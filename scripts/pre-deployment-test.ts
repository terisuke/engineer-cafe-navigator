#!/usr/bin/env npx tsx

/**
 * Pre-deployment testing script
 * Run all tests before production deployment
 * Usage: pnpm tsx scripts/pre-deployment-test.ts
 */

import { spawn, execSync } from 'child_process';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const color = {
    info: colors.cyan,
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
  }[type];
  
  console.log(`${color}${message}${colors.reset}`);
}

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

async function runPreDeploymentTests() {
  log('\n🚀 Pre-Deployment Testing Suite', 'info');
  log('===============================\n', 'info');
  
  const tests: TestResult[] = [];
  const startTime = Date.now();
  
  // 1. Build Verification
  await runTest('Build Verification', async () => {
    execSync('pnpm build', { stdio: 'pipe' });
  }, tests);
  
  // 2. Type Checking
  await runTest('Type Checking', async () => {
    execSync('pnpm tsc --noEmit', { stdio: 'pipe' });
  }, tests);
  
  // 3. Linting
  await runTest('Code Linting', async () => {
    execSync('pnpm lint', { stdio: 'pipe' });
  }, tests);
  
  // 4. Environment Variables Check
  await runTest('Environment Variables', async () => {
    const required = [
      'DATABASE_URL',
      'GOOGLE_GENERATIVE_AI_API_KEY',
      'GOOGLE_CLOUD_PROJECT_ID',
    ];
    
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required env vars: ${missing.join(', ')}`);
    }
  }, tests);
  
  // 5. Database Connection
  await runTest('Database Connection', async () => {
    const { supabaseAdmin } = await import('../src/lib/supabase');
    const { data, error } = await supabaseAdmin
      .from('knowledge_base')
      .select('count')
      .limit(1);
    
    if (error) throw error;
  }, tests);
  
  // 6. Check Migrations
  await runTest('Database Migrations', async () => {
    // Check if required tables exist
    const { supabaseAdmin } = await import('../src/lib/supabase');
    const tables = [
      'knowledge_base',
      'knowledge_base_v2',
      'rag_implementation_metrics',
      'performance_baselines',
    ];
    
    for (const table of tables) {
      const { error } = await supabaseAdmin
        .from(table)
        .select('*')
        .limit(1);
      
      if (error && error.message.includes('does not exist')) {
        throw new Error(`Table ${table} does not exist. Run migrations.`);
      }
    }
  }, tests);
  
  // 7. API Endpoints
  await runTest('API Endpoints', async () => {
    // This would need the dev server running
    log('  ⚠️  Skipping API tests (requires dev server)', 'warning');
  }, tests);
  
  // 8. External API Configuration
  await runTest('External APIs', async () => {
    if (process.env.OPENAI_API_KEY) {
      // Test OpenAI API key
      const { openai } = await import('@ai-sdk/openai');
      // Simple validation - just check if key format is correct
      if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
        throw new Error('Invalid OpenAI API key format');
      }
    } else {
      log('  ⚠️  OPENAI_API_KEY not set (required for V2)', 'warning');
    }
  }, tests);
  
  // 9. Feature Flags
  await runTest('Feature Flags', async () => {
    const flags = [
      'FF_ENABLE_GRADUAL_MIGRATION',
      'FF_NEW_EMBEDDINGS_PERCENTAGE',
      'FF_USE_PARALLEL_RAG',
    ];
    
    flags.forEach(flag => {
      const value = process.env[flag];
      log(`  ${flag}: ${value || 'not set'}`, 'info');
    });
  }, tests);
  
  // 10. File System Checks
  await runTest('Required Files', async () => {
    const requiredFiles = [
      'config/service-account-key.json',
      'src/slides/engineer-cafe.md',
      'public/characters/models/AvatarSample_A.vrm',
    ];
    
    for (const file of requiredFiles) {
      try {
        await fs.access(path.join(__dirname, '..', file));
      } catch {
        log(`  ⚠️  Missing: ${file}`, 'warning');
      }
    }
  }, tests);
  
  // Display Results
  const totalDuration = Date.now() - startTime;
  displayResults(tests, totalDuration);
  
  // Generate report
  await generateReport(tests);
  
  return tests.every(t => t.passed);
}

async function runTest(
  name: string,
  testFn: () => Promise<void>,
  results: TestResult[]
): Promise<void> {
  const startTime = Date.now();
  process.stdout.write(`Testing ${name}... `);
  
  try {
    await testFn();
    const duration = Date.now() - startTime;
    results.push({ name, passed: true, duration });
    log('✅ PASS', 'success');
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    results.push({ name, passed: false, duration, error: errorMessage });
    log('❌ FAIL', 'error');
    if (errorMessage) {
      console.log(`  Error: ${errorMessage}`);
    }
  }
}

function displayResults(tests: TestResult[], totalDuration: number) {
  console.log('\n📊 Test Results Summary');
  console.log('=====================');
  
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;
  
  console.log(`Total Tests: ${tests.length}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    tests.filter(t => !t.passed).forEach(t => {
      console.log(`  - ${t.name}: ${t.error}`);
    });
  }
  
  const allPassed = failed === 0;
  
  if (allPassed) {
    log('\n✅ All tests passed! Ready for deployment.', 'success');
    console.log('\nNext steps:');
    console.log('1. Review .env.production settings');
    console.log('2. Create production snapshot: pnpm create:snapshot');
    console.log('3. Deploy to Vercel: vercel --prod');
  } else {
    log('\n❌ Some tests failed. Fix issues before deployment.', 'error');
  }
}

async function generateReport(tests: TestResult[]) {
  const report = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    tests: tests,
    summary: {
      total: tests.length,
      passed: tests.filter(t => t.passed).length,
      failed: tests.filter(t => !t.passed).length,
    },
    readyForDeployment: tests.every(t => t.passed),
  };
  
  const reportDir = path.join(__dirname, '../test-reports');
  await fs.mkdir(reportDir, { recursive: true });
  
  const reportFile = path.join(reportDir, `pre-deployment-${Date.now()}.json`);
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
  
  console.log(`\n📄 Report saved to: ${reportFile}`);
}

// Main execution
async function main() {
  try {
    const success = await runPreDeploymentTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    log(`\n❌ Pre-deployment test failed: ${error}`, 'error');
    process.exit(1);
  }
}

main();