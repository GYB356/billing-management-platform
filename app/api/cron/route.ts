import { runCronJobs } from '@/lib/cron';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/response-format';

export default async function handler() {
  try {
    await runCronJobs();
    return createSuccessResponse({ message: 'Cron jobs triggered manually.' });
  } catch (error) {
    return createErrorResponse(error);
  }
}