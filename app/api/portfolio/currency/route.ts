import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update or create portfolio with new base currency
    const portfolio = await prisma.portfolio.upsert({
      where: { userId: user.id },
      update: { baseCurrency },
      create: {
        userId: user.id,
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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { portfolio: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      baseCurrency: user.portfolio?.baseCurrency || 'EUR',
    });
  } catch (error) {
    console.error('Error fetching portfolio currency:', error);
    return NextResponse.json(
      { error: 'Failed to fetch currency' },
      { status: 500 }
    );
  }
}
