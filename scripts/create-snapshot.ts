#!/usr/bin/env npx tsx

/**
 * Create system snapshot before major changes
 * Run: pnpm tsx scripts/create-snapshot.ts --name "pre-v2-deployment"
 */

import { config } from 'dotenv';
import path from 'path';
import { rollbackManager } from '../src/lib/rollback-manager';
import { supabaseAdmin } from '../src/lib/supabase';

// Load environment variables
config({ path: path.join(__dirname, '../.env.local') });

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const color = {
    info: colors.cyan,
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
  }[type];
  
  console.log(`${color}${message}${colors.reset}`);
}

async function createSnapshot() {
  const args = process.argv.slice(2);
  const nameIndex = args.indexOf('--name');
  const snapshotName = nameIndex >= 0 ? args[nameIndex + 1] : `snapshot-${new Date().toISOString()}`;
  
  log(`\n📸 Creating System Snapshot: ${snapshotName}`, 'info');
  log('=====================================\n', 'info');
  
  try {
    // Collect current system state
    log('1. Collecting system state...', 'info');
    
    // Get database statistics
    const { count: kbV1Count } = await supabaseAdmin
      .from('knowledge_base')
      .select('*', { count: 'exact', head: true });
    
    const { count: kbV2Count } = await supabaseAdmin
      .from('knowledge_base_v2')
      .select('*', { count: 'exact', head: true });
    
    // Get recent metrics
    const { data: recentMetrics } = await supabaseAdmin
      .from('rag_search_metrics')
      .select('*')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(100);
    
    const avgResponseTime = recentMetrics && recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.response_time_ms, 0) / recentMetrics.length
      : 0;
    
    // Get feature flag state
    const featureFlagState = {
      FF_ENABLE_GRADUAL_MIGRATION: process.env.FF_ENABLE_GRADUAL_MIGRATION,
      FF_NEW_EMBEDDINGS_PERCENTAGE: process.env.FF_NEW_EMBEDDINGS_PERCENTAGE,
      FF_USE_PARALLEL_RAG: process.env.FF_USE_PARALLEL_RAG,
      FF_ENABLE_PERFORMANCE_LOGGING: process.env.FF_ENABLE_PERFORMANCE_LOGGING,
    };
    
    // Create metadata
    const metadata = {
      database: {
        knowledge_base_v1_count: kbV1Count || 0,
        knowledge_base_v2_count: kbV2Count || 0,
      },
      performance: {
        avg_response_time_ms: avgResponseTime,
        recent_queries_count: recentMetrics?.length || 0,
      },
      deployment: {
        node_version: process.version,
        deployment_id: process.env.VERCEL_DEPLOYMENT_ID || 'local',
        git_sha: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
      },
      featureFlags: featureFlagState,
    };
    
    log('2. Creating snapshot...', 'info');
    
    // Create the snapshot
    const snapshotId = await rollbackManager.createSnapshot(snapshotName, metadata);
    
    log(`\n✅ Snapshot created successfully!`, 'success');
    log(`   ID: ${snapshotId}`, 'info');
    log(`   Name: ${snapshotName}`, 'info');
    
    // Display snapshot summary
    console.log('\n📊 Snapshot Summary:');
    console.log('------------------');
    console.log(`Knowledge Base V1: ${metadata.database.knowledge_base_v1_count} entries`);
    console.log(`Knowledge Base V2: ${metadata.database.knowledge_base_v2_count} entries`);
    console.log(`Avg Response Time: ${metadata.performance.avg_response_time_ms.toFixed(2)}ms`);
    console.log(`V2 Rollout: ${featureFlagState.FF_NEW_EMBEDDINGS_PERCENTAGE || '0'}%`);
    
    // Save snapshot info to file for reference
    const fs = await import('fs/promises');
    const snapshotInfo = {
      id: snapshotId,
      name: snapshotName,
      created_at: new Date().toISOString(),
      metadata,
    };
    
    const snapshotDir = path.join(__dirname, '../snapshots');
    await fs.mkdir(snapshotDir, { recursive: true });
    
    const snapshotFile = path.join(snapshotDir, `${snapshotId}.json`);
    await fs.writeFile(snapshotFile, JSON.stringify(snapshotInfo, null, 2));
    
    log(`\n📁 Snapshot saved to: ${snapshotFile}`, 'success');
    
    // Instructions for rollback
    console.log('\n🔄 To rollback to this snapshot:');
    console.log(`   pnpm tsx scripts/rollback.ts --snapshot ${snapshotId}`);
    
  } catch (error) {
    log(`\n❌ Failed to create snapshot: ${error}`, 'error');
    process.exit(1);
  }
}

// Run the script
createSnapshot().catch(console.error);