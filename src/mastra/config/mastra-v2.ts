import { Mastra } from '@mastra/core';
import { PgVector } from '@mastra/pg';
import { createVectorQueryTool } from '@mastra/rag';
import { openai } from '@ai-sdk/openai';
import { Config } from '../types/config';

/**
 * Create Mastra V2 instance with latest patterns
 * Uses OpenAI text-embedding-3-small (768 dimensions)
 */
export function createMastraV2Instance(config: Config) {
  // Initialize PgVector with connection string
  const pgVector = new PgVector({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL!,
  });
  
  // Create vector query tool with new embedding model
  const vectorQueryTool = createVectorQueryTool({
    vectorStoreName: 'pgVector',
    indexName: 'knowledge_base_v2',
    model: openai.embedding('text-embedding-3-small'), // 768 dimensions
  });
  
  // Initialize Mastra with new configuration
  const mastra = new Mastra({
    agents: {
      // Agents will be configured separately
    },
    vectors: {
      pgVector,
    },
    // tools and logger configuration removed - not available in current Mastra version
  });
  
  return {
    mastra,
    pgVector,
    vectorQueryTool,
  };
}

/**
 * Vector store configuration for knowledge base V2
 */
export const VECTOR_CONFIG_V2 = {
  embeddingModel: 'text-embedding-3-small',
  dimensions: 768,
  tableName: 'knowledge_base_v2',
  indexMethod: 'ivfflat',
  lists: 100, // For IVFFlat index
  similarityFunction: 'cosine',
} as const;

/**
 * Migration configuration
 */
export const MIGRATION_CONFIG = {
  batchSize: 50,
  rateLimit: {
    maxRequestsPerMinute: 1500, // OpenAI rate limit for text-embedding-3-small
    delayBetweenBatches: 1000, // 1 second
  },
  parallelWorkers: 3,
} as const;