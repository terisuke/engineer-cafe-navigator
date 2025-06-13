#!/usr/bin/env tsx

import 'dotenv/config';

async function testEngineerCafeHours() {
  const baseUrl = 'http://localhost:3001'; // ポート3001を使用
  
  console.log('🕒 Testing Engineer Cafe hours queries\n');
  
  const testQueries = [
    'エンジニアカフェの営業時間は？',
    'エンジニアカフェは何時から何時まで？',
    'Engineer Cafe operating hours',
    'カフェの営業時間について教えてください'  // 曖昧なクエリ
  ];
  
  for (const query of testQueries) {
    console.log(`\n📝 Query: "${query}"`);
    
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
          text: query,
          sessionId: 'test-hours-' + Date.now(),
          language: 'ja'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        const responseText = result.response;
        console.log('✅ Response:', responseText);
        
        // Check for correct hours (9:00-22:00)
        const hasCorrectHours = responseText.includes('9:00') && responseText.includes('22:00');
        const hasWrongHours = responseText.includes('10') && responseText.includes('21');
        
        console.log('Contains 9:00-22:00:', hasCorrectHours ? '✅' : '❌');
        if (hasWrongHours) {
          console.log('⚠️  Contains wrong hours (10-21)');
        }
      } else {
        console.log('❌ API Error:', result.error);
      }
      
    } catch (error) {
      console.log('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n✨ Engineer Cafe hours testing completed!');
}

testEngineerCafeHours();