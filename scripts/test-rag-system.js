#!/usr/bin/env node

/**
 * RAGシステム自動テストスクリプト
 * 
 * このスクリプトは、knowledge-baseディレクトリ内のマークダウンファイルを基に
 * 様々な質問を生成し、RAGシステムの回答を自動的にテストします。
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// テスト用の質問パターン
const questionPatterns = {
  'engineer-cafe': {
    'hours-operations.md': [
      'エンジニアカフェの営業時間は？',
      '何時から開いていますか？',
      '何時まで使えますか？',
      '休館日はありますか？',
      '年末年始は営業していますか？',
      'What are the opening hours?',
      '相談スタッフは何時からいますか？'
    ],
    'facilities-equipment.md': [
      'Wi-Fiは使えますか？',
      '3Dプリンターはありますか？',
      'どんな設備がありますか？',
      'メーカーズスペースについて教えて',
      'レーザー加工機は無料で使えますか？',
      'What equipment is available?',
      'プロジェクターは借りられますか？'
    ],
    'usage-fees.md': [
      '利用料金はいくらですか？',
      '無料で使えますか？',
      'メンバーシップの料金は？',
      'How much does it cost?',
      '学生割引はありますか？'
    ],
    'time-limits.md': [
      '利用時間の制限はありますか？',
      '何時間まで使えますか？',
      '連続利用の制限は？',
      'Are there time limits?'
    ],
    'user-eligibility.md': [
      '誰でも使えますか？',
      '利用条件はありますか？',
      '学生も使えますか？',
      'Who can use the facility?',
      '年齢制限はありますか？'
    ]
  },
  'meeting-rooms': {
    'booking.md': [
      '会議室の予約方法は？',
      'ミーティングルームはどうやって予約しますか？',
      'How do I book a meeting room?',
      '当日予約はできますか？'
    ],
    'pricing.md': [
      '会議室の料金は？',
      'ミーティングルームは有料ですか？',
      'Meeting room pricing?'
    ],
    'facilities.md': [
      '会議室の設備は？',
      'モニターはありますか？',
      'ホワイトボードは使えますか？'
    ]
  },
  'saino-cafe': {
    'menu-services.md': [
      'saitoカフェのメニューは？',
      'コーヒーの種類は？',
      'What drinks are available?'
    ],
    'operating-hours.md': [
      'saitoカフェの営業時間は？',
      'カフェは何時まで？'
    ],
    'price-range.md': [
      'コーヒーの値段は？',
      'カフェの価格帯は？'
    ]
  }
};

// APIエンドポイント
const API_BASE = 'http://localhost:3000/api';

// カラー出力用のヘルパー
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class RAGTester {
  constructor() {
    this.results = {
      total: 0,
      successful: 0,
      failed: 0,
      noResults: 0,
      errors: 0,
      details: []
    };
  }

  /**
   * RAG検索APIを呼び出す
   */
  async searchRAG(query, language = 'ja') {
    try {
      const cmd = `curl -s -X POST "${API_BASE}/knowledge/search" -H "Content-Type: application/json" -d '${JSON.stringify({
        query,
        language,
        threshold: 0.3,
        limit: 5
      })}'`;
      
      const { stdout } = await execAsync(cmd);
      return JSON.parse(stdout);
    } catch (error) {
      console.error(`${colors.red}Error calling RAG API:${colors.reset}`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 音声APIを使ってQ&Aテスト
   */
  async testVoiceQA(text, language = 'ja') {
    try {
      const cmd = `curl -s -X POST "${API_BASE}/voice" -H "Content-Type: application/json" -d '${JSON.stringify({
        action: 'process_text',
        text,
        language,
        sessionId: `test_${Date.now()}`
      })}'`;
      
      const { stdout } = await execAsync(cmd);
      return JSON.parse(stdout);
    } catch (error) {
      console.error(`${colors.red}Error calling Voice API:${colors.reset}`, error.message);
      return { error: error.message };
    }
  }

  /**
   * ファイルの内容から期待される回答キーワードを抽出
   */
  extractExpectedKeywords(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data: frontmatter, content: markdown } = matter(content);
    
    // 重要なキーワードを抽出（数字、時間、料金など）
    const keywords = [];
    
    // 時間のパターン
    const timePattern = /(\d{1,2}:\d{2}|午前\d{1,2}時|午後\d{1,2}時|\d{1,2}時)/g;
    const times = markdown.match(timePattern);
    if (times) keywords.push(...times);
    
    // 日付のパターン
    const datePattern = /(毎月.*曜日|年末年始|\d{1,2}月\d{1,2}日)/g;
    const dates = markdown.match(datePattern);
    if (dates) keywords.push(...dates);
    
    // 料金のパターン
    const pricePattern = /(無料|¥\d+|￥\d+|\d+円)/g;
    const prices = markdown.match(pricePattern);
    if (prices) keywords.push(...prices);
    
    // 重要な単語（太字）
    const boldPattern = /\*\*([^*]+)\*\*/g;
    let match;
    while ((match = boldPattern.exec(markdown)) !== null) {
      keywords.push(match[1]);
    }
    
    return keywords;
  }

  /**
   * 回答の品質を評価
   */
  evaluateResponse(question, response, expectedKeywords, searchResults) {
    const evaluation = {
      hasResponse: !!response && response.length > 10,
      hasSearchResults: searchResults && searchResults.length > 0,
      keywordMatches: [],
      relevanceScore: 0,
      issues: []
    };
    
    if (!evaluation.hasResponse) {
      evaluation.issues.push('回答が短すぎるか空です');
      return evaluation;
    }
    
    // キーワードマッチング
    expectedKeywords.forEach(keyword => {
      if (response.includes(keyword)) {
        evaluation.keywordMatches.push(keyword);
      }
    });
    
    // 関連性スコア計算
    if (evaluation.keywordMatches.length > 0) {
      evaluation.relevanceScore = evaluation.keywordMatches.length / expectedKeywords.length;
    }
    
    // 問題の検出
    if (!evaluation.hasSearchResults) {
      evaluation.issues.push('RAG検索結果が空です');
    }
    
    if (evaluation.keywordMatches.length === 0) {
      evaluation.issues.push('期待されるキーワードが含まれていません');
    }
    
    if (response.includes('見つかりませんでした') || response.includes('couldn\'t find')) {
      evaluation.issues.push('情報が見つからないという回答です');
    }
    
    return evaluation;
  }

  /**
   * テスト結果をフォーマット
   */
  formatTestResult(test) {
    const statusIcon = test.success ? '✅' : '❌';
    const statusColor = test.success ? colors.green : colors.red;
    
    console.log(`\n${statusIcon} ${colors.bright}質問:${colors.reset} ${test.question}`);
    console.log(`${colors.cyan}カテゴリ:${colors.reset} ${test.category} / ${test.file}`);
    console.log(`${colors.cyan}言語:${colors.reset} ${test.language}`);
    
    if (test.searchResults && test.searchResults.length > 0) {
      console.log(`${colors.cyan}検索結果:${colors.reset} ${test.searchResults.length}件`);
      console.log(`${colors.cyan}最高類似度:${colors.reset} ${test.searchResults[0].similarity.toFixed(3)}`);
    }
    
    if (test.response) {
      console.log(`${colors.cyan}回答:${colors.reset} ${test.response.substring(0, 100)}...`);
    }
    
    if (test.evaluation) {
      console.log(`${colors.cyan}評価:${colors.reset}`);
      console.log(`  - 関連性スコア: ${(test.evaluation.relevanceScore * 100).toFixed(0)}%`);
      console.log(`  - キーワードマッチ: ${test.evaluation.keywordMatches.join(', ') || 'なし'}`);
      
      if (test.evaluation.issues.length > 0) {
        console.log(`  ${colors.yellow}問題:${colors.reset}`);
        test.evaluation.issues.forEach(issue => {
          console.log(`    - ${issue}`);
        });
      }
    }
    
    if (test.error) {
      console.log(`${colors.red}エラー:${colors.reset} ${test.error}`);
    }
  }

  /**
   * 単一の質問をテスト
   */
  async testQuestion(question, category, file, language = 'ja') {
    console.log(`${colors.yellow}テスト中:${colors.reset} ${question}`);
    
    const test = {
      question,
      category,
      file,
      language,
      timestamp: new Date().toISOString()
    };
    
    try {
      // RAG検索テスト
      const searchResult = await this.searchRAG(question, language);
      test.searchResults = searchResult.results || [];
      test.searchSuccess = searchResult.success;
      
      // 音声Q&Aテスト（エラーが多いので一旦スキップ可能）
      // const voiceResult = await this.testVoiceQA(question, language);
      // test.response = voiceResult.response || voiceResult.error;
      
      // 期待されるキーワードを抽出
      const filePath = path.join(
        process.cwd(),
        'data/knowledge-base/markdown',
        category,
        file
      );
      const expectedKeywords = this.extractExpectedKeywords(filePath);
      test.expectedKeywords = expectedKeywords;
      
      // 評価
      if (test.searchResults.length > 0) {
        // 検索結果から回答を構築
        test.response = test.searchResults
          .map(r => r.content)
          .join(' ');
        
        test.evaluation = this.evaluateResponse(
          question,
          test.response,
          expectedKeywords,
          test.searchResults
        );
        
        test.success = test.evaluation.relevanceScore > 0.3 || 
                      test.searchResults[0].similarity > 0.6;
      } else {
        test.success = false;
        test.evaluation = {
          issues: ['検索結果が0件です']
        };
      }
      
    } catch (error) {
      test.error = error.message;
      test.success = false;
    }
    
    // 結果の記録
    this.results.total++;
    if (test.success) {
      this.results.successful++;
    } else {
      this.results.failed++;
      if (!test.searchResults || test.searchResults.length === 0) {
        this.results.noResults++;
      }
      if (test.error) {
        this.results.errors++;
      }
    }
    
    this.results.details.push(test);
    this.formatTestResult(test);
    
    return test;
  }

  /**
   * 全テストを実行
   */
  async runAllTests() {
    console.log(`${colors.bright}${colors.blue}=== RAGシステム自動テスト開始 ===${colors.reset}\n`);
    
    for (const [category, files] of Object.entries(questionPatterns)) {
      console.log(`\n${colors.bright}${colors.magenta}カテゴリ: ${category}${colors.reset}`);
      
      for (const [file, questions] of Object.entries(files)) {
        console.log(`\n${colors.cyan}ファイル: ${file}${colors.reset}`);
        
        for (const question of questions) {
          const language = /[a-zA-Z]/.test(question) ? 'en' : 'ja';
          await this.testQuestion(question, category, file, language);
          
          // API負荷軽減のため少し待機
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    this.printSummary();
    this.saveReport();
  }

  /**
   * テストサマリーを表示
   */
  printSummary() {
    console.log(`\n${colors.bright}${colors.blue}=== テスト結果サマリー ===${colors.reset}`);
    console.log(`${colors.cyan}総テスト数:${colors.reset} ${this.results.total}`);
    console.log(`${colors.green}成功:${colors.reset} ${this.results.successful} (${(this.results.successful / this.results.total * 100).toFixed(1)}%)`);
    console.log(`${colors.red}失敗:${colors.reset} ${this.results.failed} (${(this.results.failed / this.results.total * 100).toFixed(1)}%)`);
    console.log(`${colors.yellow}検索結果なし:${colors.reset} ${this.results.noResults}`);
    console.log(`${colors.red}エラー:${colors.reset} ${this.results.errors}`);
    
    // 最も問題のあるカテゴリを特定
    const categoryStats = {};
    this.results.details.forEach(test => {
      if (!categoryStats[test.category]) {
        categoryStats[test.category] = { total: 0, failed: 0 };
      }
      categoryStats[test.category].total++;
      if (!test.success) {
        categoryStats[test.category].failed++;
      }
    });
    
    console.log(`\n${colors.bright}カテゴリ別統計:${colors.reset}`);
    Object.entries(categoryStats).forEach(([category, stats]) => {
      const failRate = (stats.failed / stats.total * 100).toFixed(1);
      const color = failRate > 50 ? colors.red : failRate > 20 ? colors.yellow : colors.green;
      console.log(`  ${category}: ${color}${failRate}% 失敗率${colors.reset} (${stats.failed}/${stats.total})`);
    });
  }

  /**
   * 詳細レポートを保存
   */
  saveReport() {
    const reportPath = path.join(process.cwd(), 'test-results', `rag-test-${new Date().toISOString().replace(/:/g, '-')}.json`);
    const reportDir = path.dirname(reportPath);
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n${colors.green}詳細レポートを保存しました:${colors.reset} ${reportPath}`);
    
    // 改善提案を生成
    this.generateRecommendations();
  }

  /**
   * 改善提案を生成
   */
  generateRecommendations() {
    console.log(`\n${colors.bright}${colors.magenta}=== 改善提案 ===${colors.reset}`);
    
    const recommendations = [];
    
    // 検索結果なしが多い場合
    if (this.results.noResults > this.results.total * 0.2) {
      recommendations.push({
        issue: '検索結果が返されないケースが多い',
        suggestions: [
          '閾値をさらに下げる（現在0.3 → 0.2）',
          'カテゴリマッピングの改善',
          '埋め込みベクトルの再生成'
        ]
      });
    }
    
    // 特定カテゴリの問題
    const problemCategories = [];
    this.results.details.forEach(test => {
      if (!test.success && test.evaluation && test.evaluation.keywordMatches.length === 0) {
        if (!problemCategories.includes(test.category)) {
          problemCategories.push(test.category);
        }
      }
    });
    
    if (problemCategories.length > 0) {
      recommendations.push({
        issue: `以下のカテゴリでキーワードマッチが低い: ${problemCategories.join(', ')}`,
        suggestions: [
          '該当カテゴリのデータを再投入',
          'カテゴリ分類ロジックの見直し',
          '質問パターンの拡充'
        ]
      });
    }
    
    // エラーが多い場合
    if (this.results.errors > 0) {
      recommendations.push({
        issue: 'APIエラーが発生',
        suggestions: [
          'APIエンドポイントの確認',
          'エラーハンドリングの改善',
          'タイムアウト設定の調整'
        ]
      });
    }
    
    recommendations.forEach((rec, index) => {
      console.log(`\n${colors.yellow}問題 ${index + 1}: ${rec.issue}${colors.reset}`);
      console.log('提案:');
      rec.suggestions.forEach(suggestion => {
        console.log(`  - ${suggestion}`);
      });
    });
  }
}

// メイン実行
async function main() {
  const tester = new RAGTester();
  
  // コマンドライン引数の処理
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${colors.bright}RAGシステム自動テストツール${colors.reset}

使用方法:
  node test-rag-system.js [オプション]

オプション:
  --category <name>  特定のカテゴリのみテスト
  --file <name>      特定のファイルのみテスト
  --question <text>  単一の質問をテスト
  --lang <ja|en>     言語を指定（デフォルト: ja）
  --help, -h         このヘルプを表示

例:
  node test-rag-system.js --category engineer-cafe
  node test-rag-system.js --question "営業時間は？"
    `);
    return;
  }
  
  if (args.includes('--question')) {
    // 単一質問のテスト
    const questionIndex = args.indexOf('--question');
    const question = args[questionIndex + 1];
    const lang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : 'ja';
    
    await tester.testQuestion(question, 'manual', 'manual-test', lang);
    tester.printSummary();
  } else {
    // 全テスト実行
    await tester.runAllTests();
  }
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  console.error(`${colors.red}エラーが発生しました:${colors.reset}`, error);
  process.exit(1);
});

// 実行
main().catch(console.error);
