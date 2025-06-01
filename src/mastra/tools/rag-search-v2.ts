import { createVectorQueryTool } from '@mastra/rag';
import { featureFlags } from '@/lib/feature-flags';
import { ragMetrics } from '@/lib/monitoring/rag-metrics';
import { ragCache } from '@/lib/cache/rag-cache';
import { createMastraV2Instance } from '../config/mastra-v2';
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';

/**
 * RAG Search V2 Implementation using Mastra's latest patterns
 * Uses OpenAI text-embedding-3-small (768 dimensions)
 */
export class RAGSearchV2 {
  private vectorQueryTool;
  private pgVector;
  
  constructor() {
    const { vectorQueryTool, pgVector } = createMastraV2Instance({} as any);
    this.vectorQueryTool = vectorQueryTool;
    this.pgVector = pgVector;
  }
  
  /**
   * Search knowledge base using new embedding model
   */
  async search(
    query: string,
    options: {
      category?: string;
      language?: string;
      limit?: number;
      threshold?: number;
    } = {}
  ): Promise<SearchResult[]> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = JSON.stringify({ query, ...options });
      const cachedResults = await ragCache.getCachedSearchResults(query, options);
      
      if (cachedResults) {
        // Track cached search
        await ragMetrics.trackSearch({
          query,
          language: options.language || 'ja',
          resultsCount: cachedResults.length,
          avgSimilarity: this.calculateAvgSimilarity(cachedResults),
          responseTime: Date.now() - startTime,
          cached: true,
          category: options.category,
        });
        
        return cachedResults;
      }
      
      // Build filter conditions
      const filters: any = {};
      if (options.category) {
        filters.category = options.category;
      }
      if (options.language) {
        filters.language = options.language;
      }
      
      // Execute vector query using Mastra tool
      // The execute method expects the parameters directly based on the tool's schema
      const results = await this.vectorQueryTool.execute({
        filter: JSON.stringify(filters),
        queryText: query,
        topK: options.limit || 10,
      } as any);
      
      // Transform results to our format
      const transformedResults = results.map((result: any) => ({
        id: result.id,
        content: result.content,
        title: result.metadata?.title || 'Untitled',
        category: result.metadata?.category,
        language: result.metadata?.language,
        similarity: result.score,
        metadata: result.metadata,
      }));
      
      // Cache results
      await ragCache.cacheSearchResults(query, transformedResults, options);
      
      // Track metrics
      await ragMetrics.trackSearch({
        query,
        language: options.language || 'ja',
        resultsCount: transformedResults.length,
        avgSimilarity: this.calculateAvgSimilarity(transformedResults),
        responseTime: Date.now() - startTime,
        cached: false,
        category: options.category,
      });
      
      return transformedResults;
      
    } catch (error) {
      console.error('[RAGSearchV2] Search failed:', error);
      throw error;
    }
  }
  
  /**
   * Generate embedding for a text using new model
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Check cache
      const cached = await ragCache.getCachedEmbedding(text);
      if (cached) return cached;
      
      // Generate new embedding using embedMany
      const { embeddings } = await embedMany({
        model: openai.embedding('text-embedding-3-small'),
        values: [text],
      });
      
      const embeddingArray = embeddings[0];
      
      // Cache for future use
      await ragCache.cacheEmbedding(text, embeddingArray);
      
      return embeddingArray;
    } catch (error) {
      console.error('[RAGSearchV2] Embedding generation failed:', error);
      throw error;
    }
  }
  
  /**
   * Batch search for multiple queries
   */
  async batchSearch(
    queries: string[],
    options?: any
  ): Promise<Map<string, SearchResult[]>> {
    const results = new Map<string, SearchResult[]>();
    
    // Process in parallel with concurrency limit
    const concurrency = 3;
    for (let i = 0; i < queries.length; i += concurrency) {
      const batch = queries.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(query => this.search(query, options))
      );
      
      batch.forEach((query, index) => {
        results.set(query, batchResults[index]);
      });
    }
    
    return results;
  }
  
  /**
   * Health check for V2 implementation
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    try {
      // Test embedding generation
      const testEmbedding = await this.generateEmbedding('test');
      
      // Test search
      const testResults = await this.search('test', { limit: 1 });
      
      // Check dimensions
      if (testEmbedding.length !== 768) {
        return {
          status: 'unhealthy',
          details: {
            error: 'Invalid embedding dimensions',
            expected: 768,
            actual: testEmbedding.length,
          },
        };
      }
      
      return {
        status: 'healthy',
        details: {
          embeddingDimensions: 768,
          model: 'text-embedding-3-small',
          searchable: true,
        },
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
  
  /**
   * Calculate average similarity score
   */
  private calculateAvgSimilarity(results: SearchResult[]): number {
    if (results.length === 0) return 0;
    
    const sum = results.reduce((acc, result) => acc + (result.similarity || 0), 0);
    return sum / results.length;
  }
}

// Type definitions
interface SearchResult {
  id: string;
  content: string;
  title: string;
  category?: string;
  language?: string;
  similarity: number;
  metadata?: any;
}

// Export singleton instance
export const ragSearchV2 = new RAGSearchV2();