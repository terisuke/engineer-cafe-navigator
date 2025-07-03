#!/usr/bin/env tsx

/**
 * メモリシステムの文脈継承テスト
 */

import { SimplifiedMemorySystem } from '@/lib/simplified-memory';

async function testMemoryContext() {
  console.log('🧠 メモリシステムの文脈継承テスト');
  console.log('================================================================================\n');

  const memory = new SimplifiedMemorySystem('shared');
  const sessionId = 'test_memory_' + Date.now();
  
  try {
    // Step 1: サイノカフェに関するメッセージを追加
    console.log('Step 1: サイノカフェのメッセージを追加');
    await memory.addMessage('user', 'サイノカフェについて教えて', {
      sessionId: sessionId,
      metadata: { language: 'ja' }
    });
    
    await memory.addMessage('assistant', 'サイノカフェはエンジニアカフェと同じ1階にあり...', {
      sessionId: sessionId,
      metadata: { language: 'ja', entity: 'saino' }
    });
    
    console.log('  ✅ メッセージを追加しました');

    // Step 2: 短いクエリでコンテキストを取得
    console.log('\nStep 2: "営業時間は？" でコンテキストを取得');
    const context = await memory.getContext('営業時間は？', {
      includeKnowledgeBase: false,
      language: 'ja',
      inheritContext: true
    });
    
    console.log('  Context String:', context.contextString?.substring(0, 200) + '...');
    console.log('  Inherited Request Type:', context.inheritedRequestType);
    console.log('  Messages Found:', context.messages?.length || 0);
    
    // メッセージの詳細を確認
    if (context.messages && context.messages.length > 0) {
      console.log('\n  Recent Messages:');
      context.messages.forEach((msg, idx) => {
        console.log(`    [${idx}] ${msg.role}: ${msg.content.substring(0, 50)}...`);
        console.log(`         metadata: ${JSON.stringify(msg.metadata)}`);
      });
    }
    
    // エンティティ検出
    console.log('\n  Entity Detection:');
    const hasSaino = context.contextString?.includes('サイノ') || context.contextString?.includes('saino');
    const hasEngineer = context.contextString?.includes('エンジニアカフェ');
    console.log(`    Has Saino: ${hasSaino}`);
    console.log(`    Has Engineer: ${hasEngineer}`);
    
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n================================================================================');
}

testMemoryContext().catch(console.error);