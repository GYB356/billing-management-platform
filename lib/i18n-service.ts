import { prisma } from './prisma';
import { formatDistance, format } from 'date-fns';
import * as locales from 'date-fns/locale';

export class I18nService {
  private locale: string;
  private cache: Map<string, Map<string, string>>;

  constructor(locale: string = 'en') {
    this.locale = locale;
    this.cache = new Map();
  }

  async loadNamespace(namespace: string): Promise<void> {
    if (!this.cache.has(namespace)) {
      const translations = await prisma.translation.findMany({
        where: { namespace, locale: this.locale }
      });
      
      const namespaceMap = new Map();
      translations.forEach(t => namespaceMap.set(t.key, t.value));
      this.cache.set(namespace, namespaceMap);
    }
  }

  async translate(key: string, namespace: string, params: Record<string, string> = {}): Promise<string> {
    await this.loadNamespace(namespace);
    const translation = this.cache.get(namespace)?.get(key) || key;
    
    return Object.entries(params).reduce(
      (text, [key, value]) => text.replace(`{{${key}}}`, value),
      translation
    );
  }

  formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat(this.locale, {
      style: 'currency',
      currency
    }).format(amount);
  }

  formatDate(date: Date, pattern: string = 'PPP'): string {
    return format(date, pattern, {
      locale: locales[this.locale] || locales.enUS
    });
  }

  formatRelativeTime(date: Date): string {
    return formatDistance(date, new Date(), {
      addSuffix: true,
      locale: locales[this.locale] || locales.enUS
    });
  }
}

export const defaultI18nService = new I18nService();