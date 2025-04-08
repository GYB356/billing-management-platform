import { prisma } from "@/lib/db";
import { WebhookSubscription } from "@prisma/client";
import axios, { AxiosError } from "axios";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

interface WebhookPayload {
  event: string;
  timestamp: number;
  data: any;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendWebhookWithRetry(
  target: WebhookSubscription,
  payload: WebhookPayload,
  attempt = 1
): Promise<boolean> {
  try {
    const response = await axios.post(target.url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': payload.event,
        'X-Webhook-Timestamp': payload.timestamp.toString(),
        ...(target.headers as Record<string, string> || {})
      },
      timeout: 10000 // 10 second timeout
    });

    if (response.status >= 200 && response.status < 300) {
      console.log(`Successfully sent webhook to ${target.url} for event ${payload.event}`);
      return true;
    }

    throw new Error(`Received status code ${response.status}`);
  } catch (error) {
    const isAxiosError = error instanceof AxiosError;
    const statusCode = isAxiosError ? error.response?.status : undefined;
    
    // Don't retry on certain status codes
    if (statusCode && [400, 401, 403, 404, 410].includes(statusCode)) {
      console.error(
        `Webhook to ${target.url} failed with status ${statusCode}. Will not retry.`,
        error
      );
      return false;
    }

    if (attempt < MAX_RETRIES) {
      console.warn(
        `Webhook to ${target.url} failed (attempt ${attempt}/${MAX_RETRIES}). Retrying...`,
        error
      );
      await sleep(RETRY_DELAY * attempt);
      return sendWebhookWithRetry(target, payload, attempt + 1);
    }

    console.error(
      `Webhook to ${target.url} failed after ${MAX_RETRIES} attempts`,
      error
    );
    return false;
  }
}

export async function triggerWebhooks(event: string, data: any): Promise<void> {
  const targets = await prisma.webhookSubscription.findMany({
    where: { 
      event,
      active: true 
    }
  });

  if (targets.length === 0) {
    console.log(`No active webhook subscriptions found for event: ${event}`);
    return;
  }

  const payload: WebhookPayload = {
    event,
    timestamp: Date.now(),
    data
  };

  const results = await Promise.allSettled(
    targets.map(target => sendWebhookWithRetry(target, payload))
  );

  // Log summary of webhook dispatch results
  const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
  const failed = targets.length - successful;

  console.log(`Webhook dispatch summary for ${event}:`, {
    total: targets.length,
    successful,
    failed
  });
} 