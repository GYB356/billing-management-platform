'use client';

import SubscriptionCard from "@/components/customer/SubscriptionCard";
import Invoices from "@/components/customer/Invoices";
import PaymentMethods from "@/components/customer/PaymentMethods";
import UsageDashboard from "@/components/customer/UsageDashboard";
import NotificationSettings from "@/components/customer/NotificationSettings";

export default function CustomerPortal() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Customer Portal</h1>
      <SubscriptionCard />
      <PaymentMethods />
      <Invoices />
      <UsageDashboard />
      <NotificationSettings />
    </div>
  );
} 