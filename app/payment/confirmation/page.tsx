import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatAmount } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Payment Confirmation",
  description: "View your payment confirmation details",
};

export default async function PaymentConfirmationPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const paymentIntentId = searchParams.payment_intent as string;
  const paymentIntentClientSecret = searchParams.payment_intent_client_secret as string;

  if (!paymentIntentId || !paymentIntentClientSecret) {
    return (
      <div className="container py-10">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Payment Error</CardTitle>
              <CardDescription>
                We couldn't find your payment information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center p-4">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
              <p className="text-center text-muted-foreground">
                The payment confirmation page requires a valid payment intent ID.
                Please try your payment again or contact support if the problem persists.
              </p>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button asChild>
                <Link href="/dashboard">Return to Dashboard</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // Fetch the payment details from the database
  const payment = await prisma.payment.findFirst({
    where: {
      paymentIntentId,
      userId: session.user.id,
    },
  });

  if (!payment) {
    return (
      <div className="container py-10">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Payment Processing</CardTitle>
              <CardDescription>
                Your payment is still being processed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center p-4">
                <AlertTriangle className="h-12 w-12 text-yellow-500" />
              </div>
              <p className="text-center text-muted-foreground">
                We're still processing your payment. This may take a few moments.
                You'll receive an email confirmation once the payment is complete.
              </p>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button asChild>
                <Link href="/dashboard">Return to Dashboard</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  const status = payment.status;
  const isSuccess = status === "succeeded";
  const isFailed = status === "failed";

  return (
    <div className="container py-10">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>
              {isSuccess
                ? "Payment Successful"
                : isFailed
                ? "Payment Failed"
                : "Payment Processing"}
            </CardTitle>
            <CardDescription>
              {isSuccess
                ? "Your payment has been processed successfully"
                : isFailed
                ? "We couldn't process your payment"
                : "Your payment is still being processed"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-4">
              {isSuccess ? (
                <CheckCircle className="h-12 w-12 text-green-500" />
              ) : isFailed ? (
                <XCircle className="h-12 w-12 text-destructive" />
              ) : (
                <AlertTriangle className="h-12 w-12 text-yellow-500" />
              )}
            </div>

            <div className="space-y-4 mt-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-medium">
                  {formatAmount(payment.amount, payment.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span
                  className={`font-medium ${
                    isSuccess
                      ? "text-green-500"
                      : isFailed
                      ? "text-destructive"
                      : "text-yellow-500"
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-medium">
                  {new Date(payment.createdAt).toLocaleDateString()}
                </span>
              </div>
              {isFailed && payment.failureReason && (
                <div className="mt-4 p-3 bg-destructive/10 rounded-md">
                  <p className="text-sm text-destructive">
                    <strong>Error:</strong> {payment.failureReason}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button asChild>
              <Link href="/dashboard">Return to Dashboard</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 