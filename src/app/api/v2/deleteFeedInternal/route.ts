/**
 * POST /api/v2/deleteFeedInternal
 *
 * Internal delete endpoint for SkateHive services.
 * Uses author alias -> env-managed key mapping.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, checkRateLimit } from '@/app/utils/apiAuth';
import { deleteFeedPostAsAlias, PostingAlias } from '@/lib/feed-posting';

interface DeleteFeedInternalRequest {
  author_alias: PostingAlias;
  author: string;
  permlink: string;
}

const ALLOWED_ALIASES: PostingAlias[] = ['skateuser', 'skatedev', 'skatehacker'];

export async function POST(request: NextRequest) {
  const authResult = validateApiKey(request);
  if (!authResult.isValid) {
    return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
  }

  const rateLimit = checkRateLimit(request.headers.get('authorization') || '', 40, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Rate limit exceeded',
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      },
      { status: 429 }
    );
  }

  let data: DeleteFeedInternalRequest;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!data.author_alias || !ALLOWED_ALIASES.includes(data.author_alias)) {
    return NextResponse.json({ success: false, error: 'Invalid author_alias' }, { status: 400 });
  }

  if (!data.author || !data.permlink) {
    return NextResponse.json({ success: false, error: 'author and permlink are required' }, { status: 400 });
  }

  try {
    const result = await deleteFeedPostAsAlias(data.author_alias, {
      author: data.author,
      permlink: data.permlink,
    });

    return NextResponse.json({
      success: true,
      data: {
        author: result.author,
        permlink: result.permlink,
        transaction_id: result.txId,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to delete feed post',
      },
      { status: 500 }
    );
  }
}
