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

async function generateOpenAIEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-3-small', // 1536 dimensions native
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function migrateToOpenAIEmbeddings() {
  console.log('🔄 Migrating all embeddings to OpenAI text-embedding-3-small\n');
  console.log('This will ensure RAG search works correctly by using consistent embeddings.\n');

  try {
    // Get all knowledge base entries
    console.log('📋 Fetching all knowledge base entries...');
    const { data: entries, error: fetchError } = await supabase
      .from('knowledge_base')
      .select('*')
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    if (!entries || entries.length === 0) {
      console.log('No entries found in knowledge base');
      return;
    }

    console.log(`Found ${entries.length} entries to migrate\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    // Process each entry
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const progress = `[${i + 1}/${entries.length}]`;
      
      try {
        process.stdout.write(`${progress} Processing: ${entry.metadata?.title || entry.id.substring(0, 8)}... `);

        // Generate OpenAI embedding
        const embedding = await generateOpenAIEmbedding(entry.content);

        // Update the entry
        const { error: updateError } = await supabase
          .from('knowledge_base')
          .update({
            content_embedding: embedding,
            metadata: {
              ...entry.metadata,
              embedding_model: 'text-embedding-3-small',
              embedding_generated_at: new Date().toISOString(),
              embedding_dimensions: 1536
            }
          })
          .eq('id', entry.id);

        if (updateError) {
          throw updateError;
        }

        console.log('✅');
        successCount++;

        // Rate limiting - OpenAI allows 3000 RPM for embeddings
        await new Promise(resolve => setTimeout(resolve, 50)); // ~1200 RPM

      } catch (error) {
        console.log('❌');
        errorCount++;
        errors.push({
          id: entry.id,
          title: entry.metadata?.title || 'Unknown',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Summary
    console.log('\n' + '━'.repeat(70));
    console.log('📊 Migration Summary');
    console.log('━'.repeat(70));
    console.log(`Total entries: ${entries.length}`);
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);

    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(err => {
        console.log(`  - ${err.id}: ${err.error}`);
      });
    }

    // Verify migration
    console.log('\n🔍 Verifying migration...');
    
    const { count: openaiCount } = await supabase
      .from('knowledge_base')
      .select('*', { count: 'exact', head: true })
      .eq('metadata->>embedding_model', 'text-embedding-3-small');

    console.log(`\nEntries with OpenAI embeddings: ${openaiCount}`);

    if (openaiCount === entries.length) {
      console.log('✅ All entries successfully migrated to OpenAI embeddings!');
    } else {
      console.log(`⚠️  Some entries may not have been migrated (${entries.length - (openaiCount || 0)} missing)`);
    }

    console.log('\n✨ Migration complete! RAG search should now work correctly.');
    console.log('\n📝 Next steps:');
    console.log('1. Test RAG search with various queries');
    console.log('2. Verify Saino cafe and Aka-Renga queries return correct results');
    console.log('3. Monitor performance improvements');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateToOpenAIEmbeddings();