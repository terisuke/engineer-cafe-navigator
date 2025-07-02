#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiApiKey = process.env.OPENAI_API_KEY!;

if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function analyzeProblem() {
  console.log('🔍 Analyzing Embedding Model Inconsistency\n');
  console.log('━'.repeat(70));
  
  console.log('📊 CURRENT SITUATION:');
  console.log('━'.repeat(70));
  console.log('\n1. Knowledge Base Entries:');
  console.log('   Model: Google text-embedding-004');
  console.log('   Dimensions: 768 (padded to 1536)');
  console.log('   Location: knowledge-base-utils.ts');
  
  console.log('\n2. Search Queries:');
  console.log('   Model: OpenAI text-embedding-3-small');
  console.log('   Dimensions: 1536 (native)');
  console.log('   Location: rag-search.ts');
  
  console.log('\n⚠️  CRITICAL ISSUE:');
  console.log('   Different embedding models produce vectors in different spaces.');
  console.log('   Cosine similarity between Google and OpenAI embeddings is MEANINGLESS!');
  console.log('   This is why RAG search returns incorrect results.');
  
  // Check current database state
  console.log('\n\n📋 DATABASE ANALYSIS:');
  console.log('━'.repeat(70));
  
  // Sample some entries to check their embedding metadata
  const { data: entries, error } = await supabase
    .from('knowledge_base')
    .select('id, metadata, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(10);
    
  if (entries) {
    console.log('\nRecent entries and their embedding models:');
    entries.forEach(entry => {
      const model = entry.metadata?.embedding_model || 'unknown';
      const generatedAt = entry.metadata?.embedding_generated_at || 'unknown';
      console.log(`- ${entry.id.substring(0, 8)}... Model: ${model}, Generated: ${generatedAt}`);
    });
  }
  
  // Count entries by embedding model
  const { data: googleCount } = await supabase
    .from('knowledge_base')
    .select('id', { count: 'exact', head: true })
    .ilike('metadata->>embedding_model', '%google%');
    
  const { data: openaiCount } = await supabase
    .from('knowledge_base')
    .select('id', { count: 'exact', head: true })
    .ilike('metadata->>embedding_model', '%openai%');
    
  const { data: totalCount } = await supabase
    .from('knowledge_base')
    .select('id', { count: 'exact', head: true });
    
  console.log('\n📊 Embedding Model Distribution:');
  console.log(`   Total entries: ${totalCount || 0}`);
  console.log(`   Google embeddings: ${googleCount || 0}`);
  console.log(`   OpenAI embeddings: ${openaiCount || 0}`);
  console.log(`   Unknown/Mixed: ${(totalCount || 0) - (googleCount || 0) - (openaiCount || 0)}`);
  
  console.log('\n\n💡 SOLUTION OPTIONS:');
  console.log('━'.repeat(70));
  console.log('\nOption 1: Use OpenAI for everything (Recommended)');
  console.log('   ✅ Native 1536 dimensions (no padding needed)');
  console.log('   ✅ Better performance for Japanese text');
  console.log('   ✅ Consistent with current search implementation');
  console.log('   ✅ Lower cost: $0.02 vs $0.13 per 1M tokens');
  console.log('   ❌ Need to regenerate all embeddings');
  
  console.log('\nOption 2: Use Google for everything');
  console.log('   ✅ Already used for new entries');
  console.log('   ❌ Need to update search query generation');
  console.log('   ❌ Padding overhead (768→1536)');
  console.log('   ❌ Higher cost');
  
  console.log('\nOption 3: Maintain hybrid (NOT recommended)');
  console.log('   ❌ Requires complex dual-model search');
  console.log('   ❌ Performance overhead');
  console.log('   ❌ Maintenance complexity');
  
  console.log('\n\n🔧 RECOMMENDED FIX:');
  console.log('━'.repeat(70));
  console.log('\n1. Update knowledge-base-utils.ts to use OpenAI text-embedding-3-small');
  console.log('2. Regenerate all embeddings with OpenAI model');
  console.log('3. Update metadata to track embedding model consistently');
  console.log('4. Test RAG search functionality');
  
  console.log('\n📝 Implementation steps:');
  console.log('   a) Backup current database');
  console.log('   b) Update embedding generation code');
  console.log('   c) Run migration script for all entries');
  console.log('   d) Verify search accuracy');
  
  console.log('\n✨ This will ensure consistent embedding space and fix RAG search!');
}

analyzeProblem().catch(console.error);