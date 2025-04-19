import { retryOperation } from '@/lib/utils/retry';

describe('retryOperation', () => {
  it('retries the correct number of times', async () => {
    const maxRetries = 3;
    let retryCount = 0;
    const operation = async () => {
      retryCount++;
      throw new Error('Failed');
    };

    try {
      await retryOperation(operation, maxRetries, 100);
    } catch (error) {
      expect(retryCount).toBe(maxRetries + 1);
    }
  });

  it('throws an error if all retries fail', async () => {
    const maxRetries = 3;
    const operation = async () => {
      throw new Error('Failed');
    };

    await expect(retryOperation(operation, maxRetries, 100)).rejects.toThrow('Failed');
  });

  it('succeeds if one of the retries succeeds', async () => {
    const maxRetries = 3;
    let retryCount = 0;
    const operation = async () => {
      retryCount++;
      if (retryCount < 2) {
        throw new Error('Failed');
      }
      return 'Success';
    };

    const result = await retryOperation(operation, maxRetries, 100);
    expect(result).toBe('Success');
  });
});