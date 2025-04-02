'use client';

import React from 'react';

export default function AdminDashboard() {
  console.log('Admin dashboard rendered'); // Debugging log

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow mb-6">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Welcome, Admin!</h2>
          <p className="text-gray-600">
            Use this dashboard to manage users, subscriptions, and billing details.
          </p>

          {/* Example Cards */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-indigo-100 p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium text-indigo-700">Manage Users</h3>
              <p className="text-sm text-indigo-600">View and manage user accounts.</p>
              <button className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                View Users
              </button>
            </div>
            <div className="bg-green-100 p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium text-green-700">Subscriptions</h3>
              <p className="text-sm text-green-600">Track and manage subscriptions.</p>
              <button className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                View Subscriptions
              </button>
            </div>
            <div className="bg-yellow-100 p-4 rounded-lg shadow">
              <h3 className="text-lg font-medium text-yellow-700">Billing</h3>
              <p className="text-sm text-yellow-600">View and process invoices.</p>
              <button className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700">
                View Billing
              </button>
            </div>
          </div>

          {/* Analytics Section */}
          <div className="mt-10 bg-gray-50 p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold text-gray-900">Analytics Overview</h3>
            <p className="text-sm text-gray-600 mt-2">
              Get insights into your platform's performance.
            </p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <h4 className="text-lg font-medium text-gray-900">Total Users</h4>
                <p className="text-2xl font-bold text-indigo-600 mt-2">1,234</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h4 className="text-lg font-medium text-gray-900">Active Subscriptions</h4>
                <p className="text-2xl font-bold text-green-600 mt-2">567</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h4 className="text-lg font-medium text-gray-900">Monthly Revenue</h4>
                <p className="text-2xl font-bold text-yellow-600 mt-2">$12,345</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h4 className="text-lg font-medium text-gray-900">Pending Invoices</h4>
                <p className="text-2xl font-bold text-red-600 mt-2">23</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}