#!/usr/bin/env npx tsx
/**
 * Engineer Cafe Navigator - Integrated Test Suite
 * 
 * This comprehensive test suite combines all valuable test scenarios from various test files
 * to provide a unified testing framework for the Engineer Cafe Navigator system.
 * 
 * Test Categories:
 * 1. Basic Information Queries
 * 2. Facility Navigation
 * 3. Event and Calendar Integration
 * 4. Memory and Context Handling
 * 5. Multi-language Support
 * 6. Edge Cases and Error Handling
 * 7. Performance and Stress Testing
 */

import { createClient } from '@supabase/supabase-js';
import { configDotenv } from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

// Load environment variables
const rootDir = path.join(__dirname, '../..');
configDotenv({ path: path.join(rootDir, '.env.local') });
configDotenv({ path: path.join(rootDir, '.env') });

const execAsync = promisify(exec);

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create Supabase client only if credentials are available
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Test configuration
const API_BASE_URL = 'http://localhost:3000/api';
const TEST_TIMEOUT = 30000; // 30 seconds timeout for each test

// Test result tracking with enhanced evaluation
interface TestResult {
  category: string;
  scenario: string;
  query: string;
  language: string;
  passed: boolean;
  response?: string;
  error?: string;
  duration?: number;
  expectedPatterns?: string[];
  foundPatterns?: string[];
  score?: number;
  details?: string;
}

const testResults: TestResult[] = [];

// Utility functions
async function makeApiRequest(endpoint: string, data: any): Promise<any> {
  const startTime = Date.now();
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const result = await response.json();
    const duration = Date.now() - startTime;
    return { ...result, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    throw new Error(`API request error after ${duration}ms: ${error}`);
  }
}

// Import the improved evaluation system
import { evaluateResponseImproved } from './utils/test-evaluation';

async function testQuery(
  category: string,
  scenario: string,
  query: string,
  expectedPatterns: string[],
  language: 'ja' | 'en' = 'ja',
  sessionId?: string,
  conceptHint?: string
): Promise<TestResult> {
  console.log(`\n🧪 Testing: ${scenario}`);
  console.log(`   Query: ${query}`);
  
  try {
    const response = await makeApiRequest('/qa', {
      action: 'ask_question',
      question: query,
      language,
      sessionId: sessionId || `test-${Date.now()}`,
      useNewArchitecture: true, // Use new architecture for testing
    });

    const answer = response.answer || '';
    
    // Use improved semantic evaluation
    const evaluation = evaluateResponseImproved(answer, expectedPatterns, conceptHint);
    
    console.log(`   Result: ${evaluation.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Score: ${Math.round(evaluation.score * 100)}% (${evaluation.details})`);
    
    if (!evaluation.passed) {
      console.log(`   Expected: ${expectedPatterns.join(', ')}`);
      console.log(`   Found: ${evaluation.foundPatterns.join(', ')}`);
      console.log(`   Response: ${answer.substring(0, 150)}...`);
    }

    return {
      category,
      scenario,
      query,
      language,
      passed: evaluation.passed,
      response: answer,
      duration: response.duration,
      expectedPatterns,
      foundPatterns: evaluation.foundPatterns,
      score: evaluation.score,
      details: evaluation.details,
    };
  } catch (error) {
    console.log(`   Result: ❌ ERROR - ${error}`);
    return {
      category,
      scenario,
      query,
      language,
      passed: false,
      error: String(error),
      expectedPatterns,
      foundPatterns: [],
      score: 0,
      details: 'Error occurred during testing'
    };
  }
}

// Test scenarios organized by category
async function runBasicInformationTests() {
  console.log('\n📋 Category: Basic Information Queries');
  
  const tests = [
    {
      scenario: 'Operating hours query',
      query: 'エンジニアカフェの営業時間は？',
      patterns: ['9:00', '22:00', '営業時間'],
      conceptHint: 'engineer_cafe_hours'
    },
    {
      scenario: 'Location query',
      query: 'エンジニアカフェの場所はどこですか？',
      patterns: ['福岡', '天神', '赤レンガ'], // Updated for realistic expectations
      conceptHint: 'access_info'
    },
    {
      scenario: 'Access information',
      query: 'エンジニアカフェへのアクセス方法を教えて',
      patterns: ['天神', '福岡', '2階'], // Focus on location, not transportation
      conceptHint: 'access_info'
    },
    {
      scenario: 'Pricing information',
      query: 'エンジニアカフェの利用料金は？',
      patterns: ['無料', '料金'], // Focus on pricing, not membership
      conceptHint: 'pricing_info'
    },
    {
      scenario: 'Closed days query',
      query: 'エンジニアカフェの定休日は？',
      patterns: ['最終月曜日', '休館日', '年末年始'], // More specific patterns
    },
  ];

  for (const test of tests) {
    const result = await testQuery(
      'Basic Information',
      test.scenario,
      test.query,
      test.patterns,
      'ja',
      undefined,
      test.conceptHint
    );
    testResults.push(result);
  }
}

async function runFacilityNavigationTests() {
  console.log('\n🏢 Category: Facility Navigation');
  
  const tests = [
    {
      scenario: 'Basement meeting spaces',
      query: '地下の会議室について教えて',
      patterns: ['地下', 'MTG', '予約'], // Updated to match Enhanced RAG improvements
      conceptHint: 'basement_facilities'
    },
    {
      scenario: 'Saino cafe information',
      query: 'sainoの営業時間は？',
      patterns: ['11:00', '20:30', 'saino'], // Fixed to match actual Saino hours
      conceptHint: 'saino_hours'
    },
    {
      scenario: 'Specific facility - Focus Space',
      query: '地下のフォーカススペースの利用方法',
      patterns: ['地下', '集中', '予約不要'], // More specific patterns
      conceptHint: 'basement_facilities'
    },
    {
      scenario: 'Wi-Fi information',
      query: 'Wi-Fiのパスワードは？',
      patterns: ['Wi-Fi', '受付', 'パスワード'], // Tests Enhanced RAG Wi-Fi advice
      conceptHint: 'wifi_info'
    },
    {
      scenario: 'Facility comparison',
      query: 'エンジニアカフェとsainoの違いは？',
      patterns: ['エンジニアカフェ', 'saino', '違い'],
    },
  ];

  for (const test of tests) {
    const result = await testQuery(
      'Facility Navigation',
      test.scenario,
      test.query,
      test.patterns,
      'ja',
      undefined,
      test.conceptHint
    );
    testResults.push(result);
  }
}

async function runMemoryContextTests() {
  console.log('\n🧠 Category: Memory and Context Handling');
  
  const sessionId = `memory-test-${Date.now()}`;
  
  // First, ask a question
  await makeApiRequest('/qa', {
    action: 'ask_question',
    question: 'エンジニアカフェの営業時間は？',
    language: 'ja',
    sessionId,
  });
  
  // Then test memory recall and context-dependent routing
  const tests = [
    {
      scenario: 'Previous question recall',
      query: 'さっき僕が何を聞いたか覚えてる？',
      patterns: ['営業時間', '質問', '聞いた'],
    },
    {
      scenario: 'Context-based follow-up (RouterAgent test)',
      query: '土曜日も同じ時間？', // Tests our context-dependent routing fix
      patterns: ['土曜', '時間', '営業'],
    },
    {
      scenario: 'Entity-only query with context',
      query: 'sainoの方は？',
      patterns: ['saino', '営業時間'], // Updated expectations
    },
  ];

  for (const test of tests) {
    const result = await testQuery(
      'Memory Context',
      test.scenario,
      test.query,
      test.patterns,
      'ja',
      sessionId // Pass sessionId to maintain context
    );
    result.query = `${test.query} (sessionId: ${sessionId})`;
    testResults.push(result);
  }
}

async function runMultiLanguageTests() {
  console.log('\n🌐 Category: Multi-language Support');
  
  const tests = [
    {
      scenario: 'English hours query',
      query: 'What are the operating hours?',
      patterns: ['9:00', '22:00'], // Focus on content, not language-specific terms
      language: 'en' as const,
      conceptHint: 'engineer_cafe_hours'
    },
    {
      scenario: 'English location query',
      query: 'Where is Engineer Cafe located?',
      patterns: ['Fukuoka', 'Tenjin', 'Akarenga'],
      language: 'en' as const,
      conceptHint: 'access_info'
    },
    {
      scenario: 'Cross-language understanding',
      query: 'Engineer Cafe hours?',
      patterns: ['9:00', '22:00'],
      language: 'en' as const,
      conceptHint: 'engineer_cafe_hours'
    },
  ];

  for (const test of tests) {
    const result = await testQuery(
      'Multi-language',
      test.scenario,
      test.query,
      test.patterns,
      test.language,
      undefined,
      test.conceptHint
    );
    testResults.push(result);
  }
}

async function runEdgeCaseTests() {
  console.log('\n⚠️ Category: Edge Cases and Error Handling');
  
  const tests = [
    {
      scenario: 'Ambiguous query',
      query: '地下',
      patterns: ['地下'],
    },
    {
      scenario: 'Typo handling',
      query: 'エンジンカフェの場所', // Common STT error
      patterns: ['エンジニアカフェ', '福岡'],
    },
    {
      scenario: 'Multiple entities query',
      query: 'エンジニアカフェとsainoと赤レンガの営業時間を全部教えて',
      patterns: ['エンジニアカフェ', 'saino', '赤レンガ'],
    },
    {
      scenario: 'Out of scope query',
      query: '今日の天気は？',
      patterns: ['エンジニアカフェ'],
    },
    {
      scenario: 'Very long query',
      query: 'エンジニアカフェの営業時間と場所とアクセス方法と利用料金と施設の詳細と予約方法とイベント情報と地下の会議室の情報を全部詳しく教えてください',
      patterns: ['営業時間', '場所'],
    },
  ];

  for (const test of tests) {
    const result = await testQuery(
      'Edge Cases',
      test.scenario,
      test.query,
      test.patterns
    );
    testResults.push(result);
  }
}

async function runPerformanceTests() {
  console.log('\n⚡ Category: Performance Testing');
  
  const queries = [
    'エンジニアカフェの営業時間は？',
    'sainoのランチメニューは？',
    '地下の会議室の予約方法',
    'What are the facilities available?',
    'エンジニアカフェへのアクセス',
  ];
  
  console.log('Running 5 concurrent requests...');
  const startTime = Date.now();
  
  const promises = queries.map((query, index) => 
    testQuery(
      'Performance',
      `Concurrent request ${index + 1}`,
      query,
      [],
      index === 3 ? 'en' : 'ja'
    )
  );
  
  const results = await Promise.all(promises);
  const totalDuration = Date.now() - startTime;
  
  console.log(`Total time for 5 concurrent requests: ${totalDuration}ms`);
  console.log(`Average response time: ${Math.round(totalDuration / 5)}ms`);
  
  testResults.push(...results);
}

async function runCalendarEventTests() {
  console.log('\n📅 Category: Calendar and Event Integration');
  
  const tests = [
    {
      scenario: 'Today\'s events query',
      query: '今日のエンジニアカフェのイベントは？',
      patterns: ['今日', 'イベント', '開催'],
    },
    {
      scenario: 'This week\'s schedule',
      query: '今週の勉強会の予定を教えて',
      patterns: ['今週', '勉強会', '予定'],
    },
    {
      scenario: 'Upcoming workshops',
      query: 'エンジニアカフェの今後のワークショップは？',
      patterns: ['ワークショップ', '今後', '予定'],
    },
  ];

  for (const test of tests) {
    const result = await testQuery(
      'Calendar Events',
      test.scenario,
      test.query,
      test.patterns,
      'ja'
    );
    testResults.push(result);
  }
}

async function runWebSearchTests() {
  console.log('\n🔍 Category: Web Search Integration');
  
  const tests = [
    {
      scenario: 'Latest AI developments',
      query: '最新のAI開発について教えて',
      patterns: ['AI', '最新', '開発'],
    },
    {
      scenario: 'Fukuoka tech scene',
      query: '福岡のスタートアップ情報',
      patterns: ['福岡', 'スタートアップ'],
    },
    {
      scenario: 'Current tech trends',
      query: '今のプログラミングのトレンドは？',
      patterns: ['プログラミング', 'トレンド', '技術'],
    },
  ];

  for (const test of tests) {
    const result = await testQuery(
      'Web Search',
      test.scenario,
      test.query,
      test.patterns,
      'ja'
    );
    testResults.push(result);
  }
}

async function runSTTCorrectionTests() {
  console.log('\n🎤 Category: STT Correction System');
  
  const tests = [
    {
      scenario: 'Common STT error - エンジンカフェ',
      query: 'エンジンカフェの場所は？',
      patterns: ['エンジニアカフェ', '場所', '福岡'],
      conceptHint: 'access_info'
    },
    {
      scenario: 'Ambiguous term - 階下',
      query: '階下の会議室について',
      patterns: ['地下', '会議', 'MTG'],
      conceptHint: 'basement_facilities'
    },
    {
      scenario: 'Mixed spelling - WiFi',
      query: 'wifiのパスワードは？',
      patterns: ['Wi-Fi', 'パスワード', '受付'],
      conceptHint: 'wifi_info'
    },
  ];

  for (const test of tests) {
    const result = await testQuery(
      'STT Correction',
      test.scenario,
      test.query,
      test.patterns,
      'ja',
      undefined,
      test.conceptHint
    );
    testResults.push(result);
  }
}

async function runClarificationTests() {
  console.log('\n🤔 Category: Clarification System');
  
  const tests = [
    {
      scenario: 'Ambiguous cafe query - Japanese',
      query: 'カフェの営業時間について教えてください',
      patterns: ['エンジニアカフェ', 'サイノカフェ', 'どちら'],
      conceptHint: 'clarification'
    },
    {
      scenario: 'Ambiguous cafe query - English',
      query: 'What are the cafe hours?',
      patterns: ['Engineer Cafe', 'Saino Cafe', 'which one'],
      language: 'en' as const,
      conceptHint: 'clarification'
    },
    {
      scenario: 'Ambiguous meeting room query - Japanese',
      query: '会議室について教えてください',
      patterns: ['有料会議室', '地下MTGスペース', 'どちら'],
      conceptHint: 'clarification'
    },
    {
      scenario: 'Ambiguous meeting room query - English',
      query: 'Tell me about the meeting rooms',
      patterns: ['Paid Meeting Rooms', 'Basement Meeting Spaces', 'Which one'],
      language: 'en' as const,
      conceptHint: 'clarification'
    },
    {
      scenario: 'Specific cafe query - NO clarification needed',
      query: 'エンジニアカフェの営業時間は？',
      patterns: ['9:00', '22:00'],
      conceptHint: 'engineer_cafe_hours'
    },
    {
      scenario: 'Specific basement query - NO clarification needed',
      query: '地下の会議室について教えて',
      patterns: ['地下', 'MTG', '予約'],
      conceptHint: 'basement_facilities'
    },
  ];

  for (const test of tests) {
    const result = await testQuery(
      'Clarification',
      test.scenario,
      test.query,
      test.patterns,
      test.language || 'ja',
      undefined,
      test.conceptHint
    );
    testResults.push(result);
  }
}

async function runClarificationWithMemoryTests() {
  console.log('\n🧠🤔 Category: Clarification with Memory');
  
  const sessionId = `clarification-memory-test-${Date.now()}`;
  
  // Test 1: Cafe clarification flow
  console.log('\n--- Testing Cafe Clarification Flow ---');
  
  // Step 1: Ask ambiguous cafe question
  const cafeQ1 = await testQuery(
    'Clarification Memory',
    'Ambiguous cafe query',
    'カフェの営業時間は？',
    ['エンジニアカフェ', 'サイノカフェ', 'どちら'],
    'ja',
    sessionId,
    'clarification'
  );
  testResults.push(cafeQ1);
  
  // Step 2: Answer with specific cafe name
  const cafeQ2 = await testQuery(
    'Clarification Memory',
    'Specify Engineer Cafe',
    'エンジニアカフェ',
    ['9:00', '22:00'],
    'ja',
    sessionId,
    'engineer_cafe_hours'
  );
  testResults.push(cafeQ2);
  
  // Step 3: Ask about the other cafe
  const cafeQ3 = await testQuery(
    'Clarification Memory',
    'Ask about the other cafe',
    'じゃあもう一つの方は？',
    ['saino', '11:00', '20:30'],
    'ja',
    sessionId,
    'saino_hours'
  );
  testResults.push(cafeQ3);
  
  // Test 2: Meeting room clarification flow
  console.log('\n--- Testing Meeting Room Clarification Flow ---');
  
  const meetingSessionId = `meeting-clarification-${Date.now()}`;
  
  // Step 1: Ask ambiguous meeting room question
  const meetingQ1 = await testQuery(
    'Clarification Memory',
    'Ambiguous meeting room query',
    '会議室の予約方法を教えて',
    ['有料会議室', '地下MTGスペース', 'どちら'],
    'ja',
    meetingSessionId,
    'clarification'
  );
  testResults.push(meetingQ1);
  
  // Step 2: Answer with specific type
  const meetingQ2 = await testQuery(
    'Clarification Memory',
    'Specify basement meeting space',
    '地下のMTGスペース',
    ['地下', '予約不要', '無料'],
    'ja',
    meetingSessionId,
    'basement_facilities'
  );
  testResults.push(meetingQ2);
  
  // Step 3: Ask about the other type
  const meetingQ3 = await testQuery(
    'Clarification Memory',
    'Ask about paid meeting rooms',
    'じゃあ有料の方は？',
    ['2階', '有料', '予約'],
    'ja',
    meetingSessionId
  );
  testResults.push(meetingQ3);
}

// Report generation
async function generateReport() {
  console.log('\n📊 Generating Test Report...\n');
  
  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  const passRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  // Group results by category
  const categoryResults = testResults.reduce((acc, result) => {
    if (!acc[result.category]) {
      acc[result.category] = { passed: 0, failed: 0, tests: [] };
    }
    acc[result.category].tests.push(result);
    if (result.passed) {
      acc[result.category].passed++;
    } else {
      acc[result.category].failed++;
    }
    return acc;
  }, {} as Record<string, any>);
  
  // Calculate average scores
  const scoredTests = testResults.filter(r => r.score !== undefined);
  const avgScore = scoredTests.length > 0 
    ? (scoredTests.reduce((sum, test) => sum + test.score!, 0) / scoredTests.length * 100).toFixed(1)
    : 'N/A';

  // Generate report content
  let report = `# Engineer Cafe Navigator - Enhanced Test Report\n\n`;
  report += `**Date**: ${new Date().toISOString()}\n`;
  report += `**Evaluation Method**: Semantic Analysis + Synonym Recognition\n`;
  report += `**Total Tests**: ${totalTests}\n`;
  report += `**Passed**: ${passedTests} (${passRate}%)\n`;
  report += `**Failed**: ${failedTests}\n`;
  report += `**Average Match Score**: ${avgScore}%\n\n`;
  
  report += `## Summary by Category\n\n`;
  
  for (const [category, data] of Object.entries(categoryResults)) {
    const categoryPassRate = ((data.passed / data.tests.length) * 100).toFixed(1);
    const categoryScores = data.tests.filter((t: any) => t.score !== undefined);
    const categoryAvgScore = categoryScores.length > 0
      ? (categoryScores.reduce((sum: number, test: any) => sum + test.score, 0) / categoryScores.length * 100).toFixed(1)
      : 'N/A';
    
    report += `### ${category}\n`;
    report += `- Tests: ${data.tests.length}\n`;
    report += `- Passed: ${data.passed} (${categoryPassRate}%)\n`;
    report += `- Failed: ${data.failed}\n`;
    report += `- Average Score: ${categoryAvgScore}%\n\n`;
  }
  
  report += `## Failed Test Details\n\n`;
  
  const failedTestDetails = testResults.filter(r => !r.passed);
  if (failedTestDetails.length === 0) {
    report += `All tests passed! 🎉\n\n`;
  } else {
    for (const test of failedTestDetails) {
      report += `### ${test.category} - ${test.scenario}\n`;
      report += `- **Query**: ${test.query}\n`;
      report += `- **Language**: ${test.language}\n`;
      if (test.error) {
        report += `- **Error**: ${test.error}\n`;
      } else {
        report += `- **Score**: ${test.score ? Math.round(test.score * 100) : 0}%\n`;
        report += `- **Details**: ${test.details || 'N/A'}\n`;
        report += `- **Expected**: ${test.expectedPatterns?.join(', ')}\n`;
        report += `- **Found**: ${test.foundPatterns?.join(', ')}\n`;
        report += `- **Response**: ${test.response?.substring(0, 300)}...\n`;
      }
      report += `\n`;
    }
  }
  
  report += `## Performance Metrics\n\n`;
  
  const performanceTests = testResults.filter(r => r.duration);
  if (performanceTests.length > 0) {
    const durations = performanceTests.map(r => r.duration!);
    const avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    
    report += `- **Average Response Time**: ${avgDuration}ms\n`;
    report += `- **Min Response Time**: ${minDuration}ms\n`;
    report += `- **Max Response Time**: ${maxDuration}ms\n`;
  }
  
  // Save report
  const reportPath = path.join(process.cwd(), 'test-results', `integrated-test-report-${Date.now()}.md`);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, report);
  
  console.log(`\n📄 Report saved to: ${reportPath}`);
  console.log(`\n✅ Test Summary: ${passedTests}/${totalTests} passed (${passRate}%)`);
  
  return { totalTests, passedTests, failedTests, passRate };
}

// Main test runner
async function main() {
  console.log('🚀 Engineer Cafe Navigator - Integrated Test Suite');
  console.log('=' .repeat(50));
  
  try {
    // Skip server check - assume it's running
    console.log('Assuming server is running at', API_BASE_URL);
    
    // Run all test categories
    await runBasicInformationTests();
    await runFacilityNavigationTests();
    await runMemoryContextTests();
    await runMultiLanguageTests();
    await runEdgeCaseTests();
    await runCalendarEventTests();
    await runWebSearchTests();
    await runSTTCorrectionTests();
    await runClarificationTests();
    await runClarificationWithMemoryTests();
    await runPerformanceTests();
    
    // Generate report
    const summary = await generateReport();
    
    // Exit with appropriate code
    process.exit(summary.failedTests > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run the test suite
if (require.main === module) {
  main();
}