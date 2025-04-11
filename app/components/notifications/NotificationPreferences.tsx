import { useEffect, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { notificationService, NotificationType } from '@/lib/services/notification-service';

interface NotificationTypeOption {
  id: NotificationType;
  label: string;
  description: string;
}

const NOTIFICATION_TYPES: NotificationTypeOption[] = [
  {
    id: 'payment_success',
    label: 'Payment Success',
    description: 'When a payment is successfully processed',
  },
  {
    id: 'payment_failed',
    label: 'Payment Failed',
    description: 'When a payment attempt fails',
  },
  {
    id: 'usage_alert',
    label: 'Usage Alerts',
    description: 'When you approach or exceed usage limits',
  },
  {
    id: 'subscription_renewed',
    label: 'Subscription Renewed',
    description: 'When your subscription is automatically renewed',
  },
  {
    id: 'subscription_canceled',
    label: 'Subscription Canceled',
    description: 'When your subscription is canceled',
  },
  {
    id: 'maintenance',
    label: 'Maintenance Updates',
    description: 'System maintenance and downtime notifications',
  },
];

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState({
    email: true,
    push: true,
    types: [] as NotificationType[],
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    const prefs = await notificationService.getPreferences();
    setPreferences(prefs);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await notificationService.updatePreferences(preferences);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleNotificationType = (type: NotificationType) => {
    setPreferences(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type],
    }));
  };

  return (
    <div className="p-4 space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Notification Channels</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-gray-500">
                Receive notifications via email
              </p>
            </div>
            <Switch
              checked={preferences.email}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({ ...prev, email: checked }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Push Notifications</Label>
              <p className="text-sm text-gray-500">
                Receive notifications in your browser
              </p>
            </div>
            <Switch
              checked={preferences.push}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({ ...prev, push: checked }))
              }
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Notification Types</h3>
        <div className="space-y-4">
          {NOTIFICATION_TYPES.map((type) => (
            <div key={type.id} className="flex items-start space-x-3">
              <Checkbox
                id={type.id}
                checked={preferences.types.includes(type.id)}
                onCheckedChange={() => toggleNotificationType(type.id)}
              />
              <div className="space-y-1">
                <label
                  htmlFor={type.id}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {type.label}
                </label>
                <p className="text-sm text-gray-500">
                  {type.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button
        className="w-full"
        onClick={handleSave}
        disabled={isSaving}
      >
        {isSaving ? 'Saving...' : 'Save Preferences'}
      </Button>
    </div>
  );
} 