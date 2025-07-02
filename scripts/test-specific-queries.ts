import http from 'http';
import { configDotenv } from 'dotenv';
configDotenv({ path: '.env.local' });

function makeRequest(query: string, language: string = 'ja'): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      action: 'ask_question',
      question: query,
      language,
      sessionId: `test-specific-${Date.now()}`,
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

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

async function testSpecificQueries() {
  console.log('🧪 Testing Specific Query Issues\n');
  console.log('=' + '='.repeat(50));

  const tests = [
    {
      name: 'Business Hours (Japanese)',
      query: 'エンジニアカフェの営業時間は？',
      language: 'ja',
      shouldContain: ['9:00', '22:00', '営業時間'],
      shouldNotContain: ['無料', '料金', '施設利用']
    },
    {
      name: 'Wi-Fi (Mixed Language)',
      query: 'Engineer Cafeの無料Wi-Fiはありますか？',
      language: 'ja',
      shouldContain: ['Wi-Fi', '無料', 'インターネット'],
      shouldNotContain: ['9:00', '22:00', '営業時間']
    },
    {
      name: 'Location (English)',
      query: 'Where is Engineer Cafe located?',
      language: 'en',
      shouldContain: ['Fukuoka', 'Tenjin', 'location'],
      shouldNotContain: ['24/7', 'open', 'hours']
    },
    {
      name: 'Calendar Events',
      query: '今日のエンジニアカフェのイベントは？',
      language: 'ja',
      shouldContain: ['イベント', '今日', '開催'],
      shouldNotContain: ['9:00', '22:00', '営業時間']
    }
  ];

  for (const test of tests) {
    console.log(`\n📋 ${test.name}`);
    console.log(`   Query: "${test.query}"`);
    console.log(`   Language: ${test.language}`);
    
    try {
      const result = await makeRequest(test.query, test.language);
      const answer = result.answer || result.response || '';
      const category = result.category || 'unknown';
      
      console.log(`   Category: ${category}`);
      console.log(`   Answer Length: ${answer.length}`);
      
      // Check what the answer contains
      const answerLower = answer.toLowerCase();
      
      // Check for expected content
      const foundExpected = test.shouldContain.filter(pattern => 
        answerLower.includes(pattern.toLowerCase())
      );
      
      if (foundExpected.length > 0) {
        console.log(`   ✅ Found expected: ${foundExpected.join(', ')}`);
      } else {
        console.log(`   ❌ Missing expected: ${test.shouldContain.join(', ')}`);
      }
      
      // Check for unexpected content
      const foundUnexpected = test.shouldNotContain.filter(pattern => 
        answerLower.includes(pattern.toLowerCase())
      );
      
      if (foundUnexpected.length > 0) {
        console.log(`   ⚠️  Found unexpected: ${foundUnexpected.join(', ')}`);
      }
      
      // Show answer preview
      console.log(`   Answer preview: ${answer.substring(0, 150)}...`);
      
      // Debug information
      if (result.debug) {
        console.log(`   Debug info: ${JSON.stringify(result.debug)}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log('\n' + '=' + '='.repeat(50));
  console.log('\nAnalysis Summary:');
  console.log('The system appears to be returning default or incorrect responses.');
  console.log('This suggests issues with:');
  console.log('1. Context filtering not working properly');
  console.log('2. Prompt construction not using the correct context');
  console.log('3. LLM not following the specific request instructions');
}

testSpecificQueries().catch(console.error);