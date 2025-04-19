import { useState, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { 
  createSubscription, 
  cancelUserSubscription, 
  resumeUserSubscription,
  changeUserSubscriptionPlan,
  redirectToBillingPortal 
} from '@/actions/subscription';

export function useSubscription() {
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Helper to show loading state
  const withLoading = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setIsLoading(true);
    try {
      return await fn();
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Subscribe to a plan
   */
  const subscribe = useCallback(async (priceId: string, trialDays?: number) => {
    return withLoading(async () => {
      const result = await createSubscription({ priceId, trialDays });
      
      if (result.error) {
        toast.error(result.error);
        return false;
      }
      
      if (result.url) {
        router.push(result.url);
        return true;
      }
      
      return false;
    });
  }, [router]);
  
  /**
   * Cancel subscription
   */
  const cancelSubscription = useCallback((subscriptionId: string, atPeriodEnd: boolean = true) => {
    startTransition(async () => {
      const result = await cancelUserSubscription({ subscriptionId, atPeriodEnd });
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          atPeriodEnd 
            ? 'Your subscription will be canceled at the end of the billing period' 
            : 'Your subscription has been canceled'
        );
      }
    });
  }, []);
  
  /**
   * Resume subscription
   */
  const resumeSubscription = useCallback((subscriptionId: string) => {
    startTransition(async () => {
      const result = await resumeUserSubscription(subscriptionId);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Your subscription has been resumed');
      }
    });
  }, []);
  
  /**
   * Change subscription plan
   */
  const changePlan = useCallback((subscriptionId: string, newPriceId: string) => {
    startTransition(async () => {
      const result = await changeUserSubscriptionPlan({ subscriptionId, newPriceId });
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Your subscription plan has been updated');
      }
    });
  }, []);
  
  /**
   * Open billing portal
   */
  const openBillingPortal = useCallback(async () => {
    return withLoading(async () => {
      const result = await redirectToBillingPortal();
      
      if (result?.error) {
        toast.error(result.error);
        return false;
      }
      
      return true;
    });
  }, []);

  return {
    isLoading: isLoading || isPending,
    subscribe,
    cancelSubscription,
    resumeSubscription,
    changePlan,
    openBillingPortal,
  };
} 