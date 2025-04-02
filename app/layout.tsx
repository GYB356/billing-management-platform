import React from 'react';
import SessionProviderWrapper from '@/components/SessionProviderWrapper';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-100">
        <SessionProviderWrapper>
          <div className="min-h-screen flex flex-col">
            {/* Navbar */}
            <nav className="bg-indigo-600 text-white py-4">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                <div className="text-lg font-bold">BillingPro</div>
                <div>
                  <a href="/" className="text-white hover:underline">
                    Home
                  </a>
                </div>
              </div>
            </nav>

            {/* Main Content */}
            <main className="flex-grow">{children}</main>

            {/* Footer */}
            <footer className="bg-gray-800 text-white py-4">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                &copy; 2025 BillingPro. All rights reserved.
              </div>
            </footer>
          </div>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}