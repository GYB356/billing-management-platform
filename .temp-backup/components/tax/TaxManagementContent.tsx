'use client';

import { useState } from 'react';
import { TaxRateForm } from '@/components/tax/TaxRateForm';
import { TaxRatesList } from '@/components/tax/TaxRatesList';
import { TaxReportGenerator } from '@/components/tax/TaxReportGenerator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaxBreadcrumb } from '@/components/tax/TaxBreadcrumb';

interface TaxManagementContentProps {
  organizationId: string;
}

export function TaxManagementContent({ organizationId }: TaxManagementContentProps) {
  const [activeTab, setActiveTab] = useState('rates');

  const breadcrumbItems = [
    {
      label: 'Tax Management',
      href: '/tax',
    },
    {
      label: activeTab === 'rates' ? 'Tax Rates' : 'Tax Reports',
    },
  ];

  return (
    <div className="space-y-6">
      <TaxBreadcrumb items={breadcrumbItems} />
      <Tabs
        defaultValue="rates"
        className="space-y-4"
        onValueChange={setActiveTab}
      >
        <TabsList>
          <TabsTrigger value="rates">Tax Rates</TabsTrigger>
          <TabsTrigger value="reports">Tax Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="rates" className="space-y-6">
          <div className="grid gap-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Add New Tax Rate</h2>
              <TaxRateForm organizationId={organizationId} />
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Tax Rates</h2>
              <TaxRatesList organizationId={organizationId} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reports">
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Generate Tax Report</h2>
            <TaxReportGenerator organizationId={organizationId} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}