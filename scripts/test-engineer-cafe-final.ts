#!/usr/bin/env tsx

import 'dotenv/config';

async function testEngineerCafeFinal() {
  const baseUrl = 'http://localhost:3001';
  
  console.log('🏢 Testing Engineer Cafe hours (final test)\n');
  
  const query = 'エンジニア カフェの営業時間は？';
  console.log(`Query: "${query}"`);
  
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
        sessionId: 'test-final-' + Date.now(),
        language: 'ja'
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      const responseText = result.response;
      console.log('\n✅ Response received:');
      console.log(responseText);
      
      // Check for correct hours
      const hasCorrectHours = responseText.includes('9:00') && responseText.includes('22:00');
      const hasWrongHours = responseText.includes('10') && responseText.includes('21') && !responseText.includes('13:00〜21:00');
      
      console.log('\n📊 Analysis:');
      console.log('Contains correct hours (9:00-22:00):', hasCorrectHours ? '✅' : '❌');
      console.log('Contains wrong hours (10-21):', hasWrongHours ? '⚠️' : '✅');
      
      if (hasCorrectHours) {
        console.log('\n🎉 SUCCESS: エンジニアカフェの正しい営業時間が返されました！');
      } else {
        console.log('\n⚠️  Still needs improvement: 正しい営業時間が含まれていません');
      }
    } else {
      console.log('❌ API Error:', result.error);
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
  }
}

testEngineerCafeFinal();