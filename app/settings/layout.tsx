import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  Settings,
  CreditCard,
  Users,
  Bell,
  Link as LinkIcon,
  Shield,
  Building
} from 'lucide-react';

interface SettingsLayoutProps {
  children: ReactNode;
}

const navigation = [
  {
    name: 'General',
    href: '/settings',
    icon: Settings,
    description: 'Basic organization settings and preferences'
  },
  {
    name: 'Billing',
    href: '/settings/billing',
    icon: CreditCard,
    description: 'Manage your subscription and payment methods'
  },
  {
    name: 'Team',
    href: '/settings/team',
    icon: Users,
    description: 'Invite and manage team members'
  },
  {
    name: 'Notifications',
    href: '/settings/notifications',
    icon: Bell,
    description: 'Configure notification preferences'
  },
  {
    name: 'Integrations',
    href: '/settings/integrations',
    icon: LinkIcon,
    description: 'Connect with third-party services'
  },
  {
    name: 'Security',
    href: '/settings/security',
    icon: Shield,
    description: 'Security settings and authentication'
  },
  {
    name: 'Organization',
    href: '/settings/organization',
    icon: Building,
    description: 'Manage organization details and branding'
  }
];

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <div className="hidden md:flex md:w-72 md:flex-col md:fixed md:inset-y-0">
        <div className="flex flex-col flex-grow border-r border-gray-200 bg-white pt-5 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <Link
              href="/dashboard"
              className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </div>
          <div className="mt-8 flex-grow flex flex-col">
            <nav className="flex-1 px-4 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <item.icon
                      className={`mr-3 h-5 w-5 flex-shrink-0 ${
                        isActive
                          ? 'text-primary-foreground'
                          : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                      aria-hidden="true"
                    />
                    <div>
                      <div>{item.name}</div>
                      <div className={`text-xs ${
                        isActive
                          ? 'text-primary-foreground/80'
                          : 'text-gray-400'
                      }`}>
                        {item.description}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
      <div className="md:pl-72 flex flex-col flex-1">
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}