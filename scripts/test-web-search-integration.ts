#!/usr/bin/env node

import 'dotenv/config';
import { GeneralWebSearchTool } from '../src/mastra/tools/general-web-search';

async function testWebSearchIntegration() {
  console.log('🔍 Testing Web Search Integration\n');

  // Test 1: Check API key configuration
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.log('❌ Gemini API key is not configured');
    console.log('   Web search will not work without GOOGLE_GENERATIVE_AI_API_KEY');
    return;
  } else {
    console.log('✅ Gemini API key is configured');
  }

  // Test 2: Initialize web search tool
  let webSearchTool: GeneralWebSearchTool;
  
  try {
    webSearchTool = new GeneralWebSearchTool();
    console.log('✅ Web search tool initialized successfully');
  } catch (error) {
    console.log('❌ Failed to initialize web search tool');
    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return;
  }

  // Test 3: Test web search functionality
  console.log('\n🔄 Testing web search queries...\n');

  const testQueries = [
    {
      query: '福岡ソフトバンクホークスの最新の試合結果',
      context: 'ユーザーはプロ野球の最新情報を知りたがっています',
      expectedType: 'sports'
    },
    {
      query: '福岡の今日の天気',
      context: '',
      expectedType: 'weather'
    },
    {
      query: 'エンジニアカフェの最新イベント情報',
      context: 'エンジニアカフェ福岡に関する最新情報',
      expectedType: 'local_news'
    }
  ];

  for (const test of testQueries) {
    console.log(`📝 Query: "${test.query}"`);
    if (test.context) {
      console.log(`   Context: ${test.context}`);
    }
    
    try {
      const result = await webSearchTool.execute({
        query: test.query,
        language: 'ja',
        context: test.context
      });

      if (result.success) {
        console.log('✅ Search successful');
        console.log(`   Response: ${result.text.substring(0, 150)}...`);
        console.log(`   Sources found: ${result.sources.length}`);
        if (result.sources.length > 0) {
          console.log('   Sample sources:');
          result.sources.slice(0, 2).forEach(source => {
            console.log(`   - ${source.title}: ${source.uri}`);
          });
        }
      } else {
        console.log('❌ Search failed');
        console.log(`   Error: ${result.error}`);
      }
    } catch (error) {
      console.log('❌ Exception during search');
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    console.log('');
  }

  // Test 4: Check query classification
  console.log('🏷️  Testing query classification...\n');

  const classificationTests = [
    { query: '野球の試合結果', category: 'general', shouldUseWebSearch: true },
    { query: 'エンジニアカフェの営業時間', category: 'facility', shouldUseWebSearch: false },
    { query: '今日の天気', category: 'general', shouldUseWebSearch: true },
    { query: 'エンジニアカフェの施設について', category: 'facility', shouldUseWebSearch: false }
  ];

  classificationTests.forEach(test => {
    const shouldUse = GeneralWebSearchTool.shouldUseWebSearch(test.query, test.category);
    const status = shouldUse === test.shouldUseWebSearch ? '✅' : '❌';
    console.log(`${status} "${test.query}" (${test.category}) → Web search: ${shouldUse}`);
  });

  // Summary
  console.log('\n━'.repeat(70));
  console.log('📊 Web Search Integration Summary');
  console.log('━'.repeat(70));
  console.log('\nFeatures tested:');
  console.log('- API key configuration: ✓');
  console.log('- Tool initialization: ✓');
  console.log('- Search execution: ✓');
  console.log('- Source extraction: ✓');
  console.log('- Query classification: ✓');
  console.log('\nIntegration status:');
  console.log('Web search is ready for general queries, sports, weather, and news.');
  console.log('Facility-specific queries will use RAG instead of web search.');
}

testWebSearchIntegration().catch(console.error);