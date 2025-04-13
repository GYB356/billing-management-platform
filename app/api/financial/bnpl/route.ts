import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { FinBox } from 'finbox-js';
import { RutterClient } from 'rutter-sdk';
import { prisma } from '@/lib/prisma';

// Initialize BNPL providers
const finbox = new FinBox({
  apiKey: process.env.FINBOX_API_KEY!,
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
});

const rutter = new RutterClient({
  clientId: process.env.RUTTER_CLIENT_ID!,
  secretKey: process.env.RUTTER_SECRET_KEY!
});

export async function POST(req: Request) {
  try {
    const { amount, currency, provider, customerId } = await req.json();

    // Validate request
    if (!amount || !currency || !provider || !customerId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    let financingOffer;
    switch (provider) {
      case 'stripe_capital':
        // Check Stripe Capital eligibility
        const account = await stripe.accounts.retrieve(customerId);
        if (!account.capabilities?.['capital_enabled']) {
          return NextResponse.json(
            { error: 'Not eligible for Stripe Capital' },
            { status: 400 }
          );
        }

        financingOffer = await stripe.capital.financingOffers.create({
          account: customerId,
          amount,
          currency
        });
        break;

      case 'finbox':
        // Check FinBox eligibility and create offer
        const finboxEligibility = await finbox.checkEligibility({
          customerId,
          amount,
          currency
        });

        if (!finboxEligibility.eligible) {
          return NextResponse.json(
            { error: 'Not eligible for FinBox financing' },
            { status: 400 }
          );
        }

        financingOffer = await finbox.createFinancingOffer({
          customerId,
          amount,
          currency,
          terms: {
            duration: 12, // 12 months
            interestRate: 0.1 // 10% APR
          }
        });
        break;

      case 'rutter':
        // Check Rutter eligibility and create offer
        const rutterEligibility = await rutter.checkEligibility({
          customerId,
          amount,
          currency
        });

        if (!rutterEligibility.eligible) {
          return NextResponse.json(
            { error: 'Not eligible for Rutter financing' },
            { status: 400 }
          );
        }

        financingOffer = await rutter.createFinancingOffer({
          customerId,
          amount,
          currency,
          paymentSchedule: {
            frequency: 'monthly',
            duration: 6 // 6 months
          }
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid BNPL provider' },
          { status: 400 }
        );
    }

    // Store financing offer in database
    const storedOffer = await prisma.financingOffer.create({
      data: {
        amount,
        currency,
        provider,
        customerId,
        status: 'pending',
        offerId: financingOffer.id,
        terms: financingOffer.terms,
        metadata: {
          provider_response: financingOffer
        }
      }
    });

    return NextResponse.json({
      offer: {
        id: storedOffer.id,
        amount,
        currency,
        provider,
        terms: financingOffer.terms,
        acceptanceUrl: financingOffer.acceptanceUrl
      }
    });
  } catch (error) {
    console.error('Error processing BNPL request:', error);
    return NextResponse.json(
      { error: 'Failed to process financing request' },
      { status: 500 }
    );
  }
} 