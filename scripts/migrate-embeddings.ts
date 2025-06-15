#!/usr/bin/env npx tsx

/**
 * Database migration script for transitioning to new embeddings
 * This script handles the gradual migration from 1536-dim to new embedding models
 */

import { openai } from '@ai-sdk/openai';
import { embedMany } from 'ai';
import { config } from 'dotenv';
import path from 'path';
import { supabaseAdmin } from '../src/lib/supabase';
import { MIGRATION_CONFIG } from '../src/mastra/config/mastra-v2';

// Load environment variables
config();

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

class EmbeddingMigrator {
  private batchSize = MIGRATION_CONFIG.batchSize;
  private isDryRun = false;
  private requestCount = 0;
  private lastRequestTime = Date.now();
  
  constructor(isDryRun = false) {
    this.isDryRun = isDryRun;
    
    // Verify OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
  }
  
  /**
   * Create new table for migrated embeddings
   */
  async createMigrationTable(): Promise<void> {
    log('Creating migration table...', 'info');
    
    const sql = `
      -- Create new knowledge base table with versioned embeddings
      CREATE TABLE IF NOT EXISTS knowledge_base_v2 (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(50) NOT NULL,
        subcategory VARCHAR(50),
        language VARCHAR(2) NOT NULL DEFAULT 'ja',
        metadata JSONB DEFAULT '{}',
        
        -- Old embedding (1536 dimensions)
        content_embedding_v1 vector(1536),
        
        -- New embedding (768 dimensions for text-embedding-3-small)
        content_embedding_v2 vector(768),
        
        -- Embedding metadata
        embedding_model VARCHAR(50),
        embedding_generated_at TIMESTAMP WITH TIME ZONE,
        
        -- Migration tracking
        migrated_from UUID REFERENCES knowledge_base(id),
        migration_status VARCHAR(20) DEFAULT 'pending',
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
      
      -- Create indexes
      CREATE INDEX idx_kb_v2_embedding_v1 ON knowledge_base_v2 
        USING ivfflat (content_embedding_v1 vector_cosine_ops) WITH (lists = 100);
      
      CREATE INDEX idx_kb_v2_embedding_v2 ON knowledge_base_v2 
        USING ivfflat (content_embedding_v2 vector_cosine_ops) WITH (lists = 100);
      
      CREATE INDEX idx_kb_v2_category ON knowledge_base_v2(category);
      CREATE INDEX idx_kb_v2_language ON knowledge_base_v2(language);
      CREATE INDEX idx_kb_v2_migration_status ON knowledge_base_v2(migration_status);
    `;
    
    // 注意: exec_sqlはSQLインジェクションリスクがあるため、外部入力を絶対に含めないこと。
    // 本番運用ではsupabaseのマイグレーション機能やSQLファイル管理を推奨。
    if (!this.isDryRun) {
      await supabaseAdmin.rpc('exec_sql', { sql });
      log('✅ Migration table created', 'success');
    } else {
      log('🔍 [DRY RUN] Would create migration table', 'warning');
    }
  }
  
  /**
   * Migrate embeddings in batches
   */
  async migrateEmbeddings(options: {
    limit?: number;
    category?: string;
    skipExisting?: boolean;
  } = {}): Promise<void> {
    log(`\n🚀 Starting embedding migration (${this.isDryRun ? 'DRY RUN' : 'LIVE'})...`, 'info');
    
    // Get entries to migrate
    let query = supabaseAdmin
      .from('knowledge_base')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (options.category) {
      query = query.eq('category', options.category);
    }
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const { data: entries, error } = await query;
    
    if (error) {
      log(`❌ Failed to fetch entries: ${error.message}`, 'error');
      return;
    }
    
    if (!entries || entries.length === 0) {
      log('No entries to migrate', 'warning');
      return;
    }
    
    log(`Found ${entries.length} entries to migrate`, 'info');
    
    // Process in batches
    let migrated = 0;
    let failed = 0;
    
    for (let i = 0; i < entries.length; i += this.batchSize) {
      const batch = entries.slice(i, i + this.batchSize);
      log(`\nProcessing batch ${Math.floor(i / this.batchSize) + 1} (${batch.length} entries)...`);
      
      for (const entry of batch) {
        try {
          await this.migrateEntry(entry, options.skipExisting || false);
          migrated++;
          
          if (migrated % 10 === 0) {
            log(`Progress: ${migrated}/${entries.length}`, 'info');
          }
        } catch (error) {
          failed++;
          log(`❌ Failed to migrate entry ${entry.id}: ${error}`, 'error');
        }
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    log(`\n✅ Migration completed: ${migrated} migrated, ${failed} failed`, 'success');
  }
  
  /**
   * Migrate a single entry
   */
  private async migrateEntry(entry: any, skipExisting: boolean): Promise<void> {
    // Check if already migrated
    if (skipExisting) {
      const { data: existing } = await supabaseAdmin
        .from('knowledge_base_v2')
        .select('id')
        .eq('migrated_from', entry.id)
        .single();
      
      if (existing) {
        return;
      }
    }
    
    // Generate new embedding (placeholder - would use new model)
    // For now, we'll simulate with a smaller dimension
    const newEmbedding = await this.generateNewEmbedding(entry.content);
    
    const migratedEntry = {
      title: entry.title,
      content: entry.content,
      category: entry.category,
      subcategory: entry.subcategory,
      language: entry.language,
      metadata: entry.metadata,
      content_embedding_v1: entry.content_embedding,
      content_embedding_v2: newEmbedding,
      embedding_model: 'text-embedding-3-small',
      embedding_generated_at: new Date().toISOString(),
      migrated_from: entry.id,
      migration_status: 'completed',
    };
    
    if (!this.isDryRun) {
      await supabaseAdmin
        .from('knowledge_base_v2')
        .insert(migratedEntry);
    }
  }
  
  /**
   * Generate new embedding using OpenAI text-embedding-3-small
   */
  private async generateNewEmbedding(text: string): Promise<number[]> {
    // Rate limiting
    await this.enforceRateLimit();
    
    try {
      const { embeddings } = await embedMany({
        model: openai.embedding('text-embedding-3-small'),
        values: [text],
      });
      
      return embeddings[0];
    } catch (error) {
      log(`❌ Failed to generate embedding: ${error}`, 'error');
      throw error;
    }
  }
  
  /**
   * Enforce OpenAI rate limits
   */
  private async enforceRateLimit(): Promise<void> {
    this.requestCount++;
    
    // Check if we've exceeded rate limit
    const elapsedTime = Date.now() - this.lastRequestTime;
    const requestsPerMinute = (this.requestCount / elapsedTime) * 60000;
    
    if (requestsPerMinute > MIGRATION_CONFIG.rateLimit.maxRequestsPerMinute) {
      const delay = (60000 / MIGRATION_CONFIG.rateLimit.maxRequestsPerMinute) - (elapsedTime / this.requestCount);
      if (delay > 0) {
        log(`Rate limiting: waiting ${delay.toFixed(0)}ms...`, 'warning');
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Reset counter every minute
    if (elapsedTime > 60000) {
      this.requestCount = 0;
      this.lastRequestTime = Date.now();
    }
  }
  
  /**
   * Verify migration integrity
   */
  async verifyMigration(): Promise<void> {
    log('\n🔍 Verifying migration...', 'info');
    
    // Count original entries
    const { count: originalCount } = await supabaseAdmin
      .from('knowledge_base')
      .select('*', { count: 'exact', head: true });
    
    // Count migrated entries
    const { count: migratedCount } = await supabaseAdmin
      .from('knowledge_base_v2')
      .select('*', { count: 'exact', head: true });
    
    // Count by status
    const { data: statusCounts } = await supabaseAdmin
      .from('knowledge_base_v2')
      .select('migration_status', { count: 'exact' });
    
    log(`\nMigration Summary:`, 'info');
    log(`- Original entries: ${originalCount}`, 'info');
    log(`- Migrated entries: ${migratedCount}`, 'info');
    log(`- Completion rate: ${((migratedCount || 0) / (originalCount || 1) * 100).toFixed(2)}%`, 'info');
    
    if (migratedCount === originalCount) {
      log(`\n✅ All entries successfully migrated!`, 'success');
    } else {
      log(`\n⚠️  Migration incomplete: ${(originalCount || 0) - (migratedCount || 0)} entries remaining`, 'warning');
    }
  }
  
  /**
   * Create parallel search function for A/B testing
   */
  async createParallelSearchFunction(): Promise<void> {
    log('Creating parallel search function...', 'info');
    
    const sql = `
      -- Parallel search function that can use either v1 or v2 embeddings
      CREATE OR REPLACE FUNCTION search_knowledge_base_parallel(
        query_embedding_v1 vector(1536),
        query_embedding_v2 vector(768),
        use_v2 boolean DEFAULT false,
        similarity_threshold float DEFAULT 0.7,
        match_count int DEFAULT 5
      ) RETURNS TABLE (
        id uuid,
        content text,
        category varchar,
        language varchar,
        metadata jsonb,
        similarity float,
        embedding_version varchar
      ) AS $$
      BEGIN
        IF use_v2 AND query_embedding_v2 IS NOT NULL THEN
          -- Use new embeddings
          RETURN QUERY
          SELECT 
            kb.id,
            kb.content,
            kb.category,
            kb.language,
            kb.metadata,
            1 - (kb.content_embedding_v2 <=> query_embedding_v2) as similarity,
            'v2' as embedding_version
          FROM knowledge_base_v2 kb
          WHERE 1 - (kb.content_embedding_v2 <=> query_embedding_v2) > similarity_threshold
          ORDER BY kb.content_embedding_v2 <=> query_embedding_v2
          LIMIT match_count;
        ELSE
          -- Use original embeddings
          RETURN QUERY
          SELECT 
            kb.id,
            kb.content,
            kb.category,
            kb.language,
            kb.metadata,
            1 - (kb.content_embedding_v1 <=> query_embedding_v1) as similarity,
            'v1' as embedding_version
          FROM knowledge_base_v2 kb
          WHERE 1 - (kb.content_embedding_v1 <=> query_embedding_v1) > similarity_threshold
          ORDER BY kb.content_embedding_v1 <=> query_embedding_v1
          LIMIT match_count;
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    if (!this.isDryRun) {
      await supabaseAdmin.rpc('exec_sql', { sql });
      log('✅ Parallel search function created', 'success');
    } else {
      log('🔍 [DRY RUN] Would create parallel search function', 'warning');
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const action = args.find(arg => !arg.startsWith('--')) || 'migrate';
  
  const migrator = new EmbeddingMigrator(isDryRun);
  
  try {
    switch (action) {
      case 'setup':
        await migrator.createMigrationTable();
        await migrator.createParallelSearchFunction();
        break;
        
      case 'migrate':
        const limit = args.includes('--limit') 
          ? parseInt(args[args.indexOf('--limit') + 1])
          : undefined;
        
        const category = args.includes('--category')
          ? args[args.indexOf('--category') + 1]
          : undefined;
        
        await migrator.migrateEmbeddings({
          limit,
          category,
          skipExisting: args.includes('--skip-existing'),
        });
        break;
        
      case 'verify':
        await migrator.verifyMigration();
        break;
        
      default:
        log(`Unknown action: ${action}`, 'error');
        log('\nUsage: pnpm tsx scripts/migrate-embeddings.ts [action] [options]');
        log('Actions: setup, migrate, verify');
        log('Options: --dry-run, --limit <n>, --category <name>, --skip-existing');
    }
  } catch (error) {
    log(`\n❌ Migration failed: ${error}`, 'error');
    process.exit(1);
  }
}

// Run the migration
main().catch(console.error);