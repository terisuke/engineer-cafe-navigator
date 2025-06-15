#!/usr/bin/env tsx

import { config } from 'dotenv';
config();

import { createClient } from '@supabase/supabase-js';

// Configuration from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

// Complete knowledge base entries from seed-knowledge-base.ts
const allKnowledgeEntries = [
  // Japanese entries
  {
    content: 'エンジニアカフェは福岡市中央区天神にある、ITエンジニア向けの公共施設です。営業時間は9:00-22:00、休館日は毎月最終月曜日（祝日の場合は翌平日）と年末年始（12/29-1/3）です。高速インターネット、電源完備、会議室、イベントスペースなどの設備を無料で提供しています。',
    category: '基本情報',
    subcategory: '概要',
    language: 'ja',
    source: 'official',
    metadata: { title: 'エンジニアカフェとは' }
  },
  {
    content: '月額会員プランは8,000円から。ドロップイン利用は1時間500円、1日最大2,000円。学生割引あり（50%OFF）。法人プランもご用意しています。',
    category: '料金',
    subcategory: '会員プラン',
    language: 'ja',
    source: 'official',
    metadata: { title: '料金プラン' }
  },
  {
    content: '最大20名収容可能な会議室を3室完備。プロジェクター、ホワイトボード、Web会議システム完備。会員は1時間1,000円、非会員は1時間2,000円でご利用いただけます。',
    category: '設備',
    subcategory: '会議室',
    language: 'ja',
    source: 'official',
    metadata: { title: '会議室情報' }
  },
  {
    content: 'エンジニアカフェでは毎週技術勉強会やハンズオンセミナーを開催。AI、Web開発、モバイル開発、インフラなど幅広いテーマを扱っています。会員は無料で参加可能。',
    category: 'イベント',
    subcategory: '勉強会',
    language: 'ja',
    source: 'official',
    metadata: { title: 'イベント・勉強会' }
  },
  {
    content: '福岡市営地下鉄天神駅から徒歩3分。西鉄福岡（天神）駅から徒歩5分。駐車場はございませんが、近隣にコインパーキングが多数あります。',
    category: 'アクセス',
    subcategory: '交通',
    language: 'ja',
    source: 'official',
    metadata: { title: 'アクセス情報' }
  },
  {
    content: '高速光ファイバー回線（上下1Gbps）を完備。有線LAN、Wi-Fi両方利用可能。VPN接続対応。セキュアな開発環境をご提供します。',
    category: '設備',
    subcategory: 'インターネット',
    language: 'ja',
    source: 'official',
    metadata: { title: 'インターネット環境' }
  },
  {
    content: '3Dプリンター、レーザーカッター、はんだごてなどのメイカースペースを併設。IoTデバイスの試作やプロトタイピングが可能です。利用は予約制。',
    category: '設備',
    subcategory: 'メイカースペース',
    language: 'ja',
    source: 'official',
    metadata: { title: 'メイカースペース' }
  },
  {
    content: '技術書ライブラリーには最新の技術書籍が1000冊以上。オライリー、技術評論社などの定番書籍から最新刊まで。会員は自由に閲覧可能。',
    category: '設備',
    subcategory: 'ライブラリー',
    language: 'ja',
    source: 'official',
    metadata: { title: '技術書ライブラリー' }
  },

  // English entries
  {
    content: 'Engineer Cafe is a coworking space for IT engineers located in Tenjin, Fukuoka. Operating hours: 9:00-22:00, closed on the last Monday of each month (next weekday if holiday) and year-end holidays (12/29-1/3). Provides free facilities including high-speed internet, power outlets, meeting rooms, and event spaces.',
    category: 'General',
    subcategory: 'Overview',
    language: 'en',
    source: 'official',
    metadata: { title: 'About Engineer Cafe' }
  },
  {
    content: 'Monthly membership starts from ¥8,000. Drop-in rate is ¥500/hour, max ¥2,000/day. Student discount available (50% OFF). Corporate plans also available.',
    category: 'Pricing',
    subcategory: 'Membership',
    language: 'en',
    source: 'official',
    metadata: { title: 'Pricing Plans' }
  },
  {
    content: '3 meeting rooms available, each accommodating up to 20 people. Equipped with projectors, whiteboards, and video conferencing systems. Members: ¥1,000/hour, Non-members: ¥2,000/hour.',
    category: 'Facilities',
    subcategory: 'Meeting Rooms',
    language: 'en',
    source: 'official',
    metadata: { title: 'Meeting Room Information' }
  },
  {
    content: 'Weekly tech meetups and hands-on seminars covering AI, web development, mobile development, infrastructure, and more. Free for members to attend.',
    category: 'Events',
    subcategory: 'Meetups',
    language: 'en',
    source: 'official',
    metadata: { title: 'Events & Meetups' }
  },
  {
    content: '3-minute walk from Tenjin Station (Fukuoka City Subway). 5-minute walk from Nishitetsu Fukuoka (Tenjin) Station. No parking available, but many coin parking lots nearby.',
    category: 'Access',
    subcategory: 'Transportation',
    language: 'en',
    source: 'official',
    metadata: { title: 'Access Information' }
  },
  {
    content: 'High-speed fiber optic connection (1Gbps up/down). Both wired LAN and Wi-Fi available. VPN-friendly. Secure development environment provided.',
    category: 'Facilities',
    subcategory: 'Internet',
    language: 'en',
    source: 'official',
    metadata: { title: 'Internet Environment' }
  },
  {
    content: 'Maker space with 3D printers, laser cutters, soldering stations, and more. Perfect for IoT device prototyping. Reservation required.',
    category: 'Facilities',
    subcategory: 'Maker Space',
    language: 'en',
    source: 'official',
    metadata: { title: 'Maker Space' }
  },
  {
    content: 'Tech book library with over 1000 latest technical books. From O\'Reilly classics to the latest publications. Free access for all members.',
    category: 'Facilities',
    subcategory: 'Library',
    language: 'en',
    source: 'official',
    metadata: { title: 'Tech Book Library' }
  }
];

async function migrateAllKnowledge() {
  console.log('🚀 Migrating all knowledge to Supabase...');
  
  try {
    // Check current total entries
    const { count: totalCount, error: countError } = await supabase
      .from('knowledge_base')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error checking total entries:', countError);
      return;
    }
    
    console.log(`📊 Current total entries: ${totalCount}`);
    
    // Check for existing entries to avoid duplicates
    const { data: existing, error: checkError } = await supabase
      .from('knowledge_base')
      .select('content, subcategory, language');
    
    if (checkError) {
      console.error('❌ Error checking existing entries:', checkError);
      return;
    }
    
    console.log(`📊 Found ${existing?.length || 0} existing entries`);
    
    // Filter out entries that already exist
    const newEntries = allKnowledgeEntries.filter(entry => {
      return !existing?.some(existingEntry => 
        existingEntry.content === entry.content && 
        existingEntry.subcategory === entry.subcategory &&
        existingEntry.language === entry.language
      );
    });
    
    console.log(`📝 ${newEntries.length} new entries to add`);
    
    if (newEntries.length === 0) {
      console.log('✅ All knowledge entries already exist in Supabase');
      return;
    }
    
    // Insert new entries
    const { data, error } = await supabase
      .from('knowledge_base')
      .insert(newEntries)
      .select();
    
    if (error) {
      console.error('❌ Error inserting knowledge entries:', error);
      return;
    }
    
    console.log(`✅ Successfully added ${data?.length || 0} knowledge entries to Supabase`);
    
    // Verify the final count
    const { count: newTotalCount, error: newCountError } = await supabase
      .from('knowledge_base')
      .select('*', { count: 'exact', head: true });
    
    if (newCountError) {
      console.error('❌ Error checking new total:', newCountError);
      return;
    }
    
    console.log(`📊 New total entries: ${newTotalCount}`);
    console.log(`➕ Added: ${(newTotalCount || 0) - (totalCount || 0)} entries`);
    
    // Show summary by category
    const { data: summary, error: summaryError } = await supabase
      .from('knowledge_base')
      .select('category, language')
      .order('category');
    
    if (!summaryError && summary) {
      const categoryStats = summary.reduce((acc, entry) => {
        const key = `${entry.category} (${entry.language})`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('\n📊 Knowledge base summary:');
      Object.entries(categoryStats).forEach(([category, count]) => {
        console.log(`   ${category}: ${count} entries`);
      });
    }
    
    console.log('\n✨ Knowledge migration completed!');
    console.log('🎯 You can now manage all knowledge at localhost:3000/admin/knowledge');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
migrateAllKnowledge();