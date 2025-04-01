// This file configures cron jobs for the application
// You can use a service like cron-job.org, Vercel Cron, or a similar service to schedule these jobs

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
    // Add more cron jobs here as needed
  ],
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