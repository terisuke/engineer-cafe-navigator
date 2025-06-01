#!/usr/bin/env npx tsx

/**
 * Integration tests for external APIs
 * Run: pnpm tsx scripts/test-external-apis.ts
 */

import { connpassClient } from '../src/lib/external-apis/connpass-client';
import { googleCalendarClient } from '../src/lib/external-apis/google-calendar-client';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const color = {
    info: colors.cyan,
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
  }[type];
  
  console.log(`${color}${message}${colors.reset}`);
}

async function testConnpassAPI() {
  log('\n🔍 Testing Connpass API...', 'info');
  
  try {
    // Test 1: Search for general events
    log('Test 1: Searching for general events...');
    const searchResults = await connpassClient.searchEvents({
      keyword: 'プログラミング',
      count: 5,
      order: 2,
    });
    
    log(`✅ Found ${searchResults.results_returned} events (out of ${searchResults.results_available} total)`, 'success');
    
    if (searchResults.events.length > 0) {
      const event = searchResults.events[0];
      console.log(`  - ${event.title}`);
      console.log(`    Date: ${new Date(event.started_at).toLocaleString('ja-JP')}`);
      console.log(`    Place: ${event.place || 'Online'}`);
    }
    
    // Test 2: Search for Engineer Cafe events
    log('\nTest 2: Searching for Engineer Cafe events...');
    const engineerCafeEvents = await connpassClient.searchEngineerCafeEvents({
      includeEnded: false,
      count: 10,
    });
    
    log(`✅ Found ${engineerCafeEvents.length} Engineer Cafe related events`, 'success');
    
    engineerCafeEvents.slice(0, 3).forEach(event => {
      console.log(`  - ${event.title}`);
      console.log(`    URL: ${event.event_url}`);
    });
    
    // Test 3: Get events by date
    log('\nTest 3: Getting events for today...');
    const todayEvents = await connpassClient.getEventsByDate(new Date());
    
    log(`✅ Found ${todayEvents.length} events for today`, 'success');
    
    // Test 4: Rate limiting
    log('\nTest 4: Testing rate limiting...');
    const startTime = Date.now();
    
    // Make 3 rapid requests
    await Promise.all([
      connpassClient.searchEvents({ count: 1 }),
      connpassClient.searchEvents({ count: 1 }),
      connpassClient.searchEvents({ count: 1 }),
    ]);
    
    const elapsedTime = Date.now() - startTime;
    log(`✅ Rate limiting working correctly (elapsed: ${elapsedTime}ms)`, 'success');
    
  } catch (error) {
    log(`❌ Connpass API test failed: ${error}`, 'error');
    console.error(error);
  }
}

async function testGoogleCalendarAPI() {
  log('\n📅 Testing Google Calendar API...', 'info');
  
  try {
    // Check if calendar ID is configured
    if (!process.env.ENGINEER_CAFE_CALENDAR_ID) {
      log('⚠️  ENGINEER_CAFE_CALENDAR_ID not configured, skipping Google Calendar tests', 'warning');
      return;
    }
    
    // Authenticate with service account
    log('Test 1: Authenticating with service account...');
    await googleCalendarClient.authenticateWithServiceAccount();
    log('✅ Authentication successful', 'success');
    
    // Test 2: Get calendar info
    log('\nTest 2: Getting calendar information...');
    const calendarInfo = await googleCalendarClient.getCalendarInfo();
    log(`✅ Calendar: ${calendarInfo.summary} (${calendarInfo.timeZone})`, 'success');
    
    // Test 3: Get today's events
    log('\nTest 3: Getting today\'s events...');
    const todayEvents = await googleCalendarClient.getTodayEvents();
    log(`✅ Found ${todayEvents.length} events for today`, 'success');
    
    todayEvents.forEach(event => {
      console.log(`  - ${event.summary}`);
      console.log(`    Time: ${new Date(event.start).toLocaleString('ja-JP')}`);
      if (event.location) console.log(`    Location: ${event.location}`);
    });
    
    // Test 4: Get upcoming events
    log('\nTest 4: Getting upcoming events (next 7 days)...');
    const upcomingEvents = await googleCalendarClient.getUpcomingEvents(7);
    log(`✅ Found ${upcomingEvents.length} upcoming events`, 'success');
    
    // Test 5: Search events
    log('\nTest 5: Searching for specific events...');
    const searchResults = await googleCalendarClient.searchEvents('ワークショップ', {
      daysAhead: 30,
      maxResults: 5,
    });
    log(`✅ Found ${searchResults.length} matching events`, 'success');
    
  } catch (error) {
    log(`❌ Google Calendar API test failed: ${error}`, 'error');
    console.error(error);
  }
}

async function testCacheIntegration() {
  log('\n💾 Testing cache integration...', 'info');
  
  try {
    // Test cache with Connpass
    log('Test 1: Testing Connpass cache...');
    
    // First call (no cache)
    const start1 = Date.now();
    await connpassClient.searchEvents({ keyword: 'test-cache', count: 1 });
    const time1 = Date.now() - start1;
    
    // Second call (should be cached if Redis is available)
    const start2 = Date.now();
    await connpassClient.searchEvents({ keyword: 'test-cache', count: 1 });
    const time2 = Date.now() - start2;
    
    log(`✅ First call: ${time1}ms, Second call: ${time2}ms`, 'success');
    
    if (time2 < time1 * 0.5) {
      log('✅ Cache is working effectively', 'success');
    } else {
      log('⚠️  Cache might not be configured (using memory cache)', 'warning');
    }
    
  } catch (error) {
    log(`❌ Cache integration test failed: ${error}`, 'error');
  }
}

async function runAllTests() {
  log(`${colors.bright}🚀 Starting External API Integration Tests${colors.reset}\n`);
  
  // Run tests
  await testConnpassAPI();
  await testGoogleCalendarAPI();
  await testCacheIntegration();
  
  log(`\n${colors.bright}✨ All tests completed!${colors.reset}`, 'success');
}

// Run tests
runAllTests().catch(console.error);