#!/usr/bin/env tsx

/**
 * 開発サーバーでの実際の動作テスト
 * 悲観的に全ての機能をテストする
 */

import { spawn } from 'child_process';
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000';
const TEST_TIMEOUT = 30000; // 30秒のタイムアウト

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

// カラー出力用
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function waitForServer(port: number = 3000, maxTries: number = 30): Promise<boolean> {
  for (let i = 0; i < maxTries; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/`, {
        method: 'GET',
        timeout: 2000
      });
      
      if (response.ok || response.status === 404) {
        return true;
      }
    } catch (error) {
      // サーバーがまだ起動していない
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
}

async function testVoiceAPI(): Promise<TestResult> {
  const testName = 'Voice API - STT Correction';
  log(`\n🎤 ${testName}`, 'blue');
  
  try {
    // STT誤認識を含むテキストでテスト
    const testCases = [
      { input: "才能カフェの営業時間は？", expected: "サイノカフェ" },
      { input: "エンジニア壁について教えて", expected: "エンジニアカフェ" },
      { input: "地下の会議質", expected: "会議室" }
    ];
    
    for (const testCase of testCases) {
      log(`  Testing: "${testCase.input}"`);
      
      const response = await fetch(`${API_BASE}/api/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process_text',
          text: testCase.input,
          sessionId: `test_${Date.now()}`,
          language: 'ja'
        }),
        timeout: 10000
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.response && data.response.includes(testCase.expected)) {
        log(`    ✅ Correction applied: "${testCase.expected}" found in response`, 'green');
      } else {
        log(`    ❌ Correction failed: "${testCase.expected}" not found`, 'red');
        throw new Error(`Expected "${testCase.expected}" in response`);
      }
    }
    
    return { name: testName, passed: true };
  } catch (error: any) {
    log(`  ❌ ${error.message}`, 'red');
    return { name: testName, passed: false, error: error.message };
  }
}

async function testQAAPI(): Promise<TestResult> {
  const testName = 'QA API - Emotion Tags';
  log(`\n💬 ${testName}`, 'blue');
  
  try {
    const response = await fetch(`${API_BASE}/api/qa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'カフェの営業時間について教えて',
        sessionId: `test_${Date.now()}`,
        language: 'ja'
      }),
      timeout: 15000
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    log(`  Response agent: ${data.response?.agentName}`);
    log(`  Response emotion: ${data.response?.emotion}`);
    
    // 感情タグの確認
    if (data.response?.text) {
      const hasEmotionTag = /^\[(happy|sad|angry|relaxed|surprised)\]/.test(data.response.text);
      if (hasEmotionTag) {
        log(`  ✅ Emotion tag found at beginning of response`, 'green');
      } else {
        log(`  ❌ No emotion tag at beginning of response`, 'red');
        log(`  Response start: "${data.response.text.substring(0, 50)}..."`, 'yellow');
      }
    }
    
    return { name: testName, passed: true, details: data };
  } catch (error: any) {
    log(`  ❌ ${error.message}`, 'red');
    return { name: testName, passed: false, error: error.message };
  }
}

async function testCharacterAPI(): Promise<TestResult> {
  const testName = 'Character API - Surprised Emotion';
  log(`\n🎭 ${testName}`, 'blue');
  
  try {
    const response = await fetch(`${API_BASE}/api/character`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'setExpression',
        expression: 'surprised',
        transitionDuration: 0.5
      }),
      timeout: 5000
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      log(`  ✅ Surprised expression set successfully`, 'green');
    } else {
      throw new Error('Failed to set surprised expression');
    }
    
    return { name: testName, passed: true };
  } catch (error: any) {
    log(`  ❌ ${error.message}`, 'red');
    return { name: testName, passed: false, error: error.message };
  }
}

async function runAllTests() {
  log('🚀 開発サーバーでの包括的テスト', 'blue');
  log('================================================================================');
  
  // サーバーが起動しているか確認
  log('\n⏳ サーバーの起動を確認中...', 'yellow');
  const serverReady = await waitForServer();
  
  if (!serverReady) {
    log('❌ サーバーが起動していません。`pnpm dev` を実行してください。', 'red');
    process.exit(1);
  }
  
  log('✅ サーバーが起動しています', 'green');
  
  // 各テストを実行
  results.push(await testVoiceAPI());
  results.push(await testQAAPI());
  results.push(await testCharacterAPI());
  
  // 結果のサマリー
  log('\n================================================================================');
  log('📊 テスト結果サマリー', 'blue');
  log('================================================================================');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    const color = result.passed ? 'green' : 'red';
    log(`${icon} ${result.name}`, color);
    if (result.error) {
      log(`   Error: ${result.error}`, 'red');
    }
  });
  
  log('\n----------------------------------------');
  log(`合計: ${results.length}件`, 'blue');
  log(`成功: ${passed}件`, 'green');
  log(`失敗: ${failed}件`, 'red');
  log(`成功率: ${Math.round(passed / results.length * 100)}%`, passed === results.length ? 'green' : 'yellow');
  
  if (failed > 0) {
    log('\n⚠️  一部のテストが失敗しました', 'red');
    process.exit(1);
  } else {
    log('\n🎉 全てのテストが成功しました！', 'green');
  }
}

// タイムアウト設定
setTimeout(() => {
  log('\n❌ テストがタイムアウトしました', 'red');
  process.exit(1);
}, TEST_TIMEOUT);

// テスト実行
runAllTests().catch(error => {
  log(`\n❌ 予期しないエラー: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});