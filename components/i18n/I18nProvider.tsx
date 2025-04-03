'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useCustomer } from '@/hooks/useCustomer';
import { getAllTranslationsForLocale, getDefaultLocale } from '@/services/localizationService';

interface I18nContextType {
  locale: string;
  translations: Record<string, Record<string, string>>;
  t: (key: string, namespace?: string, params?: Record<string, string | number>) => string;
  changeLocale: (locale: string) => Promise<void>;
  isLoading: boolean;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en-US',
  translations: {},
  t: (key) => key,
  changeLocale: async () => {},
  isLoading: true,
});

export const useI18n = () => useContext(I18nContext);

interface I18nProviderProps {
  children: React.ReactNode;
  defaultNamespace?: string;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({
  children,
  defaultNamespace = 'common',
}) => {
  const { data: session } = useSession();
  const { customer } = useCustomer();
  const [locale, setLocale] = useState<string>('en-US');
  const [translations, setTranslations] = useState<Record<string, Record<string, string>>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        setIsLoading(true);
        const allTranslations = await getAllTranslationsForLocale(locale);
        setTranslations(allTranslations);
      } catch (error) {
        console.error(`Error loading translations for locale ${locale}:`, error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTranslations();
  }, [locale]);

  useEffect(() => {
    const initializeLocale = async () => {
      try {
        const defaultLocale = await getDefaultLocale();
        let initialLocale = defaultLocale.code;

        if (customer?.preferredLocale) {
          initialLocale = customer.preferredLocale;
        } else if (typeof navigator !== 'undefined') {
          const browserLocale = navigator.language;
          initialLocale = browserLocale || defaultLocale.code;
        }

        setLocale(initialLocale);
      } catch (error) {
        console.error('Error initializing locale:', error);
        setLocale('en-US');
      }
    };

    if (session) {
      initializeLocale();
    }
  }, [session, customer]);

  const translate = (key: string, namespace = defaultNamespace, params?: Record<string, string | number>): string => {
    if (!translations[namespace]) {
      return key;
    }

    const translation = translations[namespace][key];

    if (!translation) {
      return key;
    }

    if (params) {
      return Object.entries(params).reduce(
        (acc, [paramKey, paramValue]) => 
          acc.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(paramValue)),
        translation
      );
    }

    return translation;
  };

  const changeLocale = async (newLocale: string): Promise<void> => {
    setLocale(newLocale);
  };

  const contextValue: I18nContextType = {
    locale,
    translations,
    t: translate,
    changeLocale,
    isLoading,
  };

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
};

export default I18nProvider;
