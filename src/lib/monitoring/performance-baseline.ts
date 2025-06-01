import { supabaseAdmin } from '../supabase';
import { ragMetrics } from './rag-metrics';

/**
 * Performance baseline collector for tracking system metrics over time
 */
export class PerformanceBaseline {
  private static instance: PerformanceBaseline;
  
  private constructor() {}
  
  static getInstance(): PerformanceBaseline {
    if (!PerformanceBaseline.instance) {
      PerformanceBaseline.instance = new PerformanceBaseline();
    }
    return PerformanceBaseline.instance;
  }
  
  /**
   * Collect current performance baseline
   */
  async collectBaseline(): Promise<BaselineMetrics> {
    const timestamp = new Date();
    
    // Collect metrics from last hour
    const oneHourAgo = new Date(timestamp.getTime() - 60 * 60 * 1000);
    
    const [
      ragPerformance,
      externalAPIPerformance,
      systemResources,
      knowledgeBaseStats,
    ] = await Promise.all([
      this.collectRAGPerformance(oneHourAgo, timestamp),
      this.collectExternalAPIPerformance(oneHourAgo, timestamp),
      this.collectSystemResources(),
      this.collectKnowledgeBaseStats(),
    ]);
    
    const baseline: BaselineMetrics = {
      timestamp: timestamp.toISOString(),
      rag: ragPerformance,
      externalAPIs: externalAPIPerformance,
      system: systemResources,
      knowledgeBase: knowledgeBaseStats,
    };
    
    // Store baseline
    await this.storeBaseline(baseline);
    
    return baseline;
  }
  
  /**
   * Collect RAG search performance metrics
   */
  private async collectRAGPerformance(start: Date, end: Date): Promise<RAGPerformanceMetrics> {
    const { data: searches } = await supabaseAdmin
      .from('rag_search_metrics')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());
    
    if (!searches || searches.length === 0) {
      return {
        avgResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        avgResultCount: 0,
        avgSimilarity: 0,
        totalQueries: 0,
        cacheHitRate: 0,
        embeddingDimensions: 1536,
      };
    }
    
    // Calculate response time percentiles
    const responseTimes = searches.map(s => s.response_time_ms).sort((a, b) => a - b);
    const p50Index = Math.floor(responseTimes.length * 0.5);
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);
    
    return {
      avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      p50ResponseTime: responseTimes[p50Index],
      p95ResponseTime: responseTimes[p95Index],
      p99ResponseTime: responseTimes[p99Index],
      avgResultCount: searches.reduce((sum, s) => sum + s.results_count, 0) / searches.length,
      avgSimilarity: searches.reduce((sum, s) => sum + s.avg_similarity, 0) / searches.length,
      totalQueries: searches.length,
      cacheHitRate: searches.filter(s => s.cached).length / searches.length,
      embeddingDimensions: 1536, // Current embedding dimensions
    };
  }
  
  /**
   * Collect external API performance metrics
   */
  private async collectExternalAPIPerformance(start: Date, end: Date): Promise<ExternalAPIMetrics> {
    const { data: apiCalls } = await supabaseAdmin
      .from('external_api_metrics')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());
    
    if (!apiCalls || apiCalls.length === 0) {
      return {
        connpass: this.getEmptyAPIMetrics(),
        googleCalendar: this.getEmptyAPIMetrics(),
        website: this.getEmptyAPIMetrics(),
      };
    }
    
    const metrics: ExternalAPIMetrics = {
      connpass: this.calculateAPIMetrics(apiCalls.filter(c => c.source === 'connpass')),
      googleCalendar: this.calculateAPIMetrics(apiCalls.filter(c => c.source === 'google_calendar')),
      website: this.calculateAPIMetrics(apiCalls.filter(c => c.source === 'website')),
    };
    
    return metrics;
  }
  
  /**
   * Calculate API metrics for a specific source
   */
  private calculateAPIMetrics(calls: any[]): APISourceMetrics {
    if (calls.length === 0) return this.getEmptyAPIMetrics();
    
    const responseTimes = calls.map(c => c.response_time_ms).sort((a, b) => a - b);
    const p95Index = Math.floor(responseTimes.length * 0.95);
    
    return {
      avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      p95ResponseTime: responseTimes[p95Index],
      successRate: calls.filter(c => c.success).length / calls.length,
      totalCalls: calls.length,
      cacheHitRate: calls.filter(c => c.cached).length / calls.length,
    };
  }
  
  private getEmptyAPIMetrics(): APISourceMetrics {
    return {
      avgResponseTime: 0,
      p95ResponseTime: 0,
      successRate: 0,
      totalCalls: 0,
      cacheHitRate: 0,
    };
  }
  
  /**
   * Collect system resource metrics
   */
  private async collectSystemResources(): Promise<SystemResourceMetrics> {
    // In production, these would come from monitoring services
    // For now, we'll use placeholder values
    return {
      memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024,
      cpuUsagePercent: 0, // Would need OS-level monitoring
      activeConnections: 0, // Would need connection pool monitoring
      cacheSize: {
        memory: 0, // Would need cache size tracking
        redis: 0, // Would need Redis monitoring
      },
    };
  }
  
  /**
   * Collect knowledge base statistics
   */
  private async collectKnowledgeBaseStats(): Promise<KnowledgeBaseMetrics> {
    const { count: kbCount } = await supabaseAdmin
      .from('knowledge_base')
      .select('category', { count: 'exact', head: true });
    
    const { data: lastUpdate } = await supabaseAdmin
      .from('knowledge_base_metrics')
      .select('*')
      .eq('operation', 'batch_import')
      .eq('success', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    return {
      totalEntries: kbCount || 0,
      lastUpdateDuration: lastUpdate?.duration_ms || 0,
      lastUpdateTime: lastUpdate?.created_at || null,
      categoryCounts: {}, // Would need grouped count query
    };
  }
  
  /**
   * Store baseline metrics
   */
  private async storeBaseline(baseline: BaselineMetrics): Promise<void> {
    try {
      await supabaseAdmin
        .from('performance_baselines')
        .insert({
          timestamp: baseline.timestamp,
          metrics: baseline,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('[PerformanceBaseline] Failed to store baseline:', error);
    }
  }
  
  /**
   * Compare current performance against baseline
   */
  async compareToBaseline(baselineId?: string): Promise<PerformanceComparison> {
    // Get baseline to compare against
    let baseline: BaselineMetrics;
    
    if (baselineId) {
      const { data } = await supabaseAdmin
        .from('performance_baselines')
        .select('metrics')
        .eq('id', baselineId)
        .single();
      
      baseline = data?.metrics;
    } else {
      // Get most recent baseline
      const { data } = await supabaseAdmin
        .from('performance_baselines')
        .select('metrics')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      baseline = data?.metrics;
    }
    
    if (!baseline) {
      throw new Error('No baseline found for comparison');
    }
    
    // Collect current metrics
    const current = await this.collectBaseline();
    
    // Calculate differences
    const comparison: PerformanceComparison = {
      baseline: baseline.timestamp,
      current: current.timestamp,
      rag: {
        responseTime: {
          baseline: baseline.rag.avgResponseTime,
          current: current.rag.avgResponseTime,
          change: ((current.rag.avgResponseTime - baseline.rag.avgResponseTime) / baseline.rag.avgResponseTime) * 100,
        },
        cacheHitRate: {
          baseline: baseline.rag.cacheHitRate,
          current: current.rag.cacheHitRate,
          change: ((current.rag.cacheHitRate - baseline.rag.cacheHitRate) / baseline.rag.cacheHitRate) * 100,
        },
        similarity: {
          baseline: baseline.rag.avgSimilarity,
          current: current.rag.avgSimilarity,
          change: ((current.rag.avgSimilarity - baseline.rag.avgSimilarity) / baseline.rag.avgSimilarity) * 100,
        },
      },
      externalAPIs: {},
      recommendation: this.generateRecommendation(baseline, current),
    };
    
    // Add external API comparisons
    for (const source of ['connpass', 'googleCalendar', 'website'] as const) {
      comparison.externalAPIs[source] = {
        responseTime: {
          baseline: baseline.externalAPIs[source].avgResponseTime,
          current: current.externalAPIs[source].avgResponseTime,
          change: baseline.externalAPIs[source].avgResponseTime > 0
            ? ((current.externalAPIs[source].avgResponseTime - baseline.externalAPIs[source].avgResponseTime) / baseline.externalAPIs[source].avgResponseTime) * 100
            : 0,
        },
        successRate: {
          baseline: baseline.externalAPIs[source].successRate,
          current: current.externalAPIs[source].successRate,
          change: baseline.externalAPIs[source].successRate > 0
            ? ((current.externalAPIs[source].successRate - baseline.externalAPIs[source].successRate) / baseline.externalAPIs[source].successRate) * 100
            : 0,
        },
      };
    }
    
    return comparison;
  }
  
  /**
   * Generate recommendation based on comparison
   */
  private generateRecommendation(baseline: BaselineMetrics, current: BaselineMetrics): string {
    const issues = [];
    
    // Check RAG performance
    if (current.rag.avgResponseTime > baseline.rag.avgResponseTime * 1.2) {
      issues.push('RAG search response time has increased by more than 20%');
    }
    
    if (current.rag.cacheHitRate < baseline.rag.cacheHitRate * 0.8) {
      issues.push('Cache hit rate has decreased significantly');
    }
    
    // Check external APIs
    for (const source of ['connpass', 'googleCalendar', 'website'] as const) {
      if (current.externalAPIs[source].successRate < 0.95) {
        issues.push(`${source} API success rate is below 95%`);
      }
    }
    
    if (issues.length === 0) {
      return 'System performance is within normal parameters';
    }
    
    return `Performance issues detected: ${issues.join('; ')}`;
  }
}

// Type definitions
interface BaselineMetrics {
  timestamp: string;
  rag: RAGPerformanceMetrics;
  externalAPIs: ExternalAPIMetrics;
  system: SystemResourceMetrics;
  knowledgeBase: KnowledgeBaseMetrics;
}

interface RAGPerformanceMetrics {
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  avgResultCount: number;
  avgSimilarity: number;
  totalQueries: number;
  cacheHitRate: number;
  embeddingDimensions: number;
}

interface ExternalAPIMetrics {
  connpass: APISourceMetrics;
  googleCalendar: APISourceMetrics;
  website: APISourceMetrics;
}

interface APISourceMetrics {
  avgResponseTime: number;
  p95ResponseTime: number;
  successRate: number;
  totalCalls: number;
  cacheHitRate: number;
}

interface SystemResourceMetrics {
  memoryUsageMB: number;
  cpuUsagePercent: number;
  activeConnections: number;
  cacheSize: {
    memory: number;
    redis: number;
  };
}

interface KnowledgeBaseMetrics {
  totalEntries: number;
  lastUpdateDuration: number;
  lastUpdateTime: string | null;
  categoryCounts: Record<string, number>;
}

interface PerformanceComparison {
  baseline: string;
  current: string;
  rag: {
    responseTime: MetricComparison;
    cacheHitRate: MetricComparison;
    similarity: MetricComparison;
  };
  externalAPIs: Record<string, {
    responseTime: MetricComparison;
    successRate: MetricComparison;
  }>;
  recommendation: string;
}

interface MetricComparison {
  baseline: number;
  current: number;
  change: number; // Percentage
}

// Export singleton instance
export const performanceBaseline = PerformanceBaseline.getInstance();