import { NextRequest, NextResponse } from 'next/server';
import { HAFSQL_Database } from '@/lib/hafsql_database';
import { dealiasSoftPosts } from '@/lib/soft-posts';

const db = new HAFSQL_Database();

const DEFAULT_LIMIT = 20;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const type = searchParams.get('type') || 'all';
  const time = searchParams.get('time') || '1y';
  const community = searchParams.get('community') || 'hive-173115';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.max(1, Number(searchParams.get('limit')) || DEFAULT_LIMIT);
  const offset = (page - 1) * limit;

  if (!query) {
    return NextResponse.json({ success: false, error: 'Query parameter "q" is required' }, { status: 400 });
  }

  const searchQuery = `%${query}%`;
  const communityTag = JSON.stringify({ tags: [community] });

  // Calculate start date based on time filter
  let startDate = new Date();
  if (time === '1m') {
    startDate.setMonth(startDate.getMonth() - 1);
  } else if (time === '3m') {
    startDate.setMonth(startDate.getMonth() - 3);
  } else if (time === '1y') {
    startDate.setFullYear(startDate.getFullYear() - 1);
  } else {
    // 'all' or default - use a very old date
    startDate = new Date('2016-01-01');
  }

  try {
    let users: any[] = [];
    let snaps: any[] = [];
    let hasMoreUsers = false;
    let hasMoreSnaps = false;

    // Search Users
    if (type === 'all' || type === 'users') {
        const { rows: userRows } = await db.executeQuery(`
            SELECT 
                name, 
                reputation, 
                json_metadata, 
                posting_metadata, 
                followers, 
                followings, 
                created_at
            FROM accounts
            WHERE name ILIKE @query
               OR (json_metadata::jsonb->'profile'->>'name') ILIKE @query
            ORDER BY followers DESC
            LIMIT @limit OFFSET @offset
        `, [
            { name: 'query', value: searchQuery },
            { name: 'limit', value: limit + 1 },
            { name: 'offset', value: offset }
        ]);
        
        hasMoreUsers = userRows.length > limit;
        users = userRows.slice(0, limit);
    }

    // Search Snaps
    if (type === 'all' || type === 'snaps') {
        const { rows: snapRows } = await db.executeQuery(`
            SELECT 
                c.body, 
                c.author, 
                c.permlink, 
                c.parent_author, 
                c.parent_permlink, 
                c.created, 
                c.tags, 
                c.category, 
                c.json_metadata AS post_json_metadata,
                a.json_metadata AS user_json_metadata, 
                a.reputation, 
                a.followers, 
                a.followings
            FROM comments c
            LEFT JOIN accounts a ON c.author = a.name
            WHERE (c.body ILIKE @query OR c.title ILIKE @query)
              AND (c.parent_permlink SIMILAR TO 'snap-container-%' OR c.parent_permlink = 'nxvsjarvmp')
              AND c.json_metadata @> @communityTag::jsonb
              AND c.deleted = false
              AND c.created >= @startDate
            ORDER BY c.created DESC
            LIMIT @limit OFFSET @offset
        `, [
            { name: 'query', value: searchQuery },
            { name: 'communityTag', value: communityTag },
            { name: 'startDate', value: startDate.toISOString() },
            { name: 'limit', value: limit + 1 },
            { name: 'offset', value: offset }
        ]);
        
        hasMoreSnaps = snapRows.length > limit;
        const currentSnaps = snapRows.slice(0, limit);
        snaps = await dealiasSoftPosts(currentSnaps as any);
    }

    const hasNextPage = type === 'users' ? hasMoreUsers : (type === 'snaps' ? hasMoreSnaps : (hasMoreUsers || hasMoreSnaps));

    return NextResponse.json({
      success: true,
      data: {
        users: users.length > 0 ? users : undefined,
        snaps: snaps.length > 0 ? snaps : undefined
      },
      pagination: {
        currentPage: page,
        limit,
        hasNextPage,
        hasPrevPage: page > 1
      }
    }, {
        headers: {
            'Cache-Control': 's-maxage=60, stale-while-revalidate=30'
        }
    });

  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
