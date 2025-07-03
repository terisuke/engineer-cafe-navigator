#!/usr/bin/env tsx

/**
 * isShortContextQueryのテスト
 */

function isShortContextQuery(query: string): boolean {
  const trimmed = query.trim();
  
  // Short queries that likely depend on context
  const contextPatterns = [
    /^土曜[日]?は.*/,          // 土曜日は... 土曜は...
    /^日曜[日]?は.*/,          // 日曜日は... 日曜は...
    /^平日は.*/,               // 平日は...
    /^saino[のは方]?.*/,       // sainoの方は... sainoは...
    /^そっち[のは]?.*/,        // そっちの方は... そっちは...
    /^あっち[のは]?.*/,        // あっちの方は... あっちは...
    /^それ[のは]?.*/,          // それの方は... それは...
    /^そこ[のは]?.*/,          // そこの方は... そこは...
  ];
  
  return contextPatterns.some(pattern => pattern.test(trimmed)) || trimmed.length < 10;
}

console.log('🔍 isShortContextQuery テスト');
console.log('================================================================================\n');

const testCases = [
  '営業時間は？',
  'サイノカフェの方で。',
  '土曜日は？',
  'そっちの方は？',
  'エンジニアカフェの営業時間を教えて',
  'サイノカフェの営業時間は？',
  '何時から？',
  '料金は？',
  '場所は？'
];

console.log('テスト結果:');
testCases.forEach(query => {
  const result = isShortContextQuery(query);
  const length = query.length;
  console.log(`  "${query}" (長さ: ${length}) → ${result ? '✅ SHORT' : '❌ NOT SHORT'}`);
});

console.log('\n分析:');
console.log('- "営業時間は？"（長さ: 6）は10文字未満なので SHORT と判定される ✅');
console.log('- つまり、isShortContextQuery は正しく動作している');

console.log('\n================================================================================');