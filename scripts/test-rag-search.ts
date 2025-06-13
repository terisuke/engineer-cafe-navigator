#!/usr/bin/env tsx

import 'dotenv/config';
import { ragSearchTool } from '../src/mastra/tools/rag-search';
import { knowledgeBaseUtils } from '../src/lib/knowledge-base-utils';

// Test queries
const testQueries = [
  { query: '料金', language: 'ja' as const, description: 'Japanese pricing query' },
  { query: 'meeting room', language: 'en' as const, description: 'English facilities query' },
  { query: 'アクセス', language: 'ja' as const, description: 'Japanese access query' },
  { query: 'events', language: 'en' as const, description: 'English events query' },
  { query: 'インターネット環境', language: 'ja' as const, category: '設備', description: 'Japanese internet with category filter' },
];

async function testRAGSearch() {
  console.log('🔍 Testing RAG Search Tool\n');

  try {
    // First, check knowledge base stats
    console.log('📊 Knowledge Base Stats:');
    const stats = await knowledgeBaseUtils.getStats();
    console.log(stats);
    console.log('\n');

    if (stats.total === 0) {
      console.log('⚠️  Knowledge base is empty. Please run the seed script first:');
      console.log('   pnpm tsx scripts/seed-knowledge-base.ts\n');
      return;
    }

    // Test each query
    for (const testQuery of testQueries) {
      console.log(`\n🔎 Test: ${testQuery.description}`);
      console.log(`   Query: "${testQuery.query}"`);
      console.log(`   Language: ${testQuery.language}`);
      if (testQuery.category) {
        console.log(`   Category: ${testQuery.category}`);
      }

      const result = await ragSearchTool.execute({
        query: testQuery.query,
        language: testQuery.language,
        category: testQuery.category,
        limit: 3,
        threshold: 0.5,
      });

      if (result.success) {
        console.log(`   ✅ Success: Found ${result.results.length} results`);
        result.results.forEach((item, index) => {
          console.log(`\n   Result ${index + 1}:`);
          console.log(`     Title: ${item.title || 'No title'}`);
          console.log(`     Category: ${item.category || 'No category'}`);
          console.log(`     Similarity: ${(item.similarity * 100).toFixed(1)}%`);
          console.log(`     Content: ${item.content.substring(0, 100)}...`);
        });
      } else {
        console.log(`   ❌ Failed: ${result.message}`);
      }
    }

    // Test the searchKnowledgeBase helper method
    console.log('\n\n🧪 Testing searchKnowledgeBase helper method:');
    const contextJa = await ragSearchTool.searchKnowledgeBase('会議室の料金', 'ja');
    console.log('\nJapanese context for "会議室の料金":');
    console.log(contextJa || 'No results found');

    const contextEn = await ragSearchTool.searchKnowledgeBase('student discount', 'en');
    console.log('\nEnglish context for "student discount":');
    console.log(contextEn || 'No results found');

    console.log('\n\n✨ RAG Search testing completed!');
  } catch (error) {
    console.error('\n💥 Error testing RAG search:', error);
    process.exit(1);
  }
}

// Test the API endpoint as well
async function testAPIEndpoint() {
  console.log('\n\n🌐 Testing API Endpoint...\n');

  const baseUrl = 'http://localhost:3000';
  
  try {
    // Test GET endpoint
    console.log('📥 Testing GET /api/knowledge/search');
    const getResponse = await fetch(`${baseUrl}/api/knowledge/search`);
    const getResult = await getResponse.json();
    console.log('Status:', getResult.status);
    console.log('Has Data:', getResult.hasData);
    console.log('Message:', getResult.message);

    // Test POST endpoint
    console.log('\n📤 Testing POST /api/knowledge/search');
    const postResponse = await fetch(`${baseUrl}/api/knowledge/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'pricing plans',
        language: 'en',
        limit: 2,
      }),
    });
    const postResult = await postResponse.json();
    console.log('Success:', postResult.success);
    console.log('Results Count:', postResult.count);
    if (postResult.results) {
      postResult.results.forEach((item: any, index: number) => {
        console.log(`\nResult ${index + 1}: ${item.title || 'No title'}`);
        console.log(`Similarity: ${(item.similarity * 100).toFixed(1)}%`);
      });
    }
  } catch (error) {
    console.log('\n⚠️  API endpoint test failed. Make sure the development server is running:');
    console.log('   pnpm dev');
    console.log('\nError:', error instanceof Error ? error.message : 'Unknown error');
  }
}

// Run tests
async function runTests() {
  await testRAGSearch();
  
  // Check if we should test the API
  if (process.argv.includes('--api')) {
    await testAPIEndpoint();
  } else {
    console.log('\n💡 Tip: Run with --api flag to test the API endpoint too');
    console.log('   pnpm tsx scripts/test-rag-search.ts --api');
  }
}

runTests();