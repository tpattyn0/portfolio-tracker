import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/utils/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if (auth.error) return auth.error;

    const { baseCurrency } = await request.json();

    if (!baseCurrency || typeof baseCurrency !== 'string') {
      return NextResponse.json(
        { error: 'Invalid currency' },
        { status: 400 }
      );
    }

    // Validate currency code (3-letter ISO code)
    if (!/^[A-Z]{3}$/.test(baseCurrency)) {
      return NextResponse.json(
        { error: 'Currency must be a 3-letter ISO code (e.g., EUR, USD, GBP)' },
        { status: 400 }
      );
    }

    // Update or create portfolio with new base currency
    const portfolio = await prisma.portfolio.upsert({
      where: { userId: auth.userId },
      update: { baseCurrency },
      create: {
        userId: auth.userId,
        baseCurrency,
      },
    });

    return NextResponse.json({
      success: true,
      baseCurrency: portfolio.baseCurrency,
    });
  } catch (error) {
    console.error('Error updating portfolio currency:', error);
    return NextResponse.json(
      { error: 'Failed to update currency' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const auth = await getAuthenticatedUser();
    if (auth.error) return auth.error;

    const portfolio = await prisma.portfolio.findUnique({
      where: { userId: auth.userId },
    });

    return NextResponse.json({
      baseCurrency: portfolio?.baseCurrency || 'EUR',
    });
  } catch (error) {
    console.error('Error fetching portfolio currency:', error);
    return NextResponse.json(
      { error: 'Failed to fetch currency' },
      { status: 500 }
    );
  }
}
