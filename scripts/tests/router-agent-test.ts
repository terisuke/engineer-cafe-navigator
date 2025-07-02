#!/usr/bin/env node
/**
 * Router Agent Test
 * Tests the routing logic for different types of queries
 */

import 'dotenv/config';
import { RouterAgent } from '@/mastra/agents/router-agent';
import { google } from '@ai-sdk/google';

// Test queries for router agent
const testQueries = [
  // 営業時間関連
  { query: 'エンジニアカフェの営業時間は？', expectedAgent: 'BusinessInfoAgent', expectedType: 'hours' },
  { query: 'What time does Engineer Cafe open?', expectedAgent: 'BusinessInfoAgent', expectedType: 'hours' },
  { query: 'エンジニアカフェは何時から開いていますか？', expectedAgent: 'BusinessInfoAgent', expectedType: 'hours' },
  
  // Wi-Fi関連
  { query: 'Engineer Cafeの無料Wi-Fiはありますか？', expectedAgent: 'FacilityAgent', expectedType: 'wifi' },
  { query: 'Is there wifi in the basement?', expectedAgent: 'FacilityAgent', expectedType: 'wifi' },
  
  // 料金関連
  { query: 'sainoカフェの料金を教えて', expectedAgent: 'BusinessInfoAgent', expectedType: 'price' },
  { query: 'How much does it cost?', expectedAgent: 'BusinessInfoAgent', expectedType: 'price' },
  
  // 場所関連
  { query: 'Where is Engineer Cafe located?', expectedAgent: 'BusinessInfoAgent', expectedType: 'location' },
  { query: 'エンジニアカフェへのアクセス方法', expectedAgent: 'BusinessInfoAgent', expectedType: 'location' },
  
  // 施設関連
  { query: '地下のスペースについて教えて', expectedAgent: 'BusinessInfoAgent', expectedType: 'basement' },
  { query: '赤レンガ文化館について', expectedAgent: 'GeneralKnowledgeAgent', expectedType: null },
  
  // イベント関連
  { query: '今日のエンジニアカフェのイベントは？', expectedAgent: 'EventAgent', expectedType: 'event' },
  { query: '今週の勉強会の予定を教えて', expectedAgent: 'EventAgent', expectedType: 'event' },
  
  // メモリー関連
  { query: 'さっき何を聞いた？', expectedAgent: 'MemoryAgent', expectedType: null },
  { query: 'What did I ask earlier?', expectedAgent: 'MemoryAgent', expectedType: null },
  
  // 一般的なクエリ
  { query: '最新のAI開発について教えて', expectedAgent: 'GeneralKnowledgeAgent', expectedType: null },
  { query: '福岡のスタートアップ情報', expectedAgent: 'GeneralKnowledgeAgent', expectedType: null },
];

export async function testRouterAgent() {
  console.log('🚀 Testing RouterAgent...\n');
  
  const model = google('gemini-2.0-flash-exp', {
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }
    ]
  });
  
  const routerAgent = new RouterAgent({ llm: { model } });
  
  let correctRoutings = 0;
  let correctTypes = 0;
  
  for (const test of testQueries) {
    try {
      console.log(`\n📋 Testing: "${test.query}"`);
      const startTime = Date.now();
      
      const result = await routerAgent.routeQuery(test.query, 'test_session');
      const duration = Date.now() - startTime;
      
      console.log(`   Agent: ${result.agent} ${result.agent === test.expectedAgent ? '✅' : '❌'} (expected: ${test.expectedAgent})`);
      console.log(`   Category: ${result.category}`);
      console.log(`   RequestType: ${result.requestType} ${result.requestType === test.expectedType ? '✅' : '❌'} (expected: ${test.expectedType})`);
      console.log(`   Language: ${result.language}`);
      console.log(`   Confidence: ${result.confidence}`);
      console.log(`   Duration: ${duration}ms`);
      
      if (result.agent === test.expectedAgent) {
        correctRoutings++;
      }
      
      if (result.requestType === test.expectedType) {
        correctTypes++;
      }
      
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTS:\n');
  console.log(`✅ Correct Agent Routings: ${correctRoutings}/${testQueries.length} (${(correctRoutings/testQueries.length*100).toFixed(1)}%)`);
  console.log(`✅ Correct Request Types: ${correctTypes}/${testQueries.length} (${(correctTypes/testQueries.length*100).toFixed(1)}%)`);
  console.log('\n🎯 Target: 95% or higher routing accuracy');
}

// Run the test if called directly
if (require.main === module) {
  testRouterAgent().catch(console.error);
}