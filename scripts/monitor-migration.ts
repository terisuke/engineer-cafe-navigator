#!/usr/bin/env npx tsx

/**
 * Monitor RAG migration progress and performance
 * Run: pnpm tsx scripts/monitor-migration.ts
 */

import { config } from 'dotenv';
import path from 'path';
import { supabaseAdmin } from '../src/lib/supabase';
import { ragSearchRouter } from '../src/mastra/tools/rag-search-router';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
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

async function monitorMigration() {
  log('\n📊 RAG Migration Monitor', 'info');
  log('======================\n', 'info');
  
  try {
    // 1. Check migration status
    await checkMigrationStatus();
    
    // 2. Compare performance
    await comparePerformance();
    
    // 3. Check A/B test results
    await checkABTestResults();
    
    // 4. Monitor error rates
    await checkErrorRates();
    
    // 5. Calculate cost savings
    await calculateCostSavings();
    
    // 6. Generate recommendations
    await generateRecommendations();
    
  } catch (error) {
    log(`\n❌ Monitoring failed: ${error}`, 'error');
    process.exit(1);
  }
}

async function checkMigrationStatus() {
  log('1. Migration Status', 'info');
  log('------------------', 'info');
  
  // Count original entries
  const { count: v1Count } = await supabaseAdmin
    .from('knowledge_base')
    .select('*', { count: 'exact', head: true });
  
  // Count migrated entries
  const { count: v2Count } = await supabaseAdmin
    .from('knowledge_base_v2')
    .select('*', { count: 'exact', head: true });
  
  const migrationProgress = ((v2Count || 0) / (v1Count || 1)) * 100;
  
  console.log(`  Original entries (V1): ${v1Count}`);
  console.log(`  Migrated entries (V2): ${v2Count}`);
  console.log(`  Migration progress: ${migrationProgress.toFixed(1)}%`);
  
  if (migrationProgress < 100) {
    log(`  ⚠️  Migration incomplete`, 'warning');
  } else {
    log(`  ✅ Migration complete`, 'success');
  }
  
  console.log('');
}

async function comparePerformance() {
  log('2. Performance Comparison', 'info');
  log('------------------------', 'info');
  
  const timeRange = {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    end: new Date(),
  };
  
  const stats = await ragSearchRouter.getImplementationStats(timeRange);
  
  console.log('\n  V1 Performance:');
  console.log(`    • Queries: ${stats.v1.totalQueries}`);
  console.log(`    • Avg Response Time: ${stats.v1.avgResponseTime.toFixed(2)}ms`);
  console.log(`    • P95 Response Time: ${stats.v1.p95ResponseTime}ms`);
  console.log(`    • Avg Similarity: ${stats.v1.avgSimilarity.toFixed(3)}`);
  
  console.log('\n  V2 Performance:');
  console.log(`    • Queries: ${stats.v2.totalQueries}`);
  console.log(`    • Avg Response Time: ${stats.v2.avgResponseTime.toFixed(2)}ms`);
  console.log(`    • P95 Response Time: ${stats.v2.p95ResponseTime}ms`);
  console.log(`    • Avg Similarity: ${stats.v2.avgSimilarity.toFixed(3)}`);
  
  console.log('\n  Improvements:');
  const responseTimeImprovement = stats.comparison.responseTimeImprovement;
  const similarityChange = -stats.comparison.similarityImprovement; // Negative because higher is better
  
  if (responseTimeImprovement > 0) {
    log(`    • Response Time: ${responseTimeImprovement.toFixed(1)}% faster 🚀`, 'success');
  } else {
    log(`    • Response Time: ${Math.abs(responseTimeImprovement).toFixed(1)}% slower ⚠️`, 'warning');
  }
  
  if (similarityChange > -5) { // Within 5% is acceptable
    log(`    • Similarity: ${similarityChange > 0 ? '+' : ''}${similarityChange.toFixed(1)}% ✅`, 'success');
  } else {
    log(`    • Similarity: ${similarityChange.toFixed(1)}% ⚠️`, 'warning');
  }
  
  console.log('');
}

async function checkABTestResults() {
  log('3. A/B Test Results', 'info');
  log('------------------', 'info');
  
  // Get recent A/B test results
  const { data: abTests } = await supabaseAdmin
    .from('rag_ab_test_results')
    .select('*')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
    .limit(100);
  
  if (!abTests || abTests.length === 0) {
    console.log('  No A/B test results in the last hour');
    return;
  }
  
  // Calculate success rates
  const v1Success = abTests.filter(t => t.v1_status === 'fulfilled').length;
  const v2Success = abTests.filter(t => t.v2_status === 'fulfilled').length;
  
  console.log(`  Total comparisons: ${abTests.length}`);
  console.log(`  V1 success rate: ${((v1Success / abTests.length) * 100).toFixed(1)}%`);
  console.log(`  V2 success rate: ${((v2Success / abTests.length) * 100).toFixed(1)}%`);
  
  // Average differences for successful comparisons
  const successfulComparisons = abTests.filter(
    t => t.v1_status === 'fulfilled' && t.v2_status === 'fulfilled'
  );
  
  if (successfulComparisons.length > 0) {
    const avgResponseTimeDiff = successfulComparisons.reduce(
      (sum, t) => sum + (t.response_time_diff || 0), 0
    ) / successfulComparisons.length;
    
    const avgSimilarityDiff = successfulComparisons.reduce(
      (sum, t) => sum + (t.similarity_diff || 0), 0
    ) / successfulComparisons.length;
    
    console.log(`\n  Average differences (V2 - V1):`);
    console.log(`    • Response time: ${avgResponseTimeDiff > 0 ? '+' : ''}${avgResponseTimeDiff.toFixed(2)}ms`);
    console.log(`    • Similarity: ${avgSimilarityDiff > 0 ? '+' : ''}${avgSimilarityDiff.toFixed(3)}`);
  }
  
  console.log('');
}

async function checkErrorRates() {
  log('4. Error Rates', 'info');
  log('-------------', 'info');
  
  // LIKE句の代わりにilike（大文字小文字無視の部分一致）を使い、SQLインジェクションを防ぐ
  const { data: errors } = await supabaseAdmin
    .from('system_errors')
    .select('*')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .ilike('error_type', '%rag%');
  
  const v1Errors = errors?.filter(e => e.error_message?.includes('v1')) || [];
  const v2Errors = errors?.filter(e => e.error_message?.includes('v2')) || [];
  
  console.log(`  V1 errors (last hour): ${v1Errors.length}`);
  console.log(`  V2 errors (last hour): ${v2Errors.length}`);
  
  if (v2Errors.length > v1Errors.length * 2) {
    log(`  ⚠️  V2 error rate is concerning`, 'warning');
  } else if (v2Errors.length === 0) {
    log(`  ✅ V2 running smoothly`, 'success');
  }
  
  console.log('');
}

async function calculateCostSavings() {
  log('5. Cost Analysis', 'info');
  log('---------------', 'info');
  
  // Embedding dimensions
  const v1Dimensions = 1536;
  const v2Dimensions = 768;
  
  // Storage savings
  const storageSavings = ((v1Dimensions - v2Dimensions) / v1Dimensions) * 100;
  console.log(`  Storage reduction: ${storageSavings.toFixed(1)}%`);
  
  // API cost comparison (OpenAI pricing)
  const v1ApiCostPer1M = 0.13; // text-embedding-3-large
  const v2ApiCostPer1M = 0.02; // text-embedding-3-small
  const apiCostSavings = ((v1ApiCostPer1M - v2ApiCostPer1M) / v1ApiCostPer1M) * 100;
  
  console.log(`  API cost reduction: ${apiCostSavings.toFixed(1)}%`);
  
  // Estimate monthly savings based on usage
  const { count: monthlyQueries } = await supabaseAdmin
    .from('rag_search_metrics')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  
  if (monthlyQueries) {
    const v1MonthlyCost = (monthlyQueries / 1000000) * v1ApiCostPer1M;
    const v2MonthlyCost = (monthlyQueries / 1000000) * v2ApiCostPer1M;
    const monthlySavings = v1MonthlyCost - v2MonthlyCost;
    
    console.log(`\n  Monthly projections (${monthlyQueries} queries):`);
    console.log(`    • V1 cost: $${v1MonthlyCost.toFixed(2)}`);
    console.log(`    • V2 cost: $${v2MonthlyCost.toFixed(2)}`);
    log(`    • Savings: $${monthlySavings.toFixed(2)}/month`, 'success');
  }
  
  console.log('');
}

async function generateRecommendations() {
  log('6. Recommendations', 'info');
  log('-----------------', 'info');
  
  const recommendations: string[] = [];
  
  // Check if ready to increase rollout
  const currentPercentage = parseInt(process.env.FF_NEW_EMBEDDINGS_PERCENTAGE || '0');
  
  // Get V2 metrics
  const { data: v2Metrics } = await supabaseAdmin
    .from('rag_implementation_metrics')
    .select('*')
    .eq('implementation', 'v2')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  if (v2Metrics && v2Metrics.length > 100) {
    const avgResponseTime = v2Metrics.reduce((sum, m) => sum + m.response_time_ms, 0) / v2Metrics.length;
    const avgSimilarity = v2Metrics.reduce((sum, m) => sum + m.avg_similarity, 0) / v2Metrics.length;
    
    if (avgResponseTime < 800 && avgSimilarity > 0.7) {
      if (currentPercentage < 100) {
        const nextPercentage = Math.min(currentPercentage + 25, 100);
        recommendations.push(`✅ V2 performance is good. Increase rollout to ${nextPercentage}%`);
      } else {
        recommendations.push(`✅ Full rollout complete. Consider removing V1 after 1 week of stability`);
      }
    } else {
      recommendations.push(`⚠️  V2 performance needs improvement before increasing rollout`);
      if (avgResponseTime >= 800) {
        recommendations.push(`   - Response time (${avgResponseTime.toFixed(0)}ms) exceeds target (800ms)`);
      }
      if (avgSimilarity <= 0.7) {
        recommendations.push(`   - Similarity score (${avgSimilarity.toFixed(3)}) below threshold (0.7)`);
      }
    }
  } else {
    recommendations.push(`ℹ️  Need more data (${v2Metrics?.length || 0} queries) before making recommendations`);
  }
  
  // Check error rates
  const { count: recentErrors } = await supabaseAdmin
    .from('system_errors')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .like('error_message', '%v2%');
  
  if (recentErrors && recentErrors > 5) {
    recommendations.push(`⚠️  High V2 error rate (${recentErrors} errors/hour). Investigate before proceeding`);
  }
  
  // Display recommendations
  recommendations.forEach(rec => {
    console.log(`  ${rec}`);
  });
  
  console.log('');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const continuous = args.includes('--continuous');
  
  if (continuous) {
    log('Starting continuous monitoring (Ctrl+C to stop)...', 'info');
    
    // Run immediately
    await monitorMigration();
    
    // Then run every 5 minutes
    setInterval(async () => {
      console.log('\n' + '='.repeat(50) + '\n');
      await monitorMigration();
    }, 5 * 60 * 1000);
  } else {
    await monitorMigration();
    log('✨ Monitoring complete!', 'success');
  }
}

// Run the monitor
main().catch(console.error);