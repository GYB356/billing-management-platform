import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StripeCryptoService } from "@/app/billing/features/crypto/stripe-crypto-service";
import { defaultCryptoConfig } from "@/app/billing/features/crypto/config";

const cryptoService = new StripeCryptoService(defaultCryptoConfig);

export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const userOrg = await prisma.userOrganization.findFirst({
      where: {
        userId: session.user.id,
      },
      include: {
        organization: true,
      },
    });

    if (!userOrg?.organization?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No organization or Stripe customer found" },
        { status: 404 }
      );
    }

    // Get request data
    const { amount, currency = "usdc" } = await req.json();

    // Validate amount
    if (!amount || amount < 50) {
      return NextResponse.json(
        { error: "Invalid amount. Minimum amount is 50 cents." },
        { status: 400 }
      );
    }

    // Create crypto payment intent
    const paymentIntent = await cryptoService.createCryptoPaymentIntent({
      amount,
      currency,
      customerId: userOrg.organization.stripeCustomerId,
      organizationId: userOrg.organizationId,
    });

    // Return the client secret
    return NextResponse.json({
      clientSecret: paymentIntent.clientSecret,
      id: paymentIntent.id,
    });
  } catch (error: any) {
    console.error("Error creating crypto payment intent:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create payment intent" },
      { status: error.status || 500 }
    );
  }
} 