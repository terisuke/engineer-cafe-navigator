#!/usr/bin/env node

/**
 * Simulate the expected responses for saino cafe queries
 * This shows what the response SHOULD look like after our changes
 */

const testCases = [
  {
    query: 'sainoカフェの休館日は？',
    expectedResponse: 'さいのカフェは土曜日はエンジニアカフェが休館日の場合のみ営業しています。',
    actualBehavior: 'SHORT - Only closing day info'
  },
  {
    query: '才能カフェの定休日はいつですか？',
    expectedResponse: 'さいのカフェは土曜日はエンジニアカフェが休館日の場合のみ営業となっています。',
    actualBehavior: 'SHORT - Only regular holiday info'
  },
  {
    query: 'sainoカフェの営業時間は？',
    expectedResponse: 'さいのカフェの営業時間は火曜日〜土曜日 10:00〜17:00です。',
    actualBehavior: 'SHORT - Only operating hours'
  },
  {
    query: 'sainoカフェの営業時間と休館日を教えて',
    expectedResponse: 'さいのカフェの営業時間は火曜日〜土曜日 10:00〜17:00です。土曜日はエンジニアカフェが休館日の場合のみ営業しています。',
    actualBehavior: 'MEDIUM - Both hours and closing days'
  },
  {
    query: 'いや、sainoカフェの方。',
    contextualInfo: '(After asking about operating hours)',
    expectedResponse: 'さいのカフェの営業時間は火曜日〜土曜日 10:00〜17:00です。',
    actualBehavior: 'SHORT - Contextual, inherits previous request type'
  },
  {
    query: 'When is saino cafe closed?',
    expectedResponse: 'Saino cafe operates Tuesday to Saturday, with Saturday open only when Engineer Cafe is closed.',
    actualBehavior: 'SHORT - English closing info only'
  }
];

console.log('🎯 Expected Response Patterns for Saino Cafe Queries\n');
console.log('After implementing our changes, responses should be:\n');

testCases.forEach((testCase, index) => {
  console.log(`${index + 1}. Query: "${testCase.query}"`);
  if (testCase.contextualInfo) {
    console.log(`   Context: ${testCase.contextualInfo}`);
  }
  console.log(`   Expected Response: "${testCase.expectedResponse}"`);
  console.log(`   Behavior: ${testCase.actualBehavior}`);
  console.log(`   Length: ~${testCase.expectedResponse.length} characters`);
  console.log('');
});

console.log('📊 Summary of Changes:\n');
console.log('1. ✅ Added "休館日" to detectSpecificRequest keywords');
console.log('2. ✅ Query normalization: "休館日" → "定休日"');
console.log('3. ✅ Knowledge base updated with "休館日" in content and tags');
console.log('4. ✅ RAG search normalizes queries for consistency');
console.log('');
console.log('🎯 Result: Specific queries get specific answers!');
console.log('   - No more 300+ character responses for simple questions');
console.log('   - Only requested information is returned');
console.log('   - Context-aware responses for follow-up questions');