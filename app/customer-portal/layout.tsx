'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';
import { LayoutDashboard, CreditCard, Receipt, Settings, LogOut, TrendingUp } from 'lucide-react';
import Link from 'next/link';

const navigation = [
  { name: 'Dashboard', href: '/customer-portal', icon: LayoutDashboard },
  { name: 'Analytics', href: '/customer-portal/analytics', icon: TrendingUp },
  { name: 'Billing', href: '/customer-portal/billing', icon: CreditCard },
  { name: 'Invoices', href: '/customer-portal/invoices', icon: Receipt },
  { name: 'Settings', href: '/customer-portal/settings', icon: Settings },
];

export default function CustomerPortalLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/customer-portal" className="text-xl font-bold">
                  Customer Portal
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map(item => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-gray-500"
                  >
                    <item.icon className="h-5 w-5 mr-2" />
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <NotificationBell />
              <LanguageSelector variant="minimal" />
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">{session.user.email}</span>
                <Button variant="ghost" size="sm" onClick={() => router.push('/auth/signout')}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}