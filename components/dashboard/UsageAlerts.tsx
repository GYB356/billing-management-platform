'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Bell, BellOff, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UsageAlert {
  id: string;
  featureId: string;
  threshold: number;
  type: 'percentage' | 'absolute';
  notifyVia: ('email' | 'webhook')[];
  enabled: boolean;
}

interface Feature {
  id: string;
  name: string;
  unitName: string;
  limit: number;
}

interface UsageAlertsProps {
  subscriptionId: string;
  features: Feature[];
}

export default function UsageAlerts({ subscriptionId, features }: UsageAlertsProps) {
  const [alerts, setAlerts] = useState<UsageAlert[]>([]);
  const [showNewAlertDialog, setShowNewAlertDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const [newAlert, setNewAlert] = useState<Partial<UsageAlert>>({
    type: 'percentage',
    notifyVia: ['email'],
    enabled: true,
  });

  const loadAlerts = async () => {
    try {
      const response = await fetch(`/api/customer/usage/alerts?subscriptionId=${subscriptionId}`);
      if (!response.ok) throw new Error('Failed to load alerts');
      const data = await response.json();
      setAlerts(data);
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const handleCreateAlert = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/customer/usage/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newAlert,
          subscriptionId,
        }),
      });

      if (!response.ok) throw new Error('Failed to create alert');

      await loadAlerts();
      setShowNewAlertDialog(false);
      setNewAlert({
        type: 'percentage',
        notifyVia: ['email'],
        enabled: true,
      });
    } catch (error) {
      console.error('Error creating alert:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAlert = async (alertId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/customer/usage/alerts/${alertId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) throw new Error('Failed to update alert');

      setAlerts(alerts.map(alert => 
        alert.id === alertId ? { ...alert, enabled } : alert
      ));
    } catch (error) {
      console.error('Error updating alert:', error);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (!confirm('Are you sure you want to delete this alert?')) return;

    try {
      const response = await fetch(`/api/customer/usage/alerts/${alertId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete alert');

      setAlerts(alerts.filter(alert => alert.id !== alertId));
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  const getFeatureName = (featureId: string) => {
    return features.find(f => f.id === featureId)?.name || 'Unknown Feature';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage Alerts</CardTitle>
        <CardDescription>
          Get notified when your usage reaches certain thresholds
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">Configured Alerts</h3>
            <Dialog open={showNewAlertDialog} onOpenChange={setShowNewAlertDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Alert
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Alert</DialogTitle>
                  <DialogDescription>
                    Set up an alert to monitor your usage
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Feature</label>
                    <Select
                      value={newAlert.featureId}
                      onValueChange={(value) => setNewAlert({ ...newAlert, featureId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a feature" />
                      </SelectTrigger>
                      <SelectContent>
                        {features.map((feature) => (
                          <SelectItem key={feature.id} value={feature.id}>
                            {feature.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Alert Type</label>
                    <Select
                      value={newAlert.type}
                      onValueChange={(value: 'percentage' | 'absolute') => 
                        setNewAlert({ ...newAlert, type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage of Limit</SelectItem>
                        <SelectItem value="absolute">Absolute Value</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Threshold</label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        value={newAlert.threshold || ''}
                        onChange={(e) => 
                          setNewAlert({ 
                            ...newAlert, 
                            threshold: parseInt(e.target.value) 
                          })
                        }
                        min={0}
                        max={newAlert.type === 'percentage' ? 100 : undefined}
                      />
                      <span className="text-sm text-gray-500">
                        {newAlert.type === 'percentage' ? '%' : 'units'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Notification Methods</label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={newAlert.notifyVia?.includes('email')}
                          onChange={(e) => {
                            const notifyVia = e.target.checked
                              ? [...(newAlert.notifyVia || []), 'email']
                              : (newAlert.notifyVia || []).filter(v => v !== 'email');
                            setNewAlert({ ...newAlert, notifyVia });
                          }}
                        />
                        <span>Email</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={newAlert.notifyVia?.includes('webhook')}
                          onChange={(e) => {
                            const notifyVia = e.target.checked
                              ? [...(newAlert.notifyVia || []), 'webhook']
                              : (newAlert.notifyVia || []).filter(v => v !== 'webhook');
                            setNewAlert({ ...newAlert, notifyVia });
                          }}
                        />
                        <span>Webhook</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowNewAlertDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateAlert}
                    disabled={loading || !newAlert.featureId || !newAlert.threshold}
                  >
                    {loading ? 'Creating...' : 'Create Alert'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="divide-y">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="py-4 flex items-center justify-between"
              >
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">
                    {getFeatureName(alert.featureId)}
                  </h4>
                  <p className="text-sm text-gray-500">
                    Alert at {alert.threshold}
                    {alert.type === 'percentage' ? '%' : ' units'}
                  </p>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Bell className="h-4 w-4" />
                    <span>
                      Via {alert.notifyVia.join(' and ')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Switch
                    checked={alert.enabled}
                    onCheckedChange={(checked) => handleToggleAlert(alert.id, checked)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteAlert(alert.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}

            {alerts.length === 0 && (
              <div className="py-8 text-center">
                <BellOff className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No alerts configured
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Create an alert to get notified when your usage reaches certain thresholds
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
