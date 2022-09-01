import { ApolloServerPluginLandingPageGraphQLPlayground } from 'apollo-server-core'
import { ApolloServer } from 'apollo-server-express'
import connectRedis from 'connect-redis'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import session from 'express-session'
import Redis from 'ioredis'
import path from 'path'
import 'reflect-metadata'
import { buildSchema } from 'type-graphql'
import { DataSource } from 'typeorm'
import { COOKIE_NAME } from './constants'
import { Post } from './entities/Post'
import { Updoot } from './entities/Updoot'
import { User } from './entities/User'
import { HelloResolver } from './resolvers/HelloResolver'
import { PostResolver } from './resolvers/PostResolver'
import { UserResolver } from './resolvers/UserResolver'
import { MyContext } from './types'
import { createUpdootLoader } from './utils/createUpdootLoader'
import { createUserLoader } from './utils/createUserLoader'
dotenv.config()

const main =  async() => {
    const AppDataSource = new DataSource({
        type: 'postgres',
        database: process.env.DATABASE_NAME,
        username: process.env.DB_USER,
        password: process.env.PASSWORD,
        logging: true,
        synchronize: true,
        entities: [Post , User , Updoot],
        migrations: [path.join(__dirname , './migrations/*')]
    })

    console.log(process.env.DB_USER)

    await AppDataSource.initialize()
    // await AppDataSource.runMigrations()

    const app = express() 
    app.use(cors({
        origin: 'http://localhost:3000',
        credentials: true
    }))

    // app.use((req,res,next) => {
    //     res.setHeader('Access-Control-Allow-Credentials' , 'true')
    //     res.setHeader('Acces-Control-Allow-Origin' , 'http://localhost:3000')
    //     next()
    // })

    const RedisStore = connectRedis(session) // Connect redis to express-session
    const redis = new Redis(process.env.REDIS_URL) // create client 
    redis.on('error' , (err) => console.log('---------REDIS ERROR------' , err)) // display error 
    redis.on('connect' , () => console.log('-------------REDIS CONNECTION SUCCESFULLY CREATED----------' )) // display connecting signal
    
    app.use(
        session({
            name: COOKIE_NAME, // session name
            store: new RedisStore({client: redis , disableTouch: true}), // RedisStore 
            cookie: {
                maxAge: 1000 * 60 * 60 * 24 * 365 * 10 , // expires in 10 years
                httpOnly: true, // prevent accesing cookies from client side
                sameSite: 'lax',
                secure: false // cookie only works on https
            },
            secret: process.env.SESSION_SECRET, // session secret for encrypting data
            resave: false, // If true , when modification is performed on the session it will re-write the req.session
            saveUninitialized: false, // If true , Even session is empty it will stores session object in a session.
            // Set saveUninitialized to false if you want to prevent storing unnecessary empty sessions 
        })
    )

    const apolloServer = new ApolloServer({
        schema: await buildSchema({
            resolvers: [HelloResolver , PostResolver , UserResolver],
            validate: false,
        }),
        context: ({ req , res }) : MyContext => ({ req, res , redis , AppDataSource, userLoader: createUserLoader() , updootLoader: createUpdootLoader() }), // Allow to access request and response object
        plugins: [
            ApolloServerPluginLandingPageGraphQLPlayground({
                settings: {
                    "request.credentials": "include",
                }
            }),
        ],

    })
    
    app.get('/' , (_ , res) => {
        res.send('Hello world')
    })

    
    await apolloServer.start() // apollo server starts
    apolloServer.applyMiddleware({ app , cors: false })

    app.listen(4000 , () => {
        console.log('Server started on port : 4000')
    })

}

main().catch(err => {
    console.log('----------- MAIN CATCHED ERROR -----------------------')
    console.log(err)
    console.log('----------- END -----------------------')
})
