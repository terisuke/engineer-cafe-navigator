import { ragSearchTool } from './rag-search';
import { ragSearchV2 } from './rag-search-v2';
import { featureFlags } from '@/lib/feature-flags';
import { ragMetrics } from '@/lib/monitoring/rag-metrics';
import { FeatureCircuitBreaker } from '@/lib/rollback-manager';
import { SupportedLanguage } from '../types/config';

/**
 * RAG Search Router for A/B testing between V1 and V2 implementations
 * Routes searches based on feature flags and monitors performance
 */
export class RAGSearchRouter {
  private v1 = ragSearchTool;
  private v2 = ragSearchV2;
  
  /**
   * Route search to appropriate implementation based on feature flags
   */
  async search(
    userId: string,
    query: string,
    options: {
      category?: string;
      language?: string;
      limit?: number;
      threshold?: number;
    } = {}
  ): Promise<{
    results: any[];
    metadata: {
      implementation: 'v1' | 'v2';
      responseTime: number;
      fromCircuitBreaker: boolean;
    };
  }> {
    // Check if parallel mode is enabled
    const useParallel = featureFlags.getFlag('USE_PARALLEL_RAG', userId);
    
    if (useParallel) {
      return this.searchParallel(userId, query, options);
    }
    
    // Determine which implementation to use
    const useV2 = featureFlags.getFlag('USE_NEW_EMBEDDINGS', userId);
    const implementation = useV2 ? 'v2' : 'v1';
    
    // Use circuit breaker for protection
    return FeatureCircuitBreaker.execute(
      `rag-search-${implementation}`,
      async () => {
        const startTime = Date.now();
        
        try {
          const results = implementation === 'v2'
            ? await this.v2.search(query, options)
            : await this.v1.searchKnowledgeBase(query, (options.language as SupportedLanguage) || 'ja');
          
          const responseTime = Date.now() - startTime;
          
          // Track implementation-specific metrics
          const resultsArray = typeof results === 'string' 
            ? [] // If V1 returns string, no results array available
            : Array.isArray(results) ? results : [];
            
          await this.trackImplementationMetrics(
            implementation,
            query,
            resultsArray,
            responseTime,
            options
          );
          
          return {
            results: resultsArray,
            metadata: {
              implementation,
              responseTime,
              fromCircuitBreaker: false,
            },
          };
        } catch (error) {
          console.error(`[RAGSearchRouter] ${implementation} failed:`, error);
          throw error;
        }
      },
      // Fallback to V1 if V2 fails
      async () => {
        console.warn('[RAGSearchRouter] Falling back to V1 due to circuit breaker');
        const startTime = Date.now();
        
        const results = await this.v1.searchKnowledgeBase(query, (options.language as SupportedLanguage) || 'ja');
        const responseTime = Date.now() - startTime;
        
        return {
          results: [],
          metadata: {
            implementation: 'v1' as const,
            responseTime,
            fromCircuitBreaker: true as const,
          },
        } as any;
      }
    );
  }
  
  /**
   * Run both implementations in parallel for comparison
   */
  private async searchParallel(
    userId: string,
    query: string,
    options: any
  ): Promise<any> {
    const [v1Result, v2Result] = await Promise.allSettled([
      this.measureImplementation('v1', () => 
        this.v1.searchKnowledgeBase(query, (options.language as SupportedLanguage) || 'ja')
      ),
      this.measureImplementation('v2', () => 
        this.v2.search(query, options)
      ),
    ]);
    
    // Log comparison metrics
    await this.logComparison(query, v1Result, v2Result);
    
    // Return primary implementation results (V1 for safety)
    if (v1Result.status === 'fulfilled') {
      return {
        results: v1Result.value.results,
        metadata: {
          implementation: 'v1',
          responseTime: v1Result.value.responseTime,
          fromCircuitBreaker: false,
          parallel: {
            v2Status: v2Result.status,
            v2ResponseTime: v2Result.status === 'fulfilled' 
              ? v2Result.value.responseTime 
              : null,
          },
        },
      };
    }
    
    // If V1 failed but V2 succeeded, use V2
    if (v2Result.status === 'fulfilled') {
      return {
        results: v2Result.value.results,
        metadata: {
          implementation: 'v2',
          responseTime: v2Result.value.responseTime,
          fromCircuitBreaker: false,
          parallel: {
            v1Status: 'failed',
          },
        },
      };
    }
    
    // Both failed
    throw new Error('Both RAG implementations failed');
  }
  
  /**
   * Measure implementation performance
   */
  private async measureImplementation(
    implementation: 'v1' | 'v2',
    operation: () => Promise<any>
  ): Promise<{ results: any; responseTime: number }> {
    const startTime = Date.now();
    const results = await operation();
    const responseTime = Date.now() - startTime;
    
    return { results, responseTime };
  }
  
  /**
   * Track implementation-specific metrics
   */
  private async trackImplementationMetrics(
    implementation: 'v1' | 'v2',
    query: string,
    results: any[],
    responseTime: number,
    options: any
  ): Promise<void> {
    // Add implementation tag to metrics
    await supabaseAdmin
      .from('rag_implementation_metrics')
      .insert({
        implementation,
        query: query.substring(0, 255),
        results_count: results.length,
        avg_similarity: this.calculateAvgSimilarity(results),
        response_time_ms: responseTime,
        category: options.category,
        language: options.language,
        created_at: new Date().toISOString(),
      });
  }
  
  /**
   * Log parallel comparison results
   */
  private async logComparison(
    query: string,
    v1Result: PromiseSettledResult<any>,
    v2Result: PromiseSettledResult<any>
  ): Promise<void> {
    const comparison: any = {
      query: query.substring(0, 255),
      v1_status: v1Result.status,
      v2_status: v2Result.status,
      created_at: new Date().toISOString(),
    };
    
    if (v1Result.status === 'fulfilled') {
      comparison.v1_response_time = v1Result.value.responseTime;
      comparison.v1_results_count = v1Result.value.results.length;
      comparison.v1_avg_similarity = this.calculateAvgSimilarity(v1Result.value.results);
    } else {
      comparison.v1_error = v1Result.reason?.message || 'Unknown error';
    }
    
    if (v2Result.status === 'fulfilled') {
      comparison.v2_response_time = v2Result.value.responseTime;
      comparison.v2_results_count = v2Result.value.results.length;
      comparison.v2_avg_similarity = this.calculateAvgSimilarity(v2Result.value.results);
    } else {
      comparison.v2_error = v2Result.reason?.message || 'Unknown error';
    }
    
    // Calculate differences if both succeeded
    if (v1Result.status === 'fulfilled' && v2Result.status === 'fulfilled') {
      comparison.response_time_diff = v2Result.value.responseTime - v1Result.value.responseTime;
      comparison.results_count_diff = v2Result.value.results.length - v1Result.value.results.length;
      comparison.similarity_diff = comparison.v2_avg_similarity - comparison.v1_avg_similarity;
    }
    
    // Store comparison
    await supabaseAdmin
      .from('rag_ab_test_results')
      .insert(comparison);
  }
  
  /**
   * Get implementation statistics
   */
  async getImplementationStats(timeRange: {
    start: Date;
    end: Date;
  }): Promise<{
    v1: ImplementationStats;
    v2: ImplementationStats;
    comparison: ComparisonStats;
  }> {
    // Fetch metrics for both implementations
    const { data: metrics } = await supabaseAdmin
      .from('rag_implementation_metrics')
      .select('*')
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString());
    
    const v1Metrics = metrics?.filter(m => m.implementation === 'v1') || [];
    const v2Metrics = metrics?.filter(m => m.implementation === 'v2') || [];
    
    return {
      v1: this.calculateStats(v1Metrics),
      v2: this.calculateStats(v2Metrics),
      comparison: {
        responseTimeImprovement: this.calculateImprovement(
          this.calculateStats(v1Metrics).avgResponseTime,
          this.calculateStats(v2Metrics).avgResponseTime
        ),
        similarityImprovement: this.calculateImprovement(
          this.calculateStats(v1Metrics).avgSimilarity,
          this.calculateStats(v2Metrics).avgSimilarity
        ),
        successRateImprovement: this.calculateImprovement(
          this.calculateStats(v1Metrics).successRate,
          this.calculateStats(v2Metrics).successRate
        ),
      },
    };
  }
  
  /**
   * Calculate implementation statistics
   */
  private calculateStats(metrics: any[]): ImplementationStats {
    if (metrics.length === 0) {
      return {
        totalQueries: 0,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        avgResultsCount: 0,
        avgSimilarity: 0,
        successRate: 0,
      };
    }
    
    const responseTimes = metrics.map(m => m.response_time_ms).sort((a, b) => a - b);
    const p95Index = Math.floor(responseTimes.length * 0.95);
    
    return {
      totalQueries: metrics.length,
      avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      p95ResponseTime: responseTimes[p95Index],
      avgResultsCount: metrics.reduce((sum, m) => sum + m.results_count, 0) / metrics.length,
      avgSimilarity: metrics.reduce((sum, m) => sum + m.avg_similarity, 0) / metrics.length,
      successRate: 1, // Assuming all stored metrics are from successful queries
    };
  }
  
  /**
   * Calculate improvement percentage
   */
  private calculateImprovement(oldValue: number, newValue: number): number {
    if (oldValue === 0) return 0;
    return ((oldValue - newValue) / oldValue) * 100;
  }
  
  /**
   * Calculate average similarity
   */
  private calculateAvgSimilarity(results: any[]): number {
    if (results.length === 0) return 0;
    
    const sum = results.reduce((acc, result) => {
      const similarity = result.similarity || result.score || 0;
      return acc + similarity;
    }, 0);
    
    return sum / results.length;
  }
}

// Type definitions
interface ImplementationStats {
  totalQueries: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  avgResultsCount: number;
  avgSimilarity: number;
  successRate: number;
}

interface ComparisonStats {
  responseTimeImprovement: number;
  similarityImprovement: number;
  successRateImprovement: number;
}

// Import for metrics tracking
import { supabaseAdmin } from '@/lib/supabase';

// Export singleton instance
export const ragSearchRouter = new RAGSearchRouter();