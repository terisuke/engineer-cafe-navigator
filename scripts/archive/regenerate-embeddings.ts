#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { knowledgeBaseUtils } from '../src/lib/knowledge-base-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function regenerateEmbeddings() {
  console.log('🔄 Regenerating embeddings for knowledge base entries...\n');

  try {
    // Step 1: Find all entries without embeddings or that were recently updated
    console.log('📋 Finding entries that need embeddings...');
    
    // Get entries without embeddings
    const { data: entriesWithoutEmbeddings, error: fetchError } = await supabase
      .from('knowledge_base')
      .select('*')
      .is('content_embedding', null);

    if (fetchError) {
      console.error('❌ Error fetching entries:', fetchError.message);
      process.exit(1);
    }

    // Also get recently updated Saino and Aka-Renga entries
    const { data: recentlyUpdated, error: updateError } = await supabase
      .from('knowledge_base')
      .select('*')
      .or('content.ilike.%saino%,content.ilike.%赤煉瓦%,content.ilike.%aka-renga%');

    if (updateError) {
      console.error('❌ Error fetching updated entries:', updateError.message);
      process.exit(1);
    }

    // Combine and deduplicate
    const allEntries = [...(entriesWithoutEmbeddings || []), ...(recentlyUpdated || [])];
    const uniqueEntries = Array.from(new Map(allEntries.map(e => [e.id, e])).values());

    if (uniqueEntries.length === 0) {
      console.log('✅ No entries need embedding regeneration');
      return;
    }

    console.log(`\n📊 Found ${uniqueEntries.length} entries to process:`);
    uniqueEntries.forEach(entry => {
      const title = entry.metadata?.title || 'No title';
      console.log(`  - ${entry.id}: ${title} (${entry.language})`);
    });

    // Step 2: Generate embeddings for each entry
    console.log('\n🤖 Generating embeddings...');
    let successCount = 0;
    let errorCount = 0;

    for (const entry of uniqueEntries) {
      try {
        const title = entry.metadata?.title || 'No title';
        process.stdout.write(`  Processing: ${title}... `);

        // Generate embedding using the same method as the application
        const embedding = await knowledgeBaseUtils.generateEmbedding(entry.content);

        // Update the entry with the new embedding
        const { error: updateError } = await supabase
          .from('knowledge_base')
          .update({ 
            content_embedding: embedding,
            metadata: {
              ...entry.metadata,
              embedding_generated_at: new Date().toISOString(),
              embedding_model: 'text-embedding-004'
            }
          })
          .eq('id', entry.id);

        if (updateError) {
          console.log('❌ Failed');
          console.error(`    Error: ${updateError.message}`);
          errorCount++;
        } else {
          console.log('✅ Done');
          successCount++;
        }

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.log('❌ Failed');
        console.error(`    Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        errorCount++;
      }
    }

    // Step 3: Summary
    console.log('\n' + '━'.repeat(70));
    console.log('📊 Embedding Regeneration Summary');
    console.log('━'.repeat(70));
    console.log(`Total entries processed: ${uniqueEntries.length}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Failed: ${errorCount}`);

    if (errorCount > 0) {
      console.log('\n⚠️  Some embeddings failed to generate. Please check the errors above.');
    } else {
      console.log('\n✨ All embeddings regenerated successfully!');
    }

    // Step 4: Verify critical entries
    console.log('\n🔍 Verifying critical entries...');
    const criticalQueries = [
      'saino%休館日%',
      'saino%営業時間%',
      '赤煉瓦%営業時間%',
      '赤煉瓦%休館日%'
    ];

    for (const query of criticalQueries) {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('id, content, metadata->>title')
        .ilike('content', query)
        .not('content_embedding', 'is', null)
        .limit(1);

      if (!error && data && data.length > 0) {
        console.log(`✅ Found entry for "${query}": ${data[0].title || 'No title'}`);
      } else {
        console.log(`⚠️  No entry found for "${query}"`);
      }
    }

    console.log('\n🎯 Next steps:');
    console.log('1. Run: pnpm tsx scripts/test-rag-accuracy.ts');
    console.log('2. Test the Q&A system with actual queries');
    console.log('3. Run comprehensive integration tests');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the regeneration
regenerateEmbeddings();