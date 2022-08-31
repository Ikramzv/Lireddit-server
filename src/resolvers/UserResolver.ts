import { compare, hash } from 'bcrypt';
import { Arg, Ctx, Field, FieldResolver, InputType, Mutation, ObjectType, Query, Resolver, Root } from "type-graphql";
import { v4 } from "uuid";
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from "../constants";
import { User } from "../entities/User";
import { MyContext } from "../types";
import { sendMail } from "../utils/sendEmail";
import { validateRegister } from "../utils/validateRegister";

/* 
    req.session.userId = user.id
    1 )
    assume that { userId: 1 } and it is sent to redis
    2 )
    It will display this as sess:dsawiqjqdasasfasf in Redis and that will map to your object  => { userId: 1 }
    express-session will set a cookie on the browser dsawiqjqdasasfasf
    3 )
    when user makes a request => sen to the server dsawiqjqdasasfasf
    4 ) 
    And on the server this value ( dsawiqjqdasasfasf ) is decrypted via session secret  and it turns to sess:dsawiqjqdasasfasf
    5 )
     And when we give the sess:dsawiqjqdasasfasf to Redis , Redis give us the value of sess:dsawiqjqdasasfasf which is { userId : 1 }
*/

@InputType()
export class UsernamePasswordInput {
    @Field(() => String!)
    email: string
    @Field(() => String!)
    username: string
    @Field(() => String)
    password: string
}

@ObjectType()
class FieldError {
    @Field(() => String)
    field: string
    @Field(() => String)
    message: string
}

@ObjectType()
class UserResponse {
    @Field(() =>[FieldError] , { nullable: true })
    errors?: FieldError[]
    @Field(() => User , { nullable: true })
    user?: User
}

@Resolver(() => User)
export class UserResolver {

    @FieldResolver(() => String)
    email(
        @Root() user: User,
        @Ctx() { req } : MyContext
    ) {
        if(req.session.userId === user.id) {
            return user.email
        }

        return ""
    }

    @Query(() => User , {nullable: true})
    async me(
        @Ctx() { req } : MyContext
    ): Promise<User> {
        // you are not logged in
        if(!req.session.userId) {
            return null
        }

        const user = await User.query(`
            SELECT u.* FROM public.user u WHERE u.id = $1
        ` , [req.session.userId])
        return user[0]
    }

    @Mutation(() => UserResponse)
    async register(
        @Arg('options' , () => UsernamePasswordInput) options: UsernamePasswordInput,
        @Ctx() { req } : MyContext
    ): Promise<UserResponse> {
        const hashedPassword = await hash(options.password , 12)
        let user : User;
        const errors = validateRegister(options)
        if(errors) {
            return { errors }
        }
        try {
            const result = await User.createQueryBuilder().insert().values({
                username: options.username,
                password: hashedPassword,
                email: options.email,
                id: v4()
            }).returning('*').execute()
            user = result.raw[0]
            console.log('====RESULT====' ,result)
        } catch (error) {
            // duplicated username
            if(error.detail.indexOf('already exists') > -1){
                return {
                    errors: [{
                        field: 'usernameOrEmail',
                        message: `Username has already taken`
                    }]
                }
            }
        }

        // when user registers set userId to cookie
        req.session.userId = user.id
            
        return {
            user
        }
    }


    @Mutation(() => UserResponse) 
    async login(
        @Arg('usernameOrEmail' , () => String) usernameOrEmail: string ,
        @Arg('password' , () => String) password: string ,
        @Ctx() { req } : MyContext
    ) : Promise<UserResponse> {
        const user = await User.findOneBy(usernameOrEmail.includes('@') ? {email: usernameOrEmail} : {username: usernameOrEmail})
        if (!user) {
            return {
                errors: [{
                    field: 'usernameOrEmail' ,
                    message: "that username doesn't exist"
                },
            ]
            }
        }
        const isValid = await compare(password , user.password);
        if(!isValid) {
            return {
                errors: [
                    {
                        field: 'password',
                        message: 'incorrect password',
                    }
                ]
            }
        }
        
        // When logged in set user id to cookie
        req.session.userId = user.id
        console.log('session user id : ' +  req.session.userId)
        console.log('session id : ' +  req.session.id)
        return {
            user
        } 
    }

    @Mutation(() => Boolean!)
    logout(
        @Ctx() { req , res } : MyContext
    ) {
        return new Promise((resolve) => req.session.destroy((err) => {
            if(err) {
                console.log(err)
                return resolve(false)
            }
            
            res.clearCookie(COOKIE_NAME)
            return resolve(true)
        }))
    }

    @Mutation(() => Boolean)
    async forgotPassword(
        @Arg('email' , () => String) email: string ,
        @Ctx() { redis } : MyContext
    ) : Promise<Boolean> {
        const user = await User.findOneBy({ email })
        if(!user) {
            return true
        }

        const token = v4()
        await redis.set(`${FORGET_PASSWORD_PREFIX}${token}` , user.id , 'EX' , 1000 * 60 * 60 * 24 * 3) // 3 days
        
        sendMail(email , `<a href="http://localhost:3000/change-password/${token}">reset password</a>`)

        return true
    }

    @Mutation(() => UserResponse)
    async changePassword(
        @Arg('token' , () => String) token: string,
        @Arg('newPassword' , () => String) newPassword: string,
        @Ctx() { redis,req } : MyContext
    ): Promise<UserResponse> {
        // if newPassword length smaller than 8 return error
        if(newPassword.length < 8) {
            return {
                errors: [{
                    field: 'newPassword',
                    message: 'Length must be greater than 8'
                }]
            }
        }
        // Get userId from redis cache
        const userId = await redis.get(`${FORGET_PASSWORD_PREFIX}${token}`)
        if(!userId) {
            return {
                errors: [{
                    field: 'token',
                    message: 'token expired'
                }]
            }
        }
        const user = await User.findOne({where:  {id: userId}})
        if(!user) {
            return {
                errors: [{
                    field: 'token',
                    message: 'user no longer exists'
                }]
            }
        }

        // hash new password then assign it old password
        const hashed = await hash(newPassword , 12)
        // update user
        await User.update({id: userId} , {password: hashed})
        console.log(user)
        // log in user after pasword has been changed
        req.session.userId = user.id
        redis.del(`${FORGET_PASSWORD_PREFIX}${token}`)
        return {
            user
        }
    }

}