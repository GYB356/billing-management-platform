import React from 'react';
import SubscriptionManagement from '@/components/customer-portal/SubscriptionManagement';
import { User, Bell, Settings, CreditCard, HelpCircle, LogOut } from 'lucide-react';

const CustomerPortalPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Customer Portal</h1>
          <div className="flex items-center space-x-4">
            <button className="p-2 rounded-full hover:bg-gray-100">
              <Bell size={20} />
            </button>
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
              <User size={18} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-64 shrink-0">
            <nav className="bg-white shadow rounded-lg p-4">
              <ul className="space-y-2">
                <li>
                  <a href="#" className="flex items-center p-3 text-blue-600 bg-blue-50 rounded-lg font-medium">
                    <CreditCard className="mr-3" size={20} />
                    Subscriptions
                  </a>
                </li>
                <li>
                  <a href="#" className="flex items-center p-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                    <User className="mr-3" size={20} />
                    Profile
                  </a>
                </li>
                <li>
                  <a href="#" className="flex items-center p-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                    <Settings className="mr-3" size={20} />
                    Settings
                  </a>
                </li>
                <li>
                  <a href="#" className="flex items-center p-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                    <HelpCircle className="mr-3" size={20} />
                    Help & Support
                  </a>
                </li>
                <li>
                  <a href="#" className="flex items-center p-3 text-red-600 hover:bg-red-50 rounded-lg">
                    <LogOut className="mr-3" size={20} />
                    Sign Out
                  </a>
                </li>
              </ul>
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-6">Manage Your Subscription</h2>
              <SubscriptionManagement />
            </div>

            <div className="mt-8 bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
              <div className="border-t border-gray-200">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="py-4 border-b border-gray-200">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-medium">{`Payment processed`}</p>
                        <p className="text-sm text-gray-500">{`April ${15 - index * 5}, 2025`}</p>
                      </div>
                      <span className="font-medium text-green-600">{`$${29.99}`}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white mt-12 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-500 text-sm">&copy; 2025 Your Company. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-gray-500 hover:text-gray-700 text-sm">Privacy Policy</a>
              <a href="#" className="text-gray-500 hover:text-gray-700 text-sm">Terms of Service</a>
              <a href="#" className="text-gray-500 hover:text-gray-700 text-sm">Contact Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CustomerPortalPage;