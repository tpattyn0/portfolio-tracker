import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/utils/auth';
import { analystRatingsService } from '@/lib/services/analyst-ratings.service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const auth = await getAuthenticatedUser();
    if (auth.error) return auth.error;

    const { symbol } = await params;
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const ratings = await analystRatingsService.fetchAnalystRatings(symbol);
    return NextResponse.json(ratings);
  } catch (error) {
    console.error('Error fetching analyst ratings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analyst ratings' },
      { status: 500 }
    );
  }
}
