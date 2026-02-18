import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/utils/auth';
import { wishlistService } from '@/lib/services/wishlist.service';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser();
    if (auth.error) return auth.error;

    const { id } = await params;
    await wishlistService.removeFromWishlist(auth.userId, id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Failed to remove from wishlist:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove from wishlist' },
      { status: 400 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser();
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const { targetPrice, notes } = body;

    const item = await wishlistService.updateWishlistItem(
      auth.userId,
      id,
      { targetPrice, notes }
    );

    return NextResponse.json(item);
  } catch (error: unknown) {
    console.error('Failed to update wishlist item:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update wishlist item' },
      { status: 400 }
    );
  }
}
