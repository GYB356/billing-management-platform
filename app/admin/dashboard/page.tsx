import React from 'react';
import CustomerManagement from '@/components/admin/CustomerManagement';
import SubscriptionManagement from '@/components/admin/SubscriptionManagement';
import FinancialMetrics from '@/components/admin/FinancialMetrics';
import NotificationManagement from '@/components/admin/NotificationManagement';
import InvoiceManagement from '@/components/admin/InvoiceManagement';
import CurrencyManagement from '@/components/admin/CurrencyManagement';
import TaxCalculation from '@/components/admin/TaxCalculation';
import WebhookManagement from '@/components/admin/WebhookManagement';
import AuditLogManagement from '@/components/admin/AuditLogManagement';
import DataExport from '@/components/admin/DataExport';
import EmailTemplateManagement from '@/components/admin/EmailTemplateManagement';
import PricingRulesManagement from '@/components/admin/PricingRulesManagement';

const AdminDashboardPage = () => {
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <FinancialMetrics />
      <CustomerManagement />
      <SubscriptionManagement />
      <NotificationManagement />
      <InvoiceManagement />
      <CurrencyManagement />
      <TaxCalculation />
      <WebhookManagement />
      <AuditLogManagement />
      <DataExport />
      <EmailTemplateManagement />
      <PricingRulesManagement />
    </div>
  );
};

export default AdminDashboardPage;