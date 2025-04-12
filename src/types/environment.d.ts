declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT?: string;
      DATABASE_URL: string;
      OPENAI_API_KEY: string;
      JWT_SECRET: string;
      SMTP_HOST: string;
      SMTP_PORT: string;
      SMTP_USER: string;
      SMTP_PASSWORD: string;
      EMAIL_FROM: string;
      ADMIN_EMAIL: string;
      ALLOWED_ORIGINS?: string;
      LOG_LEVEL?: string;
    }
  }
} 