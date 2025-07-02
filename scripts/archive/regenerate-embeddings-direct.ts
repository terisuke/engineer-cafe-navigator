import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !googleApiKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(googleApiKey);

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    console.log('Generating embedding with Google text-embedding-004...');
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    const embedding = result.embedding.values;
    
    console.log(`Embedding generated (length: ${embedding.length})`);
    
    // Pad to 1536 dimensions if needed
    if (embedding.length === 768) {
      console.log('Padding embedding from 768 to 1536 dimensions');
      return [...embedding, ...new Array(768).fill(0)];
    }
    
    return embedding;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    throw error;
  }
}

async function regenerateSainoHoursEmbeddings() {
  console.log('🔄 Regenerating embeddings for Saino Cafe hours entries...\n');

  const targetIds = [
    '8aa4bf78-8680-4ada-a062-54963d5933ab', // Japanese hours entry
    '7755438e-ce50-49a1-b19d-811095f7aeaf'  // English hours entry
  ];

  try {
    for (const id of targetIds) {
      console.log(`\nProcessing entry: ${id}`);
      
      // Get the current entry
      const { data: entry, error: fetchError } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !entry) {
        console.error(`Failed to fetch entry ${id}:`, fetchError);
        continue;
      }

      console.log(`Language: ${entry.language}`);
      console.log(`Content: ${entry.content}`);
      
      // Generate new embedding
      console.log('Generating new embedding...');
      const newEmbedding = await generateEmbedding(entry.content);
      
      // Update the entry with new embedding
      const { error: updateError } = await supabase
        .from('knowledge_base')
        .update({ 
          content_embedding: newEmbedding,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) {
        console.error(`Failed to update embedding for ${id}:`, updateError);
      } else {
        console.log(`✅ Successfully updated embedding for ${id}`);
      }
    }

    // Test the search again
    console.log('\n\n🔍 Testing search with regenerated embeddings...\n');

    const testQueries = [
      'sainoカフェ 営業時間', 
      'saino cafe hours',
      'さいのカフェ 何時まで',
      'saino cafe business hours'
    ];
    
    for (const query of testQueries) {
      console.log(`\nTesting query: "${query}"`);
      
      // Generate embedding for query
      const queryEmbedding = await generateEmbedding(query);
      
      // Search
      const { data: results, error: searchError } = await supabase.rpc('search_knowledge_base', {
        query_embedding: queryEmbedding,
        similarity_threshold: 0.3,
        match_count: 10,
      });

      if (searchError) {
        console.error('Search error:', searchError);
        continue;
      }

      console.log(`Found ${results?.length || 0} results`);
      
      // Check if target entries are found
      const foundTargets = results?.filter((r: any) => targetIds.includes(r.id)) || [];
      
      if (foundTargets.length > 0) {
        console.log(`✅ Found ${foundTargets.length} target entries!`);
        foundTargets.forEach((item: any) => {
          console.log(`   - ID: ${item.id}`);
          console.log(`     Similarity: ${item.similarity}`);
          console.log(`     Content: ${item.content}`);
        });
      } else {
        console.log('❌ Target entries not found in results');
        console.log('Top 3 results:');
        results?.slice(0, 3).forEach((item: any, index: number) => {
          console.log(`   ${index + 1}. ${item.content.substring(0, 80)}...`);
          console.log(`      Similarity: ${item.similarity}`);
          console.log(`      Category: ${item.category}`);
        });
      }
    }

    // Final verification
    console.log('\n\n🔍 Final verification - Direct similarity check...\n');
    
    for (const id of targetIds) {
      const { data: entry } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('id', id)
        .single();
        
      if (entry && entry.content_embedding) {
        console.log(`\nChecking self-similarity for ${id}:`);
        const { data: selfCheck } = await supabase.rpc('search_knowledge_base', {
          query_embedding: entry.content_embedding,
          similarity_threshold: 0.5,
          match_count: 5,
        });
        
        const self = selfCheck?.find((r: any) => r.id === id);
        if (self) {
          console.log(`✅ Entry can find itself with similarity: ${self.similarity}`);
        } else {
          console.log('❌ Entry cannot find itself!');
        }
      }
    }

  } catch (err) {
    console.error('Regeneration failed:', err);
  }
}

// Run the regeneration
regenerateSainoHoursEmbeddings()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nScript failed:', err);
    process.exit(1);
  });