/**
 * Common utility functions shared across the application
 * @module utils/common
 */

/**
 * Type guard to check if a value is not null or undefined
 * @param value - Value to check
 * @returns True if value is not null or undefined
 */
export const isDefined = <T>(value: T | null | undefined): value is T => {
  return value !== null && value !== undefined;
};

/**
 * Safely parse JSON with error handling
 * @param value - String to parse as JSON
 * @param fallback - Optional fallback value if parsing fails
 * @returns Parsed JSON object or fallback value
 */
export const safeJsonParse = <T>(value: string, fallback: T | null = null): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

/**
 * Retry a function with exponential backoff
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retries
 * @param baseDelay - Base delay in milliseconds
 * @returns Promise that resolves with the function result
 * @throws Last error encountered after all retries
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const delay = baseDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

/**
 * Format a date to ISO string without milliseconds
 * @param date - Date to format
 * @returns Formatted date string
 */
export const formatDate = (date: Date): string => {
  return date.toISOString().split('.')[0] + 'Z';
};

/**
 * Chunk an array into smaller arrays
 * @param array - Array to chunk
 * @param size - Size of each chunk
 * @returns Array of chunks
 */
export const chunk = <T>(array: T[], size: number): T[][] => {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size)
  );
};

/**
 * Deep clone an object
 * @param obj - Object to clone
 * @returns Deep cloned object
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj) as any;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as any;
  }

  return Object.fromEntries(
    Object.entries(obj as any).map(([key, value]) => [key, deepClone(value)])
  ) as T;
};

/**
 * Remove undefined values from an object
 * @param obj - Object to clean
 * @returns Object without undefined values
 */
export const removeUndefined = <T extends object>(obj: T): Partial<T> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  ) as Partial<T>;
};

/**
 * Generate a random string
 * @param length - Length of the string
 * @returns Random string
 */
export const generateRandomString = (length: number): string => {
  return Array.from(
    { length },
    () => Math.random().toString(36)[2]
  ).join('');
};

/**
 * Debounce a function
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}; 