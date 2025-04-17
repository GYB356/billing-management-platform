'use client';

import Link from 'next/link';

export default function Page() {
  return (
    <div className="bg-gray-50">
      {/* Hero Section */}
      <div className="relative bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:items-center">
            <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left">
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                Simplify Your <span className="text-indigo-600">Billing</span>
              </h1>
              <p className="mt-4 text-lg leading-6 text-gray-500">
                Manage subscriptions, invoices, and payments effortlessly with our all-in-one platform.
              </p>
              <div className="mt-6 flex justify-center lg:justify-start space-x-4">
                <Link
                  href="/auth/signup"
                  className="px-6 py-3 text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Get Started
                </Link>
                <Link
                  href="/dashboard"
                  className="px-6 py-3 text-base font-medium rounded-md text-indigo-600 bg-gray-100 hover:bg-gray-200"
                >
                  Live Demo
                </Link>
              </div>
            </div>
            <div className="mt-10 relative lg:mt-0 lg:col-span-6">
              <img
                className="w-full rounded-lg shadow-lg"
                src="/api/placeholder/600/400"
                alt="BillingPro Dashboard"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-indigo-600 font-semibold tracking-wide uppercase">
              Features
            </h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to manage billing
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900">Subscription Management</h3>
              <p className="mt-2 text-sm text-gray-500">
                Easily manage subscriptions, trials, upgrades, and cancellations.
              </p>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900">Invoice Automation</h3>
              <p className="mt-2 text-sm text-gray-500">
                Generate and send invoices automatically with customizable templates.
              </p>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900">Secure Payments</h3>
              <p className="mt-2 text-sm text-gray-500">
                Process payments securely with support for multiple payment methods.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}