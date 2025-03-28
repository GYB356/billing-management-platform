/**
 * Audit middleware factory functions for API routes
 */
import { createAuditMiddleware } from "../events";
import { auth } from "../auth";

/**
 * Creates an audit middleware for subscription routes
 */
export const createSubscriptionAuditMiddleware = () => {
  return createAuditMiddleware({
    resourceType: "SUBSCRIPTION",
    
    // Extract the resource ID from the request
    getResourceId: async (req: Request) => {
      try {
        // For POST/PUT/DELETE operations we need to extract from the session
        const session = await auth();
        if (!session?.user?.email) return "unknown";
        
        // Try to get the subscription for the user
        const url = new URL(req.url);
        
        // If there's a subscription ID in the URL, use that
        const pathParts = url.pathname.split('/');
        const subscriptionIdFromPath = pathParts[pathParts.length - 1];
        if (subscriptionIdFromPath && subscriptionIdFromPath !== "subscription") {
          return subscriptionIdFromPath;
        }
        
        // Otherwise try to get it from the database
        const response = await fetch(`${url.origin}/api/subscription`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            // Pass along auth cookies/headers
            ...Object.fromEntries(req.headers)
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.subscription?.subscription_id) {
            return data.subscription.subscription_id;
          }
        }
        
        // For POST requests (new subscriptions), get the plan ID from request body
        if (req.method === "POST") {
          const clone = req.clone();
          const body = await clone.json();
          return body.priceId || "new-subscription";
        }
        
        return "unknown-subscription";
      } catch (error) {
        console.error("Error getting subscription ID:", error);
        return "error-subscription";
      }
    },
    
    // Map HTTP methods to appropriate event types
    getEventType: (req: Request, method: string) => {
      switch (method) {
        case "GET":
          return "SUBSCRIPTION_VIEWED";
        case "POST":
          return "SUBSCRIPTION_CREATED";
        case "PUT":
        case "PATCH":
          return "SUBSCRIPTION_UPDATED";
        case "DELETE":
          return "SUBSCRIPTION_CANCELLED";
        default:
          return `SUBSCRIPTION_${method}`;
      }
    },
    
    // Extract metadata from the request
    getMetadata: async (req: Request) => {
      const metadata: Record<string, any> = {
        url: req.url,
        method: req.method,
      };
      
      // For POST/PUT/PATCH, include request body details
      if (["POST", "PUT", "PATCH"].includes(req.method || "")) {
        try {
          const clone = req.clone();
          const body = await clone.json();
          
          // Include plan details if available, exclude sensitive info
          if (body.priceId) {
            metadata.planId = body.priceId;
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
      }
      
      return metadata;
    },
    
    // Extract organization ID if possible
    getOrganizationId: async () => {
      const session = await auth();
      return session?.user?.organizationId || null;
    },
    
    // Extract user ID if possible
    getUserId: async () => {
      const session = await auth();
      return session?.user?.id || null;
    },
    
    // Determine severity based on the operation
    getSeverity: (req: Request, method: string) => {
      if (method === "DELETE") {
        return "WARNING"; // Cancellations are important to track
      } else if (method === "POST") {
        return "INFO"; // New subscriptions are notable events
      } else {
        return "INFO"; // Default for other operations
      }
    }
  });
};

/**
 * Creates an audit middleware for payment method routes
 */
export const createPaymentMethodAuditMiddleware = () => {
  return createAuditMiddleware({
    resourceType: "PAYMENT_METHOD",
    
    // Extract the resource ID from the request
    getResourceId: async (req: Request) => {
      try {
        const url = new URL(req.url);
        
        // Check if there's a payment method ID in the path
        const pathParts = url.pathname.split('/');
        const paymentMethodId = pathParts[pathParts.length - 1];
        if (paymentMethodId && paymentMethodId !== "payment-method" && paymentMethodId !== "payment-methods") {
          return paymentMethodId;
        }
        
        // For POST requests, try to get from body
        if (req.method === "POST") {
          const clone = req.clone();
          const body = await clone.json();
          return body.paymentMethodId || "new-payment-method";
        }
        
        return "unknown-payment-method";
      } catch (error) {
        console.error("Error getting payment method ID:", error);
        return "error-payment-method";
      }
    },
    
    // Map HTTP methods to appropriate event types
    getEventType: (req: Request, method: string) => {
      switch (method) {
        case "GET":
          return "PAYMENT_METHOD_VIEWED";
        case "POST":
          return "PAYMENT_METHOD_ADDED";
        case "DELETE":
          return "PAYMENT_METHOD_REMOVED";
        default:
          return `PAYMENT_METHOD_${method}`;
      }
    },
    
    // Extract metadata from the request
    getMetadata: async (req: Request) => {
      const metadata: Record<string, any> = {
        url: req.url,
        method: req.method,
      };
      
      // Don't log sensitive payment details
      return metadata;
    },
    
    // Extract user ID if possible
    getUserId: async () => {
      const session = await auth();
      return session?.user?.id || null;
    },
    
    // Determine severity based on the operation
    getSeverity: (req: Request, method: string) => {
      if (method === "DELETE") {
        return "WARNING"; // Removing payment methods is important
      } else {
        return "INFO"; // Default for other operations
      }
    }
  });
};

/**
 * Creates an audit middleware for general user account operations
 */
export const createUserAccountAuditMiddleware = () => {
  return createAuditMiddleware({
    resourceType: "USER_ACCOUNT",
    
    // Extract the user ID from the request
    getResourceId: async (req: Request) => {
      const session = await auth();
      return session?.user?.id || "unknown-user";
    },
    
    // Map HTTP methods to appropriate event types
    getEventType: (req: Request, method: string) => {
      const url = new URL(req.url);
      const path = url.pathname.toLowerCase();
      
      if (path.includes("password")) {
        return "PASSWORD_CHANGED";
      } else if (path.includes("profile")) {
        return method === "GET" ? "PROFILE_VIEWED" : "PROFILE_UPDATED";
      } else if (path.includes("settings")) {
        return "SETTINGS_UPDATED";
      } else if (path.includes("delete-account")) {
        return "ACCOUNT_DELETED";
      }
      
      return `ACCOUNT_${method}`;
    },
    
    // Extract metadata from the request but exclude sensitive data
    getMetadata: async (req: Request) => {
      const metadata: Record<string, any> = {
        url: req.url,
        method: req.method,
      };
      
      // Don't include passwords or sensitive data
      if (["POST", "PUT", "PATCH"].includes(req.method || "")) {
        try {
          const clone = req.clone();
          const body = await clone.json();
          
          // Only include safe fields, exclude passwords etc.
          const safeFields = ["name", "email", "phone", "settings", "preferences"];
          const safeData: Record<string, any> = {};
          
          for (const field of safeFields) {
            if (body[field] !== undefined) {
              safeData[field] = body[field];
            }
          }
          
          metadata.changedFields = Object.keys(safeData);
        } catch (e) {
          // Ignore JSON parsing errors
        }
      }
      
      return metadata;
    },
    
    // Extract user ID if possible
    getUserId: async () => {
      const session = await auth();
      return session?.user?.id || null;
    },
    
    // Determine severity based on the operation
    getSeverity: (req: Request, method: string) => {
      const url = new URL(req.url);
      const path = url.pathname.toLowerCase();
      
      if (path.includes("delete-account")) {
        return "WARNING"; // Account deletion is important
      } else if (path.includes("password")) {
        return "WARNING"; // Password changes are security-relevant
      } else {
        return "INFO"; // Default for other operations
      }
    }
  });
}; 