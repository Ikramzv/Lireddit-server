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
exports.PostResolver = void 0;
const type_graphql_1 = require("type-graphql");
const Post_1 = require("../entities/Post");
const Updoot_1 = require("../entities/Updoot");
const User_1 = require("../entities/User");
const isAuth_1 = require("../middleware/isAuth");
let PostInput = class PostInput {
};
__decorate([
    (0, type_graphql_1.Field)(() => String),
    __metadata("design:type", String)
], PostInput.prototype, "title", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => String),
    __metadata("design:type", String)
], PostInput.prototype, "text", void 0);
PostInput = __decorate([
    (0, type_graphql_1.InputType)()
], PostInput);
let PaginatedPosts = class PaginatedPosts {
};
__decorate([
    (0, type_graphql_1.Field)(() => [Post_1.Post]),
    __metadata("design:type", Array)
], PaginatedPosts.prototype, "posts", void 0);
__decorate([
    (0, type_graphql_1.Field)(() => Boolean),
    __metadata("design:type", Boolean)
], PaginatedPosts.prototype, "hasMore", void 0);
PaginatedPosts = __decorate([
    (0, type_graphql_1.ObjectType)()
], PaginatedPosts);
let PostResolver = class PostResolver {
    textSnippet(root) {
        return root.text.slice(0, 50);
    }
    creator(root, { userLoader }) {
        return __awaiter(this, void 0, void 0, function* () {
            const loader = yield userLoader;
            return yield loader.load(root.creatorId);
        });
    }
    voteStatus(root, { updootLoader, req }) {
        return __awaiter(this, void 0, void 0, function* () {
            const updoot = yield updootLoader.load({ postId: root.id, userId: req.session.userId });
            return updoot ? updoot.value : null;
        });
    }
    posts(limit, cursor, { req, AppDataSource }) {
        return __awaiter(this, void 0, void 0, function* () {
            const realLimit = Math.min(50, limit);
            const realLimitPlusOne = realLimit + 1;
            let replacements = [realLimitPlusOne];
            if (cursor) {
                replacements.push(new Date(parseInt(cursor)));
            }
            let posts;
            yield AppDataSource.transaction((tm) => __awaiter(this, void 0, void 0, function* () {
                yield tm.query(`
                SELECT u.email, u.id , u.username FROM public.user u WHERE u.id = $1 LIMIT 1
            `, [req.session.userId]);
                posts = yield tm.query(`
                SELECT p.* FROM post p ${cursor ? `where p."createdAt" < $2` : ''}
                ORDER BY p."createdAt" DESC
                limit $1`, replacements);
            }));
            return {
                posts: posts.slice(0, realLimit),
                hasMore: posts.length === realLimitPlusOne
            };
        });
    }
    post(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const post = yield Post_1.Post.query(`
            SELECT p.* FROM post p WHERE p.id = $1 LIMIT 1
        `, [id]);
            if (!post) {
                return null;
            }
            return post[0];
        });
    }
    vote(postId, value, { req, AppDataSource }) {
        return __awaiter(this, void 0, void 0, function* () {
            const isUpdoot = value !== -1;
            const realValue = isUpdoot ? 1 : -1;
            const { userId } = req.session;
            const updoot = yield Updoot_1.Updoot.findOne({ where: { postId, userId } });
            if (updoot && updoot.value !== realValue) {
                // already voted
                yield AppDataSource.transaction((tm) => __awaiter(this, void 0, void 0, function* () {
                    yield tm.query(`
                    update updoot set value = $1 where "postId" = $2 and "userId" = $3
                `, [realValue, postId, userId]);
                    yield tm.query(`
                    update post set points = points + $1 where id = $2
                `, [2 * realValue, postId]);
                }));
            }
            else if (!updoot) {
                // never voted
                yield AppDataSource.transaction((tm) => __awaiter(this, void 0, void 0, function* () {
                    yield tm.query(`
                    INSERT INTO updoot ("userId" , "postId" , value) VALUES ($1,$2,$3)
                `, [userId, postId, realValue]);
                    yield tm.query(`
                    update post set points = points + $1 where id = $2;
                `, [realValue, postId]);
                }));
            }
            return true;
        });
    }
    updatePost(id, title, text, { req }) {
        return __awaiter(this, void 0, void 0, function* () {
            const post = yield Post_1.Post.createQueryBuilder('')
                .update()
                .set({ title, text })
                .where('id = :id and "creatorId" = :creatorId', { id, creatorId: req.session.userId })
                .returning('*').execute();
            return post.raw[0];
        });
    }
    createPost(input, { req }) {
        return __awaiter(this, void 0, void 0, function* () {
            const findEmtpyField = Object.keys(input).filter((key) => input[key] === '');
            if (findEmtpyField.length <= 0) {
                const post = yield Post_1.Post.create(Object.assign(Object.assign({}, input), { creatorId: req.session.userId })).save();
                return post;
            }
            throw new Error(`${findEmtpyField.join(' and ')} must be fulfilled`);
        });
    }
    deletePost(id, { req }) {
        return __awaiter(this, void 0, void 0, function* () {
            const post = yield Post_1.Post.findOne({ where: { id } });
            if (!post) {
                return false;
            }
            yield Post_1.Post.delete({ id, creatorId: req.session.userId });
            return true;
        });
    }
};
__decorate([
    (0, type_graphql_1.FieldResolver)(() => String),
    __param(0, (0, type_graphql_1.Root)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Post_1.Post]),
    __metadata("design:returntype", void 0)
], PostResolver.prototype, "textSnippet", null);
__decorate([
    (0, type_graphql_1.FieldResolver)(() => User_1.User),
    __param(0, (0, type_graphql_1.Root)()),
    __param(1, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Post_1.Post, Object]),
    __metadata("design:returntype", Promise)
], PostResolver.prototype, "creator", null);
__decorate([
    (0, type_graphql_1.FieldResolver)(() => type_graphql_1.Int, { nullable: true }),
    __param(0, (0, type_graphql_1.Root)()),
    __param(1, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Post_1.Post, Object]),
    __metadata("design:returntype", Promise)
], PostResolver.prototype, "voteStatus", null);
__decorate([
    (0, type_graphql_1.Query)(() => PaginatedPosts),
    __param(0, (0, type_graphql_1.Arg)('limit', () => type_graphql_1.Int)),
    __param(1, (0, type_graphql_1.Arg)('cursor', () => String, { nullable: true })),
    __param(2, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, Object]),
    __metadata("design:returntype", Promise)
], PostResolver.prototype, "posts", null);
__decorate([
    (0, type_graphql_1.Query)(() => Post_1.Post, { nullable: true }),
    __param(0, (0, type_graphql_1.Arg)('id', () => String)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PostResolver.prototype, "post", null);
__decorate([
    (0, type_graphql_1.Mutation)(() => Boolean),
    (0, type_graphql_1.UseMiddleware)(isAuth_1.isAuth),
    __param(0, (0, type_graphql_1.Arg)('postId', () => String)),
    __param(1, (0, type_graphql_1.Arg)('value', () => type_graphql_1.Int)),
    __param(2, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Object]),
    __metadata("design:returntype", Promise)
], PostResolver.prototype, "vote", null);
__decorate([
    (0, type_graphql_1.Mutation)(() => Post_1.Post, { nullable: true }),
    (0, type_graphql_1.UseMiddleware)(isAuth_1.isAuth),
    __param(0, (0, type_graphql_1.Arg)('id', () => String)),
    __param(1, (0, type_graphql_1.Arg)('title', () => String)),
    __param(2, (0, type_graphql_1.Arg)('text', () => String)),
    __param(3, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], PostResolver.prototype, "updatePost", null);
__decorate([
    (0, type_graphql_1.Mutation)(() => Post_1.Post),
    (0, type_graphql_1.UseMiddleware)(isAuth_1.isAuth),
    __param(0, (0, type_graphql_1.Arg)('input', () => PostInput)),
    __param(1, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PostInput, Object]),
    __metadata("design:returntype", Promise)
], PostResolver.prototype, "createPost", null);
__decorate([
    (0, type_graphql_1.Mutation)(() => Boolean),
    (0, type_graphql_1.UseMiddleware)(isAuth_1.isAuth),
    __param(0, (0, type_graphql_1.Arg)('id', () => String)),
    __param(1, (0, type_graphql_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PostResolver.prototype, "deletePost", null);
PostResolver = __decorate([
    (0, type_graphql_1.Resolver)(() => Post_1.Post)
], PostResolver);
exports.PostResolver = PostResolver;
