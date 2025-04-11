import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { RTLProvider } from '@/components/i18n/RTLProvider';
import { RTLStyles } from '@/components/i18n/RTLStyles';
import NextAuthProvider from '@/components/auth/next-auth-provider';
import { ThemeProvider } from '@/components/theme-provider';
import PayPalProvider from '@/components/providers/PayPalProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SaaS Billing Platform',
  description: 'A modern SaaS billing and subscription management platform',
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
      <body className={inter.className}>
        <NextAuthProvider>
          <I18nProvider>
            <RTLProvider>
              <RTLStyles />
              <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                <PayPalProvider>
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
                    <main className="flex-grow">
                      {children}
                      <Toaster />
                    </main>

                    {/* Footer */}
                    <footer className="bg-gray-800 text-white py-4">
                      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        &copy; 2025 BillingPro. All rights reserved.
                      </div>
                    </footer>
                  </div>
                </PayPalProvider>
              </ThemeProvider>
            </RTLProvider>
          </I18nProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}