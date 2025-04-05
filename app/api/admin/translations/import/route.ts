import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { I18nService, SupportedLocale } from '@/lib/i18n-service';
import { z } from 'zod';

// Schema for translation import
const translationImportSchema = z.object({
  locale: z.string().refine(val => I18nService.isValidLocale(val as SupportedLocale), {
    message: 'Invalid locale',
  }),
  translations: z.record(z.any()),
});

// POST /api/admin/translations/import
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated and has admin role
    if (!session?.user?.id || session?.user?.role !== 'ADMIN') {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const body = await req.json();
    
    // Validate request body
    const result = translationImportSchema.safeParse(body);
    if (!result.success) {
      return new NextResponse(JSON.stringify({ error: result.error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const { locale, translations } = result.data;
    
    // Process translations and add them to the database
    const flattenedTranslations = flattenTranslations(translations);
    let importedCount = 0;
    
    for (const [key, value] of Object.entries(flattenedTranslations)) {
      if (typeof value !== 'string') continue;
      
      // Create or update translation in database
      await prisma.translation.upsert({
        where: {
          locale_key: {
            locale,
            key,
          },
        },
        update: {
          value,
          updatedAt: new Date(),
        },
        create: {
          locale,
          key,
          value,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      
      importedCount++;
    }
    
    // Refresh translations in the I18nService
    await I18nService.refreshTranslations();
    
    return new NextResponse(
      JSON.stringify({
        success: true,
        message: `Successfully imported ${importedCount} translations for ${locale}`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error importing translations:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Helper function to flatten nested translation objects
function flattenTranslations(obj: any, prefix = ''): Record<string, string> {
  return Object.keys(obj).reduce((acc: Record<string, string>, key: string) => {
    const prefixedKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      Object.assign(acc, flattenTranslations(obj[key], prefixedKey));
    } else {
      acc[prefixedKey] = obj[key];
    }
    
    return acc;
  }, {});
} 