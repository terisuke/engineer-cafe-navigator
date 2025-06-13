#!/usr/bin/env tsx

/**
 * Test script for Calendar Integration with EnhancedQAAgent
 * 
 * This script tests:
 * 1. EnhancedQAAgent with calendar-related queries
 * 2. CalendarServiceTool integration
 * 3. Facility information integration
 * 4. Question categorization
 * 5. Multi-language support
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { EnhancedQAAgent } from './src/mastra/agents/enhanced-qa-agent';
import { CalendarServiceTool } from './src/mastra/tools/calendar-service';
import { EngineerCafeWebSearchTool } from './src/mastra/tools/company-web-search';
import { RAGSearchTool } from './src/mastra/tools/rag-search';
import { SupabaseMemoryAdapter } from './src/lib/supabase-memory';
import { SupportedLanguage } from './src/mastra/types/config';
import * as fs from 'fs';

// Test configuration
const TEST_CONFIG = {
  gemini: {
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    model: 'gemini-2.0-flash-exp' as const
  }
};

// Test case interface
interface TestCase {
  id: string;
  query: string;
  language: SupportedLanguage;
  expectedCategory: string;
  description: string;
}

// Test result interface
interface TestResult {
  id: string;
  description: string;
  query: string;
  language: SupportedLanguage;
  expectedCategory: string;
  detectedCategory: string | null;
  answer: string | null;
  duration: number;
  categoryMatched: boolean;
  success: boolean;
  error: string | null;
}

// Test cases
const TEST_CASES: TestCase[] = [
  // Japanese calendar queries
  {
    id: 'jp-calendar-1',
    query: '今週エンジニアカフェでやるイベントは？',
    language: 'ja',
    expectedCategory: 'calendar',
    description: 'Japanese calendar query - this week events'
  },
  {
    id: 'jp-calendar-2',
    query: '今日のイベント予定を教えて',
    language: 'ja',
    expectedCategory: 'calendar',
    description: 'Japanese calendar query - today events'
  },
  {
    id: 'jp-calendar-3',
    query: '明日の予定はありますか？',
    language: 'ja',
    expectedCategory: 'calendar',
    description: 'Japanese calendar query - tomorrow schedule'
  },
  
  // English calendar queries
  {
    id: 'en-calendar-1',
    query: 'What events are happening at Engineer Cafe this week?',
    language: 'en',
    expectedCategory: 'calendar',
    description: 'English calendar query - this week events'
  },
  {
    id: 'en-calendar-2',
    query: 'What is the schedule for today?',
    language: 'en',
    expectedCategory: 'calendar',
    description: 'English calendar query - today schedule'
  },
  {
    id: 'en-calendar-3',
    query: 'Are there any upcoming events?',
    language: 'en',
    expectedCategory: 'calendar',
    description: 'English calendar query - upcoming events'
  },
  
  // Facility + calendar combination
  {
    id: 'facility-calendar-1',
    query: 'エンジニアカフェの施設でのイベント予定は？',
    language: 'ja',
    expectedCategory: 'calendar',
    description: 'Facility + calendar combination (Japanese)'
  },
  {
    id: 'facility-calendar-2',
    query: 'What events are scheduled at the Engineer Cafe facility?',
    language: 'en',
    expectedCategory: 'calendar',
    description: 'Facility + calendar combination (English)'
  },
  
  // Non-calendar queries for comparison
  {
    id: 'facility-only-1',
    query: 'エンジニアカフェの営業時間は？',
    language: 'ja',
    expectedCategory: 'hours',
    description: 'Facility-only query (operating hours)'
  },
  {
    id: 'facility-only-2',
    query: 'What are the facilities available at Engineer Cafe?',
    language: 'en',
    expectedCategory: 'facilities',
    description: 'Facility-only query (available facilities)'
  }
];

class CalendarIntegrationTester {
  private results: TestResult[] = [];
  private agent: EnhancedQAAgent | null = null;

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Calendar Integration Test...\n');
    
    try {
      // Initialize Google AI
      const google = createGoogleGenerativeAI({
        apiKey: TEST_CONFIG.gemini.apiKey!,
      });
      
      const model = google(TEST_CONFIG.gemini.model);
      
      // Initialize Enhanced QA Agent
      this.agent = new EnhancedQAAgent({
        llm: { model },
        memory: new Map()
      });
      
      // Initialize and add tools
      const calendarTool = new CalendarServiceTool();
      const webSearchTool = new EngineerCafeWebSearchTool();
      const ragTool = new RAGSearchTool();
      
      this.agent.addTool('calendarService', calendarTool);
      this.agent.addTool('engineerCafeWebSearch', webSearchTool);
      this.agent.addTool('ragSearch', ragTool);
      
      console.log('✅ Agent and tools initialized successfully\n');
      
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      throw error;
    }
  }

  async runTest(testCase: TestCase): Promise<TestResult> {
    console.log(`🧪 Testing: ${testCase.description}`);
    console.log(`   Query: "${testCase.query}"`);
    console.log(`   Language: ${testCase.language}`);
    console.log(`   Expected Category: ${testCase.expectedCategory}`);
    
    const startTime = Date.now();
    
    try {
      if (!this.agent) {
        throw new Error('Agent not initialized');
      }

      // Set language in memory
      const memoryAdapter = new SupabaseMemoryAdapter('test');
      await memoryAdapter.set('language', testCase.language);
      
      // Test question categorization
      const category = await this.agent.categorizeQuestion(testCase.query);
      console.log(`   Detected Category: ${category}`);
      
      // Test full answer generation
      const answer = await this.agent.answerQuestion(testCase.query);
      console.log(`   Answer: ${answer.substring(0, 200)}${answer.length > 200 ? '...' : ''}`);
      
      const duration = Date.now() - startTime;
      
      const result: TestResult = {
        id: testCase.id,
        description: testCase.description,
        query: testCase.query,
        language: testCase.language,
        expectedCategory: testCase.expectedCategory,
        detectedCategory: category,
        answer: answer,
        duration: duration,
        categoryMatched: category === testCase.expectedCategory,
        success: true,
        error: null
      };
      
      console.log(`   ✅ Test completed in ${duration}ms`);
      console.log(`   📊 Category Match: ${result.categoryMatched ? '✅' : '❌'}`);
      console.log('');
      
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ Test failed: ${errorMessage}`);
      console.log('');
      
      return {
        id: testCase.id,
        description: testCase.description,
        query: testCase.query,
        language: testCase.language,
        expectedCategory: testCase.expectedCategory,
        detectedCategory: null,
        answer: null,
        duration: Date.now() - startTime,
        categoryMatched: false,
        success: false,
        error: errorMessage
      };
    }
  }

  async runAllTests(): Promise<void> {
    console.log(`📋 Running ${TEST_CASES.length} test cases...\n`);
    
    for (const testCase of TEST_CASES) {
      const result = await this.runTest(testCase);
      this.results.push(result);
      
      // Add delay between tests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  generateReport() {
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('========================\n');
    
    const totalTests = this.results.length;
    const successfulTests = this.results.filter(r => r.success).length;
    const categoryMatches = this.results.filter(r => r.categoryMatched).length;
    const calendarTests = this.results.filter(r => r.expectedCategory === 'calendar');
    const successfulCalendarTests = calendarTests.filter(r => r.success);
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Successful Tests: ${successfulTests} (${(successfulTests/totalTests*100).toFixed(1)}%)`);
    console.log(`Category Matches: ${categoryMatches} (${(categoryMatches/totalTests*100).toFixed(1)}%)`);
    console.log(`Calendar Tests: ${calendarTests.length}`);
    console.log(`Successful Calendar Tests: ${successfulCalendarTests.length} (${(successfulCalendarTests.length/calendarTests.length*100).toFixed(1)}%)\n`);
    
    // Detailed results
    console.log('📋 DETAILED RESULTS');
    console.log('===================\n');
    
    this.results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.description}`);
      console.log(`   ID: ${result.id}`);
      console.log(`   Query: "${result.query}"`);
      console.log(`   Language: ${result.language}`);
      console.log(`   Expected Category: ${result.expectedCategory}`);
      console.log(`   Detected Category: ${result.detectedCategory || 'N/A'}`);
      console.log(`   Category Match: ${result.categoryMatched ? '✅' : '❌'}`);
      console.log(`   Success: ${result.success ? '✅' : '❌'}`);
      console.log(`   Duration: ${result.duration}ms`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.answer) {
        console.log(`   Answer Preview: ${result.answer.substring(0, 150)}${result.answer.length > 150 ? '...' : ''}`);
      }
      
      console.log('');
    });
    
    // Calendar-specific analysis
    console.log('📅 CALENDAR INTEGRATION ANALYSIS');
    console.log('=================================\n');
    
    const calendarResults = this.results.filter(r => r.expectedCategory === 'calendar');
    
    calendarResults.forEach(result => {
      console.log(`${result.id}: ${result.success ? '✅' : '❌'} - ${result.description}`);
      if (result.answer && result.answer.includes('mock')) {
        console.log('   📝 Note: Using mock calendar data (development mode)');
      }
      if (result.answer && result.answer.includes('Calendar')) {
        console.log('   📅 Calendar service integration: Working');
      }
    });
    
    console.log('\n🔧 INTEGRATION STATUS');
    console.log('=====================\n');
    
    const integrationChecks = [
      {
        name: 'Calendar Service Tool',
        status: this.results.some(r => r.answer && r.answer.includes('Calendar Events'))
      },
      {
        name: 'Question Categorization',
        status: this.results.filter(r => r.categoryMatched).length > totalTests * 0.8
      },
      {
        name: 'Multi-language Support',
        status: this.results.some(r => r.language === 'ja' && r.success) && 
                this.results.some(r => r.language === 'en' && r.success)
      },
      {
        name: 'Facility Context Integration',
        status: this.results.some(r => r.answer && 
                (r.answer.includes('エンジニアカフェ') || r.answer.includes('Engineer Cafe')))
      }
    ];
    
    integrationChecks.forEach(check => {
      console.log(`${check.name}: ${check.status ? '✅ Working' : '❌ Issues detected'}`);
    });
    
    return {
      totalTests,
      successfulTests,
      categoryMatches,
      calendarTests: calendarTests.length,
      successfulCalendarTests: successfulCalendarTests.length,
      integrationChecks,
      results: this.results
    };
  }
}

// Main execution
async function main() {
  console.log('🧪 Calendar Integration Test for EnhancedQAAgent');
  console.log('================================================\n');
  
  // Check environment
  if (!TEST_CONFIG.gemini.apiKey) {
    console.error('❌ GOOGLE_GENERATIVE_AI_API_KEY environment variable is required');
    process.exit(1);
  }
  
  const tester = new CalendarIntegrationTester();
  
  try {
    await tester.initialize();
    await tester.runAllTests();
    const report = tester.generateReport();
    
    // Save results to file
    const resultFile = `test-results-${Date.now()}.json`;
    fs.writeFileSync(resultFile, JSON.stringify(report, null, 2));
    console.log(`\n💾 Detailed results saved to: ${resultFile}`);
    
    // Exit with appropriate code
    const successRate = report.successfulTests / report.totalTests;
    if (successRate >= 0.8) {
      console.log('\n🎉 Tests passed with good success rate!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Tests completed but with low success rate. Check the issues above.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (require.main === module) {
  main();
}

export { CalendarIntegrationTester, TEST_CASES };