#!/usr/bin/env ts-node

import { FacilityAgent } from '@/mastra/agents/facility-agent';
import { mastra } from '@/mastra';

interface TestCase {
  query: string;
  requestType: string | null;
  language: 'ja' | 'en';
  expectedTags: string[];
  description: string;
}

const testCases: TestCase[] = [
  {
    query: 'Wi-Fiは使えますか？',
    requestType: 'wifi',
    language: 'ja',
    expectedTags: ['[happy]', '[relaxed]'],
    description: 'Wi-Fi availability query should include happy or relaxed tags'
  },
  {
    query: 'What equipment is available in the basement?',
    requestType: 'basement',
    language: 'en',
    expectedTags: ['[happy]', '[relaxed]', '[sad]'],
    description: 'Basement facilities query should include appropriate emotion tags'
  },
  {
    query: '3Dプリンターは使えますか？',
    requestType: 'facility',
    language: 'ja',
    expectedTags: ['[happy]', '[relaxed]', '[sad]'],
    description: '3D printer query should include emotion tags based on availability'
  }
];

async function testFacilityEmotions() {
  console.log('🧪 Testing FacilityAgent emotion tag implementation\n');

  const facilityAgent = new FacilityAgent({
    llm: { model: mastra.llm }
  });

  // Add mock tools for testing
  facilityAgent.addTool('ragSearch', {
    execute: async ({ query, language }: any) => {
      // Mock RAG search results
      const mockResults: Record<string, any> = {
        'wi-fi': {
          success: true,
          results: [{
            content: language === 'ja' 
              ? 'エンジニアカフェでは無料Wi-Fiを提供しています。館内全域で利用可能です。'
              : 'Engineer Cafe provides free Wi-Fi throughout the facility.'
          }]
        },
        'basement': {
          success: true,
          results: [{
            content: language === 'ja'
              ? '地下にはMTGスペース、集中スペース、アンダースペース、Makersスペースがあります。'
              : 'The basement has MTG space, focus space, under space, and Makers space.'
          }]
        },
        'printer': {
          success: true,
          results: [{
            content: language === 'ja'
              ? '3Dプリンターは現在メンテナンス中です。利用再開時期は未定です。'
              : '3D printer is currently under maintenance. Reopening date is undecided.'
          }]
        }
      };

      const key = query.toLowerCase().includes('wi-fi') ? 'wi-fi' 
        : query.toLowerCase().includes('basement') || query.includes('地下') ? 'basement'
        : '3d' || 'printer';

      return mockResults[key] || { success: false, results: [] };
    }
  });

  for (const testCase of testCases) {
    console.log(`\n📝 Test: ${testCase.description}`);
    console.log(`   Query: "${testCase.query}"`);
    console.log(`   Language: ${testCase.language}`);
    console.log(`   Request Type: ${testCase.requestType || 'none'}`);

    try {
      const response = await facilityAgent.answerFacilityQuery(
        testCase.query,
        testCase.requestType,
        testCase.language
      );

      console.log(`\n   Response: "${response.text}"`);
      
      // Check if response contains any of the expected emotion tags
      const foundTags = testCase.expectedTags.filter(tag => 
        response.text.includes(tag)
      );

      if (foundTags.length > 0) {
        console.log(`   ✅ Found emotion tags: ${foundTags.join(', ')}`);
      } else {
        console.log(`   ❌ No emotion tags found! Expected one of: ${testCase.expectedTags.join(', ')}`);
      }

      // Also check the emotion field in the response
      console.log(`   Response emotion field: ${response.emotion}`);

    } catch (error) {
      console.error(`   ❌ Error: ${error}`);
    }
  }

  console.log('\n\n📊 Test Summary:');
  console.log('The FacilityAgent has been updated to include emotion tags in its responses.');
  console.log('Emotion tags should appear as [happy], [sad], or [relaxed] within the response text.');
}

// Run the test
testFacilityEmotions().catch(console.error);