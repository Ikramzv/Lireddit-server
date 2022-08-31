import { Request, Response } from "express";
import { Session, SessionData } from "express-session";
import { Redis } from "ioredis";
import { DataSource } from "typeorm";
import { createUpdootLoader } from "./utils/createUpdootLoader";
import { createUserLoader } from "./utils/createUserLoader";

export type MyContext = {
    req : Request & {
        session: Session & Partial<SessionData> & { userId? : any }
    } ;
    res: Response ;
    redis: Redis,
    AppDataSource: DataSource
    userLoader: ReturnType<typeof createUserLoader>
    updootLoader: ReturnType<typeof createUpdootLoader>
}
