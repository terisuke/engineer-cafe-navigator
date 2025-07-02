import http from 'http';
import { configDotenv } from 'dotenv';
configDotenv({ path: '.env.local' });

interface TestResult {
  category: string;
  scenario: string;
  query: string;
  expectedPatterns: string[];
  actualAnswer: string;
  passed: boolean;
  duration: number;
  error?: string;
}

function makeRequest(query: string, language: string = 'ja', sessionId?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      action: 'ask_question',
      question: query,
      language,
      sessionId: sessionId || `test-${Date.now()}`,
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/qa',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Parse error: ${data.substring(0, 100)}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

async function testQuery(
  category: string,
  scenario: string,
  query: string,
  expectedPatterns: string[],
  language: 'ja' | 'en' = 'ja',
  sessionId?: string
): Promise<TestResult> {
  console.log(`\n🧪 Testing: ${scenario}`);
  console.log(`   Query: ${query}`);
  
  const startTime = Date.now();
  
  try {
    const response = await makeRequest(query, language, sessionId);
    const answer = response.answer || response.response || '';
    const duration = Date.now() - startTime;
    
    const foundPatterns = expectedPatterns.filter(pattern => 
      answer.toLowerCase().includes(pattern.toLowerCase())
    );
    
    const passed = foundPatterns.length > 0;
    
    if (passed) {
      console.log(`   ✅ PASS (${duration}ms) - Found: ${foundPatterns.join(', ')}`);
    } else {
      console.log(`   ❌ FAIL (${duration}ms)`);
      console.log(`   Expected: ${expectedPatterns.join(', ')}`);
      console.log(`   Got: ${answer.substring(0, 100)}...`);
    }
    
    return {
      category,
      scenario,
      query,
      expectedPatterns,
      actualAnswer: answer,
      passed,
      duration,
    };
  } catch (error) {
    console.log(`   ❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      category,
      scenario,
      query,
      expectedPatterns,
      actualAnswer: '',
      passed: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function runComprehensiveTests() {
  console.log('🚀 Engineer Cafe Navigator - Final Comprehensive Test Suite\n');
  console.log('Testing all required features:');
  console.log('1. RAG Search (Knowledge Base)');
  console.log('2. Japanese/English Support');
  console.log('3. Short-term Memory');
  console.log('4. Calendar Integration');
  console.log('5. Web Search Integration\n');
  console.log('=' + '='.repeat(60));

  const results: TestResult[] = [];
  
  // 1. RAG Search Tests
  console.log('\n📚 1. RAG Search (Knowledge Base) Tests');
  console.log('-'.repeat(60));
  
  results.push(await testQuery(
    'RAG Search',
    'Engineer Cafe business hours',
    'エンジニアカフェの営業時間は？',
    ['9:00', '22:00']
  ));

  results.push(await testQuery(
    'RAG Search',
    'Saino cafe pricing',
    'sainoカフェの料金を教えて',
    ['saino', '料金', '円']
  ));

  results.push(await testQuery(
    'RAG Search',
    'Basement facilities',
    '地下のスペースについて教えて',
    ['地下', 'スペース', '会議室', 'ミーティング']
  ));

  results.push(await testQuery(
    'RAG Search',
    'Red brick building info',
    '赤レンガ文化館について',
    ['赤レンガ', '文化館', '歴史']
  ));

  // 2. Japanese/English Support Tests
  console.log('\n🌐 2. Japanese/English Support Tests');
  console.log('-'.repeat(60));
  
  results.push(await testQuery(
    'Multi-language',
    'English business hours',
    'What time does Engineer Cafe open?',
    ['9:00', '22:00', 'open'],
    'en'
  ));

  results.push(await testQuery(
    'Multi-language',
    'English location query',
    'Where is Engineer Cafe located?',
    ['Fukuoka', 'Tenjin', 'Red Brick'],
    'en'
  ));

  results.push(await testQuery(
    'Multi-language',
    'Mixed language query',
    'Engineer Cafeの無料Wi-Fiはありますか？',
    ['Wi-Fi', '無料', 'free', 'インターネット']
  ));

  // 3. Short-term Memory Tests
  console.log('\n🧠 3. Short-term Memory Tests');
  console.log('-'.repeat(60));
  
  const memorySession = `memory-${Date.now()}`;
  
  // Ask initial question
  results.push(await testQuery(
    'Memory',
    'Initial question about hours',
    'エンジニアカフェは何時から開いていますか？',
    ['9:00', '営業', '開'],
    'ja',
    memorySession
  ));

  // Test memory recall
  results.push(await testQuery(
    'Memory',
    'Recall previous question',
    'さっき何を聞いた？',
    ['営業時間', '何時', '開いて', '聞いた'],
    'ja',
    memorySession
  ));

  // Ask follow-up
  results.push(await testQuery(
    'Memory',
    'Follow-up question',
    '土曜日も同じ時間？',
    ['土曜', '同じ', '営業', '9:00'],
    'ja',
    memorySession
  ));

  // 4. Calendar Integration Tests
  console.log('\n📅 4. Calendar Integration Tests');
  console.log('-'.repeat(60));
  
  results.push(await testQuery(
    'Calendar',
    'Today\'s events',
    '今日のエンジニアカフェのイベントは？',
    ['今日', 'イベント', '開催', 'セミナー', 'ワークショップ']
  ));

  results.push(await testQuery(
    'Calendar',
    'This week\'s schedule',
    '今週の勉強会の予定を教えて',
    ['今週', '勉強会', '予定', 'イベント']
  ));

  // 5. Web Search Integration Tests
  console.log('\n🔍 5. Web Search Integration Tests');
  console.log('-'.repeat(60));
  
  results.push(await testQuery(
    'Web Search',
    'Latest AI developments',
    '最新のAI開発について教えて',
    ['AI', '最新', '開発', '技術', 'GPT']
  ));

  results.push(await testQuery(
    'Web Search',
    'Fukuoka tech scene',
    '福岡のスタートアップ情報',
    ['福岡', 'スタートアップ', '企業', 'ベンチャー']
  ));

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL TEST RESULTS\n');
  
  const features = {
    'RAG Search': results.filter(r => r.category === 'RAG Search'),
    'Multi-language': results.filter(r => r.category === 'Multi-language'),
    'Memory': results.filter(r => r.category === 'Memory'),
    'Calendar': results.filter(r => r.category === 'Calendar'),
    'Web Search': results.filter(r => r.category === 'Web Search')
  };

  Object.entries(features).forEach(([feature, tests]) => {
    const passed = tests.filter(t => t.passed).length;
    const status = passed === tests.length ? '✅' : '❌';
    console.log(`${status} ${feature}: ${passed}/${tests.length} tests passed`);
  });

  const totalPassed = results.filter(r => r.passed).length;
  const totalTests = results.length;
  const successRate = ((totalPassed / totalTests) * 100).toFixed(1);
  
  console.log(`\n📈 Overall Success Rate: ${successRate}% (${totalPassed}/${totalTests})`);
  
  // Performance metrics
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const maxDuration = Math.max(...results.map(r => r.duration));
  const minDuration = Math.min(...results.map(r => r.duration));
  
  console.log('\n⏱️  Performance Metrics:');
  console.log(`   Average response time: ${avgDuration.toFixed(0)}ms`);
  console.log(`   Fastest response: ${minDuration}ms`);
  console.log(`   Slowest response: ${maxDuration}ms`);

  // Failed tests details
  const failedTests = results.filter(r => !r.passed);
  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests Details:');
    failedTests.forEach(test => {
      console.log(`\n   ${test.scenario}:`);
      console.log(`   Query: ${test.query}`);
      console.log(`   Expected: ${test.expectedPatterns.join(', ')}`);
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      } else {
        console.log(`   Actual: ${test.actualAnswer.substring(0, 100)}...`);
      }
    });
  }

  // System status
  console.log('\n🏁 SYSTEM STATUS:');
  if (successRate === '100.0') {
    console.log('✅ All systems operational! The Engineer Cafe Navigator is working perfectly.');
  } else if (parseFloat(successRate) >= 80) {
    console.log('⚠️  System is mostly functional but some features need attention.');
  } else {
    console.log('❌ System has significant issues that need to be addressed.');
  }
}

runComprehensiveTests().catch(console.error);