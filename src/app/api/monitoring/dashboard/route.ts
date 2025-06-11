import { ragMetrics } from '@/lib/monitoring/rag-metrics';
import { supabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Production monitoring dashboard API
 * Returns comprehensive metrics for RAG system performance
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const timeRange = url.searchParams.get('range') || '24h';
    
    // Calculate time range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeRange) {
      case '1h':
        startDate.setHours(startDate.getHours() - 1);
        break;
      case '24h':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate.setDate(startDate.getDate() - 1);
    }
    
    // Fetch all metrics in parallel
    const [
      searchStats,
      apiStats,
      systemHealth,
      recentErrors,
      cacheStats,
    ] = await Promise.all([
      ragMetrics.getSearchStats({ start: startDate, end: endDate }),
      ragMetrics.getExternalAPIStats({ start: startDate, end: endDate }),
      getSystemHealth(),
      getRecentErrors(startDate),
      getCacheStatistics(),
    ]);
    
    // Calculate additional metrics
    const performanceMetrics = {
      avgSearchLatency: searchStats.avgResponseTime,
      p95SearchLatency: await getPercentileLatency(95, startDate, endDate),
      p99SearchLatency: await getPercentileLatency(99, startDate, endDate),
      searchVolumePerHour: searchStats.totalSearches / ((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)),
    };
    
    // Build dashboard response
    const dashboard = {
      timestamp: new Date().toISOString(),
      timeRange,
      summary: {
        totalSearches: searchStats.totalSearches,
        avgResponseTime: `${Math.round(searchStats.avgResponseTime)}ms`,
        cacheHitRate: `${Math.round(searchStats.cacheHitRate * 100)}%`,
        systemStatus: systemHealth.status,
        errorRate: searchStats.totalSearches > 0
          ? ((recentErrors.length / searchStats.totalSearches) * 100).toFixed(2) + '%'
          : '0.00%',
      },
      search: {
        ...searchStats,
        performance: performanceMetrics,
      },
      externalAPIs: apiStats.bySource,
      cache: cacheStats,
      errors: {
        count: recentErrors.length,
        recent: recentErrors.slice(0, 10),
      },
      health: systemHealth,
      alerts: await getActiveAlerts(),
    };
    
    return NextResponse.json(dashboard);
    
  } catch (error) {
    console.error('[Monitoring Dashboard] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monitoring data' },
      { status: 500 }
    );
  }
}

/**
 * Get system health metrics
 */
async function getSystemHealth() {
  try {
    // Check database connection
    const dbCheck = await supabaseAdmin
      .from('knowledge_base')
      .select('count', { count: 'exact', head: true });
    
    // Check if knowledge base has entries
    const kbCount = dbCheck.count || 0;
    
    // Get last successful update
    const { data: lastUpdate } = await supabaseAdmin
      .from('knowledge_base_metrics')
      .select('created_at')
      .eq('operation', 'batch_import')
      .eq('success', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    const hoursSinceUpdate = lastUpdate
      ? (Date.now() - new Date(lastUpdate.created_at).getTime()) / (1000 * 60 * 60)
      : 999;
    
    return {
      status: hoursSinceUpdate < 12 ? 'healthy' : 'warning',
      database: 'connected',
      knowledgeBaseEntries: kbCount,
      lastSuccessfulUpdate: lastUpdate?.created_at || null,
      hoursSinceLastUpdate: Math.round(hoursSinceUpdate),
    };
  } catch (error) {
    return {
      status: 'error',
      database: 'disconnected',
      knowledgeBaseEntries: 0,
      lastSuccessfulUpdate: null,
      hoursSinceLastUpdate: null,
    };
  }
}

/**
 * Get recent errors
 */
async function getRecentErrors(since: Date) {
  const { data: searchErrors } = await supabaseAdmin
    .from('rag_search_metrics')
    .select('query, created_at')
    .eq('results_count', 0)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });
  
  const { data: apiErrors } = await supabaseAdmin
    .from('external_api_metrics')
    .select('source, action, error_message, created_at')
    .eq('success', false)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });
  
  return [
    ...(searchErrors || []).map(e => ({
      type: 'search_no_results',
      message: `No results for query: ${e.query}`,
      timestamp: e.created_at,
    })),
    ...(apiErrors || []).map(e => ({
      type: 'external_api_error',
      message: `${e.source} - ${e.action}: ${e.error_message}`,
      timestamp: e.created_at,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Get cache statistics
 */
async function getCacheStatistics() {
  // Get cache hit rates by type
  const { data: searchMetrics } = await supabaseAdmin
    .from('rag_search_metrics')
    .select('cached')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  const { data: apiMetrics } = await supabaseAdmin
    .from('external_api_metrics')
    .select('cached, source')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  const searchCacheHits = searchMetrics?.filter(m => m.cached).length || 0;
  const searchTotal = searchMetrics?.length || 1;
  
  const apiCacheStats: Record<string, { hits: number; total: number }> = {};
  apiMetrics?.forEach(m => {
    if (!apiCacheStats[m.source]) {
      apiCacheStats[m.source] = { hits: 0, total: 0 };
    }
    apiCacheStats[m.source].total++;
    if (m.cached) apiCacheStats[m.source].hits++;
  });
  
  return {
    search: {
      hitRate: searchCacheHits / searchTotal,
      hits: searchCacheHits,
      total: searchTotal,
    },
    externalAPIs: Object.entries(apiCacheStats).reduce((acc, [source, stats]) => {
      acc[source] = {
        hitRate: stats.hits / stats.total,
        hits: stats.hits,
        total: stats.total,
      };
      return acc;
    }, {} as Record<string, any>),
  };
}

/**
 * Get percentile latency
 */
async function getPercentileLatency(percentile: number, start: Date, end: Date): Promise<number> {
  const { data } = await supabaseAdmin
    .from('rag_search_metrics')
    .select('response_time_ms')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('response_time_ms', { ascending: true });
  
  if (!data || data.length === 0) return 0;
  
  const index = Math.ceil((percentile / 100) * data.length) - 1;
  return data[index].response_time_ms;
}

/**
 * Get active alerts
 */
async function getActiveAlerts(): Promise<Array<{
  level: 'warning' | 'error';
  message: string;
  metric: string;
  value: number;
  threshold: number;
}>> {
  const alerts = [];
  
  // Check response time
  const { data: recentSearches } = await supabaseAdmin
    .from('rag_search_metrics')
    .select('response_time_ms')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
  
  if (recentSearches && recentSearches.length > 0) {
    const avgResponseTime = recentSearches.reduce((sum, s) => sum + s.response_time_ms, 0) / recentSearches.length;
    
    if (avgResponseTime > 1000) {
      alerts.push({
        level: 'error' as const,
        message: 'Search response time is critically high',
        metric: 'avg_response_time',
        value: avgResponseTime,
        threshold: 1000,
      });
    } else if (avgResponseTime > 800) {
      alerts.push({
        level: 'warning' as const,
        message: 'Search response time is elevated',
        metric: 'avg_response_time',
        value: avgResponseTime,
        threshold: 800,
      });
    }
  }
  
  // Check error rate
  const { data: recentErrors } = await supabaseAdmin
    .from('external_api_metrics')
    .select('success')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
  
  if (recentErrors && recentErrors.length > 0) {
    const errorRate = recentErrors.filter(e => !e.success).length / recentErrors.length;
    
    if (errorRate > 0.1) {
      alerts.push({
        level: 'error' as const,
        message: 'High external API error rate',
        metric: 'error_rate',
        value: errorRate * 100,
        threshold: 10,
      });
    } else if (errorRate > 0.05) {
      alerts.push({
        level: 'warning' as const,
        message: 'Elevated external API error rate',
        metric: 'error_rate',
        value: errorRate * 100,
        threshold: 5,
      });
    }
  }
  
  return alerts;
}