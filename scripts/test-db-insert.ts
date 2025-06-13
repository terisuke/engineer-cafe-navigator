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

async function testDatabaseInsert() {
  console.log('🧪 Testing database insert with 768-dimension vector...');
  
  try {
    // Create a test vector with 768 dimensions
    const testVector = Array(768).fill(0).map(() => Math.random() * 0.01);
    
    console.log(`📊 Test vector length: ${testVector.length}`);
    
    const { data, insertError } = await supabase
      .from('knowledge_base')
      .insert({
        content: 'TEST ENTRY - DIMENSION CHECK FOR 768',
        content_embedding: testVector,
        category: 'test',
        subcategory: 'dimension-test',
        language: 'ja',
        source: 'test-script',
        metadata: { test: true }
      })
      .select();
    
    if (insertError) {
      console.error('❌ Insert failed:', insertError);
      
      // Try with 1536 dimensions to confirm the issue
      console.log('🔄 Trying with 1536 dimensions...');
      const testVector1536 = Array(1536).fill(0).map(() => Math.random() * 0.01);
      
      const { data: data1536, error: error1536 } = await supabase
        .from('knowledge_base')
        .insert({
          content: 'TEST ENTRY - DIMENSION CHECK FOR 1536',
          content_embedding: testVector1536,
          category: 'test',
          subcategory: 'dimension-test-1536',
          language: 'ja',
          source: 'test-script',
          metadata: { test: true }
        })
        .select();
      
      if (error1536) {
        console.error('❌ 1536-dimension insert also failed:', error1536);
      } else {
        console.log('✅ 1536-dimension insert succeeded!');
        console.log('🔧 Database expects 1536 dimensions, not 768');
        console.log('🧹 Cleaning up test record...');
        await supabase.from('knowledge_base').delete().eq('category', 'test');
      }
      
    } else {
      console.log('✅ 768-dimension insert succeeded!');
      console.log('📝 Inserted record:', data);
      console.log('🧹 Cleaning up test record...');
      await supabase.from('knowledge_base').delete().eq('category', 'test');
    }
    
  } catch (dbError) {
    console.error('❌ Database test failed:', dbError);
  }
}

if (require.main === module) {
  testDatabaseInsert()
    .then(() => {
      console.log('🏁 Database test completed');
      process.exit(0);
    })
    .catch((testError) => {
      console.error('❌ Test failed:', testError);
      process.exit(1);
    });
}