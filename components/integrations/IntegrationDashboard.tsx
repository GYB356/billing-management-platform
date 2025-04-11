import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Icons } from '@/components/ui/icons';
import { useState } from 'react';

interface Integration {
  type: string;
  status: 'ACTIVE' | 'DISCONNECTED';
  connectedAt: string;
  disconnectedAt?: string;
}

const INTEGRATION_CONFIGS = {
  quickbooks: {
    name: 'QuickBooks',
    description: 'Sync invoices and payments with QuickBooks',
    icon: 'quickbooks',
    features: [
      'Automatic invoice sync',
      'Payment reconciliation',
      'Customer sync'
    ]
  },
  xero: {
    name: 'Xero',
    description: 'Connect your Xero accounting system',
    icon: 'xero',
    features: [
      'Two-way invoice sync',
      'Automated reconciliation',
      'Tax reporting'
    ]
  },
  netsuite: {
    name: 'NetSuite',
    description: 'Enterprise-grade NetSuite integration',
    icon: 'netsuite',
    features: [
      'Advanced accounting sync',
      'Custom field mapping',
      'Subsidiary support'
    ]
  },
  salesforce: {
    name: 'Salesforce',
    description: 'Connect with your Salesforce CRM',
    icon: 'salesforce',
    features: [
      'Customer data sync',
      'Opportunity tracking',
      'Revenue analytics'
    ]
  },
  hubspot: {
    name: 'HubSpot',
    description: 'Integrate with HubSpot CRM',
    icon: 'hubspot',
    features: [
      'Contact synchronization',
      'Deal tracking',
      'Marketing automation'
    ]
  }
} as const;

async function getIntegrations(): Promise<Integration[]> {
  const response = await fetch('/api/integrations');
  if (!response.ok) {
    throw new Error('Failed to fetch integrations');
  }
  return response.json();
}

async function connectIntegration(type: string): Promise<void> {
  const response = await fetch('/api/integrations/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type })
  });
  
  if (!response.ok) {
    throw new Error('Failed to initiate integration');
  }
  
  const { authUrl } = await response.json();
  window.location.href = authUrl;
}

export default function IntegrationDashboard() {
  const [disconnectType, setDisconnectType] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: getIntegrations
  });

  const disconnectIntegration = useMutation({
    mutationFn: async (type: string) => {
      const response = await fetch(`/api/integrations/${type}/disconnect`, {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error('Failed to disconnect integration');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setDisconnectType(null);
    }
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const getIntegrationStatus = (type: string) => {
    return integrations?.find(i => i.type === type)?.status || 'DISCONNECTED';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Integrations</h2>
        <p className="text-muted-foreground">
          Connect your billing platform with other business systems
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(INTEGRATION_CONFIGS).map(([type, config]) => {
          const status = getIntegrationStatus(type);
          const isConnected = status === 'ACTIVE';

          return (
            <Card key={type} className="relative">
              {isConnected && (
                <div className="absolute top-4 right-4">
                  <Badge variant="success">Connected</Badge>
                </div>
              )}
              
              <CardHeader>
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-primary/10">
                    <Icons[config.icon as keyof typeof Icons] className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle>{config.name}</CardTitle>
                    <CardDescription>{config.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    {config.features.map((feature, index) => (
                      <div key={index} className="flex items-center">
                        <Icons.check className="h-4 w-4 mr-2 text-primary" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {isConnected ? (
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => setDisconnectType(type)}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => connectIntegration(type)}
                    >
                      Connect {config.name}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!disconnectType} onOpenChange={() => setDisconnectType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disconnect {disconnectType && INTEGRATION_CONFIGS[disconnectType as keyof typeof INTEGRATION_CONFIGS].name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the connection to your account. You can always reconnect later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disconnectType && disconnectIntegration.mutate(disconnectType)}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}