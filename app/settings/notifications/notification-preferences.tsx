'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';

type NotificationType = 'BILLING' | 'SYSTEM' | 'USAGE';

interface NotificationPreference {
  type: NotificationType;
  email: boolean;
  inApp: boolean;
  push: boolean;
}

interface Props {
  initialPreferences: NotificationPreference[];
}

export function NotificationPreferences({ initialPreferences }: Props) {
  const [preferences, setPreferences] = useState<NotificationPreference[]>(initialPreferences);

  const updatePreference = async (type: NotificationType, channel: keyof Omit<NotificationPreference, 'type'>, value: boolean) => {
    try {
      const preference = preferences.find(p => p.type === type) || {
        type,
        email: true,
        inApp: true,
        push: false,
      };

      const updatedPreference = {
        ...preference,
        [channel]: value,
      };

      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPreference),
      });

      if (!response.ok) throw new Error('Failed to update preferences');

      setPreferences(prev => 
        prev.map(p => p.type === type ? updatedPreference : p)
      );

      toast({
        title: 'Success',
        description: 'Notification preferences updated',
        variant: 'default',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update notification preferences',
        variant: 'destructive',
      });
    }
  };

  const notificationTypes: { type: NotificationType; label: string }[] = [
    { type: 'BILLING', label: 'Billing Notifications' },
    { type: 'SYSTEM', label: 'System Updates' },
    { type: 'USAGE', label: 'Usage Alerts' },
  ];

  return (
    <div className="space-y-6">
      {notificationTypes.map(({ type, label }) => {
        const preference = preferences.find(p => p.type === type) || {
          type,
          email: true,
          inApp: true,
          push: false,
        };

        return (
          <div key={type} className="border rounded-lg p-4">
            <h3 className="text-lg font-medium mb-4">{label}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <label htmlFor={`${type}-email`}>Email notifications</label>
                <Switch
                  id={`${type}-email`}
                  checked={preference.email}
                  onCheckedChange={(checked) => updatePreference(type, 'email', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <label htmlFor={`${type}-inApp`}>In-app notifications</label>
                <Switch
                  id={`${type}-inApp`}
                  checked={preference.inApp}
                  onCheckedChange={(checked) => updatePreference(type, 'inApp', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <label htmlFor={`${type}-push`}>Push notifications</label>
                <Switch
                  id={`${type}-push`}
                  checked={preference.push}
                  onCheckedChange={(checked) => updatePreference(type, 'push', checked)}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}