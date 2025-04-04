'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

export default function SubscriptionSuccess() {
  const router = useRouter();

  useEffect(() => {
    // You could add analytics tracking here
    const timer = setTimeout(() => {
      router.push('/dashboard');
    }, 5000); // Redirect to dashboard after 5 seconds

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              Subscription Successful!
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <p className="text-lg">
              Thank you for subscribing! Your subscription has been successfully created.
            </p>
            <p className="text-sm text-gray-500">
              You will be redirected to your dashboard in a few seconds...
            </p>
            <Button
              onClick={() => router.push('/dashboard')}
              variant="outline"
            >
              Go to Dashboard Now
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 