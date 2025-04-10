import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { I18nService, SupportedLocale } from '@/lib/i18n-service';
import { z } from 'zod';

// Schema for language preference update
const updateLanguageSchema = z.object({
  locale: z.string().refine(val => I18nService.isValidLocale(val as SupportedLocale), {
    message: 'Invalid locale',
  }),
});

// GET /api/user/preferences/language
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Get user preference from database
    const userPreference = await prisma.userPreference.findUnique({
      where: { userId: session.user.id },
      select: { language: true },
    });
    
    // If no preference, use the browser locale or default
    if (!userPreference?.language) {
      const acceptLanguage = req.headers.get('accept-language') || 'en-US';
      const safeLocale = I18nService.getSafeLocale(acceptLanguage);
      
      return new NextResponse(JSON.stringify({ locale: safeLocale }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new NextResponse(JSON.stringify({ locale: userPreference.language }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching language preference:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// PUT /api/user/preferences/language
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const body = await req.json();
    
    // Validate request body
    const result = updateLanguageSchema.safeParse(body);
    if (!result.success) {
      return new NextResponse(JSON.stringify({ error: result.error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const { locale } = result.data;
    
    // Update or create user preference
    await prisma.userPreference.upsert({
      where: { userId: session.user.id },
      update: { language: locale },
      create: { 
        userId: session.user.id,
        language: locale,
      },
    });
    
    return new NextResponse(JSON.stringify({ success: true, locale }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating language preference:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 