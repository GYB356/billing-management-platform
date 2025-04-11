import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, AlertCircle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { formatDistanceToNow } from 'date-fns';

const AVAILABLE_EVENTS = [
  'subscription.created',
  'subscription.updated',
  'subscription.canceled',
  'invoice.created',
  'invoice.paid',
  'invoice.payment_failed',
  'credit_note.issued',
  'customer.created',
  'customer.updated'
];

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  status: 'ACTIVE' | 'DISABLED';
  disabledReason?: string;
  secretKey: string;
  description?: string;
  createdAt: string;
  _count: {
    deliveries: number;
  };
}

interface DeliveryAttempt {
  id: string;
  eventType: string;
  status: 'SUCCEEDED' | 'FAILED';
  statusCode?: number;
  response?: string;
  createdAt: string;
  deliveredAt?: string;
}

async function getWebhookEndpoints(): Promise<WebhookEndpoint[]> {
  const response = await fetch('/api/integrations/webhooks');
  if (!response.ok) {
    throw new Error('Failed to fetch webhook endpoints');
  }
  return response.json();
}

async function getDeliveryHistory(endpointId: string): Promise<DeliveryAttempt[]> {
  const response = await fetch(`/api/integrations/webhooks/${endpointId}/deliveries`);
  if (!response.ok) {
    throw new Error('Failed to fetch delivery history');
  }
  return response.json();
}

export default function WebhookDashboard() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: endpoints, isLoading } = useQuery({
    queryKey: ['webhook-endpoints'],
    queryFn: getWebhookEndpoints
  });

  const { data: deliveries } = useQuery({
    queryKey: ['webhook-deliveries', selectedEndpoint],
    queryFn: () => selectedEndpoint ? getDeliveryHistory(selectedEndpoint) : null,
    enabled: !!selectedEndpoint
  });

  const createEndpoint = useMutation({
    mutationFn: async (data: {
      url: string;
      events: string[];
      description?: string;
    }) => {
      const response = await fetch('/api/integrations/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error('Failed to create webhook endpoint');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      setIsCreateDialogOpen(false);
    }
  });

  const retryDelivery = useMutation({
    mutationFn: async (deliveryId: string) => {
      const response = await fetch(`/api/integrations/webhooks/retry/${deliveryId}`, {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error('Failed to retry webhook delivery');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['webhook-deliveries', selectedEndpoint]
      });
    }
  });

  const [newEndpointData, setNewEndpointData] = useState({
    url: '',
    events: [] as string[],
    description: ''
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Webhook Endpoints</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Webhook
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Webhook Endpoint</DialogTitle>
              <DialogDescription>
                Add a new endpoint to receive webhook events
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label>Endpoint URL</label>
                <Input
                  placeholder="https://your-domain.com/webhooks"
                  value={newEndpointData.url}
                  onChange={e => setNewEndpointData({
                    ...newEndpointData,
                    url: e.target.value
                  })}
                />
              </div>
              <div className="space-y-2">
                <label>Events</label>
                <Select
                  onValueChange={value => setNewEndpointData({
                    ...newEndpointData,
                    events: [...newEndpointData.events, value]
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select events" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_EVENTS.map(event => (
                      <SelectItem key={event} value={event}>
                        {event}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {newEndpointData.events.map(event => (
                    <Badge
                      key={event}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => setNewEndpointData({
                        ...newEndpointData,
                        events: newEndpointData.events.filter(e => e !== event)
                      })}
                    >
                      {event} ×
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label>Description</label>
                <Textarea
                  placeholder="Description (optional)"
                  value={newEndpointData.description}
                  onChange={e => setNewEndpointData({
                    ...newEndpointData,
                    description: e.target.value
                  })}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => createEndpoint.mutate(newEndpointData)}
                disabled={!newEndpointData.url || newEndpointData.events.length === 0}
              >
                Create Webhook
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Endpoints</CardTitle>
            <CardDescription>
              Manage your webhook endpoints
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {endpoints?.map(endpoint => (
                <div
                  key={endpoint.id}
                  className={`p-4 rounded-lg border cursor-pointer ${
                    selectedEndpoint === endpoint.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                  onClick={() => setSelectedEndpoint(endpoint.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="truncate flex-1">
                      <p className="font-medium truncate">{endpoint.url}</p>
                      <p className="text-sm text-muted-foreground">
                        {endpoint._count.deliveries} deliveries in last 24h
                      </p>
                    </div>
                    <Badge
                      variant={endpoint.status === 'ACTIVE' ? 'success' : 'destructive'}
                    >
                      {endpoint.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {endpoint.events.map(event => (
                      <Badge key={event} variant="secondary">
                        {event}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery History</CardTitle>
            <CardDescription>
              Recent webhook delivery attempts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedEndpoint ? (
              <p className="text-center text-muted-foreground">
                Select an endpoint to view delivery history
              </p>
            ) : (
              <div className="space-y-4">
                {deliveries?.map(delivery => (
                  <div
                    key={delivery.id}
                    className="p-4 rounded-lg border space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{delivery.eventType}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(delivery.createdAt), {
                            addSuffix: true
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={delivery.status === 'SUCCEEDED' ? 'success' : 'destructive'}
                        >
                          {delivery.status}
                        </Badge>
                        {delivery.status === 'FAILED' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => retryDelivery.mutate(delivery.id)}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {delivery.status === 'FAILED' && (
                      <div className="text-sm bg-destructive/10 text-destructive p-2 rounded">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 mt-0.5" />
                          <span>
                            Status {delivery.statusCode}: {delivery.response}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}