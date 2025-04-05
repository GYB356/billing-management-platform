import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/auth';
import { db } from '@/lib/db';
import { I18nService, SupportedLocale, TranslationKey } from '@/lib/i18n-service';

// Schema for creating/updating translations
const translationSchema = z.object({
  key: z.string().min(1),
  locale: z.string().refine((val) => 
    Object.keys(I18nService.supportedLocales).includes(val), 
    { message: 'Unsupported locale' }
  ),
  value: z.string().min(1),
});

// Schema for bulk import
const bulkImportSchema = z.object({
  locale: z.string().refine((val) => 
    Object.keys(I18nService.supportedLocales).includes(val), 
    { message: 'Unsupported locale' }
  ),
  translations: z.record(z.string().min(1)),
});

// Verifies if user has permission to manage translations
async function checkTranslationPermission(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: {
          organization: true,
        },
      },
    },
  });

  if (!user) {
    return false;
  }

  // Only admins can manage translations
  return user.role === 'ADMIN';
}

// GET /api/translations - Get translations
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Extract query parameters
    const searchParams = req.nextUrl.searchParams;
    const locale = searchParams.get('locale') as SupportedLocale | null;
    const key = searchParams.get('key') as TranslationKey | null;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    
    // Build the filter
    const filter: any = {};
    if (locale) filter.locale = locale;
    if (key) filter.key = { contains: key };
    
    // Get total count for pagination
    const total = await db.translation.count({ where: filter });
    
    // Get translations
    const translations = await db.translation.findMany({
      where: filter,
      skip,
      take: limit,
      orderBy: [
        { locale: 'asc' },
        { key: 'asc' },
      ],
    });
    
    // Format response with pagination
    return NextResponse.json({
      translations,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching translations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch translations' },
      { status: 500 }
    );
  }
}

// POST /api/translations - Create or update a translation
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Check admin permission
    const hasPermission = await checkTranslationPermission(session.user.id);
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }
    
    const body = await req.json();
    
    // Validate input
    const validatedData = translationSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { error: validatedData.error.format() },
        { status: 400 }
      );
    }
    
    const { key, locale, value } = validatedData.data;
    
    // Create or update the translation
    const translation = await db.translation.upsert({
      where: {
        key_locale: {
          key,
          locale,
        },
      },
      update: {
        value,
        updatedAt: new Date(),
      },
      create: {
        key,
        locale,
        value,
      },
    });
    
    // Update the in-memory translations
    await I18nService.addOrUpdateTranslation(key, locale, value);
    
    return NextResponse.json({ translation });
  } catch (error) {
    console.error('Error creating/updating translation:', error);
    return NextResponse.json(
      { error: 'Failed to create/update translation' },
      { status: 500 }
    );
  }
}

// PUT /api/translations/bulk - Bulk import translations
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Check admin permission
    const hasPermission = await checkTranslationPermission(session.user.id);
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }
    
    const body = await req.json();
    
    // Validate input
    const validatedData = bulkImportSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { error: validatedData.error.format() },
        { status: 400 }
      );
    }
    
    const { locale, translations } = validatedData.data;
    
    // Start a transaction to import all translations
    const result = await db.$transaction(async (tx) => {
      const importedTranslations = [];
      
      for (const [key, value] of Object.entries(translations)) {
        // Create or update each translation
        const translation = await tx.translation.upsert({
          where: {
            key_locale: {
              key,
              locale,
            },
          },
          update: {
            value,
            updatedAt: new Date(),
          },
          create: {
            key,
            locale,
            value,
          },
        });
        
        importedTranslations.push(translation);
      }
      
      return importedTranslations;
    });
    
    // Update the in-memory translations
    for (const translation of result) {
      await I18nService.addOrUpdateTranslation(
        translation.key,
        translation.locale,
        translation.value
      );
    }
    
    return NextResponse.json({ 
      message: `Successfully imported ${result.length} translations`,
      count: result.length
    });
  } catch (error) {
    console.error('Error bulk importing translations:', error);
    return NextResponse.json(
      { error: 'Failed to import translations' },
      { status: 500 }
    );
  }
} 