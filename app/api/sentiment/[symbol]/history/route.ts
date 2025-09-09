// app/api/sentiment/[symbol]/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const { symbol } = params;
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');
    
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