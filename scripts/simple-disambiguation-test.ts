#!/usr/bin/env tsx

import 'dotenv/config';

async function testSimpleDisambiguation() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Testing simple disambiguation\n');
  
  try {
    const response = await fetch(`${baseUrl}/api/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'process_text',
        text: 'カフェの営業時間は？',
        sessionId: 'test-simple-' + Date.now(),
        language: 'ja'
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Response received:');
      console.log(result.response);
      
      // Check if it's asking for clarification
      const isAsking = result.response.includes('どちらについてお聞きでしょうか') || 
                      result.response.includes('1.') || 
                      result.response.includes('2.');
      
      console.log('\nIs asking for clarification:', isAsking ? '✅' : '❌');
    } else {
      console.log('❌ Error:', result.error);
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
  }
}

testSimpleDisambiguation();