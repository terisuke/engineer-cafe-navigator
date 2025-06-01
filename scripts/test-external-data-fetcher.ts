#!/usr/bin/env tsx
/**
 * Test script for the External Data Fetcher Tool
 * Tests fetching data from Connpass, calendar events, and facility status
 */

import { ExternalDataFetcherTool } from '../src/mastra/tools/external-data-fetcher';

async function testExternalDataFetcher() {
  console.log('🔍 Testing External Data Fetcher Tool\n');

  // Initialize the tool
  const fetcher = new ExternalDataFetcherTool({
    // Mock configuration - in production these would come from environment
    websocketUrl: '',
    receptionApiUrl: '',
  });

  try {
    // Test 1: Fetch Connpass Events
    console.log('📅 Test 1: Fetching Connpass Events');
    console.log('─────────────────────────────────');
    
    const connpassResult = await fetcher.execute({
      action: 'fetchConnpassEvents',
      language: 'ja',
      limit: 5,
      eventType: 'all',
    });

    if (connpassResult.success && connpassResult.data) {
      console.log(`Found ${connpassResult.data.length} events`);
      connpassResult.data.forEach((event: any, index: number) => {
        console.log(`\n${index + 1}. ${event.title}`);
        console.log(`   📍 Location: ${event.location}`);
        console.log(`   📅 Start: ${event.startTime.toLocaleString('ja-JP')}`);
        console.log(`   👥 Capacity: ${event.currentAttendees}/${event.capacity || '∞'}`);
        console.log(`   🏷️  Type: ${event.eventType}`);
        if (event.url) {
          console.log(`   🔗 URL: ${event.url}`);
        }
      });
    } else {
      console.log('❌ Failed to fetch Connpass events:', connpassResult.error);
    }

    // Test 2: Get Facility Status
    console.log('\n\n🏢 Test 2: Getting Facility Status');
    console.log('─────────────────────────────────');
    
    const statusResult = await fetcher.execute({
      action: 'getFacilityStatus',
      language: 'ja',
      limit: 10,
      eventType: 'all',
    });

    if (statusResult.success && statusResult.data) {
      const status = statusResult.data;
      console.log(`📍 Facility Status:`);
      console.log(`   🚪 Open: ${status.isOpen ? '営業中' : '閉館'}`);
      console.log(`   ⏰ Hours: ${status.openingTime} - ${status.closingTime}`);
      console.log(`   👥 Occupancy: ${status.currentOccupancy}/${status.maxOccupancy} (${Math.round(status.currentOccupancy / status.maxOccupancy * 100)}%)`);
      console.log(`   📊 Available Resources:`);
      console.log(`      - Meeting Rooms: ${status.availableResources.meetingRooms}`);
      console.log(`      - Workstations: ${status.availableResources.workstations}`);
      console.log(`      - 3D Printers: ${status.availableResources._3dPrinters}`);
      console.log(`      - Laser Cutters: ${status.availableResources.laserCutters}`);
      
      if (status.announcements.length > 0) {
        console.log(`   📢 Announcements:`);
        status.announcements.forEach((announcement: any) => {
          console.log(`      - [${announcement.priority.toUpperCase()}] ${announcement.message}`);
        });
      }
    } else {
      console.log('❌ Failed to get facility status:', statusResult.error);
    }

    // Test 3: Search Events with Query
    console.log('\n\n🔎 Test 3: Searching Events');
    console.log('─────────────────────────────────');
    
    const searchResult = await fetcher.execute({
      action: 'searchEvents',
      language: 'ja',
      searchQuery: 'AI',
      limit: 3,
      eventType: 'all',
    });

    if (searchResult.success && searchResult.data) {
      console.log(`Found ${searchResult.data.length} events matching "AI"`);
      searchResult.data.forEach((event: any, index: number) => {
        console.log(`\n${index + 1}. ${event.title}`);
        console.log(`   📅 ${event.startTime.toLocaleDateString('ja-JP')}`);
        console.log(`   🏷️  Tags: ${event.tags.join(', ')}`);
      });
    } else {
      console.log('❌ Failed to search events:', searchResult.error);
    }

    // Test 4: Get Latest Announcements
    console.log('\n\n📣 Test 4: Getting Latest Announcements');
    console.log('─────────────────────────────────');
    
    const announcementsResult = await fetcher.execute({
      action: 'getLatestAnnouncements',
      language: 'ja',
      limit: 10,
      eventType: 'all',
    });

    if (announcementsResult.success && announcementsResult.data) {
      console.log(`Found ${announcementsResult.data.length} announcements`);
      announcementsResult.data.forEach((announcement: any) => {
        const timeAgo = Math.floor((Date.now() - new Date(announcement.createdAt).getTime()) / (1000 * 60));
        console.log(`\n📌 [${announcement.priority.toUpperCase()}] ${announcement.message}`);
        console.log(`   ⏱️  ${timeAgo} minutes ago`);
      });
    } else {
      console.log('❌ Failed to get announcements:', announcementsResult.error);
    }

    // Test 5: Fetch Website Content
    console.log('\n\n🌐 Test 5: Fetching Website Content');
    console.log('─────────────────────────────────');
    
    const websiteResult = await fetcher.execute({
      action: 'fetchWebsiteContent',
      language: 'en',
      limit: 10,
      eventType: 'all',
    });

    if (websiteResult.success && websiteResult.data) {
      const content = websiteResult.data;
      console.log(`📝 About: ${content.about}`);
      console.log(`\n🏢 Facilities:`);
      content.facilities.forEach((facility: any) => {
        console.log(`   - ${facility.name}: ${facility.description}`);
      });
      console.log(`\n⏰ Opening Hours:`);
      console.log(`   - Weekdays: ${content.openingHours.weekdays}`);
      console.log(`   - Weekends: ${content.openingHours.weekends}`);
      console.log(`   - Holidays: ${content.openingHours.holidays}`);
    } else {
      console.log('❌ Failed to fetch website content:', websiteResult.error);
    }

    // Test 6: Cache Information
    console.log('\n\n💾 Test 6: Cache Information');
    console.log('─────────────────────────────────');
    
    const cacheInfo = await fetcher.getCacheInfo();
    console.log(`Cache entries: ${cacheInfo.size}`);
    cacheInfo.entries.forEach(entry => {
      console.log(`   - ${entry.key}: ${entry.age}s old`);
    });

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  }

  console.log('\n\n✅ External Data Fetcher Tool tests completed!');
}

// Run the test
testExternalDataFetcher().catch(console.error);