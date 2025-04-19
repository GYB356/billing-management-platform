import { Config, LogLevel } from "../config";

async function retryOperation<T>(
  operation: () => Promise<T>,
  retries: number,
  initialDelay: number
): Promise<T> {
  const config = Config.getConfig();
  let currentTry = 0;
  let currentDelay = initialDelay;

  while (currentTry < retries) {
    try {
      return await operation();
    } catch (error: any) {
      if (config.logLevel === LogLevel.DEBUG) {
        console.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "ERROR",
            message: `Operation failed on try ${currentTry + 1} of ${retries}`,
            component: "retryOperation",
            error: error.message
          })
        );
      }
      currentTry++;
      if (currentTry < retries) {
        console.error(`Retrying in ${currentDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
        currentDelay *= 2;
      } else {
        throw error;
      }
    }
  }
  throw new Error("Retry failed");
}

export default retryOperation;