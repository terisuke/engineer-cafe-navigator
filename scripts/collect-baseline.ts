#!/usr/bin/env npx tsx

/**
 * Collect performance baseline metrics
 * Run: pnpm monitor:baseline
 */

import { performanceBaseline } from '../src/lib/monitoring/performance-baseline';
import { config } from 'dotenv';
import path from 'path';

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

async function collectBaseline() {
  log('\n📊 Collecting Performance Baseline...', 'info');
  
  try {
    const baseline = await performanceBaseline.collectBaseline();
    
    log('\n✅ Baseline collected successfully!', 'success');
    
    // Display summary
    console.log('\n📈 Performance Summary:');
    console.log('---------------------');
    
    // RAG Performance
    console.log('\n🔍 RAG Search Performance:');
    console.log(`  • Average Response Time: ${baseline.rag.avgResponseTime.toFixed(2)}ms`);
    console.log(`  • P95 Response Time: ${baseline.rag.p95ResponseTime}ms`);
    console.log(`  • P99 Response Time: ${baseline.rag.p99ResponseTime}ms`);
    console.log(`  • Cache Hit Rate: ${(baseline.rag.cacheHitRate * 100).toFixed(2)}%`);
    console.log(`  • Average Similarity: ${baseline.rag.avgSimilarity.toFixed(3)}`);
    console.log(`  • Total Queries (1hr): ${baseline.rag.totalQueries}`);
    
    // External APIs
    console.log('\n🌐 External API Performance:');
    for (const [source, metrics] of Object.entries(baseline.externalAPIs)) {
      if (metrics.totalCalls > 0) {
        console.log(`\n  ${source}:`);
        console.log(`    • Average Response Time: ${metrics.avgResponseTime.toFixed(2)}ms`);
        console.log(`    • Success Rate: ${(metrics.successRate * 100).toFixed(2)}%`);
        console.log(`    • Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(2)}%`);
        console.log(`    • Total Calls: ${metrics.totalCalls}`);
      }
    }
    
    // System Resources
    console.log('\n💻 System Resources:');
    console.log(`  • Memory Usage: ${baseline.system.memoryUsageMB.toFixed(2)}MB`);
    
    // Knowledge Base
    console.log('\n📚 Knowledge Base:');
    console.log(`  • Total Entries: ${baseline.knowledgeBase.totalEntries}`);
    if (baseline.knowledgeBase.lastUpdateTime) {
      console.log(`  • Last Update: ${new Date(baseline.knowledgeBase.lastUpdateTime).toLocaleString()}`);
      console.log(`  • Update Duration: ${baseline.knowledgeBase.lastUpdateDuration}ms`);
    }
    
    // Save baseline timestamp
    console.log(`\n📝 Baseline ID: ${baseline.timestamp}`);
    
  } catch (error) {
    log(`\n❌ Failed to collect baseline: ${error}`, 'error');
    process.exit(1);
  }
}

async function compareBaselines() {
  log('\n📊 Comparing to Previous Baseline...', 'info');
  
  try {
    const comparison = await performanceBaseline.compareToBaseline();
    
    console.log('\n📈 Performance Comparison:');
    console.log('------------------------');
    
    // RAG Comparison
    console.log('\n🔍 RAG Search:');
    console.log(`  • Response Time: ${comparison.rag.responseTime.change > 0 ? '🔴' : '🟢'} ${comparison.rag.responseTime.change.toFixed(2)}%`);
    console.log(`  • Cache Hit Rate: ${comparison.rag.cacheHitRate.change > 0 ? '🟢' : '🔴'} ${comparison.rag.cacheHitRate.change.toFixed(2)}%`);
    console.log(`  • Similarity: ${comparison.rag.similarity.change > 0 ? '🟢' : '🔴'} ${comparison.rag.similarity.change.toFixed(2)}%`);
    
    // Recommendation
    console.log(`\n💡 Recommendation: ${comparison.recommendation}`);
    
  } catch (error) {
    log(`\n⚠️  No previous baseline found for comparison`, 'warning');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const compare = args.includes('--compare');
  
  await collectBaseline();
  
  if (compare) {
    await compareBaselines();
  }
  
  log('\n✨ Done!', 'success');
}

// Run the script
main().catch(console.error);