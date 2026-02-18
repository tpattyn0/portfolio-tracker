import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/utils/auth';
import { wishlistService } from '@/lib/services/wishlist.service';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if (auth.error) return auth.error;

    const items = await wishlistService.getWishlistWithScores(auth.userId);
    return NextResponse.json(items);
  } catch (error) {
    console.error('Failed to fetch wishlist:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wishlist' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if (auth.error) return auth.error;

    const body = await request.json();
    const { ticker, targetPrice, notes } = body;

    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker is required' },
        { status: 400 }
      );
    }

    const item = await wishlistService.addToWishlist(
      auth.userId,
      ticker,
      targetPrice,
      notes
    );

    return NextResponse.json(item, { status: 201 });
  } catch (error: unknown) {
    console.error('Failed to add to wishlist:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add to wishlist' },
      { status: 400 }
    );
  }
}
