#!/usr/bin/env npx tsx

/**
 * Validate production deployment readiness
 * Run: pnpm tsx scripts/validate-production.ts
 */

import { performanceBaseline } from '../src/lib/monitoring/performance-baseline';
import { ragMetrics } from '../src/lib/monitoring/rag-metrics';
import { supabaseAdmin } from '../src/lib/supabase';
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

interface ValidationCheck {
  name: string;
  check: () => Promise<{
    passed: boolean;
    value: number;
    target: number;
    unit?: string;
  }>;
}

async function validateProduction() {
  log('\n🔍 Production Validation Starting...', 'info');
  log('===================================\n', 'info');
  
  const checks: ValidationCheck[] = [
    {
      name: 'V2 Response Time',
      check: async () => {
        const { data } = await supabaseAdmin
          .from('rag_implementation_metrics')
          .select('response_time_ms')
          .eq('implementation', 'v2')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        
        const avgResponseTime = data && data.length > 0
          ? data.reduce((sum, m) => sum + m.response_time_ms, 0) / data.length
          : 0;
        
        return {
          passed: avgResponseTime < 800 && avgResponseTime > 0,
          value: avgResponseTime,
          target: 800,
          unit: 'ms',
        };
      }
    },
    {
      name: 'V2 Error Rate',
      check: async () => {
        const { count: errors } = await supabaseAdmin
          .from('system_errors')
          .select('*', { count: 'exact' })
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .like('error_message', '%v2%');
        
        const { count: total } = await supabaseAdmin
          .from('rag_implementation_metrics')
          .select('*', { count: 'exact' })
          .eq('implementation', 'v2')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        
        const errorRate = (errors || 0) / (total || 1);
        return {
          passed: errorRate < 0.001,
          value: errorRate * 100,
          target: 0.1,
          unit: '%',
        };
      }
    },
    {
      name: 'V2 Similarity Score',
      check: async () => {
        const { data } = await supabaseAdmin
          .from('rag_implementation_metrics')
          .select('avg_similarity')
          .eq('implementation', 'v2')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        
        const avgSimilarity = data && data.length > 0
          ? data.reduce((sum, m) => sum + m.avg_similarity, 0) / data.length
          : 0;
        
        return {
          passed: avgSimilarity > 0.7,
          value: avgSimilarity,
          target: 0.7,
        };
      }
    },
    {
      name: 'Cache Hit Rate',
      check: async () => {
        const stats = await ragMetrics.getSearchStats({
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date()
        });
        
        return {
          passed: stats.cacheHitRate > 0.7,
          value: stats.cacheHitRate * 100,
          target: 70,
          unit: '%',
        };
      }
    },
    {
      name: 'Migration Completion',
      check: async () => {
        const { count: v1Count } = await supabaseAdmin
          .from('knowledge_base')
          .select('*', { count: 'exact', head: true });
        
        const { count: v2Count } = await supabaseAdmin
          .from('knowledge_base_v2')
          .select('*', { count: 'exact', head: true });
        
        const completionRate = (v2Count || 0) / (v1Count || 1);
        
        return {
          passed: completionRate >= 1.0,
          value: completionRate * 100,
          target: 100,
          unit: '%',
        };
      }
    },
    {
      name: 'V2 Uptime (24h)',
      check: async () => {
        const { count: totalQueries } = await supabaseAdmin
          .from('rag_implementation_metrics')
          .select('*', { count: 'exact' })
          .eq('implementation', 'v2')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        
        const { count: errors } = await supabaseAdmin
          .from('system_errors')
          .select('*', { count: 'exact' })
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .like('error_type', '%rag%v2%');
        
        const uptime = totalQueries && totalQueries > 0
          ? ((totalQueries - (errors || 0)) / totalQueries) * 100
          : 0;
        
        return {
          passed: uptime > 99.9,
          value: uptime,
          target: 99.9,
          unit: '%',
        };
      }
    }
  ];
  
  // Run all checks
  const results = await Promise.all(checks.map(async c => ({
    name: c.name,
    ...(await c.check())
  })));
  
  // Display results
  console.log('Validation Results:');
  console.log('------------------');
  
  results.forEach(r => {
    const status = r.passed ? '✅' : '❌';
    const unit = r.unit || '';
    console.log(`${status} ${r.name}: ${r.value.toFixed(2)}${unit} (target: ${r.target}${unit})`);
  });
  
  // Check if ready for deprecation
  const allPassed = results.every(r => r.passed);
  const v2Percentage = parseInt(process.env.FF_NEW_EMBEDDINGS_PERCENTAGE || '0');
  
  console.log('\n📊 Current Status:');
  console.log(`   V2 Rollout: ${v2Percentage}%`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  
  if (allPassed) {
    log('\n✅ All validation checks PASSED!', 'success');
    
    if (v2Percentage === 100) {
      log('🎉 Ready for V1 deprecation', 'success');
      console.log('\nNext steps:');
      console.log('1. Monitor for 7 days at 100% rollout');
      console.log('2. Create final V1 backup');
      console.log('3. Remove V1 code and dependencies');
    } else {
      log(`📈 Ready to increase rollout from ${v2Percentage}% to ${Math.min(v2Percentage + 25, 100)}%`, 'success');
    }
  } else {
    log('\n❌ Some validation checks FAILED', 'error');
    log('⚠️  Continue monitoring before proceeding', 'warning');
    
    // Provide specific recommendations
    console.log('\nRecommendations:');
    results.filter(r => !r.passed).forEach(r => {
      if (r.name === 'V2 Response Time') {
        console.log(`- Optimize V2 performance (current: ${r.value.toFixed(0)}ms)`);
      } else if (r.name === 'V2 Error Rate') {
        console.log(`- Investigate V2 errors (current rate: ${r.value.toFixed(3)}%)`);
      } else if (r.name === 'V2 Similarity Score') {
        console.log(`- Improve search relevance (current: ${r.value.toFixed(3)})`);
      } else if (r.name === 'Migration Completion') {
        console.log(`- Complete migration (${r.value.toFixed(1)}% done)`);
      }
    });
  }
  
  return allPassed;
}

// Cost analysis
async function analyzeCostSavings() {
  console.log('\n💰 Cost Analysis:');
  console.log('----------------');
  
  // Get usage stats
  const { count: monthlyQueries } = await supabaseAdmin
    .from('rag_search_metrics')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  
  const queriesPerMonth = monthlyQueries || 0;
  
  // Calculate costs
  const v1CostPer1M = 0.13; // Google text-embedding
  const v2CostPer1M = 0.02; // OpenAI text-embedding-3-small
  
  const v1MonthlyCost = (queriesPerMonth / 1000000) * v1CostPer1M;
  const v2MonthlyCost = (queriesPerMonth / 1000000) * v2CostPer1M;
  const monthlySavings = v1MonthlyCost - v2MonthlyCost;
  const savingsPercent = ((monthlySavings / v1MonthlyCost) * 100);
  
  console.log(`Monthly queries: ${queriesPerMonth.toLocaleString()}`);
  console.log(`V1 cost: $${v1MonthlyCost.toFixed(2)}/month`);
  console.log(`V2 cost: $${v2MonthlyCost.toFixed(2)}/month`);
  log(`Savings: $${monthlySavings.toFixed(2)}/month (${savingsPercent.toFixed(1)}%)`, 'success');
  
  // Storage savings
  console.log('\n📦 Storage Savings:');
  console.log(`V1: 1536 dimensions per vector`);
  console.log(`V2: 768 dimensions per vector`);
  log(`Storage reduction: 50%`, 'success');
}

// Main execution
async function main() {
  try {
    const isValid = await validateProduction();
    
    if (isValid) {
      await analyzeCostSavings();
    }
    
    console.log('\n---');
    console.log('Run continuously with: pnpm tsx scripts/validate-production.ts --watch');
    
  } catch (error) {
    log(`\n❌ Validation failed: ${error}`, 'error');
    process.exit(1);
  }
}

// Run the validation
main().catch(console.error);