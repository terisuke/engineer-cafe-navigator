#!/usr/bin/env tsx

import 'dotenv/config';

async function testVoiceCafeQuery() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🎤 Testing voice API with cafe query\n');
  
  try {
    // 1. Set language to Japanese
    console.log('1. Setting language to Japanese...');
    const langResponse = await fetch(`${baseUrl}/api/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'set_language',
        language: 'ja'
      })
    });
    const langResult = await langResponse.json();
    console.log('Language set:', langResult.success ? '✅' : '❌');
    
    // 2. Process text query about cafe hours
    console.log('\n2. Asking about cafe hours...');
    const query = '併設されてるカフェの営業時間について教えてください';
    console.log('Query:', query);
    
    const voiceResponse = await fetch(`${baseUrl}/api/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'process_text',
        text: query,
        sessionId: 'test-session-' + Date.now(),
        language: 'ja'
      })
    });
    
    const voiceResult = await voiceResponse.json();
    
    if (voiceResult.success) {
      console.log('\n✅ Response received:');
      console.log('Response:', voiceResult.response);
      console.log('\nEmotion:', voiceResult.emotion?.emotion || 'none');
      
      // Check if the response mentions Saino Cafe
      const hasSainoInfo = voiceResult.response.includes('saino') || 
                          voiceResult.response.includes('サイノ') ||
                          voiceResult.response.includes('12:00') ||
                          voiceResult.response.includes('20:30');
      
      console.log('\nContains Saino Cafe info:', hasSainoInfo ? '✅' : '❌');
      
      if (!hasSainoInfo) {
        console.log('\n⚠️  Response does not contain specific Saino Cafe hours');
      }
    } else {
      console.log('\n❌ Error:', voiceResult.error);
    }
    
  } catch (error) {
    console.error('\n💥 Test failed:', error);
  }
}

testVoiceCafeQuery();