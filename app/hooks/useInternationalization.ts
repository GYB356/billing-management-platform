import { useEffect, useMemo, useCallback } from 'react';
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
} as const;

type SupportedLocale = keyof typeof locales;

interface LocaleConfig {
  currency: string;
  dateFormat: string;
  numberFormat: string;
  timezone: string;
}

const DEFAULT_LOCALE: SupportedLocale = 'en-US';
const DEFAULT_CURRENCY = 'USD';

export function useInternationalization() {
  const { data: userLocale = DEFAULT_LOCALE, error: localeError } = useQuery({
    queryKey: ['userLocale'],
    queryFn: async () => {
      try {
      const response = await fetch('/api/user/locale');
      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
        return data.locale as SupportedLocale;
      } catch (error) {
        console.error('Failed to fetch user locale:', error);
        return DEFAULT_LOCALE;
      }
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const { data: localeConfig, error: configError } = useQuery<LocaleConfig>({
    queryKey: ['localeConfig', userLocale],
    queryFn: async () => {
      try {
      const response = await fetch(`/api/locales/${userLocale}/config`);
      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      } catch (error) {
        console.error('Failed to fetch locale config:', error);
        return {
          currency: DEFAULT_CURRENCY,
          dateFormat: 'PPP',
          numberFormat: 'decimal',
          timezone: 'UTC',
        };
      }
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const formatDate = useCallback((date: string | Date, formatStr = 'PPP') => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    try {
    return format(dateObj, formatStr, {
        locale: locales[userLocale],
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return format(dateObj, formatStr, { locale: locales[DEFAULT_LOCALE] });
    }
  }, [userLocale]);

  const formatNumber = useCallback((number: number) => {
    try {
    return new Intl.NumberFormat(userLocale, {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(number);
    } catch (error) {
      console.error('Error formatting number:', error);
      return number.toString();
    }
  }, [userLocale]);

  const formatCurrency = useCallback((amount: number, currency?: string) => {
    try {
    return new Intl.NumberFormat(userLocale, {
      style: 'currency',
        currency: currency || localeConfig?.currency || DEFAULT_CURRENCY,
    }).format(amount);
    } catch (error) {
      console.error('Error formatting currency:', error);
      return `${currency || DEFAULT_CURRENCY} ${amount.toFixed(2)}`;
    }
  }, [userLocale, localeConfig]);

  const formatRelativeTime = useCallback((date: Date) => {
    try {
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
    } catch (error) {
      console.error('Error formatting relative time:', error);
      return formatDate(date);
    }
  }, [userLocale, formatDate]);

  return {
    locale: userLocale,
    config: localeConfig,
    formatDate,
    formatNumber,
    formatCurrency,
    formatRelativeTime,
    isLoading: !localeConfig,
    hasError: Boolean(localeError || configError),
  };
} 