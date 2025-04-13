import React, { useState } from 'react';

// BNPL Provider options
const BNPL_PROVIDERS = [
  {
    id: 'stripe_capital',
    name: 'Stripe Capital',
    description: 'Business financing through Stripe',
    icon: '💳',
    minAmount: 1000,
    maxAmount: 150000,
    terms: [3, 6, 12],
    availableCountries: ['US', 'CA', 'GB', 'AU'],
    apiEndpoint: '/api/financial/stripe-capital',
  },
  {
    id: 'finbox',
    name: 'FinBox',
    description: 'Flexible payment plans for your customers',
    icon: '📦',
    minAmount: 100,
    maxAmount: 50000,
    terms: [3, 6, 9, 12, 24],
    availableCountries: ['US', 'CA', 'MX', 'BR', 'GB', 'FR', 'DE', 'ES', 'IT'],
    apiEndpoint: '/api/financial/finbox',
  },
  {
    id: 'rutter',
    name: 'Rutter Pay',
    description: 'Unified API for financial services',
    icon: '🔄',
    minAmount: 500,
    maxAmount: 100000,
    terms: [3, 6, 12, 18],
    availableCountries: ['US', 'CA', 'GB', 'AU', 'NZ', 'SG'],
    apiEndpoint: '/api/financial/rutter',
  }
];

interface FinancialServicesProps {
  amount: number;
  currency: string;
  country: string;
  onSelect: (provider: string, plan: { amount: number; term: number; monthlyPayment: number }) => void;
}

export default function FinancialServices({ 
  amount, 
  currency, 
  country, 
  onSelect 
}: FinancialServicesProps) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<number | null>(null);
  
  // Filter providers based on amount and country
  const eligibleProviders = BNPL_PROVIDERS.filter(provider => 
    provider.minAmount <= amount &&
    provider.maxAmount >= amount &&
    provider.availableCountries.includes(country)
  );
  
  // Get selected provider details
  const provider = BNPL_PROVIDERS.find(p => p.id === selectedProvider);
  
  // Calculate monthly payment based on simple interest (for demo purposes)
  const calculateMonthlyPayment = (principal: number, termMonths: number) => {
    // Mock interest rates based on provider (in a real app, would come from API)
    const interestRates = {
      stripe_capital: 0.08, // 8% APR
      finbox: 0.10,         // 10% APR
      rutter: 0.09,         // 9% APR
    };
    
    const rate = interestRates[selectedProvider as keyof typeof interestRates] || 0.1;
    const monthlyRate = rate / 12;
    const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
                   (Math.pow(1 + monthlyRate, termMonths) - 1);
    
    return Math.round(payment * 100) / 100;
  };
  
  // Handle provider selection
  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId);
    setSelectedTerm(null);
  };
  
  // Handle term selection
  const handleTermSelect = (term: number) => {
    setSelectedTerm(term);
    
    if (selectedProvider) {
      const monthlyPayment = calculateMonthlyPayment(amount, term);
      
      onSelect(selectedProvider, {
        amount,
        term,
        monthlyPayment
      });
    }
  };
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(value);
  };
  
  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-6">Payment Financing Options</h2>
      
      {eligibleProviders.length === 0 ? (
        <div className="bg-amber-100 border border-amber-300 rounded-lg p-4 text-amber-800">
          No financing options available for your current order amount or country.
        </div>
      ) : (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-blue-800">Buy now, pay later</h3>
            <p className="text-sm text-blue-600">
              Split your payment of {formatCurrency(amount)} into smaller installments
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {eligibleProviders.map((provider) => (
              <div
                key={provider.id}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedProvider === provider.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'hover:border-gray-400'
                }`}
                onClick={() => handleProviderSelect(provider.id)}
              >
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-2">{provider.icon}</span>
                  <h3 className="font-medium">{provider.name}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-2">{provider.description}</p>
                <div className="text-xs text-gray-500">
                  {provider.terms.length} payment plans available
                </div>
              </div>
            ))}
          </div>
          
          {selectedProvider && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-3">Select Payment Term</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {provider?.terms.map((term) => {
                  const monthlyPayment = calculateMonthlyPayment(amount, term);
                  
                  return (
                    <div
                      key={term}
                      className={`border rounded-lg p-4 cursor-pointer ${
                        selectedTerm === term
                          ? 'border-green-500 bg-green-50'
                          : 'hover:border-gray-400'
                      }`}
                      onClick={() => handleTermSelect(term)}
                    >
                      <div className="font-medium mb-1">{term} months</div>
                      <div className="text-lg font-bold text-green-700">
                        {formatCurrency(monthlyPayment)}/mo
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Total: {formatCurrency(monthlyPayment * term)}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {selectedTerm && (
                <div className="mt-6">
                  <button
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    onClick={() => handleTermSelect(selectedTerm)}
                  >
                    Apply for Financing
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    Subject to credit approval. Terms and conditions apply.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
      
      <div className="mt-8 border-t pt-4">
        <h3 className="text-lg font-medium mb-2">How it works</h3>
        <ol className="list-decimal list-inside text-sm text-gray-600 space-y-2">
          <li>Select a financing provider that suits your needs</li>
          <li>Choose a payment term that fits your budget</li>
          <li>Complete a quick application process</li>
          <li>Receive an instant decision in most cases</li>
          <li>Make easy monthly payments according to your plan</li>
        </ol>
      </div>
    </div>
  );
} 