"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserResolver = exports.UsernamePasswordInput = void 0;
const bcrypt_1 = require("bcrypt");
const type_graphql_1 = require("type-graphql");
const uuid_1 = require("uuid");
const constants_1 = require("../constants");
const User_1 = require("../entities/User");
const sendEmail_1 = require("../utils/sendEmail");
const validateRegister_1 = require("../utils/validateRegister");
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
let UsernamePasswordInput = class UsernamePasswordInput {
};
__decorate([
    (0, type_graphql_1.Field)(() => String),
    __metadata("design:type", String)
], UsernamePasswordInput.prototype, "email", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => String),
    __metadata("design:type", String)
], UsernamePasswordInput.prototype, "username", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => String),
    __metadata("design:type", String)
], UsernamePasswordInput.prototype, "password", void 0);
UsernamePasswordInput = __decorate([
    (0, type_graphql_1.InputType)()
], UsernamePasswordInput);
exports.UsernamePasswordInput = UsernamePasswordInput;
let FieldError = class FieldError {
};
__decorate([
    (0, type_graphql_1.Field)(() => String),
    __metadata("design:type", String)
], FieldError.prototype, "field", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => String),
    __metadata("design:type", String)
], FieldError.prototype, "message", void 0);
FieldError = __decorate([
    (0, type_graphql_1.ObjectType)()
], FieldError);
let UserResponse = class UserResponse {
};
__decorate([
    (0, type_graphql_1.Field)(() => [FieldError], { nullable: true }),
    __metadata("design:type", Array)
], UserResponse.prototype, "errors", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => User_1.User, { nullable: true }),
    __metadata("design:type", User_1.User)
], UserResponse.prototype, "user", void 0);
UserResponse = __decorate([
    (0, type_graphql_1.ObjectType)()
], UserResponse);
let UserResolver = class UserResolver {
    email(user, { req }) {
        if (req.session.userId === user.id) {
            return user.email;
        }
        return "";
    }
    me({ req }) {
        return __awaiter(this, void 0, void 0, function* () {
            // you are not logged in
            if (!req.session.userId) {
                return null;
            }
            const user = yield User_1.User.query(`
            SELECT u.* FROM public.user u WHERE u.id = $1
        `, [req.session.userId]);
            return user[0];
        });
    }
    register(options, { req }) {
        return __awaiter(this, void 0, void 0, function* () {
            const hashedPassword = yield (0, bcrypt_1.hash)(options.password, 12);
            let user;
            const errors = (0, validateRegister_1.validateRegister)(options);
            if (errors) {
                return { errors };
            }
            try {
                const result = yield User_1.User.createQueryBuilder().insert().values({
                    username: options.username,
                    password: hashedPassword,
                    email: options.email,
                    id: (0, uuid_1.v4)()
                }).returning('*').execute();
                user = result.raw[0];
                console.log('====RESULT====', result);
            }
            catch (error) {
                // duplicated username
                if (error.detail.indexOf('already exists') > -1) {
                    return {
                        errors: [{
                                field: 'usernameOrEmail',
                                message: `Username has already taken`
                            }]
                    };
                }
            }
            // when user registers set userId to cookie
            req.session.userId = user.id;
            return {
                user
            };
        });
    }
    login(usernameOrEmail, password, { req }) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield User_1.User.findOneBy(usernameOrEmail.includes('@') ? { email: usernameOrEmail } : { username: usernameOrEmail });
            if (!user) {
                return {
                    errors: [{
                            field: 'usernameOrEmail',
                            message: "that username doesn't exist"
                        },
                    ]
                };
            }
            const isValid = yield (0, bcrypt_1.compare)(password, user.password);
            if (!isValid) {
                return {
                    errors: [
                        {
                            field: 'password',
                            message: 'incorrect password',
                        }
                    ]
                };
            }
            // When logged in set user id to cookie
            req.session.userId = user.id;
            console.log('session user id : ' + req.session.userId);
            console.log('session id : ' + req.session.id);
            return {
                user
            };
        });
    }
    logout({ req, res }) {
        return new Promise((resolve) => req.session.destroy((err) => {
            if (err) {
                console.log(err);
                return resolve(false);
            }
            res.clearCookie(constants_1.COOKIE_NAME);
            return resolve(true);
        }));
    }
    forgotPassword(email, { redis }) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield User_1.User.findOneBy({ email });
            if (!user) {
                return true;
            }
            const token = (0, uuid_1.v4)();
            yield redis.set(`${constants_1.FORGET_PASSWORD_PREFIX}${token}`, user.id, 'EX', 1000 * 60 * 60 * 24 * 3); // 3 days
            (0, sendEmail_1.sendMail)(email, `<a href="http://localhost:3000/change-password/${token}">reset password</a>`);
            return true;
        });
    }
    changePassword(token, newPassword, { redis, req }) {
        return __awaiter(this, void 0, void 0, function* () {
            // if newPassword length smaller than 8 return error
            if (newPassword.length < 8) {
                return {
                    errors: [{
                            field: 'newPassword',
                            message: 'Length must be greater than 8'
                        }]
                };
            }
            // Get userId from redis cache
            const userId = yield redis.get(`${constants_1.FORGET_PASSWORD_PREFIX}${token}`);
            if (!userId) {
                return {
                    errors: [{
                            field: 'token',
                            message: 'token expired'
                        }]
                };
            }
            const user = yield User_1.User.findOne({ where: { id: userId } });
            if (!user) {
                return {
                    errors: [{
                            field: 'token',
                            message: 'user no longer exists'
                        }]
                };
            }
            // hash new password then assign it old password
            const hashed = yield (0, bcrypt_1.hash)(newPassword, 12);
            // update user
            yield User_1.User.update({ id: userId }, { password: hashed });
            console.log(user);
            // log in user after pasword has been changed
            req.session.userId = user.id;
            redis.del(`${constants_1.FORGET_PASSWORD_PREFIX}${token}`);
            return {
                user
            };
        });
    }
};
__decorate([
    (0, type_graphql_1.FieldResolver)(() => String),
    __param(0, (0, type_graphql_1.Root)()),
    __param(1, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [User_1.User, Object]),
    __metadata("design:returntype", void 0)
], UserResolver.prototype, "email", null);
__decorate([
    (0, type_graphql_1.Query)(() => User_1.User, { nullable: true }),
    __param(0, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "me", null);
__decorate([
    (0, type_graphql_1.Mutation)(() => UserResponse),
    __param(0, (0, type_graphql_1.Arg)('options', () => UsernamePasswordInput)),
    __param(1, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UsernamePasswordInput, Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "register", null);
__decorate([
    (0, type_graphql_1.Mutation)(() => UserResponse),
    __param(0, (0, type_graphql_1.Arg)('usernameOrEmail', () => String)),
    __param(1, (0, type_graphql_1.Arg)('password', () => String)),
    __param(2, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "login", null);
__decorate([
    (0, type_graphql_1.Mutation)(() => Boolean),
    __param(0, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UserResolver.prototype, "logout", null);
__decorate([
    (0, type_graphql_1.Mutation)(() => Boolean),
    __param(0, (0, type_graphql_1.Arg)('email', () => String)),
    __param(1, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "forgotPassword", null);
__decorate([
    (0, type_graphql_1.Mutation)(() => UserResponse),
    __param(0, (0, type_graphql_1.Arg)('token', () => String)),
    __param(1, (0, type_graphql_1.Arg)('newPassword', () => String)),
    __param(2, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], UserResolver.prototype, "changePassword", null);
UserResolver = __decorate([
    (0, type_graphql_1.Resolver)(() => User_1.User)
], UserResolver);
exports.UserResolver = UserResolver;
