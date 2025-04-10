'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UsageAnalyticsDashboard } from '@/components/usage/UsageAnalyticsDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';

interface PageProps {
  params: {
    id: string;
  };
}

export default function UsagePage({ params }: PageProps) {
  const router = useRouter();
  const [subscription, setSubscription] = useState<any>(null);
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/subscriptions/${params.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch subscription data');
        }

        const data = await response.json();
        setSubscription(data.subscription);
        setFeatures(data.features);
      } catch (error) {
        console.error('Error fetching subscription data:', error);
        router.push('/subscriptions');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!subscription) {
    return null;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Usage Analytics</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscription #{params.id}</CardTitle>
        </CardHeader>
        <CardContent>
          <UsageAnalyticsDashboard
            subscriptionId={params.id}
            features={features}
          />
        </CardContent>
      </Card>
    </div>
  );
} 