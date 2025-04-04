import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

interface Locale {
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
}

interface Translation {
  id: string;
  locale: string;
  namespace: string;
  key: string;
  value: string;
}

// Get all configured locales
export const getAllLocales = async (): Promise<Locale[]> => {
  const locales = await prisma.locale.findMany({
    where: { isActive: true },
    orderBy: [
      { isDefault: 'desc' },
      { code: 'asc' },
    ],
  });

  return locales.map(locale => ({
    code: locale.code,
    name: locale.name,
    isDefault: locale.isDefault,
    isActive: locale.isActive,
  }));
};

// Get a specific locale by code
export const getLocaleByCode = async (code: string): Promise<Locale | null> => {
  const locale = await prisma.locale.findUnique({
    where: { code },
  });

  if (!locale) return null;

  return {
    code: locale.code,
    name: locale.name,
    isDefault: locale.isDefault,
    isActive: locale.isActive,
  };
};

// Get default locale
export const getDefaultLocale = async (): Promise<Locale> => {
  const locale = await prisma.locale.findFirst({
    where: { isDefault: true },
  });

  if (!locale) {
    return {
      code: 'en-US',
      name: 'English (US)',
      isDefault: true,
      isActive: true,
    };
  }

  return {
    code: locale.code,
    name: locale.name,
    isDefault: locale.isDefault,
    isActive: locale.isActive,
  };
};

// Save or update a locale
export const saveLocale = async (locale: Locale): Promise<Locale> => {
  const session = await getServerSession(authOptions);

  if (!session?.user.isAdmin) {
    throw new Error('Unauthorized: Admin access required');
  }

  if (locale.isDefault) {
    await prisma.locale.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  const savedLocale = await prisma.locale.upsert({
    where: { code: locale.code },
    update: {
      name: locale.name,
      isDefault: locale.isDefault,
      isActive: locale.isActive,
    },
    create: {
      code: locale.code,
      name: locale.name,
      isDefault: locale.isDefault,
      isActive: locale.isActive,
    },
  });

  return {
    code: savedLocale.code,
    name: savedLocale.name,
    isDefault: savedLocale.isDefault,
    isActive: savedLocale.isActive,
  };
};

// Delete a locale (only if not default and not used by any customers)
export const deleteLocale = async (code: string): Promise<void> => {
  const session = await getServerSession(authOptions);

  if (!session?.user.isAdmin) {
    throw new Error('Unauthorized: Admin access required');
  }

  const locale = await prisma.locale.findUnique({
    where: { code },
  });

  if (!locale) {
    throw new Error(`Locale ${code} not found`);
  }

  if (locale.isDefault) {
    throw new Error('Cannot delete the default locale');
  }

  const customerCount = await prisma.customer.count({
    where: { preferredLocale: code },
  });

  if (customerCount > 0) {
    throw new Error(`Cannot delete locale ${code} because it is used by ${customerCount} customers`);
  }

  await prisma.translation.deleteMany({
    where: { locale: code },
  });

  await prisma.locale.delete({
    where: { code },
  });
};

// Get translations for a namespace in a specific locale
export const getTranslations = async (
  locale: string,
  namespace: string
): Promise<Record<string, string>> => {
  const translations = await prisma.translation.findMany({
    where: {
      locale,
      namespace,
    },
  });

  return translations.reduce((acc, translation) => {
    acc[translation.key] = translation.value;
    return acc;
  }, {} as Record<string, string>);
};

// Get all translations for a specific locale
export const getAllTranslationsForLocale = async (
  locale: string
): Promise<Record<string, Record<string, string>>> => {
  const translations = await prisma.translation.findMany({
    where: {
      locale,
    },
  });

  return translations.reduce((acc, translation) => {
    if (!acc[translation.namespace]) {
      acc[translation.namespace] = {};
    }
    acc[translation.namespace][translation.key] = translation.value;
    return acc;
  }, {} as Record<string, Record<string, string>>);
};

// Save a translation
export const saveTranslation = async (
  translation: Omit<Translation, 'id'>
): Promise<Translation> => {
  const session = await getServerSession(authOptions);

  if (!session?.user.isAdmin) {
    throw new Error('Unauthorized: Admin access required');
  }

  const locale = await prisma.locale.findUnique({
    where: { code: translation.locale },
  });

  if (!locale) {
    throw new Error(`Locale ${translation.locale} not found`);
  }

  const savedTranslation = await prisma.translation.upsert({
    where: {
      locale_namespace_key: {
        locale: translation.locale,
        namespace: translation.namespace,
        key: translation.key,
      },
    },
    update: {
      value: translation.value,
    },
    create: {
      locale: translation.locale,
      namespace: translation.namespace,
      key: translation.key,
      value: translation.value,
    },
  });

  return {
    id: savedTranslation.id,
    locale: savedTranslation.locale,
    namespace: savedTranslation.namespace,
    key: savedTranslation.key,
    value: savedTranslation.value,
  };
};

// Save multiple translations at once
export const saveTranslations = async (
  translations: Omit<Translation, 'id'>[]
): Promise<number> => {
  const session = await getServerSession(authOptions);

  if (!session?.user.isAdmin) {
    throw new Error('Unauthorized: Admin access required');
  }

  let savedCount = 0;
  for (const translation of translations) {
    try {
      await saveTranslation(translation);
      savedCount++;
    } catch (error) {
      console.error(`Error saving translation ${translation.locale}.${translation.namespace}.${translation.key}:`, error);
    }
  }

  return savedCount;
};

// Import translations from a file (JSON format)
export const importTranslations = async (
  locale: string,
  namespace: string,
  translations: Record<string, string>
): Promise<number> => {
  const session = await getServerSession(authOptions);

  if (!session?.user.isAdmin) {
    throw new Error('Unauthorized: Admin access required');
  }

  const localeExists = await prisma.locale.findUnique({
    where: { code: locale },
  });

  if (!localeExists) {
    throw new Error(`Locale ${locale} not found`);
  }

  const translationsArray = Object.entries(translations).map(([key, value]) => ({
    locale,
    namespace,
    key,
    value,
  }));

  return saveTranslations(translationsArray);
};

// Get a customer's preferred locale, or the default if none set
export const getCustomerLocale = async (customerId: string): Promise<string> => {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { preferredLocale: true },
  });

  if (customer?.preferredLocale) {
    const localeExists = await prisma.locale.findUnique({
      where: { code: customer.preferredLocale, isActive: true },
    });

    if (localeExists) {
      return customer.preferredLocale;
    }
  }

  const defaultLocale = await getDefaultLocale();
  return defaultLocale.code;
};

// Update a customer's preferred locale
export const updateCustomerLocale = async (
  customerId: string,
  localeCode: string
): Promise<void> => {
  const locale = await prisma.locale.findUnique({
    where: { code: localeCode, isActive: true },
  });

  if (!locale) {
    throw new Error(`Locale ${localeCode} not found or is inactive`);
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: { preferredLocale: localeCode },
  });
};