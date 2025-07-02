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
configDotenv({ path: '.env.local' });

const execAsync = promisify(exec);

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Test configuration
const API_BASE_URL = 'http://localhost:3000/api';
const TEST_TIMEOUT = 30000; // 30 seconds timeout for each test

// Test result tracking
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

async function testQuery(
  category: string,
  scenario: string,
  query: string,
  expectedPatterns: string[],
  language: 'ja' | 'en' = 'ja',
  sessionId?: string
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
    const foundPatterns = expectedPatterns.filter(pattern => 
      answer.toLowerCase().includes(pattern.toLowerCase())
    );

    // Improved evaluation: require at least 70% of keywords to pass
    const passed = foundPatterns.length >= Math.ceil(expectedPatterns.length * 0.7);
    
    console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    if (!passed) {
      console.log(`   Expected: ${expectedPatterns.join(', ')}`);
      console.log(`   Found: ${foundPatterns.join(', ')}`);
      console.log(`   Response: ${answer.substring(0, 100)}...`);
    }

    return {
      category,
      scenario,
      query,
      language,
      passed,
      response: answer,
      duration: response.duration,
      expectedPatterns,
      foundPatterns,
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
    },
    {
      scenario: 'Location query',
      query: 'エンジニアカフェの場所はどこですか？',
      patterns: ['福岡市', '中央区', '天神'],
    },
    {
      scenario: 'Access information',
      query: 'エンジニアカフェへのアクセス方法を教えて',
      patterns: ['天神駅', '地下鉄', '天神'],
    },
    {
      scenario: 'Pricing information',
      query: 'エンジニアカフェの利用料金は？',
      patterns: ['無料', '会員'],
    },
    {
      scenario: 'Closed days query',
      query: 'エンジニアカフェの定休日は？',
      patterns: ['月曜', '休'],
    },
  ];

  for (const test of tests) {
    const result = await testQuery(
      'Basic Information',
      test.scenario,
      test.query,
      test.patterns
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
      patterns: ['地下', '会議', 'ミーティング'],
    },
    {
      scenario: 'Saino cafe information',
      query: 'sainoの営業時間は？',
      patterns: ['11:00', '14:00', 'saino'],
    },
    {
      scenario: 'Specific facility - Focus Space',
      query: '地下のフォーカススペースの利用方法',
      patterns: ['地下', 'フォーカス', '予約'],
    },
    {
      scenario: 'Aka-Renga information',
      query: '赤レンガについて教えて',
      patterns: ['赤レンガ', '文化'],
    },
    {
      scenario: 'Facility comparison',
      query: 'エンジニアカフェとsainoの違いは？',
      patterns: ['エンジニアカフェ', 'saino'],
    },
  ];

  for (const test of tests) {
    const result = await testQuery(
      'Facility Navigation',
      test.scenario,
      test.query,
      test.patterns
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
  
  // Then test memory recall
  const tests = [
    {
      scenario: 'Previous question recall',
      query: 'さっき僕が何を聞いたか覚えてる？',
      patterns: ['営業時間', 'エンジニアカフェ'],
    },
    {
      scenario: 'Context-based follow-up',
      query: '土曜日は開いてる？',
      patterns: ['土曜', '開い', '営業'],
    },
    {
      scenario: 'Entity-only query with context',
      query: 'sainoの方は？',
      patterns: ['saino', '11:00', '14:00'],
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
      patterns: ['9:00', '22:00', 'hours'],
      language: 'en' as const,
    },
    {
      scenario: 'English location query',
      query: 'Where is Engineer Cafe located?',
      patterns: ['Fukuoka', 'Tenjin', 'Chuo'],
      language: 'en' as const,
    },
    {
      scenario: 'Cross-language understanding',
      query: 'Engineer Cafe hours?',
      patterns: ['9:00', '22:00'],
      language: 'en' as const,
    },
  ];

  for (const test of tests) {
    const result = await testQuery(
      'Multi-language',
      test.scenario,
      test.query,
      test.patterns,
      test.language
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
  
  // Generate report content
  let report = `# Engineer Cafe Navigator - Integrated Test Report\n\n`;
  report += `**Date**: ${new Date().toISOString()}\n`;
  report += `**Total Tests**: ${totalTests}\n`;
  report += `**Passed**: ${passedTests} (${passRate}%)\n`;
  report += `**Failed**: ${failedTests}\n\n`;
  
  report += `## Summary by Category\n\n`;
  
  for (const [category, data] of Object.entries(categoryResults)) {
    const categoryPassRate = ((data.passed / data.tests.length) * 100).toFixed(1);
    report += `### ${category}\n`;
    report += `- Tests: ${data.tests.length}\n`;
    report += `- Passed: ${data.passed} (${categoryPassRate}%)\n`;
    report += `- Failed: ${data.failed}\n\n`;
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
        report += `- **Expected**: ${test.expectedPatterns?.join(', ')}\n`;
        report += `- **Found**: ${test.foundPatterns?.join(', ')}\n`;
        report += `- **Response**: ${test.response?.substring(0, 200)}...\n`;
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
    // Check if server is running
    try {
      await fetch(`${API_BASE_URL}/health`);
    } catch (error) {
      console.error('❌ Server is not running. Please start the development server first.');
      console.log('Run: pnpm dev');
      process.exit(1);
    }
    
    // Run all test categories
    await runBasicInformationTests();
    await runFacilityNavigationTests();
    await runMemoryContextTests();
    await runMultiLanguageTests();
    await runEdgeCaseTests();
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