import { GoogleCloudVoiceServiceSimple } from '../src/mastra/voice/google-cloud-voice-simple';
import * as fs from 'fs/promises';
import * as path from 'path';

async function testVoiceIntegration() {
  console.log('🎤 Testing Google Cloud Voice Integration...\n');

  try {
    // Initialize voice service
    const voiceService = new GoogleCloudVoiceServiceSimple({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID!,
      credentials: './config/service-account-key.json',
    });

    // Test 1: Text-to-Speech
    console.log('1️⃣ Testing Text-to-Speech...');
    const testTextJa = 'こんにちは、エンジニアカフェへようこそ！';
    const testTextEn = 'Welcome to Engineer Cafe!';

    // Test Japanese TTS
    console.log('   Testing Japanese TTS...');
    const audioJa = await voiceService.textToSpeech(testTextJa, { language: 'ja' });
    console.log(`   ✅ Japanese TTS successful! Audio size: ${audioJa.byteLength} bytes`);

    // Test English TTS
    console.log('   Testing English TTS...');
    voiceService.setLanguage('en'); // Set language first
    const audioEn = await voiceService.textToSpeech(testTextEn, { language: 'en' });
    console.log(`   ✅ English TTS successful! Audio size: ${audioEn.byteLength} bytes`);

    // Save audio files for manual verification
    const outputDir = path.join(process.cwd(), 'test-output');
    await fs.mkdir(outputDir, { recursive: true });
    
    await fs.writeFile(
      path.join(outputDir, 'test-ja.mp3'),
      Buffer.from(audioJa)
    );
    await fs.writeFile(
      path.join(outputDir, 'test-en.mp3'),
      Buffer.from(audioEn)
    );
    
    console.log(`   📁 Audio files saved to ${outputDir}/`);

    // Test 2: Voice Settings
    console.log('\n2️⃣ Testing Voice Settings...');
    voiceService.setLanguage('ja');
    console.log('   ✅ Language set to Japanese');
    
    voiceService.setSpeakerByEmotion('friendly');
    console.log('   ✅ Speaker emotion set to friendly');

    // Test 3: Settings retrieval
    console.log('\n3️⃣ Testing Settings Retrieval...');
    const settings = voiceService.getSettings();
    console.log('   Current settings:', JSON.stringify(settings, null, 2));

    console.log('\n✨ All tests passed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Check the audio files in test-output/ directory');
    console.log('   2. Test Speech-to-Text with actual audio input');
    console.log('   3. Test the full voice conversation flow in the app');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('   Error details:', error.message);
      console.error('   Stack trace:', error.stack);
    }
  }
}

// Run the test
testVoiceIntegration();