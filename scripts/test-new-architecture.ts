#!/usr/bin/env node
import 'dotenv/config';
import { MainQAWorkflow } from '@/mastra/workflows/main-qa-workflow';
import { google } from '@ai-sdk/google';

// Test queries from the comprehensive test suite
const testCases = [
  // RAG Search Tests
  { query: 'エンジニアカフェの営業時間は？', expected: ['9:00', '22:00'], category: 'hours' },
  { query: 'sainoカフェの料金を教えて', expected: ['¥', '円', '400', '600'], category: 'price' },
  { query: '地下のスペースについて教えて', expected: ['地下', 'スペース'], category: 'facility' },
  { query: '赤レンガ文化館について', expected: ['赤レンガ', '文化館'], category: 'general' },
  
  // Multi-language Tests
  { query: 'What time does Engineer Cafe open?', expected: ['9:00', '22:00'], category: 'hours' },
  { query: 'Where is Engineer Cafe located?', expected: ['Fukuoka', 'Tenjin', 'Red Brick'], category: 'location' },
  { query: 'Engineer Cafeの無料Wi-Fiはありますか？', expected: ['Wi-Fi', '無料'], category: 'wifi' },
  
  // Memory Tests
  { query: 'エンジニアカフェは何時から開いていますか？', expected: ['9:00', '営業'], category: 'hours' },
  { query: 'さっき何を聞いた？', expected: ['営業時間', '何時', '開いて'], category: 'memory' },
  { query: '土曜日も同じ時間？', expected: ['土曜', '同じ', '営業'], category: 'hours' },
  
  // Calendar Tests
  { query: '今日のエンジニアカフェのイベントは？', expected: ['今日', 'イベント'], category: 'event' },
  { query: '今週の勉強会の予定を教えて', expected: ['今週', '勉強会'], category: 'event' },
  
  // Web Search Tests
  { query: '最新のAI開発について教えて', expected: ['AI', '最新', '開発'], category: 'general' },
  { query: '福岡のスタートアップ情報', expected: ['福岡', 'スタートアップ'], category: 'general' },
];

async function testNewArchitecture() {
  console.log('🚀 Testing New Multi-Agent Architecture\n');
  console.log('='.repeat(60));
  
  const model = google('gemini-2.0-flash-exp', {
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }
    ]
  });
  
  const workflow = new MainQAWorkflow({ llm: { model } });
  const sessionId = `test_session_${Date.now()}`;
  
  let passedTests = 0;
  const testResults: any[] = [];
  
  for (let i = 0; i < testCases.length; i++) {
    const test = testCases[i];
    console.log(`\n🧪 Test ${i + 1}/${testCases.length}: "${test.query}"`);
    
    try {
      const startTime = Date.now();
      const result = await workflow.processQuestion(test.query, sessionId);
      const duration = Date.now() - startTime;
      
      const answer = result.answer.toLowerCase();
      const foundKeywords = test.expected.filter(keyword => 
        answer.includes(keyword.toLowerCase())
      );
      
      // Improved evaluation: require at least 70% of keywords to pass
      const passed = foundKeywords.length >= Math.ceil(test.expected.length * 0.7);
      
      console.log(`   Agent: ${result.metadata.routedTo}`);
      console.log(`   Category: ${result.metadata.category}`);
      console.log(`   RequestType: ${result.metadata.requestType}`);
      console.log(`   Language: ${result.metadata.language}`);
      console.log(`   Confidence: ${result.metadata.confidence}`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
      
      if (!passed) {
        console.log(`   Expected: ${test.expected.join(', ')}`);
        console.log(`   Found: ${foundKeywords.join(', ')}`);
        console.log(`   Answer: ${result.answer.substring(0, 200)}...`);
      }
      
      if (passed) passedTests++;
      
      testResults.push({
        query: test.query,
        passed,
        agent: result.metadata.routedTo,
        category: result.metadata.category,
        duration,
        answer: result.answer
      });
      
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      testResults.push({
        query: test.query,
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY\n');
  console.log(`✅ Passed: ${passedTests}/${testCases.length} (${(passedTests/testCases.length*100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${testCases.length - passedTests}/${testCases.length}`);
  
  // Performance metrics
  const successfulTests = testResults.filter(r => r.duration);
  if (successfulTests.length > 0) {
    const avgDuration = successfulTests.reduce((sum, r) => sum + r.duration, 0) / successfulTests.length;
    const maxDuration = Math.max(...successfulTests.map(r => r.duration));
    const minDuration = Math.min(...successfulTests.map(r => r.duration));
    
    console.log('\n⏱️  Performance Metrics:');
    console.log(`   Average response time: ${avgDuration.toFixed(0)}ms`);
    console.log(`   Fastest response: ${minDuration}ms`);
    console.log(`   Slowest response: ${maxDuration}ms`);
  }
  
  // Agent usage statistics
  const agentStats: Record<string, number> = {};
  testResults.forEach(r => {
    if (r.agent) {
      agentStats[r.agent] = (agentStats[r.agent] || 0) + 1;
    }
  });
  
  console.log('\n🤖 Agent Usage:');
  Object.entries(agentStats).forEach(([agent, count]) => {
    console.log(`   ${agent}: ${count} queries`);
  });
  
  // Failed tests details
  const failedTests = testResults.filter(r => !r.passed);
  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests Details:');
    failedTests.forEach(test => {
      console.log(`\n   Query: ${test.query}`);
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      } else {
        console.log(`   Agent: ${test.agent}`);
        console.log(`   Answer: ${test.answer?.substring(0, 150)}...`);
      }
    });
  }
  
  console.log('\n🎯 Target: 95% or higher success rate');
  console.log(`📈 Current: ${(passedTests/testCases.length*100).toFixed(1)}%`);
  
  if (passedTests/testCases.length >= 0.95) {
    console.log('\n🎉 SUCCESS! The new architecture meets the target success rate!');
  } else {
    console.log('\n⚠️  The new architecture needs more work to meet the target.');
  }
}

// Run the test
testNewArchitecture().catch(console.error);