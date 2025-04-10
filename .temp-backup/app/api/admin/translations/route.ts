import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { I18nService, SupportedLocale } from '@/lib/i18n-service';
import { z } from 'zod';

// Schema for creating a translation
const createTranslationSchema = z.object({
  locale: z.string().refine(val => I18nService.isValidLocale(val as SupportedLocale), {
    message: 'Invalid locale',
  }),
  key: z.string().min(1, 'Key is required'),
  value: z.string().min(1, 'Translation value is required'),
});

// Schema for updating a translation
const updateTranslationSchema = z.object({
  id: z.string(),
  value: z.string().min(1, 'Translation value is required'),
});

// GET /api/admin/translations
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated and has admin role
    if (!session?.user?.id || session?.user?.role !== 'ADMIN') {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get query parameters
    const url = new URL(req.url);
    const locale = url.searchParams.get('locale') || 'en-US';
    const search = url.searchParams.get('search') || '';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    // Validate the locale
    if (!I18nService.isValidLocale(locale as SupportedLocale)) {
      return new NextResponse(JSON.stringify({ error: 'Invalid locale' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create the filter for searching
    const where = {
      locale,
      ...(search ? {
        OR: [
          { key: { contains: search, mode: 'insensitive' as const } },
          { value: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    // Get total count for pagination
    const totalCount = await prisma.translation.count({ where });
    const totalPages = Math.ceil(totalCount / limit);

    // Get translations with pagination
    const translations = await prisma.translation.findMany({
      where,
      orderBy: { key: 'asc' },
      skip,
      take: limit,
    });

    return new NextResponse(JSON.stringify({ 
      translations, 
      totalPages, 
      currentPage: page, 
      totalCount,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching translations:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST /api/admin/translations - Create a new translation
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
    const result = createTranslationSchema.safeParse(body);
    if (!result.success) {
      return new NextResponse(JSON.stringify({ error: result.error.format() }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const { locale, key, value } = result.data;
    
    // Check if translation already exists
    const existingTranslation = await prisma.translation.findUnique({
      where: {
        locale_key: {
          locale,
          key,
        },
      },
    });
    
    if (existingTranslation) {
      return new NextResponse(JSON.stringify({ error: 'Translation already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Create new translation
    const translation = await prisma.translation.create({
      data: {
        locale,
        key,
        value,
      },
    });
    
    // Refresh translations in the I18nService
    await I18nService.refreshTranslations();
    
    return new NextResponse(JSON.stringify({ success: true, translation }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating translation:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// PUT /api/admin/translations - Update an existing translation
export async function PUT(req: NextRequest) {
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
    const result = updateTranslationSchema.safeParse(body);
    if (!result.success) {
      return new NextResponse(JSON.stringify({ error: result.error.format() }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const { id, value } = result.data;
    
    // Check if translation exists
    const existingTranslation = await prisma.translation.findUnique({
      where: { id },
    });
    
    if (!existingTranslation) {
      return new NextResponse(JSON.stringify({ error: 'Translation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Update translation
    const updatedTranslation = await prisma.translation.update({
      where: { id },
      data: { 
        value,
        updatedAt: new Date(),
      },
    });
    
    // Refresh translations in the I18nService
    await I18nService.refreshTranslations();
    
    return new NextResponse(JSON.stringify({ success: true, translation: updatedTranslation }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating translation:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 