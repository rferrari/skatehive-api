/*
  Following Feed
*/
import { NextRequest, NextResponse } from 'next/server';
import { HAFSQL_Database } from '@/lib/hafsql_database';
import { dealiasSoftPosts } from '@/lib/soft-posts';
import { normalizePost } from '../../helpers';

const db = new HAFSQL_Database();

const DEFAULT_PAGE = Number(process.env.DEFAULT_PAGE) || 1;
const DEFAULT_FEED_LIMIT = Number(process.env.DEFAULT_FEED_LIMIT) || 25;

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    console.log("Fetching USER FOLLOWING FEED data...");
    try {
        const { username } = await params;
        const { searchParams } = new URL(request.url);

        const page = Math.max(1, Number(searchParams.get('page')) || Number(DEFAULT_PAGE));
        const limit = Math.max(1, Number(searchParams.get('limit')) || Number(DEFAULT_FEED_LIMIT));
        const offset = (page - 1) * limit;
        const COMMUNITY = searchParams.get('community_code') || process.env.MY_COMMUNITY_CATEGORY || 'hive-173115';
        const tagFilter = `{"tags": ["${COMMUNITY}"]}`;

        // Step 1: Get the list of users this user follows within the community
        const { rows: followRows } = await db.executeQuery(`
            SELECT f.following_name
            FROM follows f
            JOIN community_subs cs ON f.following_name = cs.account_name 
            WHERE f.follower_name = @username
            AND cs.community_name = @community
        `, [
            { name: 'username', value: username },
            { name: 'community', value: COMMUNITY }
        ]);

        const followingList = followRows.map((r: any) => r.following_name);

        if (followingList.length === 0) {
            return NextResponse.json({
                success: true,
                data: [],
                pagination: {
                    total: 0,
                    totalPages: 0,
                    currentPage: page,
                    limit,
                    hasNextPage: false,
                    hasPrevPage: false,
                    nextPage: null,
                    prevPage: null
                }
            }, {
                status: 200,
                headers: { 'Cache-Control': 'no-store, max-age=0' }
            });
        }

        // Step 2: Get paginated data (skip total count for performance)
        const fetchLimit = limit + 1;
        const { rows, headers } = await db.executeQuery(`
            SELECT 
                c.body, 
                c.author, 
                c.permlink, 
                c.parent_author, 
                c.parent_permlink, 
                c.created, 
                c.last_edited, 
                c.cashout_time, 
                c.remaining_till_cashout, 
                c.last_payout, 
                c.tags, 
                c.category, 
                c.json_metadata AS post_json_metadata, 
                c.root_author, 
                c.root_permlink, 
                c.pending_payout_value, 
                c.author_rewards, 
                c.author_rewards_in_hive, 
                c.total_payout_value, 
                c.curator_payout_value, 
                c.beneficiary_payout_value, 
                c.total_rshares, 
                c.net_rshares, 
                c.total_vote_weight, 
                c.beneficiaries, 
                c.max_accepted_payout, 
                c.percent_hbd, 
                c.allow_votes, 
                c.allow_curation_rewards, 
                c.deleted,
                a.json_metadata AS user_json_metadata, 
                a.reputation, 
                a.followers, 
                a.followings,
                COALESCE(
                json_agg(
                    json_build_object(
                    'id', v.id,
                    'timestamp', v.timestamp,
                    'voter', v.voter,
                    'weight', v.weight,
                    'rshares', v.rshares,
                    'total_vote_weight', v.total_vote_weight,
                    'pending_payout', v.pending_payout,
                    'pending_payout_symbol', v.pending_payout_symbol
                    )
                ) FILTER (WHERE v.id IS NOT NULL), 
                '[]'
                ) as votes
            FROM comments c
            LEFT JOIN accounts a ON c.author = a.name
            LEFT JOIN operation_effective_comment_vote_view v 
                ON c.author = v.author 
                AND c.permlink = v.permlink
            WHERE c.author = ANY(@followingList::text[])
            AND c.parent_author = 'peak.snaps'
            AND c.parent_permlink LIKE 'snap-container-%'
            AND c.json_metadata @> @tag_filter
            AND c.deleted = false
            GROUP BY 
                c.body, 
                c.author, 
                c.permlink, 
                c.parent_author, 
                c.parent_permlink, 
                c.created, 
                c.last_edited, 
                c.cashout_time, 
                c.remaining_till_cashout, 
                c.last_payout, 
                c.tags, 
                c.category, 
                c.json_metadata,
                c.root_author, 
                c.root_permlink, 
                c.pending_payout_value, 
                c.author_rewards, 
                c.author_rewards_in_hive, 
                c.total_payout_value, 
                c.curator_payout_value, 
                c.beneficiary_payout_value, 
                c.total_rshares, 
                c.net_rshares, 
                c.total_vote_weight, 
                c.beneficiaries, 
                c.max_accepted_payout, 
                c.percent_hbd, 
                c.allow_votes, 
                c.allow_curation_rewards, 
                c.deleted,
                a.json_metadata,
                a.reputation, 
                a.followers, 
                a.followings
            ORDER BY c.created DESC
            LIMIT ${fetchLimit}
            OFFSET ${offset};
        `, [
            { name: 'followingList', value: followingList },
            { name: 'tag_filter', value: tagFilter }
        ]);

        // Pagination trick: if we got more rows than limit, there is a next page
        const hasNextPage = rows.length > limit;
        const actualRows = hasNextPage ? rows.slice(0, limit) : rows;

        const normalizedRows = actualRows.map((row: any) => normalizePost(row, 'haf'));
        const dealiasedRows = await dealiasSoftPosts(normalizedRows);

        return NextResponse.json(
            {
                success: true,
                data: dealiasedRows,
                headers: headers,
                pagination: {
                    total: null, // Omitted for performance
                    totalPages: null,
                    currentPage: page,
                    limit,
                    hasNextPage,
                    hasPrevPage: page > 1,
                    nextPage: hasNextPage ? page + 1 : null,
                    prevPage: page > 1 ? page - 1 : null
                }
            },
            {
                status: 200,
                headers: {
                    'Cache-Control': 'no-store, max-age=0'
                }
            }
        );
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                code: 'Failed to fetch data',
                error
            },
            { status: 500 }
        );
    }
}