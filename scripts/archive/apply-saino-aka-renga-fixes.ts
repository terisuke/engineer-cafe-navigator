#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySainoAkaRengaFixes() {
  console.log('🔧 Applying Saino cafe and Aka-Renga Cultural Center fixes...\n');

  try {
    // Step 1: Update Saino cafe Japanese entry
    console.log('📝 Updating Saino cafe Japanese entry...');
    const { error: updateJaError } = await supabase
      .from('knowledge_base')
      .update({
        content: 'sainoカフェの営業時間：【平日】ランチ12:00〜17:00、ディナー18:00〜20:30（L.O.20:00）※17:00〜18:00は中休み【土日祝】11:00〜20:30（L.O.20:00）【金・土のみ】21:45まで営業（L.O.21:15）。定休日・休館日は毎月最終月曜日（エンジニアカフェと同じ）および年末年始。エンジニアカフェと同じフロア（1階）の階段手前に位置しており、コーヒー、軽食、デザートなどを提供しています。※L.O.はラストオーダー（Last Order）の略です。',
        metadata: {
          title: 'sainoカフェの営業時間と定休日',
          tags: ['saino', 'カフェ', '営業時間', '定休日', '休館日'],
          importance: 'high',
          last_updated: new Date().toISOString().split('T')[0]
        }
      })
      .eq('id', '8aa4bf78-8680-4ada-a062-54963d5933ab');

    if (updateJaError) {
      console.error('❌ Error updating Japanese entry:', updateJaError.message);
    } else {
      console.log('✅ Japanese entry updated');
    }

    // Step 2: Update Saino cafe English entry
    console.log('📝 Updating Saino cafe English entry...');
    const { error: updateEnError } = await supabase
      .from('knowledge_base')
      .update({
        content: 'saino cafe operating hours: [Weekdays] Lunch 12:00-17:00, Dinner 18:00-20:30 (L.O.20:00) *Break time 17:00-18:00 [Weekends/Holidays] 11:00-20:30 (L.O.20:00) [Friday & Saturday only] Open until 21:45 (L.O.21:15). Closed on the last Monday of each month (same as Engineer Cafe) and during New Year holidays. Located on the same floor (1st floor) as Engineer Cafe near the stairs, offering coffee, light meals, and desserts. *L.O. stands for Last Order.',
        metadata: {
          title: 'saino cafe hours and closing days',
          tags: ['saino', 'cafe', 'hours', 'closed', 'operating'],
          importance: 'high',
          last_updated: new Date().toISOString().split('T')[0]
        }
      })
      .eq('id', '7755438e-ce50-49a1-b19d-811095f7aeaf');

    if (updateEnError) {
      console.error('❌ Error updating English entry:', updateEnError.message);
    } else {
      console.log('✅ English entry updated');
    }

    // Step 3: Remove entries with incorrect information
    console.log('\n🗑️  Removing entries with incorrect information...');
    const { error: deleteError, count } = await supabase
      .from('knowledge_base')
      .delete()
      .or('content.ilike.%土曜日はエンジニアカフェが休館日の場合のみ営業%,content.ilike.%火曜日〜土曜日 10:00〜17:00%,content.ilike.%Tuesday to Saturday%10:00%17:00%');

    if (deleteError) {
      console.error('❌ Error deleting incorrect entries:', deleteError.message);
    } else {
      console.log(`✅ Removed ${count || 0} incorrect entries`);
    }

    // Step 4: Add Aka-Renga Cultural Center entries
    console.log('\n🏛️  Adding Aka-Renga Cultural Center entries...');
    
    const akaRengaEntries = [
      // Japanese entries
      {
        content: '赤煉瓦文化会館（福岡市文学館）は福岡市中央区天神1-15-30に位置する文化施設です。明治時代の赤煉瓦建築を保存・活用した歴史的建造物で、福岡の文学・文化の発信拠点として親しまれています。',
        category: '基本情報',
        subcategory: '概要',
        language: 'ja',
        metadata: {
          title: '赤煉瓦文化会館とは',
          tags: ['赤煉瓦文化会館', '福岡市文学館', '文化施設', '天神', '歴史的建造物'],
          importance: 'high'
        }
      },
      {
        content: '赤煉瓦文化会館の開館時間は9:00〜19:00です。ただし展示室は17:00までとなっています。休館日は毎週月曜日（祝日の場合は翌平日）および年末年始（12月28日〜1月4日）です。',
        category: '基本情報',
        subcategory: '営業時間',
        language: 'ja',
        metadata: {
          title: '赤煉瓦文化会館の営業時間と休館日',
          tags: ['営業時間', '開館時間', '休館日', '定休日', '赤煉瓦文化会館'],
          importance: 'high'
        }
      },
      {
        content: '赤煉瓦文化会館への入館料は無料です。ただし、特別展示については有料の場合があります。どなたでも気軽に訪れることができる開かれた文化施設です。',
        category: '料金',
        subcategory: '入館料',
        language: 'ja',
        metadata: {
          title: '赤煉瓦文化会館の入館料',
          tags: ['入館料', '料金', '無料', '赤煉瓦文化会館'],
          importance: 'medium'
        }
      },
      {
        content: '赤煉瓦文化会館には文学館、会議室、展示室があります。福岡ゆかりの文学者の資料展示や、定期的に文化イベント、講演会、ワークショップなどが開催されています。',
        category: '設備',
        subcategory: '施設一覧',
        language: 'ja',
        metadata: {
          title: '赤煉瓦文化会館の施設',
          tags: ['施設', '文学館', '会議室', '展示室', 'イベント', '赤煉瓦文化会館'],
          importance: 'medium'
        }
      },
      {
        content: '赤煉瓦文化会館はエンジニアカフェと徒歩圏内にあり、天神エリアの文化ゾーンを形成しています。エンジニアカフェでの作業の合間に、文化的な刺激を求めて訪れる方も多い施設です。',
        category: '連携情報',
        subcategory: '施設間連携',
        language: 'ja',
        metadata: {
          title: '赤煉瓦文化会館とエンジニアカフェの関係',
          tags: ['赤煉瓦文化会館', 'エンジニアカフェ', '連携', '天神', '文化施設'],
          importance: 'medium'
        }
      },
      // English entries
      {
        content: 'Aka-Renga Cultural Center (Fukuoka City Literature Museum) is located at 1-15-30 Tenjin, Chuo-ku, Fukuoka. It is a historic red brick building from the Meiji era, preserved and utilized as a cultural hub for Fukuoka\'s literature and culture.',
        category: 'General',
        subcategory: 'Overview',
        language: 'en',
        metadata: {
          title: 'About Aka-Renga Cultural Center',
          tags: ['aka-renga', 'cultural-center', 'fukuoka-literature-museum', 'tenjin', 'historic-building'],
          importance: 'high'
        }
      },
      {
        content: 'Aka-Renga Cultural Center is open from 9:00 to 19:00, with exhibition rooms closing at 17:00. Closed on Mondays (or the following weekday if Monday is a holiday) and during New Year holidays (December 28 to January 4).',
        category: 'General',
        subcategory: 'Hours',
        language: 'en',
        metadata: {
          title: 'Aka-Renga Cultural Center Hours',
          tags: ['hours', 'opening-hours', 'closed-days', 'aka-renga'],
          importance: 'high'
        }
      },
      {
        content: 'Admission to Aka-Renga Cultural Center is free. However, special exhibitions may charge admission fees. It is an open cultural facility that anyone can visit freely.',
        category: 'Pricing',
        subcategory: 'Admission',
        language: 'en',
        metadata: {
          title: 'Aka-Renga Cultural Center Admission',
          tags: ['admission', 'fee', 'free', 'aka-renga'],
          importance: 'medium'
        }
      }
    ];

    let insertCount = 0;
    for (const entry of akaRengaEntries) {
      const { error: insertError } = await supabase
        .from('knowledge_base')
        .insert(entry);

      if (insertError) {
        console.error(`❌ Error inserting entry "${entry.metadata.title}":`, insertError.message);
      } else {
        insertCount++;
      }
    }

    console.log(`✅ Added ${insertCount} of ${akaRengaEntries.length} Aka-Renga entries`);

    // Step 5: List entries that need embedding regeneration
    console.log('\n📋 Checking entries that need embedding regeneration...');
    const { data: nullEmbeddings, error: checkError } = await supabase
      .from('knowledge_base')
      .select('id, metadata->>title')
      .is('content_embedding', null);

    if (checkError) {
      console.error('❌ Error checking embeddings:', checkError.message);
    } else if (nullEmbeddings && nullEmbeddings.length > 0) {
      console.log(`\n⚠️  Found ${nullEmbeddings.length} entries without embeddings:`);
      nullEmbeddings.forEach(entry => {
        console.log(`  - ${entry.id}: ${entry.title || 'No title'}`);
      });
      console.log('\n💡 Run the embedding regeneration script next!');
    } else {
      console.log('✅ All entries have embeddings');
    }

    console.log('\n✨ Database fixes completed!');
    console.log('\nNext steps:');
    console.log('1. Run: pnpm tsx scripts/regenerate-embeddings.ts');
    console.log('2. Test with: pnpm tsx scripts/test-rag-accuracy.ts');
    console.log('3. Run comprehensive integration tests');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the fixes
applySainoAkaRengaFixes();