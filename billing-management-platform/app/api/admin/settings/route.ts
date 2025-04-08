import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Default system settings
const DEFAULT_SETTINGS = [
  {
    key: 'maintenance_mode',
    label: 'Maintenance Mode',
    value: false,
    description: 'Enable maintenance mode to prevent users from accessing the system',
  },
  {
    key: 'auto_invoice',
    label: 'Automatic Invoicing',
    value: true,
    description: 'Automatically generate invoices for subscriptions',
  },
  {
    key: 'email_notifications',
    label: 'Email Notifications',
    value: true,
    description: 'Send email notifications for important events',
  },
  {
    key: 'debug_mode',
    label: 'Debug Mode',
    value: false,
    description: 'Enable detailed error logging and debugging features',
  },
];

export async function GET() {
  try {
    // Get settings from database or use defaults
    const settings = await prisma.systemSetting.findMany();
    
    if (settings.length === 0) {
      // If no settings exist, create default settings
      await prisma.systemSetting.createMany({
        data: DEFAULT_SETTINGS,
      });
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching system settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { key, value } = await request.json();

    if (!key || typeof value !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Update the setting in the database
    const updatedSetting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: {
        key,
        value,
        label: DEFAULT_SETTINGS.find(s => s.key === key)?.label || key,
        description: DEFAULT_SETTINGS.find(s => s.key === key)?.description,
      },
    });

    return NextResponse.json(updatedSetting);
  } catch (error) {
    console.error('Error updating system setting:', error);
    return NextResponse.json(
      { error: 'Failed to update system setting' },
      { status: 500 }
    );
  }
} 