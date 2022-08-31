import { Arg, Ctx, Field, FieldResolver, InputType, Int, Mutation, ObjectType, Query, Resolver, Root, UseMiddleware } from "type-graphql";
import { Post } from "../entities/Post";
import { Updoot } from "../entities/Updoot";
import { User } from "../entities/User";
import { isAuth } from "../middleware/isAuth";
import { MyContext } from "../types";

@InputType()
class PostInput {
    @Field(() => String)
    title!: string
    @Field(() => String)
    text!: string
}

@ObjectType()
class PaginatedPosts {
    @Field(() => [Post])
    posts: Post[]
    @Field(() => Boolean)
    hasMore: boolean
}

@Resolver(() => Post)
export class PostResolver {
    @FieldResolver(() => String)
    textSnippet(
        @Root() root: Post
    ) {
        return root.text.slice(0,50);
    }

    @FieldResolver(() => User) 
    async creator(
        @Root() root: Post,
        @Ctx() { userLoader } : MyContext
    ) {
        const loader = await userLoader
        return await loader.load(root.creatorId)
    }

    @FieldResolver(() => Int , { nullable: true })
    async voteStatus(
        @Root() root: Post,
        @Ctx() { updootLoader , req }: MyContext
    ) {
        const updoot = await updootLoader.load({ postId: root.id , userId: req.session.userId })
        return updoot ? updoot.value : null
    }

    @Query(() => PaginatedPosts)
    async posts(
        @Arg('limit' , () => Int) limit: number,
         @Arg('cursor' , () => String, { nullable: true }) cursor: string | null,
        @Ctx() { req , AppDataSource }: MyContext,
    ) : Promise<PaginatedPosts> {
        const realLimit = Math.min(50 , limit)
        const realLimitPlusOne = realLimit + 1
        let replacements: any[] = [realLimitPlusOne]
        
        if(cursor) {
            replacements.push(new Date(parseInt(cursor)))
        }
        let posts: Post[];
        await AppDataSource.transaction(async tm => {
            await tm.query(`
                SELECT u.email, u.id , u.username FROM public.user u WHERE u.id = $1 LIMIT 1
            ` , [req.session.userId])
            posts = await tm.query(`
                SELECT p.* FROM post p ${cursor ? `where p."createdAt" < $2` : ''}
                ORDER BY p."createdAt" DESC
                limit $1` , replacements)
        })
        return {
            posts: posts.slice(0,realLimit),
            hasMore: posts.length === realLimitPlusOne
        }
    }

    @Query(() => Post , { nullable: true })
    async post (
        @Arg('id' , () => String) id: string ,
    ) : Promise<Post | null> {
        const post = await Post.query(`
            SELECT p.* FROM post p WHERE p.id = $1 LIMIT 1
        ` , [id])
        if(!post) {
            return null
        }
        return post[0]
    }

    @Mutation(() => Boolean)
    @UseMiddleware(isAuth)
    async vote(
        @Arg('postId' , () => String) postId: string,
        @Arg('value' , () => Int) value: number,
        @Ctx() { req, AppDataSource } : MyContext  
    ) {
        const isUpdoot = value !== -1
        const realValue = isUpdoot ? 1 : -1
        const { userId } = req.session
        const updoot = await Updoot.findOne({ where: { postId , userId } })
        if(updoot && updoot.value !== realValue) {
            // already voted
            await AppDataSource.transaction(async tm => {
                await tm.query(`
                    update updoot set value = $1 where "postId" = $2 and "userId" = $3
                ` , [realValue , postId, userId])
                await tm.query(`
                    update post set points = points + $1 where id = $2
                ` , [2 * realValue , postId])
            })

        } else if(!updoot) {
            // never voted
            await AppDataSource.transaction(async tm => {
                await tm.query(`
                    INSERT INTO updoot ("userId" , "postId" , value) VALUES ($1,$2,$3)
                ` , [userId , postId , realValue])
                await tm.query(`
                    update post set points = points + $1 where id = $2;
                ` , [realValue , postId])
            })
        }
        return true
    }

    @Mutation(() => Post , {nullable: true})
    @UseMiddleware(isAuth)
    async updatePost(
        @Arg('id' , () => String) id : string ,
        @Arg('title' , () => String) title: string,
        @Arg('text',  () => String) text: string,
        @Ctx() { req } : MyContext
    ) : Promise<Post | undefined> {
        const post = await Post.createQueryBuilder('')
        .update()
        .set({ title, text })
        .where('id = :id and "creatorId" = :creatorId' , { id , creatorId: req.session.userId })
        .returning('*').execute()

        return post.raw[0]
    }

    @Mutation(() => Post)
    @UseMiddleware(isAuth)
    async createPost(
        @Arg('input' , () => PostInput) input : PostInput,
        @Ctx() { req } : MyContext
     ) : Promise<Post> { 
        const findEmtpyField = Object.keys(input).filter((key) => input[key] === '')    
        if(findEmtpyField.length <= 0) {
            const post = await Post.create({
                ...input,
                creatorId: req.session.userId,
            }).save()
            return post
        }

        
        throw new Error(`${findEmtpyField.join(' and ')} must be fulfilled`)
     }

     @Mutation(() => Boolean)
     @UseMiddleware(isAuth)
     async deletePost(
        @Arg('id' , () => String) id: string,
        @Ctx() { req } : MyContext
     ): Promise<boolean> {
        const post = await Post.findOne({where: {id}})
        if(!post) {
            return false
        }
        await Post.delete({id , creatorId: req.session.userId})
        return true
     }

}