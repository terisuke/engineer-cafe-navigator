import { supabaseAdmin } from '../src/lib/supabase';

async function investigateKnowledgeBaseDuplicates() {
  console.log('🔍 Supabase knowledge_base テーブルの重複調査を開始します...\n');

  try {
    // 1. テーブル構造の確認
    console.log('1. テーブル構造の確認');
    const { data: tableInfo, error: tableError } = await supabaseAdmin
      .from('knowledge_base')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('テーブル情報取得エラー:', tableError);
      return;
    }

    if (tableInfo && tableInfo.length > 0) {
      console.log('テーブルの列構造:');
      console.log(Object.keys(tableInfo[0]));
    }

    // 2. 総データ件数の取得
    console.log('\n2. 総データ件数の取得');
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from('knowledge_base')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('件数取得エラー:', countError);
      return;
    }

    console.log(`総データ件数: ${totalCount}件`);

    // 3. 言語別の件数
    console.log('\n3. 言語別の件数');
    const { data: languageStats, error: langError } = await supabaseAdmin
      .from('knowledge_base')
      .select('language')
      .not('language', 'is', null);

    if (langError) {
      console.error('言語別統計エラー:', langError);
    } else {
      const langCounts = languageStats?.reduce((acc: any, item) => {
        acc[item.language] = (acc[item.language] || 0) + 1;
        return acc;
      }, {});
      console.log('言語別統計:', langCounts);
    }

    // 4. カテゴリ別の件数
    console.log('\n4. カテゴリ別の件数');
    const { data: categoryStats, error: catError } = await supabaseAdmin
      .from('knowledge_base')
      .select('category')
      .not('category', 'is', null);

    if (catError) {
      console.error('カテゴリ別統計エラー:', catError);
    } else {
      const catCounts = categoryStats?.reduce((acc: any, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {});
      console.log('カテゴリ別統計:', catCounts);
    }

    // 5. 同じcontentを持つレコードの調査
    console.log('\n5. 同じcontentを持つレコードの調査');
    const { data: duplicateContent, error: dupContentError } = await supabaseAdmin
      .rpc('find_duplicate_content_knowledge_base');

    if (dupContentError) {
      // RPCが存在しない場合、手動でクエリを実行
      console.log('RPC関数が存在しないため、代替方法で調査します...');
      
      // content の長さ別統計
      const { data: allData, error: allDataError } = await supabaseAdmin
        .from('knowledge_base')
        .select('id, content, source, category, language, created_at');

      if (allDataError) {
        console.error('全データ取得エラー:', allDataError);
        return;
      }

      if (allData) {
        // content の重複チェック
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

        console.log(`重複するcontentのパターン数: ${duplicatedContents.length}`);
        console.log(`重複により余分なレコード数: ${duplicatedContents.reduce((sum, [_, items]) => sum + items.length - 1, 0)}`);

        // 重複の詳細を表示（上位5件）
        console.log('\n🔍 重複content の詳細（上位5件）:');
        duplicatedContents.slice(0, 5).forEach(([content, items], index) => {
          console.log(`\n--- 重複パターン ${index + 1} (${items.length}件の重複) ---`);
          console.log(`Content（最初の100文字）: ${content.substring(0, 100)}...`);
          items.forEach((item, itemIndex) => {
            console.log(`  ${itemIndex + 1}. ID: ${item.id}, Source: ${item.source || 'N/A'}, Category: ${item.category || 'N/A'}, Language: ${item.language}, Created: ${item.created_at}`);
          });
        });

        // 6. 同じsourceを持つレコードの調査
        console.log('\n6. 同じsourceを持つレコードの調査');
        const sourceMap = new Map<string, any[]>();
        allData.forEach(item => {
          if (item.source) {
            const source = item.source.trim();
            if (!sourceMap.has(source)) {
              sourceMap.set(source, []);
            }
            sourceMap.get(source)!.push(item);
          }
        });

        const duplicatedSources = Array.from(sourceMap.entries())
          .filter(([_, items]) => items.length > 1)
          .sort((a, b) => b[1].length - a[1].length);

        console.log(`\n重複するsourceのパターン数: ${duplicatedSources.length}`);
        
        if (duplicatedSources.length > 0) {
          console.log('\n🔍 重複source の詳細（上位5件）:');
          duplicatedSources.slice(0, 5).forEach(([source, items], index) => {
            console.log(`\n--- 重複source ${index + 1} (${items.length}件) ---`);
            console.log(`Source: ${source}`);
            items.forEach((item, itemIndex) => {
              console.log(`  ${itemIndex + 1}. ID: ${item.id}, Category: ${item.category || 'N/A'}, Language: ${item.language}, Content: ${item.content.substring(0, 50)}...`);
            });
          });
        }

        // 7. content の長さ統計
        console.log('\n7. Content長さの統計');
        const contentLengths = allData.map(item => item.content.length);
        contentLengths.sort((a, b) => a - b);
        
        const minLength = Math.min(...contentLengths);
        const maxLength = Math.max(...contentLengths);
        const avgLength = contentLengths.reduce((sum, len) => sum + len, 0) / contentLengths.length;
        const medianLength = contentLengths[Math.floor(contentLengths.length / 2)];

        console.log(`Content長さ - 最小: ${minLength}, 最大: ${maxLength}, 平均: ${Math.round(avgLength)}, 中央値: ${medianLength}`);

        // 異常に短いor長いcontentを特定
        const shortContents = allData.filter(item => item.content.length < 50);
        const longContents = allData.filter(item => item.content.length > 5000);

        console.log(`\n異常に短いcontent（50文字未満）: ${shortContents.length}件`);
        if (shortContents.length > 0) {
          shortContents.slice(0, 3).forEach((item, index) => {
            console.log(`  ${index + 1}. ID: ${item.id}, Length: ${item.content.length}, Content: "${item.content}"`);
          });
        }

        console.log(`異常に長いcontent（5000文字超）: ${longContents.length}件`);
        if (longContents.length > 0) {
          longContents.slice(0, 3).forEach((item, index) => {
            console.log(`  ${index + 1}. ID: ${item.id}, Length: ${item.content.length}, Source: ${item.source || 'N/A'}`);
          });
        }

        // 8. 埋め込みベクトルの状況
        console.log('\n8. 埋め込みベクトルの状況');
        const withEmbedding = allData.filter(item => item.content_embedding !== null);
        const withoutEmbedding = allData.filter(item => item.content_embedding === null);
        
        console.log(`埋め込みベクトルあり: ${withEmbedding.length}件`);
        console.log(`埋め込みベクトルなし: ${withoutEmbedding.length}件`);

        // 9. 重複分析のサマリー
        console.log('\n📊 重複分析サマリー');
        console.log('================');
        console.log(`・総レコード数: ${totalCount}件`);
        console.log(`・重複contentパターン: ${duplicatedContents.length}件`);
        console.log(`・重複により余分なレコード: ${duplicatedContents.reduce((sum, [_, items]) => sum + items.length - 1, 0)}件`);
        console.log(`・重複sourceパターン: ${duplicatedSources.length}件`);
        console.log(`・埋め込みベクトル未設定: ${withoutEmbedding.length}件`);
        console.log(`・異常に短いcontent: ${shortContents.length}件`);
        console.log(`・異常に長いcontent: ${longContents.length}件`);

        if (duplicatedContents.length > 0) {
          console.log(`\n🚨 重複の重要度分析:`);
          const severeDuplicates = duplicatedContents.filter(([_, items]) => items.length >= 5);
          const moderateDuplicates = duplicatedContents.filter(([_, items]) => items.length >= 3 && items.length < 5);
          const minorDuplicates = duplicatedContents.filter(([_, items]) => items.length === 2);
          
          console.log(`・重度の重複（5件以上）: ${severeDuplicates.length}パターン`);
          console.log(`・中度の重複（3-4件）: ${moderateDuplicates.length}パターン`);
          console.log(`・軽度の重複（2件）: ${minorDuplicates.length}パターン`);
        }
      }
    }

  } catch (error) {
    console.error('調査中にエラーが発生しました:', error);
  }
}

// スクリプトの実行
if (require.main === module) {
  investigateKnowledgeBaseDuplicates()
    .then(() => {
      console.log('\n✅ 調査完了');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 調査失敗:', error);
      process.exit(1);
    });
}

export { investigateKnowledgeBaseDuplicates };