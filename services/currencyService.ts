import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import axios from 'axios';

interface ExchangeRate {
  sourceCurrency: string;
  targetCurrency: string;
  rate: number;
  lastUpdated: Date;
}

interface CurrencyConfiguration {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isDefault: boolean;
  isActive: boolean;
}

// Get all configured currencies
export const getAllCurrencies = async (): Promise<CurrencyConfiguration[]> => {
  const currencies = await prisma.currency.findMany({
    where: { isActive: true },
    orderBy: [
      { isDefault: 'desc' },
      { code: 'asc' },
    ],
  });

  return currencies.map(currency => ({
    code: currency.code,
    name: currency.name,
    symbol: currency.symbol,
    decimalPlaces: currency.decimalPlaces,
    isDefault: currency.isDefault,
    isActive: currency.isActive,
  }));
};

// Get a specific currency by code
export const getCurrencyByCode = async (code: string): Promise<CurrencyConfiguration | null> => {
  const currency = await prisma.currency.findUnique({
    where: { code },
  });

  if (!currency) return null;

  return {
    code: currency.code,
    name: currency.name,
    symbol: currency.symbol,
    decimalPlaces: currency.decimalPlaces,
    isDefault: currency.isDefault,
    isActive: currency.isActive,
  };
};

// Get default currency
export const getDefaultCurrency = async (): Promise<CurrencyConfiguration> => {
  const currency = await prisma.currency.findFirst({
    where: { isDefault: true },
  });

  if (!currency) {
    return {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      decimalPlaces: 2,
      isDefault: true,
      isActive: true,
    };
  }

  return {
    code: currency.code,
    name: currency.name,
    symbol: currency.symbol,
    decimalPlaces: currency.decimalPlaces,
    isDefault: currency.isDefault,
    isActive: currency.isActive,
  };
};

// Save or update a currency
export const saveCurrency = async (currency: CurrencyConfiguration): Promise<CurrencyConfiguration> => {
  const session = await getServerSession(authOptions);

  if (!session?.user.isAdmin) {
    throw new Error('Unauthorized: Admin access required');
  }

  if (currency.isDefault) {
    await prisma.currency.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  const savedCurrency = await prisma.currency.upsert({
    where: { code: currency.code },
    update: {
      name: currency.name,
      symbol: currency.symbol,
      decimalPlaces: currency.decimalPlaces,
      isDefault: currency.isDefault,
      isActive: currency.isActive,
    },
    create: {
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      decimalPlaces: currency.decimalPlaces,
      isDefault: currency.isDefault,
      isActive: currency.isActive,
    },
  });

  return {
    code: savedCurrency.code,
    name: savedCurrency.name,
    symbol: savedCurrency.symbol,
    decimalPlaces: savedCurrency.decimalPlaces,
    isDefault: savedCurrency.isDefault,
    isActive: savedCurrency.isActive,
  };
};

// Get exchange rate between currencies
export const getExchangeRate = async (
  sourceCurrency: string,
  targetCurrency: string
): Promise<number> => {
  if (sourceCurrency === targetCurrency) {
    return 1;
  }

  const rateRecord = await prisma.exchangeRate.findFirst({
    where: {
      sourceCurrency,
      targetCurrency,
      updatedAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
  });

  if (rateRecord) {
    return rateRecord.rate;
  }

  const rate = await fetchExchangeRateFromApi(sourceCurrency, targetCurrency);

  await prisma.exchangeRate.upsert({
    where: {
      sourceCurrency_targetCurrency: {
        sourceCurrency,
        targetCurrency,
      },
    },
    update: {
      rate,
    },
    create: {
      sourceCurrency,
      targetCurrency,
      rate,
    },
  });

  return rate;
};

// Convert amount between currencies
export const convertAmount = async (
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> => {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  const rate = await getExchangeRate(fromCurrency, toCurrency);
  return amount * rate;
};

// Fetch exchange rate from external API
const fetchExchangeRateFromApi = async (
  sourceCurrency: string,
  targetCurrency: string
): Promise<number> => {
  try {
    const response = await axios.get(
      `https://api.exchangerate.host/latest?base=${sourceCurrency}&symbols=${targetCurrency}`
    );

    if (response.data && response.data.rates && response.data.rates[targetCurrency]) {
      return response.data.rates[targetCurrency];
    }

    throw new Error('Could not retrieve exchange rate from API');
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    throw new Error(`Failed to get exchange rate from ${sourceCurrency} to ${targetCurrency}`);
  }
};

// Get all exchange rates
export const getAllExchangeRates = async (): Promise<ExchangeRate[]> => {
  const rates = await prisma.exchangeRate.findMany({
    orderBy: [
      { sourceCurrency: 'asc' },
      { targetCurrency: 'asc' },
    ],
  });

  return rates.map(rate => ({
    sourceCurrency: rate.sourceCurrency,
    targetCurrency: rate.targetCurrency,
    rate: rate.rate,
    lastUpdated: rate.updatedAt,
  }));
};

// Update all exchange rates (can be run via cron job)
export const updateAllExchangeRates = async (): Promise<number> => {
  const session = await getServerSession(authOptions);

  if (!session?.user.isAdmin) {
    throw new Error('Unauthorized: Admin access required');
  }

  const currencies = await getAllCurrencies();
  const defaultCurrency = await getDefaultCurrency();

  let updatedCount = 0;

  for (const sourceCurrency of currencies) {
    for (const targetCurrency of currencies) {
      if (sourceCurrency.code !== targetCurrency.code) {
        try {
          const rate = await fetchExchangeRateFromApi(
            sourceCurrency.code,
            targetCurrency.code
          );

          await prisma.exchangeRate.upsert({
            where: {
              sourceCurrency_targetCurrency: {
                sourceCurrency: sourceCurrency.code,
                targetCurrency: targetCurrency.code,
              },
            },
            update: { rate },
            create: {
              sourceCurrency: sourceCurrency.code,
              targetCurrency: targetCurrency.code,
              rate,
            },
          });

          updatedCount++;
        } catch (error) {
          console.error(
            `Failed direct conversion ${sourceCurrency.code} to ${targetCurrency.code}, ` +
            `trying through default currency ${defaultCurrency.code}`, 
            error
          );

          try {
            if (sourceCurrency.code !== defaultCurrency.code && 
                targetCurrency.code !== defaultCurrency.code) {
              const sourceToDefault = await fetchExchangeRateFromApi(
                sourceCurrency.code,
                defaultCurrency.code
              );

              const defaultToTarget = await fetchExchangeRateFromApi(
                defaultCurrency.code,
                targetCurrency.code
              );

              const rate = sourceToDefault * defaultToTarget;

              await prisma.exchangeRate.upsert({
                where: {
                  sourceCurrency_targetCurrency: {
                    sourceCurrency: sourceCurrency.code,
                    targetCurrency: targetCurrency.code,
                  },
                },
                update: { rate },
                create: {
                  sourceCurrency: sourceCurrency.code,
                  targetCurrency: targetCurrency.code,
                  rate,
                },
              });

              updatedCount++;
            }
          } catch (innerError) {
            console.error(
              `Failed to update rate from ${sourceCurrency.code} to ${targetCurrency.code}`,
              innerError
            );
          }
        }
      }
    }
  }

  return updatedCount;
};