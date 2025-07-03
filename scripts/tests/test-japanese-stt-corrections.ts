#!/usr/bin/env tsx

/**
 * 日本語STT誤認識の包括的テスト
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { STTCorrection } from '@/lib/stt-correction';

console.log('🇯🇵 日本語STT誤認識の包括的テスト');
console.log('================================================================================');

interface TestCase {
  input: string;
  expected: string;
  category: string;
}

const testCases: TestCase[] = [
  // エンジニアカフェの誤認識
  { category: 'エンジニアカフェ', input: 'エンジニア壁の営業時間は？', expected: 'エンジニアカフェの営業時間は？' },
  { category: 'エンジニアカフェ', input: 'エンジニア加工について教えて', expected: 'エンジニアカフェについて教えて。' },
  { category: 'エンジニアカフェ', input: 'エンジニア課はどこですか？', expected: 'エンジニアカフェはどこですか？' },
  { category: 'エンジニアカフェ', input: 'エンジニアカベの料金', expected: 'エンジニアカフェの料金。' },
  { category: 'エンジニアカフェ', input: 'engineer wallはありますか', expected: 'エンジニアカフェはありますか。' },
  
  // サイノカフェの誤認識（新パターン）
  { category: 'サイノカフェ', input: 'サイのカフェの場所', expected: 'サイノカフェの場所。' },
  { category: 'サイノカフェ', input: 'さいなカフェのメニュー', expected: 'サイノカフェのメニュー。' },
  { category: 'サイノカフェ', input: '才納カフェはいつから？', expected: 'サイノカフェはいつから？' },
  { category: 'サイノカフェ', input: '財野カフェの営業時間', expected: 'サイノカフェの営業時間。' },
  { category: 'サイノカフェ', input: '才脳カフェについて', expected: 'サイノカフェについて。' },
  
  // カフェ自体の誤認識
  { category: 'カフェ', input: 'エンジニアカヘの場所', expected: 'エンジニアカフェの場所。' },
  { category: 'カフェ', input: 'サイノカペはどこ？', expected: 'サイノカフェはどこ？' },
  { category: 'カフェ', input: 'エンジニアかへの料金', expected: 'エンジニアカフェの料金。' },
  { category: 'カフェ', input: 'サイノカファについて', expected: 'サイノカフェについて。' },
  
  // 会議室の誤認識
  { category: '会議室', input: '会議質は使えますか？', expected: '会議室は使えますか？' },
  { category: '会議室', input: '地下の開議室について', expected: '地下の会議室について。' },
  { category: '会議室', input: '階議室の予約方法', expected: '会議室の予約方法。' },
  { category: '会議室', input: 'かいぎしつの料金', expected: '会議室の料金。' },
  
  // 地下施設の誤認識
  { category: '地下施設', input: '収集スペースはどこ？', expected: '集中スペースはどこ？' },
  { category: '地下施設', input: '終日スペースの利用時間', expected: '集中スペースの利用時間。' },
  { category: '地下施設', input: 'アンダーすぺーすについて', expected: 'アンダースペースについて。' },
  { category: '地下施設', input: 'メーカーズスペースの設備', expected: 'Makersスペースの設備。' },
  { category: '地下施設', input: 'under spaceはありますか', expected: 'アンダースペースはありますか。' },
  
  // 複合的な誤認識
  { category: '複合', input: 'エンジニア壁と才能カヘの違い', expected: 'エンジニアカフェとサイノカフェの違い。' },
  { category: '複合', input: '地下の会議質と収集スペース', expected: '地下の会議室と集中スペース。' },
  { category: '複合', input: 'engineer wallの階下のメーカーズスペース', expected: 'エンジニアカフェの地下のMakersスペース。' }
];

let totalPassed = 0;
let totalFailed = 0;

// カテゴリごとにテスト
const categories = [...new Set(testCases.map(tc => tc.category))];

for (const category of categories) {
  console.log(`\n📁 ${category}のテスト`);
  console.log('----------------------------------------');
  
  const categoryTests = testCases.filter(tc => tc.category === category);
  let categoryPassed = 0;
  
  for (const test of categoryTests) {
    const corrected = STTCorrection.correct(test.input);
    const passed = corrected === test.expected;
    
    if (passed) {
      categoryPassed++;
      totalPassed++;
      console.log(`✅ "${test.input}"`);
      console.log(`   → "${corrected}"`);
    } else {
      totalFailed++;
      console.log(`❌ "${test.input}"`);
      console.log(`   → 実際: "${corrected}"`);
      console.log(`   → 期待: "${test.expected}"`);
    }
  }
  
  console.log(`\n小計: ${categoryPassed}/${categoryTests.length} (${Math.round(categoryPassed / categoryTests.length * 100)}%)`);
}

// 総合結果
console.log('\n================================================================================');
console.log('📊 総合結果');
console.log('================================================================================');
console.log(`✅ 成功: ${totalPassed}件`);
console.log(`❌ 失敗: ${totalFailed}件`);
console.log(`📈 成功率: ${Math.round(totalPassed / testCases.length * 100)}%`);

if (totalFailed === 0) {
  console.log('\n🎉 全ての日本語STT誤認識パターンに対応しています！');
} else {
  console.log('\n⚠️  一部の誤認識パターンが未対応です。');
}

// 実際の会話例でのテスト
console.log('\n\n💬 実際の会話例でのテスト');
console.log('================================================================================');

const realConversations = [
  'エンジニア壁の地下に会議質はありますか？',
  '才能カヘとエンジニアカペの違いを教えて',
  'サイのカフェの収集スペースは使えますか？',
  'メーカーズスペースとアンダーすぺーすの場所'
];

console.log('実際に起こりうる会話での補正結果:');
for (const conv of realConversations) {
  const corrected = STTCorrection.correct(conv);
  console.log(`\n入力: "${conv}"`);
  console.log(`補正: "${corrected}"`);
}