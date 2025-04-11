import { PayPalButtons } from "@paypal/react-paypal-js";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface PayPalPaymentButtonProps {
  amount: number;
  currency?: string;
  description?: string;
  invoiceId?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

export default function PayPalPaymentButton({
  amount,
  currency = "USD",
  description,
  invoiceId,
  onSuccess,
  onError
}: PayPalPaymentButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const createOrder = async () => {
    try {
      const response = await fetch('/api/payments/paypal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency,
          description,
          invoiceId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create PayPal order');
      }

      const data = await response.json();
      return data.orderId;
    } catch (error) {
      console.error('Error creating PayPal order:', error);
      toast({
        title: "Error",
        description: "Failed to create PayPal payment",
        variant: "destructive",
      });
      throw error;
    }
  };

  const onApprove = async (data: any, actions: any) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/payments/paypal/${data.orderID}/capture`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to capture PayPal payment');
      }

      const captureData = await response.json();
      
      toast({
        title: "Success",
        description: "Payment processed successfully",
      });

      onSuccess?.(captureData);
    } catch (error) {
      console.error('Error capturing PayPal payment:', error);
      toast({
        title: "Error",
        description: "Failed to process payment",
        variant: "destructive",
      });
      onError?.(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <PayPalButtons
        createOrder={createOrder}
        onApprove={onApprove}
        onError={(err) => {
          console.error('PayPal error:', err);
          toast({
            title: "Error",
            description: "PayPal payment failed",
            variant: "destructive",
          });
          onError?.(err);
        }}
        disabled={isProcessing}
        style={{ layout: "vertical" }}
      />
    </div>
  );
}