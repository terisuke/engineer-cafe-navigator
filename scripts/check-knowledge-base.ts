import { createClient } from '@supabase/supabase-js';
import { configDotenv } from 'dotenv';

configDotenv({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkKnowledge() {
  // Check for Engineer Cafe info
  const { data: engineerCafe, error: e1 } = await supabase
    .from('knowledge_base')
    .select('content, metadata')
    .ilike('content', '%エンジニアカフェ%営業時間%')
    .limit(5);
  
  console.log('Engineer Cafe operating hours entries:', engineerCafe?.length || 0);
  if (engineerCafe && engineerCafe.length > 0) {
    console.log('Sample:', engineerCafe[0].content.substring(0, 200));
  }

  // Check for location info (should be Fukuoka, not Nisshin)
  const { data: location, error: e2 } = await supabase
    .from('knowledge_base')
    .select('content, metadata')
    .or('content.ilike.%福岡%,content.ilike.%天神%,content.ilike.%中央区%')
    .limit(5);
  
  console.log('\nLocation entries:', location?.length || 0);
  if (location && location.length > 0) {
    console.log('Sample:', location[0].content.substring(0, 200));
  }

  // Check for Saino info
  const { data: saino, error: e3 } = await supabase
    .from('knowledge_base')
    .select('content, metadata')
    .ilike('content', '%saino%')
    .limit(5);
  
  console.log('\nSaino entries:', saino?.length || 0);
  if (saino && saino.length > 0) {
    console.log('Sample:', saino[0].content.substring(0, 200));
  }

  // Check for basement/underground info
  const { data: basement, error: e4 } = await supabase
    .from('knowledge_base')
    .select('content, metadata')
    .or('content.ilike.%地下%,content.ilike.%basement%')
    .limit(5);
  
  console.log('\nBasement entries:', basement?.length || 0);
  if (basement && basement.length > 0) {
    console.log('Sample:', basement[0].content.substring(0, 200));
  }

  // Check total count
  const { count } = await supabase
    .from('knowledge_base')
    .select('*', { count: 'exact', head: true });
  
  console.log('\nTotal knowledge base entries:', count);

  // Get some random entries to see what's actually in there
  const { data: sample } = await supabase
    .from('knowledge_base')
    .select('content')
    .limit(10);
  
  console.log('\n=== Sample entries ===');
  sample?.forEach((entry, i) => {
    console.log(`\n${i + 1}. ${entry.content.substring(0, 150)}...`);
  });
}

checkKnowledge().catch(console.error);