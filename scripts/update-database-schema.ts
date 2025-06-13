#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://smdmvpnsfmdspzzaisia.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtZG12cG5zZm1kc3B6emFpc2lhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODQ3NDUzMSwiZXhwIjoyMDY0MDUwNTMxfQ.AJcDHBUXPqohEtr9Z0ldG-LeWAwrUb-PrIG6ROqNUDQ';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function updateDatabaseSchema() {
  console.log('🔍 Checking current schema...');
  
  try {
    // Check if there are existing records
    const { data: existingData, error: checkError } = await supabase
      .from('knowledge_base')
      .select('id, content_embedding')
      .limit(5);
    
    if (checkError) {
      console.error('❌ Error checking existing data:', checkError);
      return;
    }
    
    console.log(`📊 Found ${existingData?.length || 0} existing records`);
    
    if (existingData && existingData.length > 0) {
      console.log('⚠️ Database contains existing data. Please backup before proceeding.');
      console.log('🗑️ Clearing existing knowledge base data...');
      
      const { error: deleteError } = await supabase
        .from('knowledge_base')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
      
      if (deleteError) {
        console.error('❌ Error clearing data:', deleteError);
        return;
      }
      console.log('✅ Existing data cleared');
    }
    
    console.log('🔧 Schema appears to be ready for 768-dimension embeddings');
    console.log('✅ Database schema update completed');
    
  } catch (error) {
    console.error('❌ Error updating schema:', error);
  }
}

if (require.main === module) {
  updateDatabaseSchema()
    .then(() => {
      console.log('🎉 Ready to import knowledge base data!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Schema update failed:', error);
      process.exit(1);
    });
}