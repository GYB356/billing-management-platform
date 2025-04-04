import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left side - Brand panel */}
      <div className="bg-indigo-700 text-white w-full md:w-2/5 p-10 hidden md:flex flex-col">
        <div className="mb-12">
          <h1 className="text-3xl font-bold">BillingPro</h1>
        </div>
        <div className="flex-grow flex flex-col justify-center">
          <h2 className="text-4xl font-bold mb-6">Simplified Billing Management</h2>
          <p className="text-xl opacity-80 mb-8">
            Handle subscriptions, invoices, and payments all in one place.
          </p>
          <div className="space-y-4">
            <div className="flex items-center">
              <div className="bg-indigo-500 p-2 rounded-full mr-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span>Secure payment processing</span>
            </div>
            <div className="flex items-center">
              <div className="bg-indigo-500 p-2 rounded-full mr-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span>Automated invoicing</span>
            </div>
            <div className="flex items-center">
              <div className="bg-indigo-500 p-2 rounded-full mr-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span>Subscription analytics</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth forms */}
      <div className="w-full md:w-3/5 flex justify-center items-center p-6 md:p-12 bg-white">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
