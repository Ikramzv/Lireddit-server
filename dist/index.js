"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const apollo_server_core_1 = require("apollo-server-core");
const apollo_server_express_1 = require("apollo-server-express");
const connect_redis_1 = __importDefault(require("connect-redis"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const ioredis_1 = __importDefault(require("ioredis"));
const path_1 = __importDefault(require("path"));
require("reflect-metadata");
const type_graphql_1 = require("type-graphql");
const typeorm_1 = require("typeorm");
const constants_1 = require("./constants");
const Post_1 = require("./entities/Post");
const Updoot_1 = require("./entities/Updoot");
const User_1 = require("./entities/User");
const HelloResolver_1 = require("./resolvers/HelloResolver");
const PostResolver_1 = require("./resolvers/PostResolver");
const UserResolver_1 = require("./resolvers/UserResolver");
const createUpdootLoader_1 = require("./utils/createUpdootLoader");
const createUserLoader_1 = require("./utils/createUserLoader");
dotenv_1.default.config();
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    const AppDataSource = new typeorm_1.DataSource({
        type: 'postgres',
        database: process.env.DATABASE_NAME,
        username: process.env.DB_USER,
        password: process.env.PASSWORD,
        logging: true,
        synchronize: true,
        entities: [Post_1.Post, User_1.User, Updoot_1.Updoot],
        migrations: [path_1.default.join(__dirname, './migrations/*')]
    });
    console.log(process.env.DB_USER);
    yield AppDataSource.initialize();
    // await AppDataSource.runMigrations()
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)({
        origin: 'http://localhost:3000',
        credentials: true
    }));
    // app.use((req,res,next) => {
    //     res.setHeader('Access-Control-Allow-Credentials' , 'true')
    //     res.setHeader('Acces-Control-Allow-Origin' , 'http://localhost:3000')
    //     next()
    // })
    const RedisStore = (0, connect_redis_1.default)(express_session_1.default); // Connect redis to express-session
    const redis = new ioredis_1.default(process.env.REDIS_URL); // create client 
    redis.on('error', (err) => console.log('---------REDIS ERROR------', err)); // display error 
    redis.on('connect', () => console.log('-------------REDIS CONNECTION SUCCESFULLY CREATED----------')); // display connecting signal
    app.use((0, express_session_1.default)({
        name: constants_1.COOKIE_NAME,
        store: new RedisStore({ client: redis, disableTouch: true }),
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
            httpOnly: true,
            sameSite: 'lax',
            secure: false // cookie only works on https
        },
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false, // If true , Even session is empty it will stores session object in a session.
        // Set saveUninitialized to false if you want to prevent storing unnecessary empty sessions 
    }));
    const apolloServer = new apollo_server_express_1.ApolloServer({
        schema: yield (0, type_graphql_1.buildSchema)({
            resolvers: [HelloResolver_1.HelloResolver, PostResolver_1.PostResolver, UserResolver_1.UserResolver],
            validate: false,
        }),
        context: ({ req, res }) => ({ req, res, redis, AppDataSource, userLoader: (0, createUserLoader_1.createUserLoader)(), updootLoader: (0, createUpdootLoader_1.createUpdootLoader)() }),
        plugins: [
            (0, apollo_server_core_1.ApolloServerPluginLandingPageGraphQLPlayground)({
                settings: {
                    "request.credentials": "include",
                }
            }),
        ],
    });
    app.get('/', (_, res) => {
        res.send('Hello world');
    });
    yield apolloServer.start(); // apollo server starts
    apolloServer.applyMiddleware({ app, cors: false });
    app.listen(4000, () => {
        console.log('Server started on port : 4000');
    });
});
main().catch(err => {
    console.log('----------- MAIN CATCHED ERROR -----------------------');
    console.log(err);
    console.log('----------- END -----------------------');
});
