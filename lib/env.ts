import { z } from 'zod';

// Schema for environment variables to ensure type safety
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  
  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Redis (optional)
  REDIS_URL: z.string().url().optional(),
  
  // NextAuth
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url().optional(),
  
  // Email service (example: Resend)
  RESEND_API_KEY: z.string().min(1).optional(),
  
  // Application URLs
  APP_URL: z.string().url().default('http://localhost:3000'),
  
  // Cache control
  CACHE_TTL: z.coerce.number().default(60),
});

// Parse and validate environment variables
function createEnv() {
  let parsed: z.infer<typeof envSchema>;
  
  try {
    parsed = envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .filter(err => err.code === 'invalid_type' && err.received === 'undefined')
        .map(err => err.path.join('.'));
      
      throw new Error(
        `❌ Missing environment variables: ${missingVars.join(', ')}\n` +
        `Please check your .env file`
      );
    }
    
    throw error;
  }
  
  return parsed;
}

// Export validated environment variables
export const env = createEnv();

// Export helper for checking environment
export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';