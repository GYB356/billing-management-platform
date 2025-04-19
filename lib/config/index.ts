enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

class Config {
  public readonly STRIPE_SECRET_KEY: string;
    public readonly DATABASE_URL: string;
  public readonly NEXTAUTH_SECRET: string;
  public readonly NEXTAUTH_URL: string;
  public readonly NODE_ENV: string;
  public readonly REDIS_URL?: string;
  public readonly WEBHOOK_SECRET: string;
  public readonly APP_URL: string;

  public readonly logLevel: LogLevel;
  private constructor() {
    this.STRIPE_SECRET_KEY = this.getEnvVar('STRIPE_SECRET_KEY');
    this.DATABASE_URL = this.getEnvVar('DATABASE_URL');
    this.NEXTAUTH_SECRET = this.getEnvVar('NEXTAUTH_SECRET');
    this.NEXTAUTH_URL = this.getEnvVar('NEXTAUTH_URL');
    this.NODE_ENV = this.getEnvVar('NODE_ENV', 'development');
    this.REDIS_URL = process.env.REDIS_URL;
    this.WEBHOOK_SECRET = this.getEnvVar('WEBHOOK_SECRET');
    this.logLevel = this.getEnvVar('LOG_LEVEL', LogLevel.INFO) as LogLevel;
    this.APP_URL = this.getEnvVar('APP_URL');
  }

  private getEnvVar(key: string, defaultValue?: string): string {
    const value = process.env[key];
    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Environment variable ${key} is not set.`);
    }
    return value;
  }

  public static getConfig(): Config {
    return new Config();
  }
}

export { LogLevel };

export default Config;