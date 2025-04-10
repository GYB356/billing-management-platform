'use client';

import Link from 'next/link';
import { useI18n } from '@/components/i18n/I18nProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Globe, 
  Shield, 
  CreditCard, 
  Bell, 
  UserCircle,
  ChevronRight,
  Settings2
} from 'lucide-react';

export default function SettingsPage() {
  const { t } = useI18n();
  
  const settingsCategories = [
    {
      title: t('settings.account.title'),
      description: t('settings.account.description'),
      icon: UserCircle,
      href: '/customer-portal/settings/account',
    },
    {
      title: t('settings.language.title'),
      description: t('settings.language.description'),
      icon: Globe,
      href: '/customer-portal/settings/language',
    },
    {
      title: t('settings.formats.title'),
      description: t('settings.formats.description'),
      icon: Settings2,
      href: '/customer-portal/settings/formats',
    },
    {
      title: t('settings.security.title'),
      description: t('settings.security.description'),
      icon: Shield,
      href: '/customer-portal/settings/security',
    },
    {
      title: t('settings.billing.title'),
      description: t('settings.billing.description'),
      icon: CreditCard,
      href: '/customer-portal/settings/billing',
    },
    {
      title: t('settings.notifications.title'),
      description: t('settings.notifications.description'),
      icon: Bell,
      href: '/customer-portal/settings/notifications',
    },
  ];
  
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">{t('settings.pageTitle')}</h1>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsCategories.map(category => (
          <Link 
            key={category.href} 
            href={category.href}
            className="no-underline text-foreground"
          >
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <category.icon className="h-5 w-5 text-muted-foreground" />
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardTitle className="text-lg">{category.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{category.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
} 