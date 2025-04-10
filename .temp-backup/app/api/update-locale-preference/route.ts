import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const LocaleUpdateSchema = z.object({
  locale: z.string(),
});

const SUPPORTED_LOCALES = [
  'en-US',
  'en-GB',
  'fr-FR',
  'de-DE',
  'es-ES',
  'it-IT',
  'ja-JP',
  'zh-CN',
  'ar-SA',
  'pt-BR',
];

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { locale } = LocaleUpdateSchema.parse(body);

    // Validate locale is supported
    if (!SUPPORTED_LOCALES.includes(locale)) {
      return NextResponse.json(
        { error: 'Unsupported locale' },
        { status: 400 }
      );
    }

    // Update user preferences
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preference: {
          upsert: {
            create: { locale },
            update: { locale },
          },
        },
      },
    });

    // Update relevant session data
    await prisma.session.updateMany({
      where: { userId: session.user.id },
      data: {
        locale,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating locale preference:', error);
    return NextResponse.json(
      { error: 'Failed to update locale preference' },
      { status: 400 }
    );
  }
}