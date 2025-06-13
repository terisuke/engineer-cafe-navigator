#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!serviceRoleKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function executeDuplicateRemoval() {
  console.log('🧹 Executing RAG data duplicate removal...');
  
  try {
    // Get statistics before deletion
    console.log('📊 Getting statistics before deletion...');
    const { data: beforeStats } = await supabase
      .from('knowledge_base')
      .select('content')
      .then(result => ({
        data: {
          total: result.data?.length || 0,
          unique: new Set(result.data?.map(r => r.content)).size
        }
      }));

    console.log(`📋 Before: ${beforeStats?.total} total records, ${beforeStats?.unique} unique content`);

    // Execute the duplicate removal using SQL
    console.log('🗑️ Removing duplicate records...');
    
    // First, identify duplicates with SQL query through RPC
    const deleteQuery = `
      WITH ranked_records AS (
        SELECT 
          id,
          content,
          ROW_NUMBER() OVER (
            PARTITION BY content 
            ORDER BY created_at ASC, id ASC
          ) as rn
        FROM knowledge_base
      )
      DELETE FROM knowledge_base 
      WHERE id IN (
        SELECT id FROM ranked_records WHERE rn > 1
      );
    `;

    // Execute deletion
    const { error: deleteError } = await supabase.rpc('exec', { sql: deleteQuery });
    
    if (deleteError) {
      console.error('❌ Error during deletion:', deleteError);
      return;
    }

    // Get statistics after deletion
    console.log('📊 Getting statistics after deletion...');
    const { data: afterStats } = await supabase
      .from('knowledge_base')
      .select('content')
      .then(result => ({
        data: {
          total: result.data?.length || 0,
          unique: new Set(result.data?.map(r => r.content)).size
        }
      }));

    console.log(`📋 After: ${afterStats?.total} total records, ${afterStats?.unique} unique content`);
    console.log(`🎯 Removed: ${(beforeStats?.total || 0) - (afterStats?.total || 0)} duplicate records`);

    // Verify no duplicates remain
    console.log('🔍 Verifying no duplicates remain...');
    const { data: remainingDuplicates } = await supabase.rpc('exec', {
      sql: `
        SELECT content, COUNT(*) as count
        FROM knowledge_base
        GROUP BY content
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
        LIMIT 5;
      `
    });

    if (remainingDuplicates && remainingDuplicates.length > 0) {
      console.log('⚠️ Still have duplicates:', remainingDuplicates);
    } else {
      console.log('✅ No duplicates remain!');
    }

    // Show records by source
    console.log('📈 Records by source:');
    const { data: sourceStats } = await supabase.rpc('exec', {
      sql: `
        SELECT source, COUNT(*) as count
        FROM knowledge_base
        GROUP BY source
        ORDER BY COUNT(*) DESC;
      `
    });
    
    if (sourceStats) {
      sourceStats.forEach((stat: any) => {
        console.log(`  ${stat.source}: ${stat.count} records`);
      });
    }

    console.log('🎉 RAG data cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during duplicate removal:', error);
  }
}

if (require.main === module) {
  executeDuplicateRemoval()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}