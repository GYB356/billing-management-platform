import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { stripe, formatAmount } from "@/lib/stripe";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Payment Example",
  description: "An example of secure payment processing",
};

export default async function PaymentExamplePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/payment/example");
  }

  // Fetch user's payment methods
  const paymentMethods = await stripe.paymentMethods.list({
    customer: session.user.stripeCustomerId,
    type: "card",
  });

  // Get available plans
  const prices = await stripe.prices.list({
    active: true,
    limit: 4,
    expand: ["data.product"],
  });

  return (
    <div className="container py-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Payment Examples</h1>
        
        <div className="grid gap-6 md:grid-cols-2">
          {/* One-time Payment Card */}
          <Card>
            <CardHeader>
              <CardTitle>One-time Payment</CardTitle>
              <CardDescription>
                Process a single payment securely
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                This example demonstrates a simple one-time payment flow using Stripe Elements.
              </p>
              <div className="text-lg font-medium">
                {formatAmount(2500, "usd")}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                For demonstration purposes only
              </p>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <Link href="/payment/one-time">
                  Make One-time Payment
                </Link>
              </Button>
            </CardFooter>
          </Card>

          {/* Subscription Payment Card */}
          <Card>
            <CardHeader>
              <CardTitle>Subscription Payment</CardTitle>
              <CardDescription>
                Start a recurring subscription
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                This example shows how to set up a subscription using Stripe Checkout.
              </p>
              <div className="space-y-2">
                {prices.data.slice(0, 2).map((price) => (
                  <div key={price.id} className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{(price.product as Stripe.Product).name}</span>
                      <span className="text-sm text-muted-foreground block">
                        {price.recurring ? `${price.recurring.interval_count} ${price.recurring.interval}` : "One time"}
                      </span>
                    </div>
                    <div className="font-medium">
                      {formatAmount(price.unit_amount || 0, price.currency)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <Link href="/payment/subscription">
                  Start Subscription
                </Link>
              </Button>
            </CardFooter>
          </Card>

          {/* Payment Methods Card */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>
                {paymentMethods.data.length > 0 
                  ? `You have ${paymentMethods.data.length} saved payment method(s)` 
                  : "You don't have any saved payment methods"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {paymentMethods.data.length > 0 ? (
                  paymentMethods.data.map((method) => (
                    <div key={method.id} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-10 h-6 mr-3 flex items-center justify-center bg-slate-800 rounded">
                          {method.card?.brand === "visa" ? (
                            <span className="text-white text-xs">VISA</span>
                          ) : method.card?.brand === "mastercard" ? (
                            <span className="text-white text-xs">MC</span>
                          ) : (
                            <span className="text-white text-xs">{method.card?.brand}</span>
                          )}
                        </div>
                        <span>•••• {method.card?.last4}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Expires {method.card?.exp_month}/{method.card?.exp_year}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">
                    Add a payment method to speed up future payments
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full" variant="outline">
                <Link href="/payment/methods">
                  Manage Payment Methods
                </Link>
              </Button>
            </CardFooter>
          </Card>

          {/* Payment History Card */}
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>
                View your recent transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Access your complete payment history and download receipts
              </p>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full" variant="outline">
                <Link href="/payment/history">
                  View Payment History
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
} 