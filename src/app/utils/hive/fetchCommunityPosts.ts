import { HAFSQL_Database } from '@/lib/hafsql_database';

const db = new HAFSQL_Database();

const MULTIPLIER_POSTS = 1.5;
const MULTIPLIER_VOTES = 0.2;
const MULTIPLIER_PAYOUT = 10;

export async function fetchCommunityPosts(COMMUNITY: string, page: number, limit: number) {
  const offset = (page - 1) * limit;

  // Get total count first to fix pagination
  const countQuery = `
    SELECT COUNT(DISTINCT c.author) as total
    FROM comments c
    WHERE c.author IN (
        SELECT account_name FROM hafsql.community_subs WHERE community_name = @community
    )
    AND c.category = @community
    AND c.deleted = false
    AND c.parent_author = ''
    AND c.created >= date_trunc('week', NOW())
    AND c.created < date_trunc('week', NOW()) + interval '7 days';
  `;

  const { rows: countRows } = await db.executeQuery(countQuery, [{ name: 'community', value: COMMUNITY }]);
  const total = parseInt(countRows[0]?.total || '0');

  const query = `
    SELECT 
        c.author AS user,
        COUNT(*) AS posts,
        COALESCE(SUM((
            SELECT COUNT(*) 
            FROM operation_effective_comment_vote_view v 
            WHERE v.author = c.author 
            AND v.permlink = c.permlink
        )), 0) AS total_votes,
        SUM(c.author_rewards_in_hive + c.pending_payout_value) AS total_payout,
        ROUND(
            (COUNT(*) * ${MULTIPLIER_POSTS}) 
            + (COALESCE(SUM((
                SELECT COUNT(*) 
                FROM operation_effective_comment_vote_view v 
                WHERE v.author = c.author 
                AND v.permlink = c.permlink
            )), 0) * ${MULTIPLIER_VOTES})
            + (SUM(c.author_rewards_in_hive + c.pending_payout_value) * ${MULTIPLIER_PAYOUT})
        ) AS score,
        TO_CHAR(NOW(), 'IYYY-IW') AS current_week
    FROM comments c
    WHERE c.author IN (
        SELECT account_name FROM hafsql.community_subs WHERE community_name = @community
    )
    AND c.category = @community
    AND c.deleted = false
    AND c.parent_author = ''
    AND c.created >= date_trunc('week', NOW())
    AND c.created < date_trunc('week', NOW()) + interval '7 days'
    GROUP BY c.author
    ORDER BY score DESC
    LIMIT ${limit}
    OFFSET ${offset};
  `;

  const { rows, headers } = await db.executeQuery(query, [{ name: 'community', value: COMMUNITY }]);
  return { rows, headers, total };
}
