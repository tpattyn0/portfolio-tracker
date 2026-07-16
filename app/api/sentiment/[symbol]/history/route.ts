// app/api/sentiment/[symbol]/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/middleware/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = checkRateLimit(request, "sentiment-history", 30, 60 * 1000);
    if (limited) return limited;

    const { symbol } = await params;
    const searchParams = request.nextUrl.searchParams;
    const daysParam = parseInt(searchParams.get('days') || '30');
    const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 365) : 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const history = await prisma.sentimentHistory.findMany({
      where: {
        symbol,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });
    
    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching sentiment history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sentiment history' },
      { status: 500 }
    );
  }
}