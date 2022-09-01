declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SESSION_SECRET: string;
      DB_USER: string;
      PASSWORD: string;
      DATABASE_NAME: string;
      REDIS_URL: string;
    }
  }
}

export {}
