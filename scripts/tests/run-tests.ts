#!/usr/bin/env npx tsx
/**
 * Test Runner
 * Main entry point for running all tests or specific test suites
 */

import { execSync } from 'child_process';
import * as path from 'path';

const testSuites = {
  'integrated': {
    name: 'Integrated Test Suite',
    description: 'Comprehensive test suite covering all major features',
    script: './integrated-test-suite.ts'
  },
  'router': {
    name: 'Router Agent Test',
    description: 'Tests routing logic for different query types',
    script: './router-agent-test.ts'
  },
  'calendar': {
    name: 'Calendar Integration Test',
    description: 'Tests Google Calendar integration',
    script: './calendar-integration-test.ts'
  }
};

function printUsage() {
  console.log(`
Engineer Cafe Navigator - Test Runner
====================================

Usage: pnpm test:run [suite]

Available test suites:
`);
  
  Object.entries(testSuites).forEach(([key, suite]) => {
    console.log(`  ${key.padEnd(12)} - ${suite.description}`);
  });
  
  console.log(`
Run all tests:
  pnpm test:run

Run specific test:
  pnpm test:run integrated
  pnpm test:run router
  pnpm test:run calendar
`);
}

async function runTest(suiteName: string) {
  const suite = testSuites[suiteName as keyof typeof testSuites];
  
  if (!suite) {
    console.error(`❌ Unknown test suite: ${suiteName}`);
    printUsage();
    process.exit(1);
  }
  
  console.log(`\n🚀 Running ${suite.name}...`);
  console.log('=' .repeat(60));
  
  try {
    execSync(`npx tsx ${suite.script}`, {
      stdio: 'inherit',
      cwd: __dirname
    });
  } catch (error) {
    console.error(`\n❌ Test suite failed: ${suiteName}`);
    process.exit(1);
  }
}

async function runAllTests() {
  console.log('🚀 Running All Test Suites');
  console.log('=' .repeat(60));
  
  let failedSuites: string[] = [];
  
  for (const [key, suite] of Object.entries(testSuites)) {
    console.log(`\n\n📋 ${suite.name}`);
    console.log('-'.repeat(60));
    
    try {
      execSync(`npx tsx ${suite.script}`, {
        stdio: 'inherit',
        cwd: __dirname
      });
    } catch (error) {
      failedSuites.push(key);
    }
  }
  
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  if (failedSuites.length === 0) {
    console.log('✅ All test suites passed!');
  } else {
    console.log(`❌ ${failedSuites.length} test suite(s) failed:`);
    failedSuites.forEach(suite => {
      console.log(`   - ${testSuites[suite as keyof typeof testSuites].name}`);
    });
    process.exit(1);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Run all tests
    await runAllTests();
  } else if (args[0] === '--help' || args[0] === '-h') {
    printUsage();
  } else {
    // Run specific test
    await runTest(args[0]);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}