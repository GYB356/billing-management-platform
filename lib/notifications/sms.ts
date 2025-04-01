/**
 * SMS Notification Channel using Twilio
 */
import twilio from 'twilio';
import { createEvent, EventSeverity } from "../events";

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Default from phone number
const DEFAULT_FROM = process.env.TWILIO_PHONE_NUMBER || '';

/**
 * Send an SMS notification using Twilio
 */
export async function sendSMS({
  to,
  message,
  userId,
  organizationId,
  metadata = {},
}: {
  to: string;
  message: string;
  userId?: string;
  organizationId?: string;
  metadata?: Record<string, any>;
}) {
  try {
    // Make sure the phone number is in E.164 format
    const formattedNumber = formatPhoneNumber(to);
    
    // Send the SMS
    const result = await client.messages.create({
      body: message,
      from: DEFAULT_FROM,
      to: formattedNumber,
    });
    
    // Log the successful SMS
    await createEvent({
      userId,
      organizationId,
      eventType: "SMS_SENT",
      resourceType: "NOTIFICATION",
      resourceId: result.sid,
      severity: EventSeverity.INFO,
      metadata: {
        to: formattedNumber,
        twilioMessageSid: result.sid,
        status: result.status,
        ...metadata,
      },
    });
    
    return {
      success: true,
      messageId: result.sid,
      status: result.status,
    };
  } catch (error: any) {
    // Log the SMS failure
    await createEvent({
      userId,
      organizationId,
      eventType: "SMS_FAILED",
      resourceType: "NOTIFICATION",
      resourceId: "error",
      severity: EventSeverity.ERROR,
      metadata: {
        to,
        error: error.message,
        code: error.code,
        ...metadata,
      },
    });
    
    console.error("Error sending SMS:", error);
    
    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }
}

/**
 * Helper function to format phone numbers to E.164 format
 */
function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  
  // Handle US phone numbers (default if no country code)
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  }
  
  // If already has a country code (assuming it starts with +)
  if (phoneNumber.startsWith('+')) {
    return phoneNumber;
  }
  
  // Otherwise, assume it has a country code
  return `+${digitsOnly}`;
}

/**
 * Helper to check if a phone number is valid
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  // Simple validation - can be enhanced with a more robust library
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber.replace(/\s+/g, ""));
} 