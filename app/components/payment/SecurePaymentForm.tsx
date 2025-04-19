import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

import { retryOperation } from '@/lib/utils/retry';
// Initialize Stripe outside of component to avoid recreating on each render
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type PaymentFormProps = {
  clientSecret: string;
  onSuccess?: (paymentIntent: any) => void;
  onError?: (error: any) => void;
};

// Payment form component that uses Stripe Elements
function PaymentForm({ clientSecret, onSuccess, onError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!stripe) {
      return;
    }

    // Retrieve the "payment_intent_client_secret" query parameter
    const clientSecret = new URLSearchParams(window.location.search).get(
      "payment_intent_client_secret"
    );

    if (clientSecret) {
      // Retrieve the PaymentIntent
      stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
        switch (paymentIntent?.status) {
          case "succeeded":
            setMessage("Payment succeeded!");
            setStatus('success');
            if (onSuccess) onSuccess(paymentIntent);
            break;
          case "processing":
            setMessage("Your payment is processing.");
            setStatus('processing');
            break;
          case "requires_payment_method":
            setMessage("Your payment was not successful, please try again.");
            setStatus('error');
            if (onError) onError(new Error("Payment failed"));
            break;
          default:
            setMessage("Something went wrong.");
            setStatus('error');
            if (onError) onError(new Error("Payment failed"));
            break;
        }
      });
    }
  }, [stripe, onSuccess, onError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js hasn't yet loaded.
      return;
    }

    setIsSubmitting(true);
    setStatus('processing')
    setMessage(null)

    const paymentOperation = async () => {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // Return URL where the customer should be redirected after the PaymentIntent is confirmed.
          return_url: `${window.location.origin}/payment/confirmation`,
        },
      });
      return { error, paymentIntent }
    };

    const { error, paymentIntent } = await retryOperation(paymentOperation, 3, 1000)

    setIsProcessing(false);
    setIsSubmitting(false);

    if (error) {
      if (error.message.startsWith('Network error')) {
      },
    });

    if (error) {
      // This point will only be reached if there is an immediate error when
      // confirming the payment. Otherwise, your customer will be redirected to
      // your `return_url`.
      setMessage(error.message || "An unexpected error occurred.");
      setStatus('error');
      if (onError) onError(error);
      toast({
        title: "Payment failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      })
      setMessage(error.message || "An unexpected error occurred.");
      setStatus('error');
      if (onError) onError(error);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      setMessage("Payment succeeded!");
      setStatus('success');

      setTimeout(() => {
        setMessage(null);
        setStatus('idle')
        if(elements){
          elements.getElement('payment')!.clear();
        }
      }, 5000);

      toast({
        title: "Payment successful",
        description: "Your payment has been processed successfully.",
      });

      if (onSuccess) onSuccess(paymentIntent);
      
    } else {
      setMessage('An unexpected error occurred.');
      setStatus('error');
    }


    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <PaymentElement />
      
      {message && (
        <Alert className={`mt-4 ${status === 'error' ? 'bg-destructive/10 border-destructive' : status === 'success' ? 'bg-green-50 border-green-500' : ''}`}>
          {status === 'error' ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : status === 'success' ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : null}
          <AlertTitle>{status === 'error' ? 'Error' : status === 'success' ? 'Success' : 'Processing'}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      
      <Button 
        type="submit" 
        disabled={isSubmitting || isProcessing || !stripe || !elements} 
        className="w-full mt-6"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          "Pay now"
        )}
      </Button>
    </form>
  );
}

// Wrapper component that provides Stripe context
export default function SecurePaymentForm(props: PaymentFormProps) {
  const options = {
    clientSecret: props.clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#0f172a',
        colorBackground: '#ffffff',
        colorText: '#0f172a',
        colorDanger: '#ef4444',
        fontFamily: 'Inter, system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '4px',
      },
    },
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Secure Payment</CardTitle>
        <CardDescription>
          Your payment information is securely processed by Stripe
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Elements stripe={stripePromise} options={options}>
          <PaymentForm {...props} />
        </Elements>
      </CardContent>
      <CardFooter className="flex flex-col items-start text-xs text-muted-foreground">
        <div className="flex items-center mb-2">
          <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 8V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Your card details are never stored on our servers</span>
        </div>
        <div className="flex items-center">
          <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>All transactions are encrypted and secure</span>
        </div>
      </CardFooter>
    </Card>
  );
} 