import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import axios from 'axios';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch exchange rates from an external API (e.g., Open Exchange Rates)
    const response = await axios.get('https://openexchangerates.org/api/latest.json', {
      params: {
        app_id: process.env.OPEN_EXCHANGE_RATES_API_KEY,
      },
    });

    const rates = response.data.rates;

    return NextResponse.json({ success: true, rates });
  } catch (error) {
    console.error('Error fetching currency rates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch currency rates' },
      { status: 500 }
    );
  }
}