import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  enUS,
  enGB,
  de,
  fr,
  ja,
} from 'date-fns/locale';

const locales = {
  'en-US': enUS,
  'en-GB': enGB,
  'de-DE': de,
  'fr-FR': fr,
  'ja-JP': ja,
};

interface LocaleConfig {
  currency: string;
  dateFormat: string;
  numberFormat: string;
  timezone: string;
}

export function useInternationalization() {
  const { data: userLocale = 'en-US' } = useQuery({
    queryKey: ['userLocale'],
    queryFn: async () => {
      const response = await fetch('/api/user/locale');
      if (!response.ok) {
        throw new Error('Failed to fetch user locale');
      }
      const data = await response.json();
      return data.locale;
    },
  });

  const { data: localeConfig } = useQuery<LocaleConfig>({
    queryKey: ['localeConfig', userLocale],
    queryFn: async () => {
      const response = await fetch(`/api/locales/${userLocale}/config`);
      if (!response.ok) {
        throw new Error('Failed to fetch locale config');
      }
      return response.json();
    },
  });

  const formatDate = (date: string | Date, formatStr = 'PPP') => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, formatStr, {
      locale: locales[userLocale as keyof typeof locales],
    });
  };

  const formatNumber = (number: number) => {
    return new Intl.NumberFormat(userLocale, {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(number);
  };

  const formatCurrency = (amount: number, currency?: string) => {
    return new Intl.NumberFormat(userLocale, {
      style: 'currency',
      currency: currency || localeConfig?.currency || 'USD',
    }).format(amount);
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    const rtf = new Intl.RelativeTimeFormat(userLocale, {
      numeric: 'auto',
    });

    if (diffInSeconds < 60) {
      return rtf.format(-diffInSeconds, 'second');
    }
    if (diffInSeconds < 3600) {
      return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
    }
    if (diffInSeconds < 86400) {
      return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
    }
    return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
  };

  return {
    locale: userLocale,
    config: localeConfig,
    formatDate,
    formatNumber,
    formatCurrency,
    formatRelativeTime,
  };
} 