import { Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WebhookDashboard from '@/components/integrations/WebhookDashboard';
import IntegrationDashboard from '@/components/integrations/IntegrationDashboard';
import { notFound } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function IntegrationsPage({
  searchParams
}: {
  searchParams: { error?: string; success?: string }
}) {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrations & Webhooks</h1>
        <p className="text-muted-foreground mt-2">
          Manage your external connections and data synchronization
        </p>
      </div>

      {searchParams.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {decodeURIComponent(searchParams.error)}
          </AlertDescription>
        </Alert>
      )}

      {searchParams.success && (
        <Alert variant="success">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>
            {decodeURIComponent(searchParams.success)
              .split('_')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="integrations">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="integrations">
            Third-Party Integrations
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            Webhooks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="mt-6">
          <Suspense fallback={<div>Loading integrations...</div>}>
            <IntegrationDashboard />
          </Suspense>
        </TabsContent>

        <TabsContent value="webhooks" className="mt-6">
          <Suspense fallback={<div>Loading webhooks...</div>}>
            <WebhookDashboard />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}