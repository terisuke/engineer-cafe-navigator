import { supabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Migration success dashboard endpoint
 * Returns comprehensive migration metrics
 */
export async function GET(request: NextRequest) {
  try {
    // Get migration status
    const migrationStatus = await getMigrationStatus();
    
    // Get performance metrics
    const performanceMetrics = await getPerformanceMetrics();
    
    // Get cost analysis
    const costAnalysis = await getCostAnalysis();
    
    // Get quality metrics
    const qualityMetrics = await getQualityMetrics();
    
    // Build success dashboard
    const dashboard = {
      generated_at: new Date().toISOString(),
      migration: migrationStatus,
      performance: performanceMetrics,
      cost: costAnalysis,
      quality: qualityMetrics,
      overall_status: determineOverallStatus(migrationStatus, performanceMetrics, qualityMetrics),
    };
    
    return NextResponse.json(dashboard);
    
  } catch (error) {
    console.error('[Migration Success API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate migration success metrics' },
      { status: 500 }
    );
  }
}

async function getMigrationStatus() {
  const { count: v1Entries } = await supabaseAdmin
    .from('knowledge_base')
    .select('*', { count: 'exact', head: true });
  
  const { count: v2Entries } = await supabaseAdmin
    .from('knowledge_base_v2')
    .select('*', { count: 'exact', head: true });
  
  const completionRate = ((v2Entries || 0) / (v1Entries || 1)) * 100;
  const currentRollout = parseInt(process.env.FF_NEW_EMBEDDINGS_PERCENTAGE || '0');
  
  return {
    status: completionRate === 100 ? 'completed' : 'in_progress',
    v1Entries: v1Entries || 0,
    v2Entries: v2Entries || 0,
    completionRate: `${completionRate.toFixed(1)}%`,
    currentRollout: `${currentRollout}%`,
    isFullyDeployed: currentRollout === 100 && completionRate === 100,
  };
}

async function getPerformanceMetrics() {
  const timeRange = {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    end: new Date(),
  };
  
  // Get V1 metrics
  const { data: v1Metrics } = await supabaseAdmin
    .from('rag_implementation_metrics')
    .select('response_time_ms')
    .eq('implementation', 'v1')
    .gte('created_at', timeRange.start.toISOString());
  
  // Get V2 metrics
  const { data: v2Metrics } = await supabaseAdmin
    .from('rag_implementation_metrics')
    .select('response_time_ms')
    .eq('implementation', 'v2')
    .gte('created_at', timeRange.start.toISOString());
  
  // Calculate averages
  const v1Avg = v1Metrics && v1Metrics.length > 0
    ? v1Metrics.reduce((sum, m) => sum + m.response_time_ms, 0) / v1Metrics.length
    : 0;
  
  const v2Avg = v2Metrics && v2Metrics.length > 0
    ? v2Metrics.reduce((sum, m) => sum + m.response_time_ms, 0) / v2Metrics.length
    : 0;
  
  // Calculate P95
  const v1P95 = calculatePercentile(v1Metrics?.map(m => m.response_time_ms) || [], 95);
  const v2P95 = calculatePercentile(v2Metrics?.map(m => m.response_time_ms) || [], 95);
  
  const avgImprovement = v1Avg > 0 ? ((v1Avg - v2Avg) / v1Avg * 100) : 0;
  const p95Improvement = v1P95 > 0 ? ((v1P95 - v2P95) / v1P95 * 100) : 0;
  
  return {
    avgResponseTime: {
      v1: v1Avg,
      v2: v2Avg,
      improvement: `${avgImprovement.toFixed(1)}%`,
    },
    p95ResponseTime: {
      v1: v1P95,
      v2: v2P95,
      improvement: `${p95Improvement.toFixed(1)}%`,
    },
    sampleSize: {
      v1: v1Metrics?.length || 0,
      v2: v2Metrics?.length || 0,
    },
  };
}

async function getCostAnalysis() {
  // Get monthly query volume
  const { count: monthlyQueries } = await supabaseAdmin
    .from('rag_search_metrics')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  
  const queries = monthlyQueries || 0;
  
  // API costs
  const v1ApiCostPer1M = 0.13; // Google text-embedding
  const v2ApiCostPer1M = 0.02; // OpenAI text-embedding-3-small
  
  const v1ApiCost = (queries / 1000000) * v1ApiCostPer1M;
  const v2ApiCost = (queries / 1000000) * v2ApiCostPer1M;
  const apiSavings = v1ApiCost - v2ApiCost;
  const apiReduction = ((apiSavings / v1ApiCost) * 100);
  
  // Storage reduction
  const storageReduction = 50; // 768 vs 1536 dimensions
  
  return {
    storageReduction: `${storageReduction}%`,
    apiCostReduction: `${apiReduction.toFixed(1)}%`,
    monthlySavings: `$${apiSavings.toFixed(2)}`,
    annualSavings: `$${(apiSavings * 12).toFixed(2)}`,
    monthlyQueries: queries,
  };
}

async function getQualityMetrics() {
  const timeRange = {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    end: new Date(),
  };
  
  // Get similarity scores
  const { data: v1Metrics } = await supabaseAdmin
    .from('rag_implementation_metrics')
    .select('avg_similarity')
    .eq('implementation', 'v1')
    .gte('created_at', timeRange.start.toISOString());
  
  const { data: v2Metrics } = await supabaseAdmin
    .from('rag_implementation_metrics')
    .select('avg_similarity')
    .eq('implementation', 'v2')
    .gte('created_at', timeRange.start.toISOString());
  
  const v1AvgSimilarity = v1Metrics && v1Metrics.length > 0
    ? v1Metrics.reduce((sum, m) => sum + m.avg_similarity, 0) / v1Metrics.length
    : 0;
  
  const v2AvgSimilarity = v2Metrics && v2Metrics.length > 0
    ? v2Metrics.reduce((sum, m) => sum + m.avg_similarity, 0) / v2Metrics.length
    : 0;
  
  // ゼロ除算防止
  const safeV1Avg = isFinite(v1AvgSimilarity) ? v1AvgSimilarity : 0;
  const safeV2Avg = isFinite(v2AvgSimilarity) ? v2AvgSimilarity : 0;
  
  const similarityImprovement = safeV1Avg > 0 ? ((safeV2Avg - safeV1Avg) / safeV1Avg * 100) : 0;
  
  return {
    avgSimilarity: {
      v1: safeV1Avg.toFixed(3),
      v2: safeV2Avg.toFixed(3),
      improvement: `${similarityImprovement > 0 ? '+' : ''}${similarityImprovement.toFixed(1)}%`,
    },
    meetsThreshold: safeV2Avg >= 0.7,
  };
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = values.sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

function determineOverallStatus(migration: any, performance: any, quality: any): string {
  if (migration.isFullyDeployed && quality.meetsThreshold) {
    return 'success';
  } else if (migration.completionRate === '100%') {
    return 'ready_for_rollout';
  } else {
    return 'in_progress';
  }
}