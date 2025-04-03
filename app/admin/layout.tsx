import { Toaster } from 'sonner';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { RTLProvider } from '@/components/i18n/RTLProvider';
import { RTLStyles } from '@/components/i18n/RTLStyles';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Billing Management Platform',
  description: 'A comprehensive platform for managing subscriptions and billing',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <I18nProvider>
          <RTLProvider>
            <RTLStyles />
            <Toaster />
            {children}
          </RTLProvider>
        </I18nProvider>
      </body>
    </html>
  );
}