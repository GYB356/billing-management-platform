'use client';

import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';

const navigation = [
  { name: 'Overview', href: '/dashboard' },
  { name: 'Subscription', href: '/dashboard/subscription' },
  { name: 'Payment Methods', href: '/dashboard/payment-methods' },
  { name: 'Usage', href: '/dashboard/usage' },
  { name: 'Invoices', href: '/dashboard/invoices' },
  { name: 'Tax Management', href: '/tax' },
];

const adminNavigation = [
  { name: 'Overview', href: '/dashboard' },
  { name: 'Subscriptions', href: '/dashboard/admin/subscriptions' },
  { name: 'Payment Methods', href: '/dashboard/payment-methods' },
  { name: 'Users', href: '/dashboard/admin/users' },
  { name: 'Analytics', href: '/dashboard/admin/analytics' },
  { name: 'Tax Management', href: '/tax' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAdmin } = useAuth();
  const pathname = usePathname();

  if (!user) {
    return null;
  }

  const navItems = isAdmin ? adminNavigation : navigation;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        {/* Sidebar */}
        <div className="hidden md:flex md:w-64 md:flex-col">
          <div className="flex min-h-0 flex-1 flex-col border-r border-gray-200 bg-white">
            <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
              <div className="flex flex-shrink-0 items-center px-4">
                <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
              </div>
              <nav className="mt-5 flex-1 space-y-1 bg-white px-2">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                        isActive
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex flex-shrink-0 border-t border-gray-200 p-4">
              <div className="flex items-center">
                <div>
                  <p className="text-sm font-medium text-gray-700">{user.name}</p>
                  <p className="text-xs font-medium text-gray-500">{user.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col">
          <main className="flex-1">
            <div className="py-6">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
                <div className="flex items-center gap-4">
                  <NotificationBell />
                  <LanguageSelector variant="minimal" />
                  {/* Other header items */}
                </div>
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
} 