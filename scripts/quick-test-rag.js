#!/usr/bin/env node

/**
 * RAGシステム簡易テストスクリプト
 * 基本的な質問でRAGシステムの動作を素早く確認
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const API_BASE = 'http://localhost:3000/api';

// テスト質問セット
const testQuestions = [
  // 営業時間関連
  { query: 'エンジニアカフェの営業時間は？', expectedKeywords: ['9:00', '22:00', '9時', '22時'] },
  { query: '何時から開いていますか？', expectedKeywords: ['9:00', '9時'] },
  { query: '休館日はありますか？', expectedKeywords: ['最終月曜日', '年末年始'] },
  
  // 施設・設備関連
  { query: 'Wi-Fiは使えますか？', expectedKeywords: ['無料Wi-Fi', 'Wi-Fi', '無料'] },
  { query: '3Dプリンターはありますか？', expectedKeywords: ['3Dプリンター', 'デジタル工作', 'メーカーズスペース'] },
  
  // 料金関連
  { query: '利用料金はいくらですか？', expectedKeywords: ['無料', '完全無料'] },
  { query: 'メンバーシップの料金は？', expectedKeywords: ['無料'] },
  
  // 会議室関連
  { query: '会議室の予約方法は？', expectedKeywords: ['予約', '会議室', 'ミーティングルーム'] },
  
  // カフェ関連
  { query: 'カフェはありますか？', expectedKeywords: ['saitoカフェ', 'カフェ'] }
];

// カラー出力
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function testRAGSearch(query, expectedKeywords = []) {
  console.log(`\n${colors.cyan}質問: ${query}${colors.reset}`);
  
  try {
    // RAG検索実行
    const cmd = `curl -s -X POST "${API_BASE}/knowledge/search" \
      -H "Content-Type: application/json" \
      -d '${JSON.stringify({
        query,
        language: 'ja',
        threshold: 0.3,
        limit: 3
      })}'`;
    
    const { stdout } = await execAsync(cmd);
    const result = JSON.parse(stdout);
    
    if (result.success && result.results && result.results.length > 0) {
      console.log(`${colors.green}✓ 検索結果: ${result.results.length}件${colors.reset}`);
      
      // トップ結果を表示
      const top = result.results[0];
      console.log(`  最高類似度: ${top.similarity.toFixed(3)}`);
      console.log(`  コンテンツ: ${top.content.substring(0, 80)}...`);
      
      // キーワードチェック
      if (expectedKeywords.length > 0) {
        const foundKeywords = expectedKeywords.filter(kw => 
          result.results.some(r => r.content.includes(kw))
        );
        
        if (foundKeywords.length > 0) {
          console.log(`  ${colors.green}✓ キーワード: ${foundKeywords.join(', ')}${colors.reset}`);
        } else {
          console.log(`  ${colors.yellow}⚠ 期待されるキーワードが見つかりません${colors.reset}`);
        }
      }
      
      return { success: true, results: result.results };
    } else {
      console.log(`${colors.red}✗ 検索結果なし${colors.reset}`);
      return { success: false, error: 'No results' };
    }
  } catch (error) {
    console.log(`${colors.red}✗ エラー: ${error.message}${colors.reset}`);
    return { success: false, error: error.message };
  }
}

async function testDatabaseStatus() {
  console.log(`\n${colors.bright}${colors.blue}=== データベース状態確認 ===${colors.reset}`);
  
  try {
    // 管理APIでデータ数を確認
    const { stdout } = await execAsync(`curl -s "${API_BASE}/admin/knowledge"`);
    const result = JSON.parse(stdout);
    
    console.log(`総レコード数: ${result.total || 0}`);
    
    if (result.data && result.data.length > 0) {
      // カテゴリ別集計
      const categories = {};
      result.data.forEach(item => {
        const cat = item.category || 'unknown';
        categories[cat] = (categories[cat] || 0) + 1;
      });
      
      console.log('カテゴリ別:');
      Object.entries(categories).forEach(([cat, count]) => {
        console.log(`  - ${cat}: ${count}件`);
      });
    }
    
    return result.total || 0;
  } catch (error) {
    console.log(`${colors.red}データベース確認エラー: ${error.message}${colors.reset}`);
    return 0;
  }
}

async function runQuickTest() {
  console.log(`${colors.bright}${colors.blue}=== RAGシステム簡易テスト ===${colors.reset}`);
  console.log(`API: ${API_BASE}`);
  console.log(`時刻: ${new Date().toISOString()}`);
  
  // データベース状態確認
  const totalRecords = await testDatabaseStatus();
  
  if (totalRecords === 0) {
    console.log(`\n${colors.red}⚠️  データベースが空です！${colors.reset}`);
    console.log('データを投入してから再度テストしてください。');
    return;
  }
  
  // テスト実行
  console.log(`\n${colors.bright}${colors.blue}=== 質問テスト開始 ===${colors.reset}`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const test of testQuestions) {
    const result = await testRAGSearch(test.query, test.expectedKeywords);
    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // API負荷軽減
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  // サマリー表示
  console.log(`\n${colors.bright}${colors.blue}=== テスト結果 ===${colors.reset}`);
  console.log(`${colors.green}成功: ${successCount}/${testQuestions.length}${colors.reset}`);
  console.log(`${colors.red}失敗: ${failCount}/${testQuestions.length}${colors.reset}`);
  console.log(`成功率: ${(successCount / testQuestions.length * 100).toFixed(1)}%`);
  
  if (failCount > testQuestions.length * 0.3) {
    console.log(`\n${colors.yellow}⚠️  改善が必要です${colors.reset}`);
    console.log('提案:');
    console.log('  1. 閾値を0.2に下げる');
    console.log('  2. マークダウンファイルの内容をデータベースに追加投入');
    console.log('  3. カテゴリ分類の改善');
  } else {
    console.log(`\n${colors.green}✓ RAGシステムは正常に動作しています${colors.reset}`);
  }
}

// 単一質問テストモード
if (process.argv.length > 2) {
  const query = process.argv.slice(2).join(' ');
  console.log(`${colors.bright}単一質問テストモード${colors.reset}`);
  testRAGSearch(query).then(() => process.exit(0));
} else {
  // 全体テスト
  runQuickTest().catch(console.error);
}
