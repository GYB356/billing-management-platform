import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/logging/audit";
import Stripe from "stripe";

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16", // Use the latest API version
});

export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { amount, currency = "usd", paymentMethodType = "card" } = await req.json();

    // Validate amount
    if (!amount || amount < 50) {
      return NextResponse.json(
        { error: "Invalid amount. Minimum amount is 50 cents." },
        { status: 400 }
      );
    }

    // Create a PaymentIntent with the specified amount
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method_types: [paymentMethodType],
      metadata: {
        userId,
        integration_check: "accept_a_payment",
      },
    });

    // Log the payment intent creation
    await logAudit({
      userId,
      action: "payment.intent_created",
      description: `Payment intent created for ${amount / 100} ${currency.toUpperCase()}`,
      metadata: {
        amount,
        currency,
        paymentIntentId: paymentIntent.id,
      },
    });

    // Return the client secret to the client
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    
    // Log the error
    if (session?.user?.id) {
      await logAudit({
        userId: session.user.id,
        action: "payment.intent_creation_failed",
        description: "Failed to create payment intent",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
    
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
} 