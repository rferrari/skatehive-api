#!/usr/bin/env node

/**
 * Test script for Skatehive Search API endpoint
 * 
 * Usage:
 *   node test-search-api.js <query> [type] [time] [community]
 * 
 * Examples:
 *   node test-search-api.js skate
 *   node test-search-api.js skate snaps 1m
 *   node test-search-api.js "skate hive" users
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';

const query = process.argv[2];
const type = process.argv[3] || 'all';
const time = process.argv[4] || '1y';
const community = process.argv[5] || 'hive-173115';

if (!query) {
  console.log(`
Usage: node test-search-api.js <query> [type] [time] [community]

Arguments:
  query      Search term (required)
  type       all | users | snaps (default: all)
  time       1m | 3m | 1y | all (default: 1y)
  community  Community ID (default: hive-173115)

Example:
  node test-search-api.js skate snaps 1m
  `);
  process.exit(1);
}

async function testSearch() {
  const url = new URL(`${API_URL}/api/v2/search`);
  url.searchParams.append('q', query);
  url.searchParams.append('type', type);
  url.searchParams.append('time', time);
  url.searchParams.append('community', community);

  console.log(`🧪 Testing GET ${url.toString()}`);

  try {
    const response = await fetch(url);
    const result = await response.json();

    if (response.ok) {
      console.log('✅ Success!');
      if (result.data.users) {
        console.log(`\n👤 Users (${result.data.users.length}):`);
        result.data.users.slice(0, 5).forEach(u => console.log(`  - @${u.name} (Followers: ${u.followers})`));
        if (result.data.users.length > 5) console.log('    ...');
      } else {
        console.log('\n👤 No users found.');
      }

      if (result.data.snaps) {
        console.log(`\n🛹 Snaps (${result.data.snaps.length}):`);
        result.data.snaps.slice(0, 5).forEach(s => console.log(`  - By @${s.author} on ${s.created}: ${s.body.substring(0, 50).replace(/\n/g, ' ')}...`));
        if (result.data.snaps.length > 5) console.log('    ...');
      } else {
        console.log('\n🛹 No snaps found.');
      }

      console.log('\n📊 Pagination:', result.pagination);
    } else {
      console.log('❌ Failed');
      console.log('Error:', result.error);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testSearch();
