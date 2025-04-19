import { BackgroundJob } from './background-job';

export class BackgroundJobManager {
  private jobQueue: BackgroundJob[] = [];
  private isProcessing = false;
  private intervalId: NodeJS.Timeout | null = null;

  addJob(job: BackgroundJob): void {
    this.jobQueue.push(job);
  }

  async processJobs(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    while (this.jobQueue.length > 0) {
      const job = this.jobQueue.shift();
      if (job) {
        try {
          await job.process(job.data);
          console.log(`Job ${job.name} processed successfully.`);
        } catch (error) {
          console.error(`Error processing job ${job.name}:`, error);
        }
      }
    }

    this.isProcessing = false;
  }

  start(): void {
    if (this.intervalId) {
        clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(async () => {
      await this.processJobs();
    }, 10000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}