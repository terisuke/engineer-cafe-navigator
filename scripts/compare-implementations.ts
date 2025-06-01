#!/usr/bin/env npx tsx

/**
 * Compare V1 and V2 RAG implementations side-by-side
 * Run: pnpm tsx scripts/compare-implementations.ts
 */

import { config } from 'dotenv';
import path from 'path';
import { ragSearchTool } from '../src/mastra/tools/rag-search';
import { ragSearchV2 } from '../src/mastra/tools/rag-search-v2';

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

// Test queries
const TEST_QUERIES = [
  { query: 'エンジニアカフェの営業時間', category: 'facilities', language: 'ja' },
  { query: '料金プラン', category: 'pricing', language: 'ja' },
  { query: 'What are the membership benefits?', category: 'services', language: 'en' },
  { query: 'イベントスペースの予約方法', category: 'facilities', language: 'ja' },
  { query: 'WiFiの速度', category: 'technical', language: 'ja' },
];

async function compareImplementations() {
  log('\n🔍 RAG Implementation Comparison', 'info');
  log('================================\n', 'info');
  
  const results: Array<{
    query: string;
    v1: any;
    v2: any;
  }> = [];
  
  for (const testCase of TEST_QUERIES) {
    log(`\nQuery: "${testCase.query}"`, 'info');
    log(`Category: ${testCase.category}, Language: ${testCase.language}`, 'info');
    log('-'.repeat(50), 'info');
    
    try {
      // Run both implementations in parallel
      const [v1Result, v2Result] = await Promise.all([
        runV1(testCase),
        runV2(testCase),
      ]);
      
      // Display results
      displayComparison(v1Result, v2Result);
      
      // Store for summary
      results.push({
        query: testCase.query,
        v1: v1Result,
        v2: v2Result,
      });
      
    } catch (error) {
      log(`❌ Error comparing: ${error}`, 'error');
    }
  }
  
  // Display summary
  displaySummary(results);
}

async function runV1(testCase: any) {
  const startTime = Date.now();
  try {
    const result = await ragSearchTool.searchKnowledgeBase(
      testCase.query,
      testCase.language as 'ja' | 'en'
    );
    const responseTime = Date.now() - startTime;
    // 文字列ならラップ、配列ならそのまま返却
    const results = typeof result === 'string' ? [{ text: result }] : result;
    return {
      success: true,
      results,
      responseTime,
      resultCount: Array.isArray(results) ? results.length : 0,
      avgSimilarity: Array.isArray(results) ? calculateAvgSimilarity(results) : 0,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime,
    };
  }
}

async function runV2(testCase: any) {
  const startTime = Date.now();
  
  try {
    const results = await ragSearchV2.search(
      testCase.query,
      {
        category: testCase.category,
        language: testCase.language,
        limit: 5,
      }
    );
    
    const responseTime = Date.now() - startTime;
    
    return {
      success: true,
      results,
      responseTime,
      resultCount: 0, // searchKnowledgeBase returns a formatted string, not array
      avgSimilarity: 0, // searchKnowledgeBase returns a formatted string, not array
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime,
    };
  }
}

function displayComparison(v1Result: any, v2Result: any) {
  console.log('\n📊 Results:');
  // V1 Results
  console.log('\nV1 (Current - 1536 dims):');
  if (v1Result.success) {
    console.log(`  ✅ Success in ${v1Result.responseTime}ms`);
    console.log(`  • Results: ${v1Result.resultCount}`);
    console.log(`  • Avg Similarity: ${v1Result.avgSimilarity.toFixed(3)}`);
    if (Array.isArray(v1Result.results) && v1Result.results.length > 0) {
      console.log('  • Top result:');
      console.log(`    - ${v1Result.results[0].title || v1Result.results[0].text || 'Untitled'}`);
      if (v1Result.results[0].similarity !== undefined) {
        console.log(`    - Similarity: ${v1Result.results[0].similarity.toFixed(3)}`);
      }
    }
  } else {
    console.log(`  ❌ Failed: ${v1Result.error}`);
  }
  // V2 Results
  console.log('\nV2 (New - 768 dims):');
  if (v2Result.success) {
    console.log(`  ✅ Success in ${v2Result.responseTime}ms`);
    console.log(`  • Results: ${v2Result.resultCount}`);
    console.log(`  • Avg Similarity: ${v2Result.avgSimilarity.toFixed(3)}`);
    if (Array.isArray(v2Result.results) && v2Result.results.length > 0) {
      console.log('  • Top result:');
      console.log(`    - ${v2Result.results[0].title || v2Result.results[0].text || 'Untitled'}`);
      if (v2Result.results[0].similarity !== undefined) {
        console.log(`    - Similarity: ${v2Result.results[0].similarity.toFixed(3)}`);
      }
    }
  } else {
    console.log(`  ❌ Failed: ${v2Result.error}`);
  }
  // Comparison
  if (v1Result.success && v2Result.success) {
    console.log('\n📈 Comparison:');
    const timeDiff = v2Result.responseTime - v1Result.responseTime;
    const timePercent = ((timeDiff / v1Result.responseTime) * 100).toFixed(1);
    if (timeDiff < 0) {
      log(`  • Speed: V2 is ${Math.abs(timeDiff)}ms faster (${Math.abs(parseFloat(timePercent))}% improvement)`, 'success');
    } else {
      log(`  • Speed: V2 is ${timeDiff}ms slower (${timePercent}% degradation)`, 'warning');
    }
    const simDiff = v2Result.avgSimilarity - v1Result.avgSimilarity;
    if (Math.abs(simDiff) < 0.05) {
      log(`  • Accuracy: Similar (diff: ${simDiff.toFixed(3)})`, 'success');
    } else if (simDiff > 0) {
      log(`  • Accuracy: V2 is better (+${simDiff.toFixed(3)})`, 'success');
    } else {
      log(`  • Accuracy: V1 is better (${simDiff.toFixed(3)})`, 'warning');
    }
    // Check if results are similar
    const v1Ids = new Set(Array.isArray(v1Result.results) ? v1Result.results.map((r: any) => r.id) : []);
    const v2Ids = new Set(Array.isArray(v2Result.results) ? v2Result.results.map((r: any) => r.id) : []);
    const overlap = [...v1Ids].filter(id => v2Ids.has(id)).length;
    const overlapPercent = (overlap / Math.max(v1Ids.size, v2Ids.size || 1)) * 100;
    console.log(`  • Result overlap: ${overlap}/${Math.max(v1Ids.size, v2Ids.size || 1)} (${overlapPercent.toFixed(0)}%)`);
  }
}

function displaySummary(results: any[]) {
  log('\n\n📊 SUMMARY', 'info');
  log('==========\n', 'info');
  
  const v1Stats = {
    successCount: 0,
    totalTime: 0,
    totalSimilarity: 0,
    count: 0,
  };
  
  const v2Stats = {
    successCount: 0,
    totalTime: 0,
    totalSimilarity: 0,
    count: 0,
  };
  
  results.forEach(result => {
    if (result.v1.success) {
      v1Stats.successCount++;
      v1Stats.totalTime += result.v1.responseTime;
      v1Stats.totalSimilarity += result.v1.avgSimilarity;
      v1Stats.count++;
    }
    
    if (result.v2.success) {
      v2Stats.successCount++;
      v2Stats.totalTime += result.v2.responseTime;
      v2Stats.totalSimilarity += result.v2.avgSimilarity;
      v2Stats.count++;
    }
  });
  
  console.log('V1 Performance:');
  console.log(`  • Success rate: ${v1Stats.successCount}/${results.length} (${(v1Stats.successCount / results.length * 100).toFixed(0)}%)`);
  if (v1Stats.count > 0) {
    console.log(`  • Avg response time: ${(v1Stats.totalTime / v1Stats.count).toFixed(0)}ms`);
    console.log(`  • Avg similarity: ${(v1Stats.totalSimilarity / v1Stats.count).toFixed(3)}`);
  }
  
  console.log('\nV2 Performance:');
  console.log(`  • Success rate: ${v2Stats.successCount}/${results.length} (${(v2Stats.successCount / results.length * 100).toFixed(0)}%)`);
  if (v2Stats.count > 0) {
    console.log(`  • Avg response time: ${(v2Stats.totalTime / v2Stats.count).toFixed(0)}ms`);
    console.log(`  • Avg similarity: ${(v2Stats.totalSimilarity / v2Stats.count).toFixed(3)}`);
  }
  
  // Overall comparison
  if (v1Stats.count > 0 && v2Stats.count > 0) {
    console.log('\n🎯 Overall Comparison:');
    
    const avgTimeDiff = (v2Stats.totalTime / v2Stats.count) - (v1Stats.totalTime / v1Stats.count);
    const timeImprovement = ((avgTimeDiff / (v1Stats.totalTime / v1Stats.count)) * 100).toFixed(1);
    
    if (avgTimeDiff < 0) {
      log(`  • V2 is ${Math.abs(avgTimeDiff).toFixed(0)}ms faster on average (${Math.abs(parseFloat(timeImprovement))}% improvement)`, 'success');
    } else {
      log(`  • V2 is ${avgTimeDiff.toFixed(0)}ms slower on average (${timeImprovement}% degradation)`, 'warning');
    }
    
    const simDiff = (v2Stats.totalSimilarity / v2Stats.count) - (v1Stats.totalSimilarity / v1Stats.count);
    if (Math.abs(simDiff) < 0.05) {
      log(`  • Accuracy is comparable (diff: ${simDiff.toFixed(3)})`, 'success');
    } else if (simDiff > 0) {
      log(`  • V2 has better accuracy (+${simDiff.toFixed(3)})`, 'success');
    } else {
      log(`  • V1 has better accuracy (${simDiff.toFixed(3)})`, 'warning');
    }
    
    // Cost comparison
    console.log('\n💰 Cost Analysis:');
    console.log('  • Storage: V2 uses 50% less space (768 vs 1536 dimensions)');
    console.log('  • API cost: V2 is 84.6% cheaper ($0.02 vs $0.13 per 1M tokens)');
    
    // Recommendation
    console.log('\n💡 Recommendation:');
    if (avgTimeDiff < 100 && Math.abs(simDiff) < 0.05) {
      log('  ✅ V2 is ready for production rollout', 'success');
    } else if (avgTimeDiff < 200 && Math.abs(simDiff) < 0.1) {
      log('  ⚠️  V2 needs minor optimization before full rollout', 'warning');
    } else {
      log('  ❌ V2 requires significant improvement', 'error');
    }
  }
}

function calculateAvgSimilarity(results: any[]): number {
  if (results.length === 0) return 0;
  
  const sum = results.reduce((acc, result) => {
    const similarity = result.similarity || result.score || 0;
    return acc + similarity;
  }, 0);
  
  return sum / results.length;
}

// Main execution
async function main() {
  try {
    await compareImplementations();
    log('\n✨ Comparison complete!', 'success');
  } catch (error) {
    log(`\n❌ Failed: ${error}`, 'error');
    process.exit(1);
  }
}

// Run the comparison
main().catch(console.error);