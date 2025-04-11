import { prisma } from '../prisma';
import { stripe } from '../stripe';
import { CurrencyService } from '../currency';
import { i18n } from 'next-i18next';

interface LocaleConfig {
  currency: string;
  dateFormat: string;
  numberFormat: string;
  timezone: string;
}

export class InternationalizationService {
  private static localeConfigs: Record<string, LocaleConfig> = {
    'en-US': {
      currency: 'USD',
      dateFormat: 'MM/dd/yyyy',
      numberFormat: '1,234.56',
      timezone: 'America/New_York'
    },
    'en-GB': {
      currency: 'GBP',
      dateFormat: 'dd/MM/yyyy',
      numberFormat: '1,234.56',
      timezone: 'Europe/London'
    },
    'de-DE': {
      currency: 'EUR',
      dateFormat: 'dd.MM.yyyy',
      numberFormat: '1.234,56',
      timezone: 'Europe/Berlin'
    },
    'fr-FR': {
      currency: 'EUR',
      dateFormat: 'dd/MM/yyyy',
      numberFormat: '1 234,56',
      timezone: 'Europe/Paris'
    },
    'ja-JP': {
      currency: 'JPY',
      dateFormat: 'yyyy/MM/dd',
      numberFormat: '1,234',
      timezone: 'Asia/Tokyo'
    }
  };

  static async setUserLocale(userId: string, locale: string) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { locale }
      });

      // Update Stripe customer locale if exists
      const customer = await prisma.customer.findFirst({
        where: { userId }
      });

      if (customer?.stripeCustomerId) {
        await stripe.customers.update(customer.stripeCustomerId, {
          preferred_locales: [locale]
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Error setting user locale:', error);
      throw new Error('Failed to set user locale');
    }
  }

  static async getLocalizedPricing(planId: string, locale: string) {
    try {
      const plan = await prisma.plan.findUnique({
        where: { id: planId },
        include: { prices: true }
      });

      if (!plan) throw new Error('Plan not found');

      const localeConfig = this.localeConfigs[locale] || this.localeConfigs['en-US'];
      const price = plan.prices.find(p => p.currency === localeConfig.currency) || plan.prices[0];

      return {
        amount: price.amount,
        currency: price.currency,
        formattedPrice: new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: price.currency
        }).format(price.amount)
      };
    } catch (error) {
      console.error('Error getting localized pricing:', error);
      throw new Error('Failed to get localized pricing');
    }
  }

  static async getLocalizedInvoice(invoiceId: string, locale: string) {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          items: true,
          customer: {
            include: { organization: true }
          }
        }
      });

      if (!invoice) throw new Error('Invoice not found');

      const localeConfig = this.localeConfigs[locale] || this.localeConfigs['en-US'];

      return {
        ...invoice,
        formattedDate: new Intl.DateTimeFormat(locale, {
          dateStyle: 'full',
          timeZone: localeConfig.timezone
        }).format(invoice.createdAt),
        formattedDueDate: new Intl.DateTimeFormat(locale, {
          dateStyle: 'full',
          timeZone: localeConfig.timezone
        }).format(invoice.dueDate),
        items: invoice.items.map(item => ({
          ...item,
          formattedAmount: new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: invoice.currency
          }).format(item.amount)
        })),
        formattedTotal: new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: invoice.currency
        }).format(invoice.totalAmount)
      };
    } catch (error) {
      console.error('Error getting localized invoice:', error);
      throw new Error('Failed to get localized invoice');
    }
  }

  static async updateCurrencyRates() {
    try {
      const response = await fetch(
        `https://api.exchangerate-api.com/v4/latest/USD`
      );
      const data = await response.json();

      // Store exchange rates in database
      await prisma.exchangeRate.deleteMany();
      
      const rates = Object.entries(data.rates).map(([currency, rate]) => ({
        fromCurrency: 'USD',
        toCurrency: currency,
        rate: rate as number,
        updatedAt: new Date()
      }));

      await prisma.exchangeRate.createMany({
        data: rates
      });

      return { success: true, updatedAt: new Date() };
    } catch (error) {
      console.error('Error updating currency rates:', error);
      throw new Error('Failed to update currency rates');
    }
  }

  static getLocaleConfig(locale: string): LocaleConfig {
    return this.localeConfigs[locale] || this.localeConfigs['en-US'];
  }
}
