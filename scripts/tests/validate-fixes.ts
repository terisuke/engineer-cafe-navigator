#!/usr/bin/env tsx

/**
 * Validate fixes for the reported issues:
 * 1. Surprised emotion mapping error
 * 2. STT correction for サイノカフェ
 * 3. RAG search failures
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { EmotionMapping } from '@/lib/emotion-mapping';
import { STTCorrection } from '@/lib/stt-correction';
import { MainQAWorkflow } from '@/mastra/workflows/main-qa-workflow';

const API_BASE = 'http://localhost:3000';

async function testEmotionMapping() {
  console.log('\n🎭 Testing Emotion Mapping Fixes');
  console.log('================================================================================');
  
  // Test surprised emotion mapping
  const emotions = ['happy', 'sad', 'angry', 'relaxed', 'surprised', 'curious'];
  
  for (const emotion of emotions) {
    try {
      const mapped = EmotionMapping.mapToVRMEmotion(emotion);
      const supported = EmotionMapping.getSupportedEmotions();
      const intensity = EmotionMapping.getIntensityForEmotion(emotion);
      
      console.log(`Emotion: ${emotion}`);
      console.log(`  Mapped to: ${mapped}`);
      console.log(`  Intensity: ${intensity}`);
      console.log(`  Supported emotions: ${supported.join(', ')}`);
      
      if (emotion === 'surprised' && !supported.includes('surprised')) {
        console.log('  ❌ FAIL: surprised not in supported emotions list');
      } else {
        console.log('  ✅ PASS');
      }
    } catch (error) {
      console.log(`  ❌ ERROR: ${error}`);
    }
  }
}

async function testSTTCorrection() {
  console.log('\n🎤 Testing STT Correction');
  console.log('================================================================================');
  
  const testCases = [
    { input: 'じゃ 才能 cafeの方で。', expected: 'じゃサイノカフェの方で。' },
    { input: 'サイノウ カフェの営業時間は？', expected: 'サイノカフェの営業時間は？' },
    { input: 'engineer cafeはどこですか？', expected: 'エンジニアカフェはどこですか？' },
    { input: '階下のMTGスペースについて', expected: '地下のMTGスペースについて。' },
    { input: 'ワイファイは使えますか？', expected: 'Wi-Fiは使えますか？' }
  ];
  
  for (const testCase of testCases) {
    const corrected = STTCorrection.correct(testCase.input);
    const passed = corrected === testCase.expected;
    
    console.log(`\nInput: "${testCase.input}"`);
    console.log(`Expected: "${testCase.expected}"`);
    console.log(`Actual: "${corrected}"`);
    console.log(passed ? '✅ PASS' : '❌ FAIL');
  }
}

async function testQAWorkflow() {
  console.log('\n🤖 Testing QA Workflow');
  console.log('================================================================================');
  
  const workflow = new MainQAWorkflow();
  
  const testQueries = [
    {
      name: 'Ambiguous cafe query',
      question: 'カフェの営業時間について教えて',
      expectedAgent: 'ClarificationAgent',
      expectedEmotion: 'surprised'
    },
    {
      name: 'Saino cafe query',
      question: 'サイノカフェの営業時間は？',
      expectedAgent: 'BusinessInfoAgent',
      expectedCategory: 'saino-cafe'
    }
  ];
  
  for (const test of testQueries) {
    console.log(`\n📝 Test: ${test.name}`);
    console.log(`Question: "${test.question}"`);
    
    try {
      const result = await workflow.execute({
        question: test.question,
        sessionId: `test_${Date.now()}`,
        requestLanguage: 'ja'
      });
      
      console.log(`Response agent: ${result.response?.agentName}`);
      console.log(`Response emotion: ${result.response?.emotion}`);
      console.log(`Response text preview: ${result.response?.text?.substring(0, 100)}...`);
      
      const emotionMatch = result.response?.text?.match(/^\[(\w+)\]/);
      if (emotionMatch) {
        console.log(`Emotion tag: ${emotionMatch[1]}`);
      }
      
      if (test.expectedAgent && result.response?.agentName !== test.expectedAgent) {
        console.log(`❌ FAIL: Expected ${test.expectedAgent}, got ${result.response?.agentName}`);
      } else if (test.expectedEmotion && !result.response?.text?.includes(`[${test.expectedEmotion}]`)) {
        console.log(`❌ FAIL: Expected emotion [${test.expectedEmotion}] not found`);
      } else {
        console.log('✅ PASS');
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error}`);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function testAPIEndpoint() {
  console.log('\n🌐 Testing API Endpoint');
  console.log('================================================================================');
  
  try {
    const response = await fetch(`${API_BASE}/api/qa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'さいのうカフェの営業時間は？',
        sessionId: `api_test_${Date.now()}`,
        language: 'ja'
      })
    });
    
    const data = await response.json();
    
    console.log('API Response:', {
      success: response.ok,
      status: response.status,
      agentName: data.response?.agentName,
      hasEmotionTag: /^\[(\w+)\]/.test(data.response?.text || ''),
      textPreview: data.response?.text?.substring(0, 100)
    });
    
    if (!response.ok) {
      console.log('❌ FAIL: API request failed');
    } else if (!data.response?.text) {
      console.log('❌ FAIL: No response text');
    } else {
      console.log('✅ PASS');
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}`);
  }
}

async function runValidation() {
  console.log('🔍 Validating Fixes for Reported Issues');
  console.log('================================================================================');
  console.log('1. Emotion mapping error for "surprised"');
  console.log('2. STT correction for サイノカフェ');
  console.log('3. RAG search failures and emotion tags');
  console.log('================================================================================');
  
  await testEmotionMapping();
  await testSTTCorrection();
  
  // Check if server is running
  try {
    const health = await fetch(`${API_BASE}/api/health`).catch(() => null);
    if (!health || !health.ok) {
      console.log('\n⚠️  Server not available at ' + API_BASE);
      console.log('Skipping API and workflow tests');
      return;
    }
  } catch {
    console.log('\n⚠️  Server not available at ' + API_BASE);
    console.log('Skipping API and workflow tests');
    return;
  }
  
  await testQAWorkflow();
  await testAPIEndpoint();
  
  console.log('\n================================================================================');
  console.log('✅ Validation Complete');
  console.log('================================================================================');
}

runValidation().catch(console.error);