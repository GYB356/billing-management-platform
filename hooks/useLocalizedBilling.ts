import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface LocalizedBillingOptions {
  defaultCurrency?: string;
  defaultLocale?: string;
}

interface CurrencyFormat {
  amount: string;
  withTax?: string;
  originalAmount?: string;
  exchangeRate?: number;
}

export function useLocalizedBilling(options: LocalizedBillingOptions = {}) {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get user's locale and currency preferences
  const [locale, setLocale] = useState(
    options.defaultLocale || 
    session?.user?.locale || 
    navigator.language || 
    'en-US'
  );

  const [currency, setCurrency] = useState(
    options.defaultCurrency || 
    session?.user?.preferredCurrency || 
    'USD'
  );

  // Format amount according to locale and currency
  const formatAmount = useCallback(async (
    amount: number,
    options: {
      includeTax?: boolean;
      displayCurrency?: boolean;
      customFormat?: Record<string, any>;
    } = {}
  ): Promise<string> => {
    try {
      const response = await fetch('/api/format-currency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          currency,
          locale,
          ...options,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to format currency');
      }

      const data = await response.json();
      return data.formatted;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error formatting currency');
      return amount.toString();
    }
  }, [currency, locale]);

  // Convert amount between currencies
  const convertAmount = useCallback(async (
    amount: number,
    targetCurrency: string,
    options: {
      includeDetails?: boolean;
      roundingMode?: 'ceil' | 'floor' | 'round';
    } = {}
  ): Promise<CurrencyFormat> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/convert-currency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          fromCurrency: currency,
          toCurrency: targetCurrency,
          ...options,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to convert currency');
      }

      const data = await response.json();
      return {
        amount: await formatAmount(data.amount, { displayCurrency: true }),
        withTax: data.withTax ? await formatAmount(data.withTax, { displayCurrency: true }) : undefined,
        originalAmount: await formatAmount(amount, { displayCurrency: true }),
        exchangeRate: data.rate,
      };
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error converting currency');
      return {
        amount: await formatAmount(amount, { displayCurrency: true }),
      };
    } finally {
      setIsLoading(false);
    }
  }, [currency, formatAmount]);

  // Calculate tax for the current region
  const calculateTax = useCallback(async (
    amount: number,
    options: {
      customerType?: 'business' | 'individual';
      customerCountry?: string;
      productType?: string;
    } = {}
  ): Promise<{
    taxAmount: number;
    totalAmount: number;
    details: Array<{
      type: string;
      rate: number;
      amount: number;
      description: string;
    }>;
  }> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/calculate-tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          currency,
          locale,
          ...options,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to calculate tax');
      }

      return await response.json();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error calculating tax');
      return {
        taxAmount: 0,
        totalAmount: amount,
        details: [],
      };
    } finally {
      setIsLoading(false);
    }
  }, [currency, locale]);

  // Generate localized invoice
  const generateInvoice = useCallback(async (
    invoiceData: any,
    options: {
      language?: string;
      currency?: string;
      template?: string;
    } = {}
  ): Promise<Blob | null> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/generate-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...invoiceData,
          language: options.language || locale,
          currency: options.currency || currency,
          template: options.template,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate invoice');
      }

      return await response.blob();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error generating invoice');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currency, locale]);

  // Update user's currency preference
  const updateCurrency = useCallback(async (newCurrency: string): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/update-currency-preference', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: newCurrency }),
      });

      if (!response.ok) {
        throw new Error('Failed to update currency preference');
      }

      setCurrency(newCurrency);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error updating currency preference');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update user's locale preference
  const updateLocale = useCallback(async (newLocale: string): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/update-locale-preference', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: newLocale }),
      });

      if (!response.ok) {
        throw new Error('Failed to update locale preference');
      }

      setLocale(newLocale);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error updating locale preference');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Clear any errors
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    currency,
    locale,
    isLoading,
    error,
    formatAmount,
    convertAmount,
    calculateTax,
    generateInvoice,
    updateCurrency,
    updateLocale,
    clearError,
  };
}