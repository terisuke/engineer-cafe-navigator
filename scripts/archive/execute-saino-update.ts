import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
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

async function updateSainoCafeHours() {
  console.log('Updating saino cafe hours...\n');

  const updateQuery = `
    UPDATE knowledge_base 
    SET 
      content = 'さいのカフェ営業時間：火曜日〜土曜日 10:00〜17:00（土曜日はエンジニアカフェが休館日の場合のみ営業）',
      updated_at = NOW()
    WHERE id = '8aa4bf78-8680-4ada-a062-54963d5933ab'
    RETURNING id, content, category, subcategory, language, updated_at;
  `;

  try {
    // Execute the update query
    const { data, error } = await supabase.rpc('exec_sql', {
      query: updateQuery
    });

    if (error) {
      // If RPC doesn't exist, try direct update
      console.log('RPC method not available, trying direct update...');
      
      const { data: updateData, error: updateError } = await supabase
        .from('knowledge_base')
        .update({
          content: 'さいのカフェ営業時間：火曜日〜土曜日 10:00〜17:00（土曜日はエンジニアカフェが休館日の場合のみ営業）',
          updated_at: new Date().toISOString()
        })
        .eq('id', '8aa4bf78-8680-4ada-a062-54963d5933ab')
        .select('id, content, category, subcategory, language, updated_at')
        .single();

      if (updateError) {
        console.error('Update failed:', updateError);
        return;
      }

      console.log('Update successful!');
      console.log('\nUpdated entry:');
      console.log('ID:', updateData.id);
      console.log('Content:', updateData.content);
      console.log('Category:', updateData.category);
      console.log('Subcategory:', updateData.subcategory);
      console.log('Language:', updateData.language);
      console.log('Updated at:', updateData.updated_at);
    } else {
      console.log('Update successful via RPC!');
      console.log('\nUpdated entry:', data);
    }

    // Verify the update
    console.log('\n--- Verifying update ---');
    const { data: verifyData, error: verifyError } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('id', '8aa4bf78-8680-4ada-a062-54963d5933ab')
      .single();

    if (verifyError) {
      console.error('Verification failed:', verifyError);
      return;
    }

    console.log('\nVerified entry:');
    console.log('ID:', verifyData.id);
    console.log('Content:', verifyData.content);
    console.log('Category:', verifyData.category);
    console.log('Subcategory:', verifyData.subcategory);
    console.log('Language:', verifyData.language);
    console.log('Updated at:', verifyData.updated_at);

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// Run the update
updateSainoCafeHours()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nScript failed:', err);
    process.exit(1);
  });