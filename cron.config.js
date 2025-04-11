// This file configures cron jobs for the application
// You can use a service like cron-job.org, Vercel Cron, or a similar service to schedule these jobs

const { processPaymentRecovery } = require('./lib/jobs/payment-recovery');

module.exports = {
  jobs: [
    {
      name: 'Usage Report Processing',
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/usage-report?key=${process.env.CRON_SECRET_KEY}`,
      schedule: '0 0 * * *', // Run daily at midnight
      timezone: 'UTC',
      enabled: true,
      description: 'Process usage records and report to Stripe for billing',
    },
    {
      name: 'Payment Recovery Processing',
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/retry-processing?key=${process.env.CRON_SECRET_KEY}`,
      schedule: '*/15 * * * *', // Run every 15 minutes
      timezone: 'UTC',
      enabled: true,
      description: 'Process payment retries and dunning management',
      options: {
        timeout: 30 * 60 * 1000, // 30 minutes timeout
        retries: 3, // Retry up to 3 times on failure
        backoff: {
          type: 'exponential',
          delay: 60000 // Start with 1 minute delay
        }
      }
    },
    // Process win-back campaign emails every hour
    {
      name: 'process-winback-emails',
      schedule: '0 * * * *',
      command: async () => {
        const { EmailService } = require('./lib/services/email-service');
        const emailService = new EmailService();
        await emailService.processWinBackEmails();
      }
    }
  ],

  // Payment recovery job - runs every hour
  paymentRecovery: {
    schedule: '0 * * * *', // Every hour
    handler: processPaymentRecovery,
    options: {
      timeout: 30 * 60 * 1000, // 30 minutes timeout
      retries: 3 // Retry up to 3 times on failure
    }
  },

  apps: [
    // Usage aggregation worker
    {
      name: 'usage-aggregations',
      script: 'scripts/process-usage-aggregations.ts',
      exec_mode: 'fork',
      cron_restart: '*/15 * * * *', // Run every 15 minutes
      autorestart: false,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};

/**
 * To set up this cron job:
 * 
 * 1. Using Vercel Cron (if deployed on Vercel):
 *    Add this to your vercel.json file:
 *    {
 *      "crons": [
 *        {
 *          "path": "/api/cron/usage-report?key=YOUR_CRON_SECRET_KEY",
 *          "schedule": "0 0 * * *"
 *        }
 *      ]
 *    }
 * 
 * 2. Using an external service like cron-job.org:
 *    - Create an account on cron-job.org or similar service
 *    - Add a new cron job with the URL: https://yourdomain.com/api/cron/usage-report?key=YOUR_CRON_SECRET_KEY
 *    - Set the schedule to daily at midnight (or your preferred schedule)
 *    - Enable the job
 * 
 * 3. Make sure to set CRON_SECRET_KEY in your environment variables for security
 */