import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SubscriptionManager } from './SubscriptionManager';
import { PaymentMethods } from './PaymentMethods';
import { BillingHistory } from './BillingHistory';
import { AccountSettings } from './AccountSettings';

export function CustomerPortal() {
  const [activeTab, setActiveTab] = useState('subscription');

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Customer Portal</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-4 gap-4 bg-gray-100 p-1 rounded-lg">
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="payment">Payment Methods</TabsTrigger>
          <TabsTrigger value="billing">Billing History</TabsTrigger>
          <TabsTrigger value="account">Account Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="subscription" className="space-y-4">
          <SubscriptionManager />
        </TabsContent>

        <TabsContent value="payment" className="space-y-4">
          <PaymentMethods />
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <BillingHistory />
        </TabsContent>

        <TabsContent value="account" className="space-y-4">
          <AccountSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
} 