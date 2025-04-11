import { useCallback } from 'react';
import { I18nService } from '../lib/i18n-service';

export function useI18n() {
  const i18nService = I18nService.getInstance();

  const formatCurrency = useCallback((amount: number, currency: string, locale: string) => {
    return i18nService.formatCurrency(amount, currency, locale);
  }, []);

  const formatDate = useCallback((date: Date, format: string, locale: string) => {
    return i18nService.formatDate(date, format, locale);
  }, []);

  const translate = useCallback(async (key: string, namespace: string, locale: string) => {
    return i18nService.getTranslation(key, namespace, locale);
  }, []);

  const getBillingTranslations = useCallback(async (locale: string) => {
    return i18nService.translateBillingTerms(locale);
  }, []);

  return {
    formatCurrency,
    formatDate,
    translate,
    getBillingTranslations,
  };
}