import { prisma } from './prisma';
import { formatDistanceToNow, format } from 'date-fns';
import { enUS, fr, de, es, ja, zhCN } from 'date-fns/locale';

export type SupportedLocale = 
  | 'en-US' 
  | 'fr-FR' 
  | 'de-DE' 
  | 'es-ES' 
  | 'ja-JP' 
  | 'zh-CN';

export interface LocaleInfo {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  dateLocale: Locale;
  numberFormat: {
    currency: {
      style: string;
      currencyDisplay: string;
    };
    number: {
      style: string;
    };
    percent: {
      style: string;
    };
  };
  direction: 'ltr' | 'rtl';
  isActive: boolean;
}

export type TranslationKey = string;
export type TranslationValues = Record<string, string | number | Date | boolean>;

export class I18nService {
  private static supportedLocales: Record<SupportedLocale, LocaleInfo> = {
    'en-US': {
      code: 'en-US',
      name: 'English (US)',
      nativeName: 'English (US)',
      dateLocale: enUS,
      numberFormat: {
        currency: {
          style: 'currency',
          currencyDisplay: 'symbol'
        },
        number: {
          style: 'decimal'
        },
        percent: {
          style: 'percent'
        }
      },
      direction: 'ltr',
      isActive: true
    },
    'fr-FR': {
      code: 'fr-FR',
      name: 'French',
      nativeName: 'Français',
      dateLocale: fr,
      numberFormat: {
        currency: {
          style: 'currency',
          currencyDisplay: 'symbol'
        },
        number: {
          style: 'decimal'
        },
        percent: {
          style: 'percent'
        }
      },
      direction: 'ltr',
      isActive: true
    },
    'de-DE': {
      code: 'de-DE',
      name: 'German',
      nativeName: 'Deutsch',
      dateLocale: de,
      numberFormat: {
        currency: {
          style: 'currency',
          currencyDisplay: 'symbol'
        },
        number: {
          style: 'decimal'
        },
        percent: {
          style: 'percent'
        }
      },
      direction: 'ltr',
      isActive: true
    },
    'es-ES': {
      code: 'es-ES',
      name: 'Spanish',
      nativeName: 'Español',
      dateLocale: es,
      numberFormat: {
        currency: {
          style: 'currency',
          currencyDisplay: 'symbol'
        },
        number: {
          style: 'decimal'
        },
        percent: {
          style: 'percent'
        }
      },
      direction: 'ltr',
      isActive: true
    },
    'ja-JP': {
      code: 'ja-JP',
      name: 'Japanese',
      nativeName: '日本語',
      dateLocale: ja,
      numberFormat: {
        currency: {
          style: 'currency',
          currencyDisplay: 'symbol'
        },
        number: {
          style: 'decimal'
        },
        percent: {
          style: 'percent'
        }
      },
      direction: 'ltr',
      isActive: true
    },
    'zh-CN': {
      code: 'zh-CN',
      name: 'Chinese (Simplified)',
      nativeName: '中文(简体)',
      dateLocale: zhCN,
      numberFormat: {
        currency: {
          style: 'currency',
          currencyDisplay: 'symbol'
        },
        number: {
          style: 'decimal'
        },
        percent: {
          style: 'percent'
        }
      },
      direction: 'ltr',
      isActive: true
    }
  };

  private static translations: Record<SupportedLocale, Record<string, string>> = {
    'en-US': {},
    'fr-FR': {},
    'de-DE': {},
    'es-ES': {},
    'ja-JP': {},
    'zh-CN': {}
  };

  private static defaultLocale: SupportedLocale = 'en-US';
  private static translationsLoaded = false;

  /**
   * Initialize translations from database
   */
  static async initialize(): Promise<void> {
    if (this.translationsLoaded) {
      return;
    }

    try {
      // Load translations from database
      const allTranslations = await prisma.translation.findMany();
      
      // Organize translations by locale
      for (const translation of allTranslations) {
        const locale = translation.locale as SupportedLocale;
        
        if (this.isLocaleSupported(locale)) {
          this.translations[locale][translation.key] = translation.value;
        }
      }
      
      this.translationsLoaded = true;
    } catch (error) {
      console.error('Error loading translations:', error);
      // Load fallback values from code
      this.loadFallbackTranslations();
    }
  }

  /**
   * Load basic fallback translations from code
   */
  private static loadFallbackTranslations(): void {
    // Basic billing translations
    const basicTranslations: Record<TranslationKey, Record<SupportedLocale, string>> = {
      'billing.invoice.title': {
        'en-US': 'Invoice',
        'fr-FR': 'Facture',
        'de-DE': 'Rechnung',
        'es-ES': 'Factura',
        'ja-JP': '請求書',
        'zh-CN': '发票'
      },
      'billing.invoice.number': {
        'en-US': 'Invoice Number',
        'fr-FR': 'Numéro de facture',
        'de-DE': 'Rechnungsnummer',
        'es-ES': 'Número de factura',
        'ja-JP': '請求書番号',
        'zh-CN': '发票号码'
      },
      'billing.invoice.date': {
        'en-US': 'Invoice Date',
        'fr-FR': 'Date de facturation',
        'de-DE': 'Rechnungsdatum',
        'es-ES': 'Fecha de factura',
        'ja-JP': '請求日',
        'zh-CN': '发票日期'
      },
      'billing.invoice.dueDate': {
        'en-US': 'Due Date',
        'fr-FR': 'Date d\'échéance',
        'de-DE': 'Fälligkeitsdatum',
        'es-ES': 'Fecha de vencimiento',
        'ja-JP': '支払期日',
        'zh-CN': '到期日'
      },
      'billing.invoice.total': {
        'en-US': 'Total',
        'fr-FR': 'Total',
        'de-DE': 'Gesamtbetrag',
        'es-ES': 'Total',
        'ja-JP': '合計',
        'zh-CN': '总计'
      },
      'billing.invoice.subtotal': {
        'en-US': 'Subtotal',
        'fr-FR': 'Sous-total',
        'de-DE': 'Zwischensumme',
        'es-ES': 'Subtotal',
        'ja-JP': '小計',
        'zh-CN': '小计'
      },
      'billing.invoice.tax': {
        'en-US': 'Tax',
        'fr-FR': 'Taxe',
        'de-DE': 'Steuer',
        'es-ES': 'Impuesto',
        'ja-JP': '税金',
        'zh-CN': '税费'
      },
      'billing.subscription.active': {
        'en-US': 'Active',
        'fr-FR': 'Actif',
        'de-DE': 'Aktiv',
        'es-ES': 'Activo',
        'ja-JP': 'アクティブ',
        'zh-CN': '有效'
      },
      'billing.subscription.canceled': {
        'en-US': 'Canceled',
        'fr-FR': 'Annulé',
        'de-DE': 'Gekündigt',
        'es-ES': 'Cancelado',
        'ja-JP': 'キャンセル済み',
        'zh-CN': '已取消'
      },
      'billing.subscription.paused': {
        'en-US': 'Paused',
        'fr-FR': 'En pause',
        'de-DE': 'Pausiert',
        'es-ES': 'Pausado',
        'ja-JP': '一時停止',
        'zh-CN': '已暂停'
      },
      'billing.payment.success': {
        'en-US': 'Payment successful',
        'fr-FR': 'Paiement réussi',
        'de-DE': 'Zahlung erfolgreich',
        'es-ES': 'Pago exitoso',
        'ja-JP': '支払い成功',
        'zh-CN': '支付成功'
      },
      'billing.payment.failed': {
        'en-US': 'Payment failed',
        'fr-FR': 'Échec du paiement',
        'de-DE': 'Zahlung fehlgeschlagen',
        'es-ES': 'Pago fallido',
        'ja-JP': '支払い失敗',
        'zh-CN': '支付失败'
      }
    };
    
    // Load into translations object
    Object.entries(basicTranslations).forEach(([key, locales]) => {
      Object.entries(locales).forEach(([locale, value]) => {
        this.translations[locale as SupportedLocale][key] = value;
      });
    });
    
    this.translationsLoaded = true;
  }

  /**
   * Get list of supported locales
   */
  static getSupportedLocales(): LocaleInfo[] {
    return Object.values(this.supportedLocales)
      .filter(locale => locale.isActive);
  }

  /**
   * Check if locale is supported
   */
  static isLocaleSupported(locale: string): boolean {
    return locale in this.supportedLocales && this.supportedLocales[locale as SupportedLocale].isActive;
  }

  /**
   * Get default locale if requested locale is not supported
   */
  static getSafeLocale(locale?: string): SupportedLocale {
    if (locale && this.isLocaleSupported(locale)) {
      return locale as SupportedLocale;
    }
    return this.defaultLocale;
  }

  /**
   * Translate key into requested locale
   */
  static translate(
    key: TranslationKey,
    locale?: string,
    values?: TranslationValues
  ): string {
    // Force initialization if not done yet
    if (!this.translationsLoaded) {
      this.loadFallbackTranslations();
    }
    
    const safeLocale = this.getSafeLocale(locale);
    
    // Get translation for key
    let translation = this.translations[safeLocale][key];
    
    // Fallback to default locale if translation not found
    if (!translation && safeLocale !== this.defaultLocale) {
      translation = this.translations[this.defaultLocale][key];
    }
    
    // Fallback to key if no translation found
    if (!translation) {
      console.warn(`Missing translation for key: ${key}`);
      translation = key;
    }
    
    // Replace placeholders with values
    if (values) {
      translation = this.interpolateValues(translation, values, safeLocale);
    }
    
    return translation;
  }

  /**
   * Replace placeholders with values
   * @private
   */
  private static interpolateValues(
    text: string,
    values: TranslationValues,
    locale: SupportedLocale
  ): string {
    return text.replace(/\{(\w+)(?::(\w+))?\}/g, (match, key, format) => {
      const value = values[key];
      
      if (value === undefined) {
        console.warn(`Missing value for placeholder: ${key}`);
        return match;
      }
      
      // Format value based on type and format specifier
      if (value instanceof Date) {
        return this.formatDate(value, format, locale);
      } else if (typeof value === 'number') {
        return this.formatNumber(value, format, locale);
      } else {
        return String(value);
      }
    });
  }

  /**
   * Format date according to locale
   */
  static formatDate(
    date: Date,
    format?: string,
    locale?: string
  ): string {
    const safeLocale = this.getSafeLocale(locale);
    const localeInfo = this.supportedLocales[safeLocale];
    
    // Format based on format string
    switch (format) {
      case 'short':
        return this.formatDateShort(date, localeInfo.dateLocale);
      case 'long':
        return this.formatDateLong(date, localeInfo.dateLocale);
      case 'relative':
        return this.formatDateRelative(date, localeInfo.dateLocale);
      case 'time':
        return this.formatTime(date, localeInfo.dateLocale);
      default:
        return this.formatDateDefault(date, localeInfo.dateLocale);
    }
  }

  /**
   * Format date in short format
   * @private
   */
  private static formatDateShort(date: Date, dateLocale: Locale): string {
    return format(date, 'P', { locale: dateLocale });
  }

  /**
   * Format date in long format
   * @private
   */
  private static formatDateLong(date: Date, dateLocale: Locale): string {
    return format(date, 'PPP', { locale: dateLocale });
  }

  /**
   * Format date as relative time
   * @private
   */
  private static formatDateRelative(date: Date, dateLocale: Locale): string {
    return formatDistanceToNow(date, { addSuffix: true, locale: dateLocale });
  }

  /**
   * Format time
   * @private
   */
  private static formatTime(date: Date, dateLocale: Locale): string {
    return format(date, 'p', { locale: dateLocale });
  }

  /**
   * Format date in default format
   * @private
   */
  private static formatDateDefault(date: Date, dateLocale: Locale): string {
    return format(date, 'PP', { locale: dateLocale });
  }

  /**
   * Format number according to locale
   */
  static formatNumber(
    number: number,
    format?: string,
    locale?: string
  ): string {
    const safeLocale = this.getSafeLocale(locale);
    
    // Format based on format string
    switch (format) {
      case 'currency':
        return this.formatCurrency(number, undefined, safeLocale);
      case 'percent':
        return this.formatPercent(number, safeLocale);
      default:
        return this.formatDecimal(number, safeLocale);
    }
  }

  /**
   * Format currency
   */
  static formatCurrency(
    amount: number,
    currency?: string,
    locale?: string
  ): string {
    const safeLocale = this.getSafeLocale(locale);
    
    return new Intl.NumberFormat(safeLocale, {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  }

  /**
   * Format percent
   * @private
   */
  private static formatPercent(number: number, locale: SupportedLocale): string {
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      maximumFractionDigits: 2
    }).format(number / 100);
  }

  /**
   * Format decimal
   * @private
   */
  private static formatDecimal(number: number, locale: SupportedLocale): string {
    return new Intl.NumberFormat(locale, {
      style: 'decimal'
    }).format(number);
  }

  /**
   * Add or update translation
   */
  static async setTranslation(
    key: TranslationKey,
    locale: SupportedLocale,
    value: string
  ): Promise<boolean> {
    try {
      await prisma.translation.upsert({
        where: {
          key_locale: {
            key,
            locale
          }
        },
        update: {
          value
        },
        create: {
          key,
          locale,
          value
        }
      });
      
      // Update in-memory translations
      this.translations[locale][key] = value;
      
      return true;
    } catch (error) {
      console.error('Error setting translation:', error);
      return false;
    }
  }

  /**
   * Get user's preferred locale from settings or browser
   */
  static async getUserPreferredLocale(userId: string, browserLocale?: string): Promise<SupportedLocale> {
    try {
      // Try to get from user settings
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          settings: true
        }
      });
      
      if (user?.settings?.preferredLocale && this.isLocaleSupported(user.settings.preferredLocale as string)) {
        return user.settings.preferredLocale as SupportedLocale;
      }
      
      // Try to use browser locale
      if (browserLocale) {
        // Extract language and region code
        const [language, region] = browserLocale.split('-');
        
        // Try exact match first
        if (this.isLocaleSupported(browserLocale)) {
          return browserLocale as SupportedLocale;
        }
        
        // Try to find a match with same language
        const matchingLocale = Object.keys(this.supportedLocales).find(
          locale => locale.startsWith(language)
        );
        
        if (matchingLocale && this.isLocaleSupported(matchingLocale)) {
          return matchingLocale as SupportedLocale;
        }
      }
      
      // Fallback to default
      return this.defaultLocale;
    } catch (error) {
      console.error('Error getting user preferred locale:', error);
      return this.defaultLocale;
    }
  }

  /**
   * Update user's preferred locale
   */
  static async setUserPreferredLocale(userId: string, locale: SupportedLocale): Promise<boolean> {
    try {
      if (!this.isLocaleSupported(locale)) {
        return false;
      }
      
      // Get current user settings
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          settings: true
        }
      });
      
      // Update settings
      await prisma.user.update({
        where: { id: userId },
        data: {
          settings: {
            ...user?.settings as Record<string, any>,
            preferredLocale: locale
          }
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error setting user preferred locale:', error);
      return false;
    }
  }
} 