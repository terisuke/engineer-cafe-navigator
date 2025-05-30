import * as fs from 'fs/promises';
import * as path from 'path';

async function testTTSAPI() {
  console.log('🎤 Testing TTS through API...\n');
  
  try {
    // Start a session
    console.log('1️⃣ Starting session...');
    const sessionRes = await fetch('http://localhost:3000/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start_session',
        language: 'ja',
      }),
    });
    const sessionData = await sessionRes.json();
    console.log('Session ID:', sessionData.sessionId);

    // Test TTS with actual text
    console.log('\n2️⃣ Testing Text-to-Speech...');
    
    // Create a fake audio that says "こんにちは"
    const testText = "こんにちは、エンジニアカフェへようこそ！";
    console.log('Test text:', testText);
    
    // We'll send dummy audio but expect real TTS response
    const dummyAudio = Buffer.from('test-audio').toString('base64');
    
    const response = await fetch('http://localhost:3000/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'process_voice',
        audioData: dummyAudio,
        sessionId: sessionData.sessionId,
        language: 'ja',
        // Add the text directly for testing
        __testText: testText, // This won't work with current API, but let's try
      }),
    });

    const data = await response.json();
    console.log('\nResponse status:', response.status);
    console.log('Success:', data.success);
    console.log('Transcript:', data.transcript || '(empty)');
    console.log('AI Response:', data.response || '(empty)');
    console.log('Has audio response:', !!data.audioResponse);
    
    if (data.audioResponse) {
      // Save the audio response
      const outputDir = path.join(process.cwd(), 'test-output');
      await fs.mkdir(outputDir, { recursive: true });
      
      const audioBuffer = Buffer.from(data.audioResponse, 'base64');
      const outputPath = path.join(outputDir, 'api-response.mp3');
      await fs.writeFile(outputPath, audioBuffer);
      
      console.log(`\n✅ Audio saved to: ${outputPath}`);
      console.log(`   Size: ${audioBuffer.length} bytes`);
    }

    // Test direct TTS endpoint if available
    console.log('\n3️⃣ Testing language switching...');
    const langRes = await fetch('http://localhost:3000/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'set_language',
        language: 'en',
        sessionId: sessionData.sessionId,
      }),
    });
    const langData = await langRes.json();
    console.log('Language switch:', langData.success ? '✅ Success' : '❌ Failed');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

console.log('⚠️  Make sure the dev server is running on port 3000\n');
testTTSAPI();