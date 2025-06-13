#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!serviceRoleKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function removeDuplicates() {
  console.log('🧹 Starting RAG data duplicate removal...');
  
  try {
    // Get all records
    console.log('📊 Fetching all records...');
    const { data: allRecords, error: fetchError } = await supabase
      .from('knowledge_base')
      .select('*')
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('❌ Error fetching records:', fetchError);
      return;
    }

    console.log(`📋 Found ${allRecords?.length || 0} total records`);

    // Group by content and identify duplicates
    const contentMap = new Map();
    const duplicateIds: string[] = [];

    allRecords?.forEach(record => {
      if (contentMap.has(record.content)) {
        // This is a duplicate - add to deletion list
        duplicateIds.push(record.id);
      } else {
        // This is the first occurrence - keep it
        contentMap.set(record.content, record);
      }
    });

    console.log(`🎯 Found ${duplicateIds.length} duplicate records to remove`);
    console.log(`✅ Keeping ${contentMap.size} unique records`);

    if (duplicateIds.length === 0) {
      console.log('✨ No duplicates found!');
      return;
    }

    // Delete duplicates in batches of 100
    const batchSize = 100;
    let deletedCount = 0;

    for (let i = 0; i < duplicateIds.length; i += batchSize) {
      const batch = duplicateIds.slice(i, i + batchSize);
      console.log(`🗑️ Deleting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(duplicateIds.length / batchSize)} (${batch.length} records)...`);

      const { error: deleteError } = await supabase
        .from('knowledge_base')
        .delete()
        .in('id', batch);

      if (deleteError) {
        console.error('❌ Error deleting batch:', deleteError);
        break;
      }

      deletedCount += batch.length;
      console.log(`✅ Deleted ${deletedCount}/${duplicateIds.length} duplicate records`);
    }

    // Verify final state
    console.log('🔍 Verifying final state...');
    const { data: finalRecords } = await supabase
      .from('knowledge_base')
      .select('content');

    const finalTotal = finalRecords?.length || 0;
    const finalUnique = new Set(finalRecords?.map(r => r.content)).size;

    console.log(`📊 Final result: ${finalTotal} total records, ${finalUnique} unique content`);
    
    if (finalTotal === finalUnique) {
      console.log('🎉 Success! All duplicates removed!');
    } else {
      console.log('⚠️ Warning: Some duplicates may still exist');
    }

    // Show breakdown by source
    console.log('📈 Final records by source:');
    const sources = new Map();
    finalRecords?.forEach(record => {
      // We need to get the source info
    });

    const { data: sourceStats } = await supabase
      .from('knowledge_base')
      .select('source')
      .then(result => {
        const stats = new Map();
        result.data?.forEach(record => {
          stats.set(record.source, (stats.get(record.source) || 0) + 1);
        });
        return { data: Array.from(stats.entries()) };
      });

    sourceStats?.data?.forEach(([source, count]) => {
      console.log(`  ${source}: ${count} records`);
    });

  } catch (error) {
    console.error('❌ Error during duplicate removal:', error);
  }
}

if (require.main === module) {
  removeDuplicates()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}