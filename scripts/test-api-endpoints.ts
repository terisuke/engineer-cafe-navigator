async function testAPIEndpoints() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Testing Engineer Cafe Navigator API Endpoints\n');

  try {
    // Test 1: Voice API Status
    console.log('1️⃣ Testing Voice API Status...');
    const statusResponse = await fetch(`${baseUrl}/api/voice?action=status`);
    const statusData = await statusResponse.json();
    console.log('   Status:', statusResponse.status);
    console.log('   Data:', JSON.stringify(statusData, null, 2));

    // Test 2: Start a new session
    console.log('\n2️⃣ Starting a new session...');
    const sessionResponse = await fetch(`${baseUrl}/api/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start_session',
        language: 'ja',
      }),
    });
    const sessionData = await sessionResponse.json();
    console.log('   Status:', sessionResponse.status);
    console.log('   Session ID:', sessionData.sessionId);

    // Test 3: Supported languages
    console.log('\n3️⃣ Testing supported languages...');
    const langResponse = await fetch(`${baseUrl}/api/voice?action=supported_languages`);
    const langData = await langResponse.json();
    console.log('   Status:', langResponse.status);
    console.log('   Languages:', JSON.stringify(langData, null, 2));

    // Test 4: Test TTS through API (without real audio)
    console.log('\n4️⃣ Testing Text-to-Speech through API...');
    const testAudio = Buffer.from('test').toString('base64'); // Dummy audio
    const ttsResponse = await fetch(`${baseUrl}/api/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'process_voice',
        audioData: testAudio,
        sessionId: sessionData.sessionId,
        language: 'ja',
      }),
    });
    const ttsData = await ttsResponse.json();
    console.log('   Status:', ttsResponse.status);
    console.log('   Response:', JSON.stringify(ttsData, null, 2));

    console.log('\n✅ API endpoint tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Note: Make sure the dev server is running on port 3000
console.log('⚠️  Make sure the dev server is running: pnpm dev\n');
testAPIEndpoints();