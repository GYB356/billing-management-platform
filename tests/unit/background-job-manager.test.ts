import { BackgroundJobManager } from '@/lib/background-jobs/background-job-manager';
import { BackgroundJob } from '@/lib/background-jobs/background-job';

describe('BackgroundJobManager', () => {
  let jobManager: BackgroundJobManager;
  let mockJobProcess: jest.Mock;

  beforeEach(() => {
    jobManager = new BackgroundJobManager();
    mockJobProcess = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jobManager.stop();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should add a job to the queue', () => {
    const job = BackgroundJob.create('testJob', {}, mockJobProcess);
    jobManager.addJob(job);
    expect(jobManager.getQueueLength()).toBe(1);
  });

  it('should process jobs in the queue', async () => {
    const job1 = BackgroundJob.create('testJob1', { id: 1 }, mockJobProcess);
    const job2 = BackgroundJob.create('testJob2', { id: 2 }, mockJobProcess);
    jobManager.addJob(job1);
    jobManager.addJob(job2);
    await jobManager.processJobs();
    expect(mockJobProcess).toHaveBeenCalledTimes(2);
    expect(mockJobProcess).toHaveBeenCalledWith({ id: 1 });
    expect(mockJobProcess).toHaveBeenCalledWith({ id: 2 });
    expect(jobManager.getQueueLength()).toBe(0);
  });

  it('should start job processing', async () => {
    jest.useFakeTimers();
    const job = BackgroundJob.create('testJob', {}, mockJobProcess);
    jobManager.addJob(job);
    jobManager.start();
    jest.advanceTimersByTime(11000);
    expect(mockJobProcess).toHaveBeenCalledTimes(1);
  });

  it('should handle errors during job processing', async () => {
    const error = new Error('Job failed');
    const failingJobProcess = jest.fn().mockRejectedValue(error);
    const job = BackgroundJob.create('failingJob', {}, failingJobProcess);
    jobManager.addJob(job);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    await jobManager.processJobs();
    expect(failingJobProcess).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Error processing job: failingJob', error);
    consoleSpy.mockRestore();
  });
});