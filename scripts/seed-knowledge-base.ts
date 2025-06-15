#!/usr/bin/env tsx

import { knowledgeBaseUtils, KnowledgeBaseEntry } from '../src/lib/knowledge-base-utils';

// Sample knowledge base entries for Engineer Cafe
const sampleEntries: KnowledgeBaseEntry[] = [
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
    content: 'Engineer Cafe is a coworking space for IT engineers located in Tenjin, Fukuoka. Open 24/7 with high-speed internet, power outlets, free drinks, and more facilities.',
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

async function seedKnowledgeBase() {
  console.log('🌱 Starting knowledge base seeding...\n');

  try {
    // Check current stats
    console.log('📊 Current knowledge base stats:');
    const statsBefore = await knowledgeBaseUtils.getStats();
    console.log(statsBefore);
    console.log('\n');

    // Add sample entries
    console.log(`📝 Adding ${sampleEntries.length} sample entries...`);
    const result = await knowledgeBaseUtils.addEntries(sampleEntries);
    
    console.log(`✅ Successfully added: ${result.successful}`);
    console.log(`❌ Failed to add: ${result.failed}`);
    
    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      result.errors.forEach(({ index, error }) => {
        console.log(`  - Entry ${index}: ${error}`);
      });
    }

    // Update any missing embeddings
    console.log('\n🔄 Updating missing embeddings...');
    const updateResult = await knowledgeBaseUtils.updateMissingEmbeddings();
    console.log(`✅ Updated: ${updateResult.updated}`);
    console.log(`❌ Failed: ${updateResult.failed}`);

    // Show final stats
    console.log('\n📊 Final knowledge base stats:');
    const statsAfter = await knowledgeBaseUtils.getStats();
    console.log(statsAfter);

    console.log('\n✨ Knowledge base seeding completed!');
  } catch (error) {
    console.error('\n💥 Error seeding knowledge base:', error);
    process.exit(1);
  }
}

// Run the seeding script
seedKnowledgeBase();