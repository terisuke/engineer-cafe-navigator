#!/usr/bin/env node

import 'dotenv/config';
import { CalendarServiceTool } from '../src/mastra/tools/calendar-service';

async function testCalendarIntegration() {
  console.log('📅 Testing Google Calendar Integration\n');

  const calendarTool = new CalendarServiceTool();
  
  // Test 1: Check if calendar URL is configured
  const calendarUrl = process.env.GOOGLE_CALENDAR_ICAL_URL;
  
  if (!calendarUrl) {
    console.log('❌ GOOGLE_CALENDAR_ICAL_URL is not configured in environment');
    console.log('   Calendar integration will not work without this URL');
    return;
  } else {
    console.log('✅ Calendar URL is configured');
    console.log(`   URL: ${calendarUrl.substring(0, 50)}...`);
  }

  // Test 2: Try to fetch calendar data
  console.log('\n🔄 Attempting to fetch calendar events...');
  
  try {
    const result = await calendarTool.execute({
      useProxy: false, // Direct fetch for testing
      daysAhead: 30,
      maxEvents: 5
    });

    if (result.success) {
      console.log('✅ Calendar fetch successful!');
      console.log('\nCalendar events:');
      console.log(result.events);
    } else {
      console.log('❌ Calendar fetch failed');
      console.log(`   Error: ${result.error}`);
    }
  } catch (error) {
    console.log('❌ Exception during calendar fetch');
    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Test 3: Try with proxy (simulating production)
  console.log('\n🔄 Testing with proxy API (production mode)...');
  
  try {
    const result = await calendarTool.execute({
      useProxy: true,
      daysAhead: 7,
      maxEvents: 3
    });

    if (result.success) {
      console.log('✅ Proxy API fetch successful!');
      if (result.events.includes('Mock Data')) {
        console.log('⚠️  Received mock data (development fallback)');
      }
    } else {
      console.log('❌ Proxy API fetch failed');
      console.log(`   Error: ${result.error}`);
    }
  } catch (error) {
    console.log('❌ Exception during proxy fetch');
    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Test 4: Check OAuth credentials
  console.log('\n🔐 Checking OAuth2 credentials...');
  
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  
  if (clientId && clientSecret) {
    console.log('✅ OAuth2 credentials are configured');
    console.log('   (Required for authenticated calendar access)');
  } else {
    console.log('⚠️  OAuth2 credentials are not fully configured');
    console.log('   Missing:', !clientId ? 'CLIENT_ID' : '', !clientSecret ? 'CLIENT_SECRET' : '');
    console.log('   (Optional - only needed for private calendars)');
  }

  // Summary
  console.log('\n━'.repeat(70));
  console.log('📊 Calendar Integration Summary');
  console.log('━'.repeat(70));
  console.log('\nConfiguration status:');
  console.log(`- iCal URL: ${calendarUrl ? '✅ Configured' : '❌ Missing'}`);
  console.log(`- OAuth2: ${clientId && clientSecret ? '✅ Ready' : '⚠️  Not configured'}`);
  console.log('\nRecommendations:');
  console.log('1. Ensure GOOGLE_CALENDAR_ICAL_URL points to a public calendar');
  console.log('2. Use /api/calendar endpoint in production to avoid CORS');
  console.log('3. OAuth2 is only needed for private calendar access');
}

testCalendarIntegration().catch(console.error);