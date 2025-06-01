/**
 * Feature flag system for gradual migration and A/B testing
 */

interface FeatureFlags {
  // RAG system flags
  USE_NEW_EMBEDDINGS: boolean;
  NEW_EMBEDDINGS_PERCENTAGE: number; // 0-100
  USE_PARALLEL_RAG: boolean; // Run both old and new in parallel
  
  // External API flags
  USE_CACHED_EXTERNAL_API: boolean;
  EXTERNAL_API_TIMEOUT_MS: number;
  
  // Performance flags
  ENABLE_PERFORMANCE_LOGGING: boolean;
  ENABLE_QUERY_ANALYTICS: boolean;
  
  // Migration flags
  ENABLE_GRADUAL_MIGRATION: boolean;
  MIGRATION_USER_PERCENTAGE: number; // 0-100
}

class FeatureFlagManager {
  private static instance: FeatureFlagManager;
  private flags: FeatureFlags;
  private userOverrides: Map<string, Partial<FeatureFlags>> = new Map();
  
  private constructor() {
    // Default flags - can be overridden by environment variables
    this.flags = {
      USE_NEW_EMBEDDINGS: this.getEnvBoolean('FF_USE_NEW_EMBEDDINGS', false),
      NEW_EMBEDDINGS_PERCENTAGE: this.getEnvNumber('FF_NEW_EMBEDDINGS_PERCENTAGE', 0),
      USE_PARALLEL_RAG: this.getEnvBoolean('FF_USE_PARALLEL_RAG', false),
      
      USE_CACHED_EXTERNAL_API: this.getEnvBoolean('FF_USE_CACHED_EXTERNAL_API', true),
      EXTERNAL_API_TIMEOUT_MS: this.getEnvNumber('FF_EXTERNAL_API_TIMEOUT_MS', 5000),
      
      ENABLE_PERFORMANCE_LOGGING: this.getEnvBoolean('FF_ENABLE_PERFORMANCE_LOGGING', true),
      ENABLE_QUERY_ANALYTICS: this.getEnvBoolean('FF_ENABLE_QUERY_ANALYTICS', true),
      
      ENABLE_GRADUAL_MIGRATION: this.getEnvBoolean('FF_ENABLE_GRADUAL_MIGRATION', false),
      MIGRATION_USER_PERCENTAGE: this.getEnvNumber('FF_MIGRATION_USER_PERCENTAGE', 0),
    };
  }
  
  static getInstance(): FeatureFlagManager {
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager();
    }
    return FeatureFlagManager.instance;
  }
  
  /**
   * Get flag value for a specific user/session
   */
  getFlag<K extends keyof FeatureFlags>(
    flagName: K,
    userId?: string
  ): FeatureFlags[K] {
    // Check user-specific overrides first
    if (userId && this.userOverrides.has(userId)) {
      const overrides = this.userOverrides.get(userId)!;
      if (flagName in overrides) {
        return overrides[flagName] as FeatureFlags[K];
      }
    }
    
    // For percentage-based flags, determine if user should get the feature
    if (flagName === 'USE_NEW_EMBEDDINGS' && this.flags.ENABLE_GRADUAL_MIGRATION && userId) {
      return this.isUserInPercentage(userId, this.flags.NEW_EMBEDDINGS_PERCENTAGE) as FeatureFlags[K];
    }
    
    return this.flags[flagName];
  }
  
  /**
   * Check if a feature is enabled for a user
   */
  isEnabled(flagName: keyof FeatureFlags, userId?: string): boolean {
    const value = this.getFlag(flagName, userId);
    return typeof value === 'boolean' ? value : value > 0;
  }
  
  /**
   * Set a user-specific override (for testing)
   */
  setUserOverride(userId: string, overrides: Partial<FeatureFlags>): void {
    this.userOverrides.set(userId, {
      ...this.userOverrides.get(userId),
      ...overrides,
    });
  }
  
  /**
   * Clear user-specific overrides
   */
  clearUserOverride(userId: string): void {
    this.userOverrides.delete(userId);
  }
  
  /**
   * Update global flags (admin function)
   */
  updateFlags(updates: Partial<FeatureFlags>): void {
    this.flags = {
      ...this.flags,
      ...updates,
    };
  }
  
  /**
   * Get all current flag values
   */
  getAllFlags(): FeatureFlags {
    return { ...this.flags };
  }
  
  /**
   * Determine if a user should be in a percentage rollout
   */
  private isUserInPercentage(userId: string, percentage: number): boolean {
    if (percentage >= 100) return true;
    if (percentage <= 0) return false;
    
    // Simple hash-based distribution
    const hash = this.hashString(userId);
    const userPercentage = (hash % 100) + 1;
    return userPercentage <= percentage;
  }
  
  /**
   * Simple string hash function
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  /**
   * Get boolean from environment variable
   */
  private getEnvBoolean(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
  }
  
  /**
   * Get number from environment variable
   */
  private getEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
}

// Export singleton instance
export const featureFlags = FeatureFlagManager.getInstance();

// A/B testing helper for RAG
export class RAGExperiment {
  /**
   * Run A/B test between old and new RAG implementations
   */
  static async runExperiment(
    userId: string,
    query: string,
    options?: {
      category?: string;
      language?: string;
    }
  ): Promise<{
    variant: 'control' | 'treatment';
    results: any[];
    metrics: {
      responseTime: number;
      resultCount: number;
      avgSimilarity: number;
    };
  }> {
    const useNewImplementation = featureFlags.getFlag('USE_NEW_EMBEDDINGS', userId);
    const variant = useNewImplementation ? 'treatment' : 'control';
    
    const startTime = Date.now();
    let results: any[];
    
    if (variant === 'treatment') {
      // New implementation (would be implemented later)
      results = await this.searchWithNewEmbeddings(query, options);
    } else {
      // Current implementation
      results = await this.searchWithCurrentImplementation(query, options);
    }
    
    const responseTime = Date.now() - startTime;
    const avgSimilarity = results.length > 0
      ? results.reduce((sum, r) => sum + (r.similarity || 0), 0) / results.length
      : 0;
    
    // Log experiment results if enabled
    if (featureFlags.isEnabled('ENABLE_QUERY_ANALYTICS')) {
      await this.logExperimentResult({
        userId,
        variant,
        query,
        responseTime,
        resultCount: results.length,
        avgSimilarity,
      });
    }
    
    return {
      variant,
      results,
      metrics: {
        responseTime,
        resultCount: results.length,
        avgSimilarity,
      },
    };
  }
  
  /**
   * Run parallel comparison (for testing)
   */
  static async runParallelComparison(
    query: string,
    options?: any
  ): Promise<{
    control: any;
    treatment: any;
    comparison: {
      responseTimeDiff: number;
      resultCountDiff: number;
      similarityDiff: number;
    };
  }> {
    const [controlResult, treatmentResult] = await Promise.all([
      this.runExperiment('control-user', query, options),
      this.runExperiment('treatment-user', query, options),
    ]);
    
    return {
      control: controlResult,
      treatment: treatmentResult,
      comparison: {
        responseTimeDiff: treatmentResult.metrics.responseTime - controlResult.metrics.responseTime,
        resultCountDiff: treatmentResult.metrics.resultCount - controlResult.metrics.resultCount,
        similarityDiff: treatmentResult.metrics.avgSimilarity - controlResult.metrics.avgSimilarity,
      },
    };
  }
  
  private static async searchWithCurrentImplementation(query: string, options?: any): Promise<any[]> {
    // Import and use current RAG search tool
    const { ragSearchTool } = await import('@/mastra/tools/rag-search');
    const result = await ragSearchTool.searchKnowledgeBase(query, options?.language || 'ja');
    return typeof result === 'string' ? [] : []; // Return empty array for now as searchKnowledgeBase returns string
  }
  
  private static async searchWithNewEmbeddings(query: string, options?: any): Promise<any[]> {
    // Placeholder for new implementation
    // This would use the new Mastra vector query tool
    console.log('[RAGExperiment] New embeddings not yet implemented, falling back to current');
    return this.searchWithCurrentImplementation(query, options);
  }
  
  private static async logExperimentResult(result: any): Promise<void> {
    // Log to analytics system
    console.log('[RAGExperiment] Result:', result);
  }
}