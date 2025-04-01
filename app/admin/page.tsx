'use client';

import React from 'react';

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <header className="bg-white shadow mb-6">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Welcome, Admin!</h2>
          <p className="text-gray-600">
            Use this dashboard to manage users, subscriptions, and billing details.
          </p>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-indigo-100 p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium text-indigo-700">Manage Users</h3>
              <p className="text-sm text-indigo-600">View and manage user accounts.</p>
            </div>
            <div className="bg-green-100 p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium text-green-700">Subscriptions</h3>
              <p className="text-sm text-green-600">Track and manage subscriptions.</p>
            </div>
            <div className="bg-yellow-100 p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium text-yellow-700">Billing</h3>
              <p className="text-sm text-yellow-600">View and process invoices.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}