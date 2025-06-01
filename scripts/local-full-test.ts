#!/usr/bin/env npx tsx

/**
 * Full local integration test before production deployment
 * Run: pnpm tsx scripts/local-full-test.ts
 */

import { config } from 'dotenv';
import path from 'path';
import { execSync, exec } from 'child_process';
import { createClient } from '@supabase/supabase-js';

config({ path: path.join(__dirname, '../.env.local') });

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  test: string;
  status: '✅' | '❌';
  response?: number;
  error?: string;
  info?: string;
  value?: string;
}

async function runFullLocalTest() {
  console.log('🧪 Running Full Local Integration Test');
  console.log('====================================\n');
  
  const testResults: TestResult[] = [];
  let server: any = null;
  
  try {
    // 1. Build Test
    console.log('1. Testing Production Build...');
    try {
      execSync('pnpm build', { stdio: 'inherit' });
      testResults.push({ test: 'Production Build', status: '✅' });
    } catch (error) {
      testResults.push({ 
        test: 'Production Build', 
        status: '❌', 
        error: error instanceof Error ? error.message : 'Build failed' 
      });
      displayResults(testResults);
      return;
    }
    
    // 2. Start server and run tests
    console.log('\n2. Starting Production Server...');
    server = exec('pnpm start');
    
    // Wait for server to start
    console.log('   Waiting for server to start...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // 3. API Tests
    console.log('\n3. Testing API Endpoints...');
    const apiTests = [
      {
        name: 'Health Check',
        endpoint: '/api/monitoring/dashboard',
        method: 'GET'
      },
      {
        name: 'Migration Status',
        endpoint: '/api/monitoring/migration-success',
        method: 'GET'
      },
      {
        name: 'Q&A API',
        endpoint: '/api/qa',
        method: 'POST',
        body: { question: 'エンジニアカフェの営業時間は？', language: 'ja' }
      },
      {
        name: 'Voice Status',
        endpoint: '/api/voice?action=status',
        method: 'GET'
      },
      {
        name: 'Knowledge Search',
        endpoint: '/api/knowledge/search',
        method: 'POST',
        body: { query: '営業時間' }
      }
    ];
    
    for (const test of apiTests) {
      try {
        const options: RequestInit = {
          method: test.method,
          headers: { 'Content-Type': 'application/json' }
        };
        
        if (test.body) {
          options.body = JSON.stringify(test.body);
        }
        
        console.log(`   Testing ${test.name}...`);
        const res = await fetch(`${BASE_URL}${test.endpoint}`, options);
        const data = await res.json();
        
        testResults.push({
          test: `API: ${test.name}`,
          status: res.ok ? '✅' : '❌',
          response: res.status,
          info: res.ok ? 'Response received' : `Status: ${res.status}`
        });
        
        // Special validation for specific endpoints
        if (test.name === 'Migration Status' && res.ok) {
          if (data.migration?.status) {
            testResults.push({
              test: 'Migration Data Structure',
              status: '✅',
              info: `Status: ${data.migration.status}, V2 Entries: ${data.migration.v2Entries || 0}`
            });
          }
        }
        
      } catch (error) {
        testResults.push({
          test: `API: ${test.name}`,
          status: '❌',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // 4. Feature Flag Tests
    console.log('\n4. Testing Feature Flags...');
    const flagTests = [
      { flag: 'FF_ENABLE_GRADUAL_MIGRATION', expected: 'true' },
      { flag: 'FF_NEW_EMBEDDINGS_PERCENTAGE', expected: '0' },
      { flag: 'FF_ENABLE_PERFORMANCE_LOGGING', expected: 'true' }
    ];
    
    for (const test of flagTests) {
      const value = process.env[test.flag];
      testResults.push({
        test: `Feature Flag: ${test.flag}`,
        status: value === test.expected ? '✅' : '❌',
        value: value || 'undefined',
        info: `Expected: ${test.expected}`
      });
    }
    
    // 5. Database Connection Test
    console.log('\n5. Testing Database Connection...');
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      // Test knowledge_base table
      const { count: kbCount, error: kbError } = await supabase
        .from('knowledge_base')
        .select('*', { count: 'exact', head: true });
      
      if (kbError) throw kbError;
      
      testResults.push({
        test: 'Database: knowledge_base',
        status: '✅',
        info: `Entries: ${kbCount || 0}`
      });
      
      // Test knowledge_base_v2 table
      const { count: v2Count, error: v2Error } = await supabase
        .from('knowledge_base_v2')
        .select('*', { count: 'exact', head: true });
      
      if (v2Error && !v2Error.message.includes('does not exist')) {
        throw v2Error;
      }
      
      testResults.push({
        test: 'Database: knowledge_base_v2',
        status: v2Error?.message.includes('does not exist') ? '❌' : '✅',
        info: v2Error?.message.includes('does not exist') 
          ? 'Table not created yet' 
          : `Entries: ${v2Count || 0}`
      });
      
      // Test metrics tables
      const metricsTablesTest = await testMetricsTables(supabase);
      testResults.push(...metricsTablesTest);
      
    } catch (error) {
      testResults.push({
        test: 'Database Connection',
        status: '❌',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // 6. External Service Tests
    console.log('\n6. Testing External Services...');
    
    // Google Cloud API
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      testResults.push({
        test: 'Google Generative AI Key',
        status: '✅',
        info: 'API key configured'
      });
    } else {
      testResults.push({
        test: 'Google Generative AI Key',
        status: '❌',
        error: 'Not configured'
      });
    }
    
    // OpenAI API
    if (process.env.OPENAI_API_KEY) {
      const keyValid = process.env.OPENAI_API_KEY.startsWith('sk-');
      testResults.push({
        test: 'OpenAI API Key',
        status: keyValid ? '✅' : '❌',
        info: keyValid ? 'Valid format' : 'Invalid format'
      });
    } else {
      testResults.push({
        test: 'OpenAI API Key',
        status: '❌',
        error: 'Not configured (required for V2)'
      });
    }
    
    // Service Account Key
    const fs = await import('fs/promises');
    try {
      await fs.access(path.join(__dirname, '../config/service-account-key.json'));
      testResults.push({
        test: 'Service Account Key',
        status: '✅',
        info: 'File exists'
      });
    } catch {
      testResults.push({
        test: 'Service Account Key',
        status: '❌',
        error: 'File not found'
      });
    }
    
  } finally {
    // Kill server
    if (server) {
      console.log('\n7. Shutting down server...');
      server.kill();
    }
  }
  
  // Display results
  displayResults(testResults);
}

async function testMetricsTables(supabase: any): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const tables = [
    'rag_search_metrics',
    'external_api_metrics',
    'performance_baselines',
    'system_snapshots'
  ];
  
  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      results.push({
        test: `Database: ${table}`,
        status: error && error.message.includes('does not exist') ? '❌' : '✅',
        info: error?.message.includes('does not exist') ? 'Not created' : 'Available'
      });
    } catch (error) {
      results.push({
        test: `Database: ${table}`,
        status: '❌',
        error: 'Check failed'
      });
    }
  }
  
  return results;
}

function displayResults(testResults: TestResult[]) {
  console.log('\n📊 Test Results:');
  console.log('================');
  
  // Group results by category
  const categories = {
    'Build': testResults.filter(r => r.test.includes('Build')),
    'API': testResults.filter(r => r.test.includes('API:')),
    'Database': testResults.filter(r => r.test.includes('Database:')),
    'Feature Flags': testResults.filter(r => r.test.includes('Feature Flag:')),
    'External Services': testResults.filter(r => 
      r.test.includes('Key') || r.test.includes('Service Account')
    ),
  };
  
  Object.entries(categories).forEach(([category, results]) => {
    if (results.length > 0) {
      console.log(`\n${category}:`);
      results.forEach(result => {
        console.log(`${result.status} ${result.test}`);
        if (result.error) console.log(`   ❌ Error: ${result.error}`);
        if (result.info) console.log(`   ℹ️  Info: ${result.info}`);
        if (result.value !== undefined) console.log(`   📌 Value: ${result.value}`);
      });
    }
  });
  
  const passed = testResults.filter(r => r.status === '✅').length;
  const total = testResults.length;
  const passRate = ((passed / total) * 100).toFixed(1);
  
  console.log('\n' + '='.repeat(50));
  console.log(`✨ Summary: ${passed}/${total} tests passed (${passRate}%)`);
  console.log('='.repeat(50));
  
  if (passed === total) {
    console.log('\n✅ All tests passed! Ready for production deployment.');
    console.log('\nNext steps:');
    console.log('1. Create snapshot: pnpm create:snapshot --name "pre-prod-$(date +%Y%m%d)"');
    console.log('2. Deploy to preview: vercel');
    console.log('3. Test preview environment');
    console.log('4. Deploy to production: vercel --prod');
  } else {
    console.log('\n❌ Some tests failed. Please fix issues before deploying.');
    console.log('\nFailed tests:');
    testResults
      .filter(r => r.status === '❌')
      .forEach(r => console.log(`  - ${r.test}`));
    process.exit(1);
  }
  
  // Save report
  saveReport(testResults, passed, total);
}

async function saveReport(testResults: TestResult[], passed: number, total: number) {
  const fs = await import('fs/promises');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total,
      passed,
      failed: total - passed,
      passRate: ((passed / total) * 100).toFixed(1) + '%'
    },
    environment: {
      node: process.version,
      env: process.env.NODE_ENV || 'development'
    },
    results: testResults
  };
  
  const reportDir = path.join(__dirname, '../test-reports');
  await fs.mkdir(reportDir, { recursive: true });
  
  const reportFile = path.join(reportDir, `local-test-${Date.now()}.json`);
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
  
  console.log(`\n📄 Report saved: ${reportFile}`);
}

// Main execution
runFullLocalTest().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});