'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Bell, Mail, AlertCircle } from 'lucide-react';
import { toast } from '@/components/ui/toast';

interface NotificationSetting {
  id: string;
  type: string;
  email: boolean;
  inApp: boolean;
  push: boolean;
}

interface NotificationChannel {
  id: string;
  name: string;
  description: string;
  icon: JSX.Element;
}

const notificationTypes = [
  {
    id: 'billing',
    name: 'Billing Notifications',
    description: 'Receive updates about invoices, payments, and subscription changes',
    defaultChannels: ['email', 'inApp'],
  },
  {
    id: 'usage',
    name: 'Usage Alerts',
    description: 'Get notified when you approach usage limits or have unusual usage patterns',
    defaultChannels: ['email', 'inApp', 'push'],
  },
  {
    id: 'system',
    name: 'System Notifications',
    description: 'Important updates about system maintenance and service status',
    defaultChannels: ['email', 'inApp'],
  },
  {
    id: 'security',
    name: 'Security Alerts',
    description: 'Critical security updates and unusual account activity',
    defaultChannels: ['email', 'inApp', 'push'],
  },
];

const channels: NotificationChannel[] = [
  {
    id: 'inApp',
    name: 'In-App Notifications',
    description: 'Receive notifications within the platform',
    icon: <Bell className="h-4 w-4" />,
  },
  {
    id: 'email',
    name: 'Email Notifications',
    description: 'Get updates sent to your email',
    icon: <Mail className="h-4 w-4" />,
  },
  {
    id: 'push',
    name: 'Push Notifications',
    description: 'Browser notifications for important updates',
    icon: <AlertCircle className="h-4 w-4" />,
  },
];

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/notifications/settings');
      if (!response.ok) throw new Error('Failed to fetch notification settings');
      
      const data = await response.json();
      setSettings(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching notification settings:', error);
    }
  };

  const updateSetting = async (
    typeId: string,
    channel: string,
    enabled: boolean
  ) => {
    try {
      const response = await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typeId,
          channel,
          enabled,
        }),
      });

      if (!response.ok) throw new Error('Failed to update notification settings');

      setSettings(settings.map(setting => {
        if (setting.id === typeId) {
          return {
            ...setting,
            [channel]: enabled,
          };
        }
        return setting;
      }));

      toast({
        title: 'Settings updated',
        description: 'Your notification preferences have been saved.',
        variant: 'success',
      });
    } catch (error) {
      console.error('Error updating notification settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to update notification settings. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleTestNotification = async (typeId: string) => {
    try {
      await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typeId }),
      });

      toast({
        title: 'Test notification sent',
        description: 'Check your configured channels for the test notification.',
        variant: 'success',
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to send test notification. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Notification Settings</h1>
        <p className="text-gray-600 mt-2">
          Customize how and when you receive notifications
        </p>
      </div>

      <div className="space-y-6">
        {notificationTypes.map((type) => (
          <Card key={type.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{type.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {type.description}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestNotification(type.id)}
                >
                  Send Test
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {channels.map((channel) => {
                  const setting = settings.find(s => s.id === type.id);
                  const isEnabled = setting ? setting[channel.id] : type.defaultChannels.includes(channel.id);

                  return (
                    <div
                      key={`${type.id}-${channel.id}`}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {channel.icon}
                        <div>
                          <p className="text-sm font-medium">{channel.name}</p>
                          <p className="text-sm text-gray-500">
                            {channel.description}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) =>
                          updateSetting(type.id, channel.id, checked)
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}