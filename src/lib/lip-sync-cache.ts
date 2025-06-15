/**
 * Lip-sync cache manager for fast mouth shape animation
 * Caches analyzed lip-sync data in localStorage and memory
 */

import { LipSyncData, LipSyncFrame } from './lip-sync-analyzer';

interface CachedLipSyncData {
  data: LipSyncData;
  timestamp: number;
  audioHash: string;
  size: number;
}

interface LipSyncCacheStats {
  totalEntries: number;
  totalSize: number;
  hitCount: number;
  missCount: number;
  lastCleanup: number;
}

export class LipSyncCache {
  private static readonly CACHE_PREFIX = 'lipsync_cache_';
  private static readonly STATS_KEY = 'lipsync_cache_stats';
  private static readonly MAX_CACHE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly MAX_ENTRIES = 100;
  private static readonly CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

  private memoryCache = new Map<string, CachedLipSyncData>();
  private stats: LipSyncCacheStats;
  private isClient: boolean;

  constructor() {
    this.isClient = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
    this.stats = this.loadStats();
    if (this.isClient) {
      this.cleanupExpiredEntries();
    }
  }

  /**
   * Generate a hash key for audio data
   */
  private async generateAudioHash(audioBlob: Blob): Promise<string> {
    try {
      // Use audio size and a sample of the data to create a fingerprint
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Create a simple hash from file size and sample data points
      let hash = audioBlob.size.toString(16);
      
      // Sample data points throughout the audio for fingerprinting
      const samplePoints = Math.min(100, uint8Array.length);
      const step = Math.floor(uint8Array.length / samplePoints);
      
      for (let i = 0; i < samplePoints; i++) {
        const index = i * step;
        if (index < uint8Array.length) {
          hash += uint8Array[index].toString(16).padStart(2, '0');
        }
      }
      
      // Add a simple checksum
      let checksum = 0;
      for (let i = 0; i < Math.min(1000, uint8Array.length); i++) {
        checksum = (checksum + uint8Array[i]) % 65536;
      }
      hash += checksum.toString(16);
      
      return hash;
    } catch (error) {
      console.warn('Failed to generate audio hash:', error);
      // Fallback to size-based hash for consistency
      return `fallback_size_${audioBlob.size.toString(16)}_type_${audioBlob.type.replace(/[^a-z0-9]/gi, '')}`;
    }
  }

  /**
   * Get cached lip-sync data if available
   */
  async getCachedLipSync(audioBlob: Blob): Promise<LipSyncData | null> {
    try {
      const audioHash = await this.generateAudioHash(audioBlob);
      
      // Check memory cache first
      if (this.memoryCache.has(audioHash)) {
        const cached = this.memoryCache.get(audioHash)!;
        if (this.isValidCache(cached)) {
          this.stats.hitCount++;
          console.log('[LipSyncCache] Memory cache hit for hash:', audioHash.substring(0, 12));
          return cached.data;
        } else {
          this.memoryCache.delete(audioHash);
        }
      }

      // Check localStorage cache (only in browser)
      if (!this.isClient) {
        this.stats.missCount++;
        return null;
      }

      const cacheKey = LipSyncCache.CACHE_PREFIX + audioHash;
      const cachedString = localStorage.getItem(cacheKey);
      
      if (cachedString) {
        try {
          const cached: CachedLipSyncData = JSON.parse(cachedString);
          
          if (this.isValidCache(cached)) {
            // Add to memory cache for faster future access
            this.memoryCache.set(audioHash, cached);
            this.stats.hitCount++;
            console.log('[LipSyncCache] localStorage cache hit for hash:', audioHash.substring(0, 12));
            return cached.data;
          } else {
            // Remove expired cache
            localStorage.removeItem(cacheKey);
          }
        } catch (error) {
          console.warn('[LipSyncCache] Failed to parse cached data:', error);
          localStorage.removeItem(cacheKey);
        }
      }

      this.stats.missCount++;
      this.saveStats();
      return null;
    } catch (error) {
      console.error('[LipSyncCache] Error getting cached lip-sync:', error);
      return null;
    }
  }

  /**
   * Cache lip-sync data
   */
  async cacheLipSync(audioBlob: Blob, lipSyncData: LipSyncData): Promise<void> {
    try {
      const audioHash = await this.generateAudioHash(audioBlob);
      const timestamp = Date.now();
      const serializedData = JSON.stringify(lipSyncData);
      const size = new Blob([serializedData]).size;

      const cachedData: CachedLipSyncData = {
        data: lipSyncData,
        timestamp,
        audioHash,
        size
      };

      // Add to memory cache
      this.memoryCache.set(audioHash, cachedData);

      // Add to localStorage if size is reasonable and in browser
      if (this.isClient && size < 500 * 1024) { // Max 500KB per entry
        const cacheKey = LipSyncCache.CACHE_PREFIX + audioHash;
        
        try {
          localStorage.setItem(cacheKey, JSON.stringify(cachedData));
          console.log('[LipSyncCache] Cached lip-sync data for hash:', audioHash.substring(0, 12), 'Size:', this.formatBytes(size));
        } catch (error) {
          console.warn('[LipSyncCache] Failed to save to localStorage, cache may be full:', error);
          this.cleanupOldEntries();
          
          // Try again after cleanup
          try {
            localStorage.setItem(cacheKey, JSON.stringify(cachedData));
          } catch (secondError) {
            console.warn('[LipSyncCache] Still failed after cleanup, skipping localStorage cache');
          }
        }
      }

      this.updateStats();
      this.enforeCacheLimits();
    } catch (error) {
      console.error('[LipSyncCache] Error caching lip-sync data:', error);
    }
  }

  /**
   * Check if cached data is still valid
   */
  private isValidCache(cached: CachedLipSyncData): boolean {
    const age = Date.now() - cached.timestamp;
    return age < LipSyncCache.CACHE_EXPIRY && cached.data && cached.data.frames;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredEntries(): void {
    if (!this.isClient) return;
    
    const now = Date.now();
    
    // Clean memory cache
    for (const [key, cached] of this.memoryCache.entries()) {
      if (!this.isValidCache(cached)) {
        this.memoryCache.delete(key);
      }
    }

    // Clean localStorage cache
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LipSyncCache.CACHE_PREFIX)) {
        try {
          const cached: CachedLipSyncData = JSON.parse(localStorage.getItem(key)!);
          if (!this.isValidCache(cached)) {
            keysToRemove.push(key);
          }
        } catch (error) {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    if (keysToRemove.length > 0) {
      console.log('[LipSyncCache] Cleaned up', keysToRemove.length, 'expired entries');
    }

    this.stats.lastCleanup = now;
    this.saveStats();
  }

  /**
   * Clean up old entries when cache is full
   */
  private cleanupOldEntries(): void {
    if (!this.isClient) return;
    
    const entries: Array<{key: string, timestamp: number}> = [];
    
    // Collect all cache entries with timestamps
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LipSyncCache.CACHE_PREFIX)) {
        try {
          const cached: CachedLipSyncData = JSON.parse(localStorage.getItem(key)!);
          entries.push({ key, timestamp: cached.timestamp });
        } catch (error) {
          localStorage.removeItem(key);
        }
      }
    }

    // Sort by timestamp (oldest first) and remove oldest entries
    entries.sort((a, b) => a.timestamp - b.timestamp);
    const entriesToRemove = entries.slice(0, Math.floor(entries.length * 0.3)); // Remove oldest 30%
    
    entriesToRemove.forEach(entry => localStorage.removeItem(entry.key));
    
    console.log('[LipSyncCache] Cleaned up', entriesToRemove.length, 'old entries');
  }

  /**
   * Enforce cache size and entry limits
   */
  private enforeCacheLimits(): void {
    // Limit memory cache size
    if (this.memoryCache.size > LipSyncCache.MAX_ENTRIES) {
      const entries = Array.from(this.memoryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const entriesToRemove = entries.slice(0, this.memoryCache.size - LipSyncCache.MAX_ENTRIES);
      entriesToRemove.forEach(([key]) => this.memoryCache.delete(key));
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): LipSyncCacheStats & {
    memoryEntries: number;
    localStorageEntries: number;
    hitRate: number;
  } {
    const localStorageEntries = this.getLocalStorageEntryCount();
    const totalRequests = this.stats.hitCount + this.stats.missCount;
    const hitRate = totalRequests > 0 ? (this.stats.hitCount / totalRequests) * 100 : 0;

    return {
      ...this.stats,
      memoryEntries: this.memoryCache.size,
      localStorageEntries,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }

  /**
   * Clear all cache data
   */
  clearCache(): void {
    // Clear memory cache
    this.memoryCache.clear();

    // Clear localStorage cache (only in browser)
    if (this.isClient) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(LipSyncCache.CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }

    // Reset stats
    this.stats = {
      totalEntries: 0,
      totalSize: 0,
      hitCount: 0,
      missCount: 0,
      lastCleanup: Date.now()
    };
    this.saveStats();

    console.log('[LipSyncCache] Cache cleared');
  }

  /**
   * Load cache statistics from localStorage
   */
  private loadStats(): LipSyncCacheStats {
    if (!this.isClient) {
      return {
        totalEntries: 0,
        totalSize: 0,
        hitCount: 0,
        missCount: 0,
        lastCleanup: Date.now()
      };
    }

    try {
      const statsString = localStorage.getItem(LipSyncCache.STATS_KEY);
      if (statsString) {
        return JSON.parse(statsString);
      }
    } catch (error) {
      console.warn('[LipSyncCache] Failed to load stats:', error);
    }

    return {
      totalEntries: 0,
      totalSize: 0,
      hitCount: 0,
      missCount: 0,
      lastCleanup: Date.now()
    };
  }

  /**
   * Save cache statistics to localStorage
   */
  private saveStats(): void {
    if (!this.isClient) return;
    
    try {
      localStorage.setItem(LipSyncCache.STATS_KEY, JSON.stringify(this.stats));
    } catch (error) {
      console.warn('[LipSyncCache] Failed to save stats:', error);
    }
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    this.stats.totalEntries = this.getLocalStorageEntryCount();
    this.stats.totalSize = this.getLocalStorageCacheSize();
    this.saveStats();
  }

  /**
   * Get number of entries in localStorage cache
   */
  private getLocalStorageEntryCount(): number {
    if (!this.isClient) return 0;
    
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LipSyncCache.CACHE_PREFIX)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get total size of localStorage cache
   */
  private getLocalStorageCacheSize(): number {
    if (!this.isClient) return 0;
    
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LipSyncCache.CACHE_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += new Blob([value]).size;
        }
      }
    }
    return totalSize;
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Global cache instance (lazy initialization for SSR compatibility)
let _lipSyncCache: LipSyncCache | null = null;

export const lipSyncCache = {
  get instance(): LipSyncCache {
    if (!_lipSyncCache) {
      _lipSyncCache = new LipSyncCache();
    }
    return _lipSyncCache;
  },
  
  // Convenience methods that delegate to the instance
  getCachedLipSync: (audioBlob: Blob) => lipSyncCache.instance.getCachedLipSync(audioBlob),
  cacheLipSync: (audioBlob: Blob, lipSyncData: any) => lipSyncCache.instance.cacheLipSync(audioBlob, lipSyncData),
  getCacheStats: () => lipSyncCache.instance.getCacheStats(),
  clearCache: () => lipSyncCache.instance.clearCache(),
};