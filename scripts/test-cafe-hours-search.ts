#!/usr/bin/env tsx

import 'dotenv/config';
import { ragSearchTool } from '../src/mastra/tools/rag-search';

async function testCafeHoursSearch() {
  console.log('🔍 Testing cafe hours search\n');

  const queries = [
    '併設されてるカフェの営業時間について教えてください',
    'カフェの営業時間',
    'サイノカフェの営業時間',
    '営業時間',
    'cafe hours',
    'saino cafe hours'
  ];

  for (const query of queries) {
    console.log(`\n📝 Query: "${query}"`);
    
    try {
      // Test with searchKnowledgeBase method
      const context = await ragSearchTool.searchKnowledgeBase(query, 'ja');
      if (context) {
        console.log('✅ Found context:');
        console.log(context.substring(0, 300) + '...\n');
      } else {
        console.log('❌ No context found');
        
        // Try with execute method for more details
        const result = await ragSearchTool.execute({
          query,
          language: 'ja',
          limit: 5,
          threshold: 0.3
        });
        
        if (result.success && result.results.length > 0) {
          console.log(`Found ${result.results.length} results with execute:`)
          result.results.forEach((r: any, i: number) => {
            console.log(`  ${i+1}. ${r.title} (${r.category}) - ${(r.similarity * 100).toFixed(1)}%`);
          });
        }
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }
}

testCafeHoursSearch();