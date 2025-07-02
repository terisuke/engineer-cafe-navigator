import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

// Test the issue and proposed fix
async function testSainoHoursFilter() {
  console.log('Testing Saino Cafe hours filtering issue...\n');

  // Simulate the search query that's generated
  const searchQuery = 'sainoカフェの営業時間';
  
  // The issue is that when searching for "sainoカフェの営業時間",
  // the RAG search returns ALL information about saino cafe,
  // not just the operating hours.
  
  // The fix needs to be in the EnhancedQAAgent where it processes
  // the search results. Instead of passing all search results to
  // the LLM, we need to filter the results based on the requestType.
  
  console.log('Current behavior:');
  console.log('1. User asks for cafe hours');
  console.log('2. System detects requestType = "hours"');
  console.log('3. User clarifies they mean Saino Cafe');
  console.log('4. System searches for "sainoカフェの営業時間"');
  console.log('5. RAG returns ALL Saino Cafe information');
  console.log('6. LLM gets overwhelmed and returns everything\n');
  
  console.log('Proposed fix:');
  console.log('1. Add content filtering based on requestType');
  console.log('2. For "hours" requestType, filter results to only include:');
  console.log('   - Content containing: 営業時間, 時間, hours, time, ランチ, ディナー');
  console.log('   - Exclude content about: メニュー, 席数, 設備, 場所 (unless time-related)');
  console.log('3. Pass filtered content to LLM with strict instructions\n');
  
  // The fix location
  console.log('Fix location: enhanced-qa-agent.ts');
  console.log('Method: processContextualResponse()');
  console.log('After line 1406 where searchKnowledgeBase is called\n');
  
  // Sample filter function
  console.log('Sample filter implementation:');
  console.log(`
  // After getting context from searchKnowledgeBase
  if (originalContext.requestType === 'hours' && context) {
    // Filter context to only include time-related information
    const timeKeywords = ['営業時間', '時間', 'hours', 'time', 'ランチ', 'ディナー', '午前', '午後', '曜日', '定休日', '休業日'];
    const excludeKeywords = ['メニュー', '席数', '設備', '電話', 'TEL', '住所', 'アクセス'];
    
    // Split context into sentences/paragraphs
    const sections = context.split(/[。\\n]+/);
    
    // Filter sections that contain time keywords and don't contain exclude keywords
    const filteredSections = sections.filter(section => {
      const hasTimeKeyword = timeKeywords.some(keyword => section.includes(keyword));
      const hasExcludeKeyword = excludeKeywords.some(keyword => section.includes(keyword));
      return hasTimeKeyword && !hasExcludeKeyword;
    });
    
    // Rebuild context with only time-related information
    context = filteredSections.join('。');
  }
  `);
}

// Run the test
testSainoHoursFilter();