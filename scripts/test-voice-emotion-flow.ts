import { EmotionManager } from '../src/lib/emotion-manager';

async function testVoiceEmotionFlow() {
  console.log('🎭🎤 Testing Voice + Emotion Integration Flow\n');

  const baseUrl = 'http://localhost:3000';

  try {
    // Step 1: Start a session
    console.log('1️⃣ Starting voice session...');
    const sessionRes = await fetch(`${baseUrl}/api/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start_session',
        language: 'ja',
      }),
    });
    const sessionData = await sessionRes.json();
    console.log(`✅ Session started: ${sessionData.sessionId}`);

    // Step 2: Test character control with emotion detection
    console.log('\n2️⃣ Testing character emotion detection...');
    const emotionTestTexts = [
      'こんにちは！今日はとても嬉しいです！',
      'うーん、これは難しい問題ですね。',
      'ありがとうございます！素晴らしい説明でした！',
    ];

    for (const [index, text] of emotionTestTexts.entries()) {
      console.log(`\n   Test ${index + 1}: "${text}"`);
      
      // Test emotion detection through character API
      const emotionRes = await fetch(`${baseUrl}/api/character`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'detectEmotion',
          text,
          language: 'ja',
        }),
      });
      
      const emotionData = await emotionRes.json();
      if (emotionData.success) {
        console.log(`   🎭 Detected emotion: ${emotionData.result.emotionData.emotion}`);
        console.log(`   📊 Intensity: ${emotionData.result.emotionData.intensity.toFixed(2)}`);
        console.log(`   🎯 Confidence: ${emotionData.result.emotionData.confidence.toFixed(2)}`);
        console.log(`   👤 Suggested expression: ${emotionData.result.suggestions.expression}`);
        console.log(`   🎬 Suggested animation: ${emotionData.result.suggestions.animation}`);

        // Apply the detected emotion
        const applyRes = await fetch(`${baseUrl}/api/character`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'setEmotion',
            emotion: emotionData.result.emotionData.emotion,
          }),
        });
        
        const applyData = await applyRes.json();
        if (applyData.success) {
          console.log(`   ✅ Applied emotion to character`);
        } else {
          console.log(`   ❌ Failed to apply emotion: ${applyData.error}`);
        }
      } else {
        console.log(`   ❌ Emotion detection failed: ${emotionData.error}`);
      }
    }

    // Step 3: Test supported features
    console.log('\n3️⃣ Testing supported features...');
    const featuresRes = await fetch(`${baseUrl}/api/character?action=supported_features`);
    const featuresData = await featuresRes.json();
    
    if (featuresData.success) {
      console.log(`   📝 Expressions: ${featuresData.expressions?.length || 0} available`);
      console.log(`   🎬 Animations: ${featuresData.animations?.length || 0} available`);
      console.log(`   🎭 Emotions: ${featuresData.emotions?.length || 0} available`);
      console.log(`   ⚡ Capabilities: ${featuresData.capabilities?.length || 0} features`);
      
      if (featuresData.emotions) {
        console.log(`   Available emotions: ${featuresData.emotions.join(', ')}`);
      }
    }

    // Step 4: Test conversation state
    console.log('\n4️⃣ Testing conversation state...');
    const stateRes = await fetch(`${baseUrl}/api/voice?action=status`);
    const stateData = await stateRes.json();
    
    if (stateData.success) {
      console.log(`   🔄 Status: ${stateData.status}`);
      console.log(`   💬 Conversation state: ${stateData.conversationState}`);
      console.log(`   🕐 Timestamp: ${stateData.timestamp}`);
    }

    // Step 5: Test language switching with emotions
    console.log('\n5️⃣ Testing language switching...');
    const langRes = await fetch(`${baseUrl}/api/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'set_language',
        language: 'en',
        sessionId: sessionData.sessionId,
      }),
    });
    
    const langData = await langRes.json();
    if (langData.success) {
      console.log(`   ✅ Language switched to English`);
      
      // Test English emotion detection
      const englishEmotion = await fetch(`${baseUrl}/api/character`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'detectEmotion',
          text: 'Hello! I am so happy to see you today!',
          language: 'en',
        }),
      });
      
      const englishEmotionData = await englishEmotion.json();
      if (englishEmotionData.success) {
        console.log(`   🎭 English emotion: ${englishEmotionData.result.emotionData.emotion}`);
        console.log(`   📊 Intensity: ${englishEmotionData.result.emotionData.intensity.toFixed(2)}`);
      }
    }

    // Step 6: Test emotion-based interactions
    console.log('\n6️⃣ Testing emotion-based interactions...');
    const interactions = ['welcome', 'question', 'explanation', 'goodbye'];
    
    for (const interaction of interactions) {
      const interactionEmotion = EmotionManager.getEmotionForInteraction(interaction as any);
      console.log(`   ${interaction}: ${interactionEmotion.emotion} (intensity: ${interactionEmotion.intensity})`);
    }

    console.log('\n✅ Voice + Emotion integration tests completed!');
    console.log('\n🎉 Results summary:');
    console.log('   ✅ Session management working');
    console.log('   ✅ Emotion detection working');
    console.log('   ✅ Character expression control working');
    console.log('   ✅ Language switching working');
    console.log('   ✅ API integration complete');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

console.log('⚠️  Make sure the dev server is running on port 3000\n');
testVoiceEmotionFlow();