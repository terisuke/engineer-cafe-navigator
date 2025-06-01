import { Redis } from '@upstash/redis';
import crypto from 'crypto';

/**
 * RAG Cache for optimizing embeddings and search results
 */
export class RAGCache {
  private redis: Redis | null = null;
  private memoryCache: Map<string, { value: any; expiry: number }> = new Map();
  private isRedisAvailable = false;
  
  constructor() {
    // Initialize Redis if credentials are available
    if (process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN) {
      try {
        this.redis = new Redis({
          url: process.env.UPSTASH_REDIS_URL,
          token: process.env.UPSTASH_REDIS_TOKEN,
        });
        this.isRedisAvailable = true;
        console.log('[RAGCache] Redis cache initialized');
      } catch (error) {
        console.warn('[RAGCache] Redis initialization failed, using memory cache:', error);
      }
    } else {
      console.log('[RAGCache] Redis credentials not found, using memory cache');
    }
  }
  
  /**
   * Generate cache key from text
   */
  private generateKey(prefix: string, text: string): string {
    const hash = crypto.createHash('sha256').update(text).digest('hex');
    return `${prefix}:${hash}`;
  }
  
  /**
   * Get cached embedding for text
   */
  async getCachedEmbedding(text: string): Promise<number[] | null> {
    const key = this.generateKey('embedding', text);
    
    try {
      if (this.isRedisAvailable && this.redis) {
        const cached = await this.redis.get<number[]>(key);
        if (cached) {
          console.log('[RAGCache] Embedding cache hit');
          return cached;
        }
      } else {
        // Fallback to memory cache
        const cached = this.getFromMemoryCache(key);
        if (cached) {
          console.log('[RAGCache] Embedding memory cache hit');
          return cached;
        }
      }
    } catch (error) {
      console.error('[RAGCache] Error getting cached embedding:', error);
    }
    
    return null;
  }
  
  /**
   * Cache embedding for text
   */
  async cacheEmbedding(text: string, embedding: number[], ttl = 86400): Promise<void> {
    const key = this.generateKey('embedding', text);
    
    try {
      if (this.isRedisAvailable && this.redis) {
        await this.redis.setex(key, ttl, embedding);
      } else {
        // Fallback to memory cache
        this.setInMemoryCache(key, embedding, ttl);
      }
    } catch (error) {
      console.error('[RAGCache] Error caching embedding:', error);
    }
  }
  
  /**
   * Get cached search results
   */
  async getCachedSearchResults(query: string, options?: {
    category?: string;
    language?: string;
  }): Promise<any[] | null> {
    const cacheKey = JSON.stringify({ query, ...options });
    const key = this.generateKey('search', cacheKey);
    
    try {
      if (this.isRedisAvailable && this.redis) {
        const cached = await this.redis.get<any[]>(key);
        if (cached) {
          console.log('[RAGCache] Search results cache hit');
          return cached;
        }
      } else {
        // Fallback to memory cache
        const cached = this.getFromMemoryCache(key);
        if (cached) {
          console.log('[RAGCache] Search results memory cache hit');
          return cached;
        }
      }
    } catch (error) {
      console.error('[RAGCache] Error getting cached search results:', error);
    }
    
    return null;
  }
  
  /**
   * Cache search results
   */
  async cacheSearchResults(
    query: string, 
    results: any[], 
    options?: {
      category?: string;
      language?: string;
    },
    ttl = 3600
  ): Promise<void> {
    const cacheKey = JSON.stringify({ query, ...options });
    const key = this.generateKey('search', cacheKey);
    
    try {
      if (this.isRedisAvailable && this.redis) {
        await this.redis.setex(key, ttl, results);
      } else {
        // Fallback to memory cache
        this.setInMemoryCache(key, results, ttl);
      }
    } catch (error) {
      console.error('[RAGCache] Error caching search results:', error);
    }
  }
  
  /**
   * Cache external API response
   */
  async cacheExternalResponse(
    source: string,
    action: string,
    params: any,
    response: any,
    ttl = 600 // 10 minutes default
  ): Promise<void> {
    const cacheKey = JSON.stringify({ source, action, params });
    const key = this.generateKey('external', cacheKey);
    
    try {
      if (this.isRedisAvailable && this.redis) {
        await this.redis.setex(key, ttl, response);
      } else {
        // Fallback to memory cache
        this.setInMemoryCache(key, response, ttl);
      }
    } catch (error) {
      console.error('[RAGCache] Error caching external response:', error);
    }
  }
  
  /**
   * Get cached external API response
   */
  async getCachedExternalResponse(
    source: string,
    action: string,
    params: any
  ): Promise<any | null> {
    const cacheKey = JSON.stringify({ source, action, params });
    const key = this.generateKey('external', cacheKey);
    
    try {
      if (this.isRedisAvailable && this.redis) {
        const cached = await this.redis.get(key);
        if (cached) {
          console.log(`[RAGCache] External ${source} cache hit`);
          return cached;
        }
      } else {
        // Fallback to memory cache
        const cached = this.getFromMemoryCache(key);
        if (cached) {
          console.log(`[RAGCache] External ${source} memory cache hit`);
          return cached;
        }
      }
    } catch (error) {
      console.error('[RAGCache] Error getting cached external response:', error);
    }
    
    return null;
  }
  
  /**
   * Clear all caches for a specific prefix
   */
  async clearCache(prefix: 'embedding' | 'search' | 'external'): Promise<void> {
    try {
      if (this.isRedisAvailable && this.redis) {
        // In production, you'd want to use SCAN to find and delete keys
        console.log(`[RAGCache] Clearing ${prefix} cache in Redis`);
      }
      
      // Clear memory cache
      const keysToDelete: string[] = [];
      this.memoryCache.forEach((_, key) => {
        if (key.startsWith(prefix)) {
          keysToDelete.push(key);
        }
      });
      
      keysToDelete.forEach(key => this.memoryCache.delete(key));
      console.log(`[RAGCache] Cleared ${keysToDelete.length} ${prefix} entries from memory cache`);
    } catch (error) {
      console.error('[RAGCache] Error clearing cache:', error);
    }
  }
  
  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    memoryCacheSize: number;
    redisAvailable: boolean;
  }> {
    // Clean up expired entries first
    this.cleanupMemoryCache();
    
    return {
      memoryCacheSize: this.memoryCache.size,
      redisAvailable: this.isRedisAvailable,
    };
  }
  
  /**
   * Memory cache helpers
   */
  private getFromMemoryCache(key: string): any | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiry) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return entry.value;
  }
  
  private setInMemoryCache(key: string, value: any, ttlSeconds: number): void {
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.memoryCache.set(key, { value, expiry });
    
    // Limit memory cache size
    if (this.memoryCache.size > 1000) {
      this.cleanupMemoryCache();
    }
  }
  
  private cleanupMemoryCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.memoryCache.forEach((entry, key) => {
      if (now > entry.expiry) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.memoryCache.delete(key));
    
    // If still too large, remove oldest entries
    if (this.memoryCache.size > 800) {
      const entries = Array.from(this.memoryCache.entries())
        .sort((a, b) => a[1].expiry - b[1].expiry);
      
      const toRemove = entries.slice(0, entries.length - 800);
      toRemove.forEach(([key]) => this.memoryCache.delete(key));
    }
  }
}

// Export singleton instance
export const ragCache = new RAGCache();