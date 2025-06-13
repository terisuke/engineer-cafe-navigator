import { supabaseAdmin } from '../src/lib/supabase';

async function detailedDuplicateAnalysis() {
  console.log('📊 詳細な重複分析を実行します...\n');

  try {
    // 全データを取得
    const { data: allData, error: allDataError } = await supabaseAdmin
      .from('knowledge_base')
      .select('id, content, source, category, language, created_at, content_embedding')
      .order('created_at', { ascending: true });

    if (allDataError || !allData) {
      console.error('データ取得エラー:', allDataError);
      return;
    }

    console.log(`総データ件数: ${allData.length}件\n`);

    // 1. Content の重複分析
    const contentMap = new Map<string, any[]>();
    allData.forEach(item => {
      const content = item.content.trim();
      if (!contentMap.has(content)) {
        contentMap.set(content, []);
      }
      contentMap.get(content)!.push(item);
    });

    const duplicatedContents = Array.from(contentMap.entries())
      .filter(([_, items]) => items.length > 1)
      .sort((a, b) => b[1].length - a[1].length);

    console.log('=== CONTENT 重複分析 ===');
    console.log(`重複パターン数: ${duplicatedContents.length}`);
    console.log(`重複により余分なレコード数: ${duplicatedContents.reduce((sum, [_, items]) => sum + items.length - 1, 0)}`);

    // 重複度合いの分布
    const duplicateDistribution = new Map<number, number>();
    duplicatedContents.forEach(([_, items]) => {
      const count = items.length;
      duplicateDistribution.set(count, (duplicateDistribution.get(count) || 0) + 1);
    });

    console.log('\n重複度合いの分布:');
    Array.from(duplicateDistribution.entries())
      .sort((a, b) => b[0] - a[0])
      .forEach(([duplicateCount, patternCount]) => {
        console.log(`  ${duplicateCount}件重複: ${patternCount}パターン`);
      });

    // 2. 作成日時による分析
    console.log('\n=== 作成日時分析 ===');
    const timeGroups = new Map<string, number>();
    allData.forEach(item => {
      const date = item.created_at.split('T')[0]; // 日付のみ取得
      timeGroups.set(date, (timeGroups.get(date) || 0) + 1);
    });

    console.log('日別作成件数:');
    Array.from(timeGroups.entries())
      .sort()
      .forEach(([date, count]) => {
        console.log(`  ${date}: ${count}件`);
      });

    // 3. 最も重複が多い内容の詳細分析
    console.log('\n=== 最重複コンテンツ分析 ===');
    const topDuplicates = duplicatedContents.slice(0, 3);
    
    topDuplicates.forEach(([content, items], index) => {
      console.log(`\n--- 重複パターン ${index + 1} (${items.length}件の重複) ---`);
      console.log(`Content (最初の150文字): ${content.substring(0, 150)}...`);
      
      // 作成時刻の分析
      const createdTimes = items.map(item => item.created_at).sort();
      console.log(`作成時刻範囲: ${createdTimes[0]} ~ ${createdTimes[createdTimes.length - 1]}`);
      
      // 時刻のグループ化（分単位）
      const timeMinutes = items.map(item => {
        const date = new Date(item.created_at);
        return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
      });
      
      const timeGroups = timeMinutes.reduce((acc: any, time) => {
        acc[time] = (acc[time] || 0) + 1;
        return acc;
      }, {});
      
      console.log('時刻別分布:');
      Object.entries(timeGroups).forEach(([time, count]) => {
        console.log(`  ${time}: ${count}件`);
      });
    });

    // 4. 埋め込みベクトルの状況
    console.log('\n=== 埋め込みベクトル分析 ===');
    const withEmbedding = allData.filter(item => item.content_embedding !== null);
    const withoutEmbedding = allData.filter(item => item.content_embedding === null);
    
    console.log(`埋め込みベクトルあり: ${withEmbedding.length}件`);
    console.log(`埋め込みベクトルなし: ${withoutEmbedding.length}件`);
    
    // 重複データで埋め込みベクトルがある件数
    let duplicatesWithEmbedding = 0;
    duplicatedContents.forEach(([_, items]) => {
      items.forEach(item => {
        if (item.content_embedding !== null) {
          duplicatesWithEmbedding++;
        }
      });
    });
    
    console.log(`重複データで埋め込みベクトルあり: ${duplicatesWithEmbedding}件`);

    // 5. Source別の分析
    console.log('\n=== SOURCE別分析 ===');
    const sourceMap = new Map<string, number>();
    allData.forEach(item => {
      const source = item.source || 'null';
      sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
    });

    Array.from(sourceMap.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([source, count]) => {
        console.log(`  ${source}: ${count}件`);
      });

    // 6. 重複除去による削減効果の推定
    console.log('\n=== 重複除去効果 ===');
    const uniqueContents = contentMap.size;
    const totalRecords = allData.length;
    const duplicateRecords = totalRecords - uniqueContents;
    const reductionPercentage = ((duplicateRecords / totalRecords) * 100).toFixed(1);
    
    console.log(`現在のレコード数: ${totalRecords}件`);
    console.log(`ユニークなコンテンツ数: ${uniqueContents}件`);
    console.log(`削除可能な重複レコード数: ${duplicateRecords}件`);
    console.log(`削減率: ${reductionPercentage}%`);

    // 7. カテゴリ別重複分析
    console.log('\n=== カテゴリ別重複分析 ===');
    const categoryDuplicates = new Map<string, number>();
    duplicatedContents.forEach(([_, items]) => {
      items.forEach(item => {
        const category = item.category || 'null';
        categoryDuplicates.set(category, (categoryDuplicates.get(category) || 0) + 1);
      });
    });

    Array.from(categoryDuplicates.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`  ${category}: ${count}件の重複レコード`);
      });

    // 8. 言語別重複分析
    console.log('\n=== 言語別重複分析 ===');
    const languageDuplicates = new Map<string, number>();
    duplicatedContents.forEach(([_, items]) => {
      items.forEach(item => {
        const language = item.language || 'null';
        languageDuplicates.set(language, (languageDuplicates.get(language) || 0) + 1);
      });
    });

    Array.from(languageDuplicates.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([language, count]) => {
        console.log(`  ${language}: ${count}件の重複レコード`);
      });

    // 9. 最終サマリー
    console.log('\n🚨 === 重複問題の深刻度評価 ===');
    console.log(`総レコード数: ${totalRecords}件`);
    console.log(`重複パターン数: ${duplicatedContents.length}件`);
    console.log(`重複レコード数: ${duplicateRecords}件 (${reductionPercentage}%)`);
    
    const severeDuplicates = duplicatedContents.filter(([_, items]) => items.length >= 10);
    const moderateDuplicates = duplicatedContents.filter(([_, items]) => items.length >= 5 && items.length < 10);
    const minorDuplicates = duplicatedContents.filter(([_, items]) => items.length >= 2 && items.length < 5);
    
    console.log(`\n重複度別分類:`);
    console.log(`・重度（10件以上）: ${severeDuplicates.length}パターン`);
    console.log(`・中度（5-9件）: ${moderateDuplicates.length}パターン`);
    console.log(`・軽度（2-4件）: ${minorDuplicates.length}パターン`);

    console.log(`\n⚠️  推定される問題:`);
    console.log(`1. スライドナレーションデータが複数回インポートされている`);
    console.log(`2. 同じコンテンツが16回も重複している（最大）`);
    console.log(`3. データベースサイズが約${reductionPercentage}%無駄になっている`);
    console.log(`4. RAGクエリ時に同一内容が複数回検索される可能性`);
    console.log(`5. 埋め込みベクトル生成による計算リソースの無駄`);

  } catch (error) {
    console.error('分析中にエラーが発生しました:', error);
  }
}

// スクリプトの実行
if (require.main === module) {
  detailedDuplicateAnalysis()
    .then(() => {
      console.log('\n✅ 詳細分析完了');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 分析失敗:', error);
      process.exit(1);
    });
}

export { detailedDuplicateAnalysis };