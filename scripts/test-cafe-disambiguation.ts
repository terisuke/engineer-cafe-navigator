#!/usr/bin/env tsx

import 'dotenv/config';

async function testCafeDisambiguation() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🤔 Testing cafe disambiguation logic\n');
  
  const testQueries = [
    {
      query: 'カフェの営業時間は？',
      expected: 'clarification',
      description: 'Ambiguous cafe query'
    },
    {
      query: 'サイノカフェの営業時間は？',
      expected: 'saino-info',
      description: 'Specific Saino cafe query'
    },
    {
      query: 'エンジニアカフェの営業時間は？',
      expected: 'engineer-info',
      description: 'Specific Engineer cafe query'
    },
    {
      query: '併設されてるカフェの営業時間は？',
      expected: 'saino-info',
      description: 'Attached cafe query (should be Saino)'
    },
    {
      query: 'カフェで作業できますか？',
      expected: 'engineer-info',
      description: 'Work-related cafe query (should be Engineer)'
    },
    {
      query: 'cafe hours',
      expected: 'clarification',
      description: 'Ambiguous English query'
    }
  ];
  
  for (const testCase of testQueries) {
    console.log(`\n📝 Testing: "${testCase.query}"`);
    console.log(`Expected: ${testCase.expected} (${testCase.description})`);
    
    try {
      // Set language first
      await fetch(`${baseUrl}/api/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_language',
          language: 'ja'
        })
      });
      
      // Process the query
      const response = await fetch(`${baseUrl}/api/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process_text',
          text: testCase.query,
          sessionId: 'test-disambiguation-' + Date.now(),
          language: 'ja'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        const responseText = result.response;
        
        // Check response type
        let actualType = 'unknown';
        if (responseText.includes('どちらについてお聞きでしょうか') || responseText.includes('Are you asking about')) {
          actualType = 'clarification';
        } else if (responseText.includes('saino') || responseText.includes('サイノ') || responseText.includes('併設')) {
          actualType = 'saino-info';
        } else if (responseText.includes('エンジニアカフェ') && !responseText.includes('サイノ')) {
          actualType = 'engineer-info';
        }
        
        const isCorrect = actualType === testCase.expected;
        console.log(`Result: ${actualType} ${isCorrect ? '✅' : '❌'}`);
        
        if (!isCorrect) {
          console.log(`Response preview: ${responseText.substring(0, 100)}...`);
        }
      } else {
        console.log('❌ API Error:', result.error);
      }
      
    } catch (error) {
      console.log('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✨ Disambiguation testing completed!');
}

testCafeDisambiguation();