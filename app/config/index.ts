 // Configuration values loaded from environment variables
export const config = {
    // Authentication
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || '',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || '',
    
    // Encryption
    ENCRYPTION_KEY: process.env.PAYMENT_ENCRYPTION_KEY || '',
    
    // Database
    DATABASE_URL: process.env.DATABASE_URL || '',
    
    // Payment Processors
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
    
    // Application
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3000', 10),
    
    // CORS
    ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
    
    // Security
    REQUIRE_HTTPS: process.env.REQUIRE_HTTPS === 'true',
    
    // Feature Flags
    ENABLE_NEW_TAX_CALCULATOR: process.env.ENABLE_NEW_TAX_CALCULATOR === 'true',
    ENABLE_SUBSCRIPTION_ANALYTICS: process.env.ENABLE_SUBSCRIPTION_ANALYTICS === 'true',
    
    // Check if required environment variables are set
    validate() {
      const requiredVars = [
        'JWT_ACCESS_SECRET',
        'JWT_REFRESH_SECRET',
        'PAYMENT_ENCRYPTION_KEY',
        'DATABASE_URL'
      ];
      
      const missingVars = requiredVars.filter(key => !process.env[key]);
      
      if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
      }
    }
  };