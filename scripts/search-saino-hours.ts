import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// 環境変数の読み込み（最初に実行）
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function searchSainoHours() {
  console.log('=== サイノカフェの営業時間情報を検索 ===\n');

  // 1. 直接データベースから検索
  console.log('1. データベースから直接検索:');
  const { data: directResults, error } = await supabase
    .from('knowledge_base')
    .select('*')
    .or('content.ilike.%saino%,category.ilike.%saino%,subcategory.ilike.%saino%')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Database error:', error);
    return;
  }

  console.log(`Found ${directResults?.length || 0} results containing 'saino'`);
  
  if (directResults && directResults.length > 0) {
    console.log('\nサイノ関連のエントリ:');
    directResults.forEach((result, index) => {
      const title = result.metadata?.title || result.category || 'No title';
      console.log(`\n[${index + 1}] ${title}`);
      console.log(`Category: ${result.category}`);
      console.log(`Subcategory: ${result.subcategory}`);
      console.log(`Language: ${result.language}`);
      console.log(`Content preview: ${result.content.substring(0, 200)}...`);
      
      // 営業時間に関する情報を探す
      if (result.content.includes('ランチ') || result.content.includes('ディナー') || 
          result.content.includes('営業時間') || result.content.includes('時間') ||
          result.content.includes('lunch') || result.content.includes('dinner') ||
          result.content.includes('hours')) {
        console.log('\n*** 営業時間情報を含む可能性があります ***');
        console.log('Full content:', result.content);
      }
    });
  }

  // 2. Enhanced RAG検索でサイノの営業時間を検索
  console.log('\n\n2. Enhanced RAG検索で「サイノの営業時間」を検索:');
  
  // 動的インポートでenhancedRagSearchToolを取得
  const { enhancedRagSearchTool } = await import('../src/mastra/tools/enhanced-rag-search');
  
  const ragResult = await enhancedRagSearchTool.execute({
    query: 'サイノカフェの営業時間',
    category: 'hours',
    language: 'ja',
    includeAdvice: true,
    maxResults: 5
  });

  if (ragResult.success) {
    console.log('\nRAG検索結果:');
    console.log('Top entity:', ragResult.data.topEntity);
    console.log('Total results:', ragResult.data.totalResults);
    console.log('\nContext:');
    console.log(ragResult.data.context);
    
    if (ragResult.data.results && ragResult.data.results.length > 0) {
      console.log('\n検索結果詳細:');
      ragResult.data.results.forEach((result: any, index: number) => {
        const title = result.metadata?.title || result.title || result.category || 'No title';
        console.log(`\n[${index + 1}] ${title}`);
        console.log(`Entity: ${result.entity}`);
        console.log(`Priority Score: ${result.priorityScore}`);
        console.log(`Original Similarity: ${result.originalSimilarity}`);
        console.log(`Content: ${result.content.substring(0, 300)}...`);
      });
    }
  } else {
    console.error('RAG search error:', ragResult.error);
  }

  // 3. 営業時間カテゴリの全エントリを確認
  console.log('\n\n3. 営業時間カテゴリの全エントリ:');
  const { data: hoursData } = await supabase
    .from('knowledge_base')
    .select('*')
    .or('category.ilike.%hours%,category.ilike.%営業時間%')
    .order('updated_at', { ascending: false });

  if (hoursData && hoursData.length > 0) {
    console.log(`Found ${hoursData.length} entries in hours category`);
    hoursData.forEach((entry, index) => {
      const title = entry.metadata?.title || entry.category || 'No title';
      console.log(`\n[${index + 1}] ${title}`);
      console.log(`Category: ${entry.category}`);
      console.log(`Subcategory: ${entry.subcategory}`);
      console.log(`Content: ${entry.content.substring(0, 200)}...`);
    });
  }
}

// 実行
searchSainoHours().catch(console.error);