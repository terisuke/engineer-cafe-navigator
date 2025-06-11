import { supabaseAdmin } from '../supabase';

/**
 * RAG Metrics for monitoring search performance and external API usage
 */
export class RAGMetrics {
  private static instance: RAGMetrics;
  
  private constructor() {}
  
  static getInstance(): RAGMetrics {
    if (!RAGMetrics.instance) {
      RAGMetrics.instance = new RAGMetrics();
    }
    return RAGMetrics.instance;
  }
  
  /**
   * Track RAG search performance
   */
  async trackSearch(params: {
    query: string;
    language: string;
    resultsCount: number;
    avgSimilarity: number;
    responseTime: number;
    category?: string;
    cached?: boolean;
  }): Promise<void> {
    try {
      await supabaseAdmin
        .from('rag_search_metrics')
        .insert({
          query: params.query.substring(0, 255), // Limit query length
          language: params.language,
          results_count: params.resultsCount,
          avg_similarity: params.avgSimilarity,
          response_time_ms: params.responseTime,
          category: params.category,
          cached: params.cached || false,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('[RAGMetrics] Failed to track search:', error);
    }
  }
  
  /**
   * Track external API fetch performance
   */
  async trackExternalFetch(params: {
    source: 'connpass' | 'google_calendar' | 'website';
    action: string;
    success: boolean;
    responseTime: number;
    cached: boolean;
    error?: string;
    itemsReturned?: number;
  }): Promise<void> {
    try {
      await supabaseAdmin
        .from('external_api_metrics')
        .insert({
          source: params.source,
          action: params.action,
          success: params.success,
          response_time_ms: params.responseTime,
          cached: params.cached,
          error_message: params.error,
          items_returned: params.itemsReturned,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('[RAGMetrics] Failed to track external fetch:', error);
    }
  }
  
  /**
   * Track knowledge base operations
   */
  async trackKnowledgeBaseOperation(params: {
    operation: 'insert' | 'update' | 'delete' | 'batch_import';
    category: string;
    count: number;
    duration: number;
    success: boolean;
    error?: string;
  }): Promise<void> {
    try {
      await supabaseAdmin
        .from('knowledge_base_metrics')
        .insert({
          operation: params.operation,
          category: params.category,
          record_count: params.count,
          duration_ms: params.duration,
          success: params.success,
          error_message: params.error,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('[RAGMetrics] Failed to track KB operation:', error);
    }
  }
  
  /**
   * Get search performance statistics
   */
  async getSearchStats(timeRange: {
    start: Date;
    end: Date;
  }): Promise<{
    totalSearches: number;
    avgResponseTime: number;
    avgResultsCount: number;
    avgSimilarity: number;
    cacheHitRate: number;
    topQueries: Array<{ query: string; count: number }>;
  }> {
    const { data } = await supabaseAdmin
      .from('rag_search_metrics')
      .select('*')
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString());
    
    if (!data || data.length === 0) {
      return {
        totalSearches: 0,
        avgResponseTime: 0,
        avgResultsCount: 0,
        avgSimilarity: 0,
        cacheHitRate: 0,
        topQueries: [],
      };
    }
    
    const totalSearches = data.length;
    const cachedSearches = data.filter(d => d.cached).length;
    const avgResponseTime = data.reduce((sum, d) => sum + d.response_time_ms, 0) / totalSearches;
    const avgResultsCount = data.reduce((sum, d) => sum + d.results_count, 0) / totalSearches;
    const avgSimilarity = data.reduce((sum, d) => sum + d.avg_similarity, 0) / totalSearches;
    const cacheHitRate = cachedSearches / totalSearches;
    
    // Get top queries
    const queryCount = new Map<string, number>();
    data.forEach(d => {
      const count = queryCount.get(d.query) || 0;
      queryCount.set(d.query, count + 1);
    });
    
    const topQueries = Array.from(queryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));
    
    return {
      totalSearches,
      avgResponseTime,
      avgResultsCount,
      avgSimilarity,
      cacheHitRate,
      topQueries,
    };
  }
  
  /**
   * Get external API performance statistics
   */
  async getExternalAPIStats(timeRange: {
    start: Date;
    end: Date;
  }): Promise<{
    bySource: Record<string, {
      totalRequests: number;
      successRate: number;
      avgResponseTime: number;
      cacheHitRate: number;
    }>;
  }> {
    const { data } = await supabaseAdmin
      .from('external_api_metrics')
      .select('*')
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString());
    
    if (!data || data.length === 0) {
      return { bySource: {} };
    }
    
    const stats: Record<string, any> = {};
    
    // Group by source
    const sources = new Set(data.map(d => d.source));
    
    sources.forEach(source => {
      const sourceData = data.filter(d => d.source === source);
      const total = sourceData.length;
      const successful = sourceData.filter(d => d.success).length;
      const cached = sourceData.filter(d => d.cached).length;
      const avgResponseTime = sourceData.reduce((sum, d) => sum + d.response_time_ms, 0) / total;
      
      stats[source] = {
        totalRequests: total,
        successRate: successful / total,
        avgResponseTime,
        cacheHitRate: cached / total,
      };
    });
    
    return { bySource: stats };
  }
  
  /**
   * Generate daily report
   */
  async generateDailyReport(date: Date = new Date()): Promise<{
    date: string;
    searches: any;
    externalAPIs: any;
    knowledgeBase: any;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const [searchStats, apiStats, kbStats] = await Promise.all([
      this.getSearchStats({ start: startOfDay, end: endOfDay }),
      this.getExternalAPIStats({ start: startOfDay, end: endOfDay }),
      this.getKnowledgeBaseStats({ start: startOfDay, end: endOfDay }),
    ]);
    
    return {
      date: date.toISOString().split('T')[0],
      searches: searchStats,
      externalAPIs: apiStats,
      knowledgeBase: kbStats,
    };
  }
  
  /**
   * Get knowledge base operation statistics
   */
  private async getKnowledgeBaseStats(timeRange: {
    start: Date;
    end: Date;
  }): Promise<{
    totalOperations: number;
    byOperation: Record<string, number>;
    successRate: number;
    avgDuration: number;
  }> {
    const { data } = await supabaseAdmin
      .from('knowledge_base_metrics')
      .select('*')
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString());
    
    if (!data || data.length === 0) {
      return {
        totalOperations: 0,
        byOperation: {},
        successRate: 0,
        avgDuration: 0,
      };
    }
    
    const totalOperations = data.length;
    const successful = data.filter(d => d.success).length;
    const avgDuration = data.reduce((sum, d) => sum + d.duration_ms, 0) / totalOperations;
    
    const byOperation: Record<string, number> = {};
    data.forEach(d => {
      byOperation[d.operation] = (byOperation[d.operation] || 0) + 1;
    });
    
    return {
      totalOperations,
      byOperation,
      successRate: successful / totalOperations,
      avgDuration,
    };
  }
}

// Export singleton instance
export const ragMetrics = RAGMetrics.getInstance();