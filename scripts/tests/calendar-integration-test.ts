#!/usr/bin/env node
/**
 * Calendar Integration Test
 * Tests Google Calendar integration and event fetching
 */

import 'dotenv/config';
import { CalendarServiceTool } from '../../src/mastra/tools/calendar-service';

export async function testCalendarIntegration() {
  console.log('📅 Testing Google Calendar Integration\n');

  const calendarTool = new CalendarServiceTool();
  
  // Test 1: Check if calendar URL is configured
  const calendarUrl = process.env.GOOGLE_CALENDAR_ICAL_URL;
  
  if (!calendarUrl) {
    console.log('❌ GOOGLE_CALENDAR_ICAL_URL is not configured in environment');
    console.log('   Calendar integration will not work without this URL');
    return {
      success: false,
      error: 'Calendar URL not configured'
    };
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
      return {
        success: true,
        events: result.events
      };
    } else {
      console.log('❌ Calendar fetch failed');
      console.log(`   Error: ${result.error}`);
      return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    console.log('❌ Exception during calendar fetch');
    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Run the test if called directly
if (require.main === module) {
  testCalendarIntegration().catch(console.error);
}