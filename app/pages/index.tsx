import React, { useState } from 'react';
import SimpleRuleBuilder from '../components/billing/SimpleRuleBuilder';
import FinancialServices from '../components/billing/FinancialServices';
import ClimateTracking from '../components/billing/ClimateTracking';

export default function BillingDashboard() {
  // State for rule builder
  const [savedRule, setSavedRule] = useState<any>(null);
  
  // State for financial services
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  
  // State for climate tracking
  const [usageData] = useState({
    apiCalls: 2500000,
    dataTransferGB: 750,
    computeHours: 320,
    storageGB: 1200
  });
  
  // Handle rule save
  const handleRuleSave = (rule: any) => {
    setSavedRule(rule);
    alert(`Rule '${rule.name}' saved successfully!`);
  };
  
  // Handle financing plan selection
  const handlePlanSelect = (provider: string, plan: any) => {
    setSelectedPlan({ provider, ...plan });
  };
  
  // Handle carbon offset
  const handleOffset = async (amount: number): Promise<boolean> => {
    try {
      // Make API call to offset carbon
      const response = await fetch('/api/climate/offset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency: 'USD',
          customerId: 'cust_example123'
        }),
      });
      
      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('Failed to process offset:', error);
      return false;
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Advanced Billing System
          </h1>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 gap-8">
            
            {/* Billing Rule Builder Section */}
            <section className="bg-white shadow rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-6">Visual Billing Rule Builder</h2>
              <SimpleRuleBuilder onSave={handleRuleSave} />
              
              {savedRule && (
                <div className="mt-8 border-t pt-4">
                  <h3 className="font-medium mb-2">Last Saved Rule</h3>
                  <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
                    {JSON.stringify(savedRule, null, 2)}
                  </pre>
                </div>
              )}
            </section>
            
            {/* Financial Services Section */}
            <section className="bg-white shadow rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-6">Embedded Financial Services</h2>
              <FinancialServices
                amount={5000}
                currency="USD"
                country="US"
                onSelect={handlePlanSelect}
              />
              
              {selectedPlan && (
                <div className="mt-8 border-t pt-4">
                  <h3 className="font-medium mb-2">Selected Financing Plan</h3>
                  <div className="bg-blue-50 p-4 rounded">
                    <p><span className="font-medium">Provider:</span> {selectedPlan.provider}</p>
                    <p><span className="font-medium">Amount:</span> ${selectedPlan.amount}</p>
                    <p><span className="font-medium">Term:</span> {selectedPlan.term} months</p>
                    <p><span className="font-medium">Monthly Payment:</span> ${selectedPlan.monthlyPayment}</p>
                  </div>
                </div>
              )}
            </section>
            
            {/* Climate Tracking Section */}
            <section className="bg-white shadow rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-6">Climate-Conscious Billing</h2>
              <ClimateTracking
                usageData={usageData}
                onOffset={handleOffset}
              />
            </section>
            
          </div>
        </div>
      </main>
    </div>
  );
}