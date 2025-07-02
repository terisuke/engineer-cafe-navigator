import http from 'http';
import { configDotenv } from 'dotenv';
configDotenv({ path: '.env.local' });

function makeRequest(query: string, language?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      action: 'ask_question',
      question: query,
      language: language,
      sessionId: `test-wifi-${Date.now()}`,
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

async function testWiFiQueries() {
  console.log('🧪 Testing Wi-Fi related queries\n');
  console.log('=' + '='.repeat(50));

  const queries = [
    {
      text: 'エンジニアカフェに無料Wi-Fiはありますか？',
      language: 'ja',
      expected: ['Wi-Fi', '無料', 'インターネット', 'ネット'],
      description: 'Japanese Wi-Fi query'
    },
    {
      text: 'Engineer Cafeの無料Wi-Fiはありますか？',
      language: undefined, // 言語自動検出
      expected: ['Wi-Fi', '無料', 'インターネット', 'ネット'],
      description: 'Mixed language Wi-Fi query (auto-detect)'
    },
    {
      text: 'Engineer Cafeの無料Wi-Fiはありますか？',
      language: 'ja',
      expected: ['Wi-Fi', '無料', 'インターネット', 'ネット'],
      description: 'Mixed language Wi-Fi query (explicit ja)'
    },
    {
      text: 'Is there free Wi-Fi at Engineer Cafe?',
      language: 'en',
      expected: ['Wi-Fi', 'free', 'internet', 'wireless'],
      description: 'English Wi-Fi query'
    },
    {
      text: 'Wi-Fiについて教えて',
      language: 'ja',
      expected: ['Wi-Fi', 'インターネット', 'ネット', '接続'],
      description: 'Simple Japanese Wi-Fi query'
    }
  ];

  for (const query of queries) {
    console.log(`\n📋 ${query.description}`);
    console.log(`   Query: "${query.text}"`);
    if (query.language) {
      console.log(`   Language: ${query.language}`);
    }
    
    try {
      const result = await makeRequest(query.text, query.language);
      const answer = result.answer || result.response || '';
      
      console.log(`   Category: ${result.category || 'unknown'}`);
      console.log(`   Answer: ${answer.substring(0, 150)}...`);
      
      const foundPatterns = query.expected.filter(pattern => 
        answer.toLowerCase().includes(pattern.toLowerCase())
      );
      
      if (foundPatterns.length > 0) {
        console.log(`   ✅ Found: ${foundPatterns.join(', ')}`);
      } else {
        console.log(`   ❌ Expected one of: ${query.expected.join(', ')}`);
        console.log(`   But got information about: ${detectTopic(answer)}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log('\n' + '=' + '='.repeat(50));
}

function detectTopic(answer: string): string {
  if (answer.includes('営業時間') || answer.includes('9:00') || answer.includes('22:00')) {
    return 'business hours';
  }
  if (answer.includes('Wi-Fi') || answer.includes('インターネット')) {
    return 'Wi-Fi/internet';
  }
  if (answer.includes('場所') || answer.includes('アクセス') || answer.includes('location')) {
    return 'location';
  }
  if (answer.includes('料金') || answer.includes('無料') || answer.includes('price')) {
    return 'pricing';
  }
  return 'other';
}

testWiFiQueries().catch(console.error);