import { supabaseAdmin } from './supabase';
import { featureFlags } from './feature-flags';

/**
 * Rollback manager for safe production deployments
 */
export class RollbackManager {
  private static instance: RollbackManager;
  
  private constructor() {}
  
  static getInstance(): RollbackManager {
    if (!RollbackManager.instance) {
      RollbackManager.instance = new RollbackManager();
    }
    return RollbackManager.instance;
  }
  
  /**
   * Create a system snapshot before major changes
   */
  async createSnapshot(name: string, metadata?: any): Promise<string> {
    try {
      const snapshot = {
        id: `snapshot-${Date.now()}`,
        name,
        timestamp: new Date().toISOString(),
        feature_flags: featureFlags.getAllFlags(),
        metadata: {
          ...metadata,
          node_env: process.env.NODE_ENV,
          deployment_id: process.env.VERCEL_DEPLOYMENT_ID,
        },
      };
      
      // Store snapshot
      const { data, error } = await supabaseAdmin
        .from('system_snapshots')
        .insert(snapshot)
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`[RollbackManager] Created snapshot: ${data.id}`);
      return data.id;
    } catch (error) {
      console.error('[RollbackManager] Failed to create snapshot:', error);
      throw error;
    }
  }
  
  /**
   * Rollback to a previous snapshot
   */
  async rollback(snapshotId: string): Promise<void> {
    try {
      console.log(`[RollbackManager] Rolling back to snapshot: ${snapshotId}`);
      
      // Get snapshot
      const { data: snapshot, error } = await supabaseAdmin
        .from('system_snapshots')
        .select('*')
        .eq('id', snapshotId)
        .single();
      
      if (error || !snapshot) {
        throw new Error(`Snapshot not found: ${snapshotId}`);
      }
      
      // Restore feature flags
      featureFlags.updateFlags(snapshot.feature_flags);
      
      // Log rollback
      await this.logRollback(snapshotId, 'manual');
      
      console.log(`[RollbackManager] Rollback completed to snapshot: ${snapshotId}`);
    } catch (error) {
      console.error('[RollbackManager] Rollback failed:', error);
      throw error;
    }
  }
  
  /**
   * Automatic rollback based on error threshold
   */
  async checkHealthAndRollback(options: {
    errorThreshold: number;
    timeWindowMinutes: number;
    snapshotId?: string;
  }): Promise<boolean> {
    try {
      const timeWindow = new Date();
      timeWindow.setMinutes(timeWindow.getMinutes() - options.timeWindowMinutes);
      
      // Check error rate
      const { data: errors } = await supabaseAdmin
        .from('system_errors')
        .select('*')
        .gte('created_at', timeWindow.toISOString());
      
      const errorRate = errors ? errors.length : 0;
      
      if (errorRate > options.errorThreshold) {
        console.warn(`[RollbackManager] Error threshold exceeded: ${errorRate} > ${options.errorThreshold}`);
        
        // Get latest snapshot if not specified
        const snapshotId = options.snapshotId || await this.getLatestSnapshotId();
        
        if (snapshotId) {
          await this.rollback(snapshotId);
          await this.logRollback(snapshotId, 'automatic', {
            reason: 'error_threshold_exceeded',
            error_count: errorRate,
            threshold: options.errorThreshold,
          });
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('[RollbackManager] Health check failed:', error);
      return false;
    }
  }
  
  /**
   * Emergency shutdown - disable all new features
   */
  async emergencyShutdown(): Promise<void> {
    console.warn('[RollbackManager] EMERGENCY SHUTDOWN INITIATED');
    
    // Disable all experimental features
    featureFlags.updateFlags({
      USE_NEW_EMBEDDINGS: false,
      NEW_EMBEDDINGS_PERCENTAGE: 0,
      USE_PARALLEL_RAG: false,
      ENABLE_GRADUAL_MIGRATION: false,
      MIGRATION_USER_PERCENTAGE: 0,
    });
    
    // Log emergency action
    await this.logRollback('emergency', 'emergency_shutdown', {
      timestamp: new Date().toISOString(),
      reason: 'manual_emergency_shutdown',
    });
    
    console.warn('[RollbackManager] Emergency shutdown completed - all experimental features disabled');
  }
  
  /**
   * Get rollback history
   */
  async getRollbackHistory(limit = 10): Promise<any[]> {
    const { data } = await supabaseAdmin
      .from('rollback_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    return data || [];
  }
  
  /**
   * Get latest snapshot ID
   */
  private async getLatestSnapshotId(): Promise<string | null> {
    const { data } = await supabaseAdmin
      .from('system_snapshots')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    return data?.id || null;
  }
  
  /**
   * Log rollback action
   */
  private async logRollback(
    snapshotId: string,
    type: 'manual' | 'automatic' | 'emergency_shutdown',
    metadata?: any
  ): Promise<void> {
    try {
      await supabaseAdmin
        .from('rollback_history')
        .insert({
          snapshot_id: snapshotId,
          rollback_type: type,
          metadata,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('[RollbackManager] Failed to log rollback:', error);
    }
  }
}

/**
 * Circuit breaker for feature protection
 */
export class FeatureCircuitBreaker {
  private static failures = new Map<string, number>();
  private static lastFailureTime = new Map<string, number>();
  private static circuitState = new Map<string, 'closed' | 'open' | 'half-open'>();
  
  private static readonly FAILURE_THRESHOLD = 5;
  private static readonly TIMEOUT_MS = 60000; // 1 minute
  private static readonly HALF_OPEN_REQUESTS = 3;
  
  /**
   * Execute a feature with circuit breaker protection
   */
  static async execute<T>(
    featureName: string,
    operation: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    const state = this.circuitState.get(featureName) || 'closed';
    
    // Check circuit state
    if (state === 'open') {
      const lastFailure = this.lastFailureTime.get(featureName) || 0;
      const timeSinceFailure = Date.now() - lastFailure;
      
      if (timeSinceFailure > this.TIMEOUT_MS) {
        // Try half-open state
        this.circuitState.set(featureName, 'half-open');
      } else {
        // Circuit still open, use fallback
        console.warn(`[CircuitBreaker] Circuit open for ${featureName}, using fallback`);
        return fallback();
      }
    }
    
    try {
      const result = await operation();
      
      // Success - reset failures
      if (state === 'half-open') {
        console.log(`[CircuitBreaker] Circuit closing for ${featureName}`);
        this.circuitState.set(featureName, 'closed');
      }
      
      this.failures.set(featureName, 0);
      return result;
      
    } catch (error) {
      // Record failure
      const failureCount = (this.failures.get(featureName) || 0) + 1;
      this.failures.set(featureName, failureCount);
      this.lastFailureTime.set(featureName, Date.now());
      
      console.error(`[CircuitBreaker] Feature ${featureName} failed (${failureCount}/${this.FAILURE_THRESHOLD}):`, error);
      
      // Open circuit if threshold exceeded
      if (failureCount >= this.FAILURE_THRESHOLD) {
        console.warn(`[CircuitBreaker] Opening circuit for ${featureName}`);
        this.circuitState.set(featureName, 'open');
      }
      
      // Use fallback
      return fallback();
    }
  }
  
  /**
   * Get circuit breaker status
   */
  static getStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    this.circuitState.forEach((state, feature) => {
      status[feature] = {
        state,
        failures: this.failures.get(feature) || 0,
        lastFailure: this.lastFailureTime.get(feature) || null,
      };
    });
    
    return status;
  }
  
  /**
   * Reset a specific circuit
   */
  static reset(featureName: string): void {
    this.failures.delete(featureName);
    this.lastFailureTime.delete(featureName);
    this.circuitState.delete(featureName);
    console.log(`[CircuitBreaker] Reset circuit for ${featureName}`);
  }
}

// Export singleton instance
export const rollbackManager = RollbackManager.getInstance();