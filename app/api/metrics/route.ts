import { NextRequest } from 'next/server';
import logger from '@/lib/logger';
import os from 'os';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  
  // Create a new ReadableStream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const metrics = {
            timestamp: Date.now(),
            memory: {
              total: os.totalmem(),
              free: os.freemem(),
              usage: process.memoryUsage(),
            },
            cpu: {
              load: os.loadavg(),
              cores: os.cpus().length,
            },
            uptime: process.uptime(),
          };

          // Format the data as an SSE message
          const data = `data: ${JSON.stringify(metrics)}\n\n`;
          controller.enqueue(encoder.encode(data));

          // Wait for 1 second before sending the next update
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        logger.error('Error in metrics stream', error as Error);
        controller.close();
      }
    },
    cancel() {
      // Clean up when the client disconnects
      logger.info('Client disconnected from metrics stream');
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
} 