import { QueryClassifier } from '../src/lib/query-classifier';
import { configDotenv } from 'dotenv';

configDotenv({ path: '.env.local' });

async function debugCategorization() {
  console.log('🔍 Debugging Query Categorization\n');
  console.log('=' + '='.repeat(50));

  const classifier = new QueryClassifier(true);

  const queries = [
    'エンジニアカフェの営業時間は？',
    'Engineer Cafeの無料Wi-Fiはありますか？',
    'Where is Engineer Cafe located?',
    '今日のエンジニアカフェのイベントは？',
    'sainoカフェの料金を教えて',
    '地下のスペースについて教えて',
  ];

  for (const query of queries) {
    const result = await classifier.classifyWithDetails(query);
    console.log(`\nQuery: "${query}"`);
    console.log(`Category: ${result.category}`);
    console.log(`Confidence: ${result.confidence}`);
    if (result.debugInfo) {
      console.log(`Debug: ${JSON.stringify(result.debugInfo)}`);
    }

    // Additional categorization insights
    const normalized = query.toLowerCase();
    
    // Check for specific patterns
    const patterns = {
      'calendar/events': ['今日', 'イベント', 'today', 'event', '予定', 'schedule'],
      'hours': ['営業時間', 'hours', '何時', 'open', 'close'],
      'wifi': ['wi-fi', 'wifi', 'インターネット', 'internet'],
      'location': ['どこ', 'where', '場所', 'location', '住所'],
      'pricing': ['料金', '値段', 'price', 'cost', '無料']
    };

    const matchedPatterns: string[] = [];
    for (const [category, keywords] of Object.entries(patterns)) {
      if (keywords.some(k => normalized.includes(k))) {
        matchedPatterns.push(category);
      }
    }

    console.log(`Potential categories: ${matchedPatterns.join(', ')}`);
  }
}

debugCategorization().catch(console.error);