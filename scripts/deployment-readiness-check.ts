#!/usr/bin/env npx tsx

/**
 * Final deployment readiness check
 * Run this after all tests pass
 */

import { config } from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

config({ path: path.join(__dirname, '../.env.local') });

interface CheckResult {
  category: string;
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warning';
    details?: string;
  }>;
}

async function deploymentReadinessCheck() {
  console.log('🚀 Deployment Readiness Check');
  console.log('============================\n');
  
  const results: CheckResult[] = [];
  
  // 1. Environment Configuration
  const envChecks = await checkEnvironment();
  results.push(envChecks);
  
  // 2. Build & Code Quality
  const buildChecks = await checkBuildQuality();
  results.push(buildChecks);
  
  // 3. Database Readiness
  const dbChecks = await checkDatabase();
  results.push(dbChecks);
  
  // 4. Feature Flags
  const flagChecks = checkFeatureFlags();
  results.push(flagChecks);
  
  // 5. Documentation
  const docChecks = await checkDocumentation();
  results.push(docChecks);
  
  // Display results
  displayReadinessReport(results);
}

async function checkEnvironment(): Promise<CheckResult> {
  const checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warning';
    details?: string;
  }> = [];
  
  // Required environment variables
  const requiredVars = [
    'DATABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_CLOUD_PROJECT_ID',
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'OPENAI_API_KEY', // Required for V2
  ];
  
  for (const varName of requiredVars) {
    checks.push({
      name: `Environment: ${varName}`,
      status: process.env[varName] ? 'pass' : 'fail',
      details: process.env[varName] ? 'Configured' : 'Missing',
    });
  }
  
  // Check production env file
  try {
    await fs.access(path.join(__dirname, '../.env.production'));
    checks.push({
      name: '.env.production file',
      status: 'pass',
      details: 'File exists',
    });
  } catch {
    checks.push({
      name: '.env.production file',
      status: 'warning',
      details: 'Not found - will need to configure in Vercel',
    });
  }
  
  return {
    category: '🔧 Environment Configuration',
    checks,
  };
}

async function checkBuildQuality(): Promise<CheckResult> {
  const checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warning';
    details?: string;
  }> = [];
  const { execSync } = require('child_process');
  
  // TypeScript check
  try {
    execSync('pnpm tsc --noEmit', { stdio: 'pipe' });
    checks.push({
      name: 'TypeScript compilation',
      status: 'pass',
      details: 'No errors',
    });
  } catch {
    checks.push({
      name: 'TypeScript compilation',
      status: 'fail',
      details: 'Type errors found',
    });
  }
  
  // Lint check
  try {
    execSync('pnpm lint', { stdio: 'pipe' });
    checks.push({
      name: 'ESLint',
      status: 'pass',
      details: 'No critical issues',
    });
  } catch {
    checks.push({
      name: 'ESLint',
      status: 'warning',
      details: 'Some warnings present',
    });
  }
  
  // Build test
  try {
    const buildDir = path.join(__dirname, '../.next');
    await fs.access(buildDir);
    const stats = await fs.stat(buildDir);
    const ageMinutes = (Date.now() - stats.mtimeMs) / (1000 * 60);
    
    checks.push({
      name: 'Production build',
      status: ageMinutes < 60 ? 'pass' : 'warning',
      details: ageMinutes < 60 ? 'Recent build found' : 'Build is outdated',
    });
  } catch {
    checks.push({
      name: 'Production build',
      status: 'fail',
      details: 'No build found - run pnpm build',
    });
  }
  
  return {
    category: '🏗️ Build & Code Quality',
    checks,
  };
}

async function checkDatabase(): Promise<CheckResult> {
  const checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warning';
    details?: string;
  }> = [];
  
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Check main tables
    const tables = [
      { name: 'knowledge_base', required: true },
      { name: 'knowledge_base_v2', required: false },
      { name: 'rag_search_metrics', required: true },
      { name: 'performance_baselines', required: false },
    ];
    
    for (const table of tables) {
      const { error } = await supabase
        .from(table.name)
        .select('*')
        .limit(1);
      
      const exists = !error || !error.message.includes('does not exist');
      
      checks.push({
        name: `Table: ${table.name}`,
        status: exists ? 'pass' : (table.required ? 'fail' : 'warning'),
        details: exists ? 'Available' : 'Not created',
      });
    }
    
    // Check pgvector extension
    const { data: extensions } = await supabase
      .rpc('get_extensions', {});
    
    const hasVector = extensions?.some((ext: any) => ext.name === 'vector');
    
    checks.push({
      name: 'pgvector extension',
      status: hasVector ? 'pass' : 'fail',
      details: hasVector ? 'Installed' : 'Not found',
    });
    
  } catch (error) {
    checks.push({
      name: 'Database connection',
      status: 'fail',
      details: error instanceof Error ? error.message : 'Connection failed',
    });
  }
  
  return {
    category: '🗄️ Database Readiness',
    checks,
  };
}

function checkFeatureFlags(): CheckResult {
  const checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warning';
    details?: string;
  }> = [];
  
  const flags = [
    {
      name: 'FF_ENABLE_GRADUAL_MIGRATION',
      expected: 'true',
      critical: true,
    },
    {
      name: 'FF_NEW_EMBEDDINGS_PERCENTAGE',
      expected: '0',
      critical: true,
    },
    {
      name: 'FF_USE_PARALLEL_RAG',
      expected: 'false',
      critical: false,
    },
    {
      name: 'FF_ENABLE_PERFORMANCE_LOGGING',
      expected: 'true',
      critical: false,
    },
  ];
  
  for (const flag of flags) {
    const value = process.env[flag.name];
    const isCorrect = value === flag.expected;
    
    checks.push({
      name: flag.name,
      status: isCorrect ? 'pass' : (flag.critical ? 'fail' : 'warning'),
      details: `${value || 'undefined'} (expected: ${flag.expected})`,
    });
  }
  
  return {
    category: '🚦 Feature Flags',
    checks,
  };
}

async function checkDocumentation(): Promise<CheckResult> {
  const checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warning';
    details?: string;
  }> = [];
  
  const requiredDocs = [
    'README.md',
    'docs/DEPLOYMENT.md',
    'docs/MIGRATION-GUIDE.md',
    'docs/FINAL-DEPLOYMENT-GUIDE.md',
  ];
  
  for (const doc of requiredDocs) {
    try {
      await fs.access(path.join(__dirname, '..', doc));
      checks.push({
        name: doc,
        status: 'pass',
        details: 'Found',
      });
    } catch {
      checks.push({
        name: doc,
        status: 'warning',
        details: 'Missing',
      });
    }
  }
  
  return {
    category: '📚 Documentation',
    checks,
  };
}

function displayReadinessReport(results: CheckResult[]) {
  console.log('Deployment Readiness Report');
  console.log('=========================\n');
  
  let totalChecks = 0;
  let passedChecks = 0;
  let failedChecks = 0;
  let warnings = 0;
  
  for (const category of results) {
    console.log(`${category.category}`);
    console.log('-'.repeat(40));
    
    for (const check of category.checks) {
      totalChecks++;
      
      const icon = {
        pass: '✅',
        fail: '❌',
        warning: '⚠️',
      }[check.status];
      
      if (check.status === 'pass') passedChecks++;
      else if (check.status === 'fail') failedChecks++;
      else warnings++;
      
      console.log(`${icon} ${check.name}`);
      if (check.details) {
        console.log(`   ${check.details}`);
      }
    }
    
    console.log('');
  }
  
  // Summary
  console.log('Summary');
  console.log('=======');
  console.log(`Total checks: ${totalChecks}`);
  console.log(`✅ Passed: ${passedChecks}`);
  console.log(`❌ Failed: ${failedChecks}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  
  const readyForDeployment = failedChecks === 0;
  
  console.log('\nDeployment Status:');
  if (readyForDeployment) {
    console.log('✅ READY FOR DEPLOYMENT');
    console.log('\nNext steps:');
    console.log('1. Create final snapshot: pnpm create:snapshot --name "ready-for-prod"');
    console.log('2. Deploy to Vercel: vercel --prod');
    console.log('3. Monitor deployment: pnpm monitor:migration --continuous');
  } else {
    console.log('❌ NOT READY - Fix failed checks before deploying');
    console.log('\nCritical issues to resolve:');
    results.forEach(category => {
      category.checks
        .filter(check => check.status === 'fail')
        .forEach(check => console.log(`  - ${check.name}`));
    });
  }
  
  // Save readiness report
  saveReadinessReport(results, {
    totalChecks,
    passedChecks,
    failedChecks,
    warnings,
    readyForDeployment,
  });
}

async function saveReadinessReport(results: CheckResult[], summary: any) {
  const report = {
    timestamp: new Date().toISOString(),
    summary,
    results,
    environment: {
      node: process.version,
      platform: process.platform,
    },
  };
  
  const reportDir = path.join(__dirname, '../deployment-reports');
  await fs.mkdir(reportDir, { recursive: true });
  
  const reportFile = path.join(reportDir, `readiness-${Date.now()}.json`);
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
  
  console.log(`\n📄 Report saved: ${reportFile}`);
}

// Run the check
deploymentReadinessCheck().catch(console.error);