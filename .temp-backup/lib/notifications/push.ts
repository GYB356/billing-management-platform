/**
 * Push Notification Channel using Firebase Cloud Messaging
 */
import { credential } from "firebase-admin";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createEvent, EventSeverity } from "../events";
import { prisma } from "../prisma";

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

/**
 * Send a push notification to a specific user
 */
export async function sendPushNotification({
  userId,
  title,
  body,
  data = {},
  organizationId,
  metadata = {},
}: {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  organizationId?: string;
  metadata?: Record<string, any>;
}) {
  try {
    // Find all device tokens for the user
    const deviceTokens = await prisma.deviceToken.findMany({
      where: {
        userId,
        NOT: { pushSubscription: null },
      },
    });

    if (!deviceTokens.length) {
      console.log(`No device tokens found for user ${userId}`);
      return {
        success: false,
        error: "No device tokens found",
      };
    }

    // Track successful and failed deliveries
    const results = {
      success: 0,
      failure: 0,
      tokens: [] as string[],
    };

    // Send to web push subscriptions
    const webResults = await Promise.all(
      deviceTokens
        .filter((token) => token.platform === "web")
        .map(async (token) => {
          try {
            if (!token.pushSubscription) return { success: false };

            const message = {
              notification: {
                title,
                body,
              },
              webpush: {
                notification: {
                  icon: "/icons/icon-192x192.png",
                  ...data,
                },
                fcmOptions: {
                  link: data.url || "/dashboard",
                },
              },
              token: token.token,
            };

            const response = await getMessaging().send(message);
            results.success++;
            results.tokens.push(token.token);
            return { success: true, messageId: response };
          } catch (error) {
            results.failure++;
            return { success: false, error };
          }
        })
    );

    // Send to mobile device tokens (FCM)
    const mobileResults = await Promise.all(
      deviceTokens
        .filter((token) => token.platform === "ios" || token.platform === "android")
        .map(async (token) => {
          try {
            const message = {
              notification: {
                title,
                body,
              },
              data: {
                ...data,
                click_action: "FLUTTER_NOTIFICATION_CLICK",
              },
              token: token.token,
            };

            const response = await getMessaging().send(message);
            results.success++;
            results.tokens.push(token.token);
            return { success: true, messageId: response };
          } catch (error) {
            results.failure++;
            return { success: false, error };
          }
        })
    );

    // Log the push notification event
    await createEvent({
      userId,
      organizationId,
      eventType: "PUSH_NOTIFICATION_SENT",
      resourceType: "NOTIFICATION",
      resourceId: userId,
      severity: EventSeverity.INFO,
      metadata: {
        title,
        body,
        data,
        successCount: results.success,
        failureCount: results.failure,
        ...metadata,
      },
    });

    return {
      success: results.success > 0,
      results: {
        ...results,
        web: webResults,
        mobile: mobileResults,
      },
    };
  } catch (error: any) {
    // Log the push notification failure
    await createEvent({
      userId,
      organizationId,
      eventType: "PUSH_NOTIFICATION_FAILED",
      resourceType: "NOTIFICATION",
      resourceId: userId,
      severity: EventSeverity.ERROR,
      metadata: {
        title,
        body,
        data,
        error: error.message,
        ...metadata,
      },
    });

    console.error("Error sending push notification:", error);

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send a push notification to a topic 
 * (for notifications targeted to groups of users)
 */
export async function sendPushNotificationToTopic({
  topic,
  title,
  body,
  data = {},
  organizationId,
  metadata = {},
}: {
  topic: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  organizationId?: string;
  metadata?: Record<string, any>;
}) {
  try {
    // Format the topic name (FCM topics must match /^[a-zA-Z0-9-_.~%]+$/)
    const formattedTopic = topic.replace(/[^a-zA-Z0-9-_.~%]/g, "_");

    // Create message
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
      },
      topic: formattedTopic,
    };

    // Send the message
    const response = await getMessaging().send(message);

    // Log the push notification event
    await createEvent({
      organizationId,
      eventType: "PUSH_NOTIFICATION_TOPIC_SENT",
      resourceType: "NOTIFICATION",
      resourceId: formattedTopic,
      severity: EventSeverity.INFO,
      metadata: {
        topic: formattedTopic,
        title,
        body,
        data,
        messageId: response,
        ...metadata,
      },
    });

    return {
      success: true,
      messageId: response,
    };
  } catch (error: any) {
    // Log the push notification failure
    await createEvent({
      organizationId,
      eventType: "PUSH_NOTIFICATION_TOPIC_FAILED",
      resourceType: "NOTIFICATION",
      resourceId: topic,
      severity: EventSeverity.ERROR,
      metadata: {
        topic,
        title,
        body,
        data,
        error: error.message,
        ...metadata,
      },
    });

    console.error("Error sending push notification to topic:", error);

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Subscribe a user's devices to a topic
 */
export async function subscribeToTopic({
  userId,
  topic,
}: {
  userId: string;
  topic: string;
}) {
  try {
    // Find all device tokens for the user
    const deviceTokens = await prisma.deviceToken.findMany({
      where: {
        userId,
      },
    });

    if (!deviceTokens.length) {
      return {
        success: false,
        error: "No device tokens found",
      };
    }

    // Format the topic name
    const formattedTopic = topic.replace(/[^a-zA-Z0-9-_.~%]/g, "_");

    // Extract tokens
    const tokens = deviceTokens.map((token) => token.token);

    // Subscribe to the topic
    const response = await getMessaging().subscribeToTopic(tokens, formattedTopic);

    return {
      success: true,
      results: response,
    };
  } catch (error: any) {
    console.error("Error subscribing to topic:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Unsubscribe a user's devices from a topic
 */
export async function unsubscribeFromTopic({
  userId,
  topic,
}: {
  userId: string;
  topic: string;
}) {
  try {
    // Find all device tokens for the user
    const deviceTokens = await prisma.deviceToken.findMany({
      where: {
        userId,
      },
    });

    if (!deviceTokens.length) {
      return {
        success: false,
        error: "No device tokens found",
      };
    }

    // Format the topic name
    const formattedTopic = topic.replace(/[^a-zA-Z0-9-_.~%]/g, "_");

    // Extract tokens
    const tokens = deviceTokens.map((token) => token.token);

    // Unsubscribe from the topic
    const response = await getMessaging().unsubscribeFromTopic(tokens, formattedTopic);

    return {
      success: true,
      results: response,
    };
  } catch (error: any) {
    console.error("Error unsubscribing from topic:", error);
    return {
      success: false,
      error: error.message,
    };
  }
} 