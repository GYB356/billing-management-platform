import { prisma } from "@/lib/db";
import { WebhookEvent } from "@prisma/client";

export async function processPendingWebhooks() {
  const events = await prisma.webhookEvent.findMany({
    where: { processed: false },
    take: 20,
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Processing ${events.length} pending webhook events`);

  for (const event of events) {
    try {
      await processWebhookEvent(event);
      
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { processed: true }
      });

      console.log(`Successfully processed webhook event ${event.id}`);
    } catch (error) {
      console.error(`Error processing webhook event ${event.id}:`, error);
      
      // You might want to add error tracking or notification here
      // e.g., send to error monitoring service
    }
  }
}

async function processWebhookEvent(event: WebhookEvent) {
  switch (event.source) {
    case 'stripe':
      await processStripeWebhook(event);
      break;
    case 'hubspot':
      await processHubspotWebhook(event);
      break;
    default:
      throw new Error(`Unsupported webhook source: ${event.source}`);
  }
}

async function processStripeWebhook(event: WebhookEvent) {
  // Implement Stripe-specific webhook processing
  // Example:
  // const stripeEvent = event.payload as Stripe.Event;
  // switch (stripeEvent.type) {
  //   case 'payment_intent.succeeded':
  //     await handlePaymentSuccess(stripeEvent.data.object);
  //     break;
  //   // Add other Stripe event types
  // }
}

async function processHubspotWebhook(event: WebhookEvent) {
  // Implement HubSpot-specific webhook processing
  // Example:
  // const hubspotEvent = event.payload as HubspotWebhookPayload;
  // switch (hubspotEvent.subscriptionType) {
  //   case 'contact.creation':
  //     await syncContactToCRM(hubspotEvent.data);
  //     break;
  //   // Add other HubSpot event types
  // }
} 