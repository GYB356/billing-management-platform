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
      </body>
    </html>
  );
}