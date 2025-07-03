#!/usr/bin/env node

/**
 * Test STT correction patterns
 */

// Simple STT correction implementation for testing
const corrections = [
  {
    patterns: [/才能[\s]*カフェ/gi, /才能[\s]*cafe/gi, /サイノウ[\s]*カフェ/gi],
    replacement: 'サイノカフェ'
  },
  {
    patterns: [/エンジンカフェ/gi, /engineer\s*cafe/gi],
    replacement: 'エンジニアカフェ'
  },
  {
    patterns: [/階下/g],
    replacement: '地下'
  },
  {
    patterns: [/ワイファイ/g],
    replacement: 'Wi-Fi'
  }
];

function correctSTT(text) {
  let corrected = text;
  
  for (const correction of corrections) {
    for (const pattern of correction.patterns) {
      corrected = corrected.replace(pattern, correction.replacement);
    }
  }
  
  // Add period at end if missing
  if (!/[。！？]$/.test(corrected)) {
    corrected += '。';
  }
  
  return corrected;
}

console.log('🎤 Testing STT Correction Patterns');
console.log('================================================================================');

const testCases = [
  { input: 'じゃ 才能 cafeの方で。', expected: 'じゃサイノカフェの方で。' },
  { input: 'サイノウ カフェの営業時間は？', expected: 'サイノカフェの営業時間は？' },
  { input: 'engineer cafeはどこですか？', expected: 'エンジニアカフェはどこですか？' },
  { input: '階下のMTGスペースについて', expected: '地下のMTGスペースについて。' },
  { input: 'ワイファイは使えますか？', expected: 'Wi-Fiは使えますか？' }
];

let passCount = 0;

for (const testCase of testCases) {
  const corrected = correctSTT(testCase.input);
  const passed = corrected === testCase.expected;
  if (passed) passCount++;
  
  console.log(`\nInput: "${testCase.input}"`);
  console.log(`Expected: "${testCase.expected}"`);
  console.log(`Actual: "${corrected}"`);
  console.log(passed ? '✅ PASS' : '❌ FAIL');
}

console.log(`\n================================================================================`);
console.log(`Result: ${passCount}/${testCases.length} tests passed`);

// Test API if available
const http = require('http');

console.log('\n🌐 Testing API Endpoint');
console.log('================================================================================');

const postData = JSON.stringify({
  question: 'サイノカフェの営業時間は？',
  sessionId: `test_${Date.now()}`,
  language: 'ja'
});

const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/api/qa',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('API Response:');
      console.log(`  Status: ${res.statusCode}`);
      console.log(`  Agent: ${response.response?.agentName}`);
      console.log(`  Text preview: ${response.response?.text?.substring(0, 100)}...`);
      
      // Check for emotion tag
      const emotionMatch = response.response?.text?.match(/^\[(\w+)\]/);
      if (emotionMatch) {
        console.log(`  Emotion tag: [${emotionMatch[1]}]`);
        console.log('  ✅ Emotion tag present');
      } else {
        console.log('  ❌ No emotion tag found');
      }
    } catch (e) {
      console.log('❌ Failed to parse response:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.log('⚠️  Cannot connect to server:', e.message);
  console.log('Make sure the dev server is running with: pnpm dev');
});

req.write(postData);
req.end();