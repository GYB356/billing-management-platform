<<<<<<< HEAD
import { Toaster } from 'sonner';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { RTLProvider } from '@/components/i18n/RTLProvider';
import { RTLStyles } from '@/components/i18n/RTLStyles';
import NextAuthProvider from '@/components/auth/next-auth-provider';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

export const metadata = {
  title: 'Billing Management Platform',
  description: 'Manage your billing and subscriptions'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link 
          rel="stylesheet" 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="font-sans">
        <NextAuthProvider>
          <I18nProvider>
            <RTLProvider>
              <RTLStyles />
              <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                {children}
                <Toaster richColors />
              </ThemeProvider>
            </RTLProvider>
          </I18nProvider>
        </NextAuthProvider>
=======
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
>>>>>>> 58d4a3da7158e64e5700c51b28776197a8d974c9
      </body>
    </html>
  );
}