// app/api/news/[symbol]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/utils/auth';
import { newsService } from '@/lib/services/news.service';
import { checkRateLimit } from '@/lib/middleware/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const auth = await getAuthenticatedUser();
    if (auth.error) return auth.error;

    const limited = checkRateLimit(request, "news", 30, 60 * 1000);
    if (limited) return limited;

    const { symbol } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const companyName = searchParams.get('name') || undefined;
    const analyze = searchParams.get('analyze') !== 'false';

    const articles = await newsService.getAnalyzedNewsForSymbol(symbol, {
      companyName,
      limit,
      analyze,
    });

    return NextResponse.json(articles);
  } catch (error) {
    console.error('Error in news API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news' },
      { status: 500 }
    );
  }
}
