# 📋 管理UIへのデータ投入手順書

## 最優先で投入すべきデータ

### 1. エンジニアカフェ営業時間（日本語）

**フィールド入力内容:**
- **カテゴリ**: `engineer-cafe`
- **サブカテゴリ**: `operating_hours`
- **言語**: `ja` (選択)
- **ソース**: `engineercafe-structured-data`
- **メタデータ** (キーと値を個別入力):
  - キー: `title` → 値: `Engineer Cafe Hours of Operation`
  - キー: `importance` → 値: `high`
  - キー: `tags` → 値: `engineer_cafe,operating_hours,closed_days,consultation_hours`
  - キー: `last_updated` → 値: `2025-06-01`

**コンテンツ (Markdown)**:
```markdown
エンジニアカフェ本施設の営業時間は**9:00〜22:00**です。休館日は毎月**最終月曜日**（その日が祝日の場合は翌平日）と年末年始（**12/29〜1/3**）となっています。

※相談スタッフの対応時間は13:00〜21:00です。
```

### 2. エンジニアカフェ営業時間（英語）

**フィールド入力内容:**
- **カテゴリ**: `engineer-cafe`
- **サブカテゴリ**: `operating_hours`
- **言語**: `en` (選択)
- **ソース**: `engineercafe-structured-data`
- **メタデータ** (キーと値を個別入力):
  - キー: `title` → 値: `Engineer Cafe Hours of Operation`
  - キー: `importance` → 値: `high`
  - キー: `tags` → 値: `engineer_cafe,operating_hours,closed_days,consultation_hours`
  - キー: `last_updated` → 値: `2025-06-01`

**コンテンツ (Markdown)**:
```markdown
The Engineer Cafe facility is open from **9:00 to 22:00** daily. It is closed on the **last Monday** of each month (or the next weekday if that Monday is a holiday) and during the New Year holidays (**Dec 29–Jan 3**).

*Note: Consultation staff are available 13:00–21:00.*
```

## その他の重要データ

### 3. 施設・設備情報（日本語）
`facilities-equipment.md` の日本語セクションから：

**フィールド入力内容:**
- **カテゴリ**: `engineer-cafe`
- **サブカテゴリ**: `facilities`
- **言語**: `ja` (選択)
- **ソース**: `engineercafe-structured-data`
- **メタデータ**:
  - キー: `title` → 値: `Engineer Cafe Facilities and Equipment`
  - キー: `importance` → 値: `high`
  - キー: `tags` → 値: `engineer_cafe,facilities,equipment,wifi,makers_space,digital_fabrication`

**コンテンツ**: facilities-equipment.mdの「## Japanese」セクションの内容

### 4. 利用料金情報
`usage-fees.md` から料金情報も投入してください。

## 投入後の確認手順

### 1. データ確認
```bash
curl "http://localhost:3001/api/admin/knowledge" | jq '.data[] | {category, subcategory, language}'
```

### 2. 営業時間検索テスト
```bash
curl -X POST "http://localhost:3001/api/knowledge/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "営業時間",
    "language": "ja",
    "threshold": 0.5
  }' | jq
```

### 3. 音声Q&Aテスト
ブラウザで以下の質問を試してください：
- 「エンジニアカフェは何時から開いていますか？」
- 「何時まで使えますか？」
- 「休館日はありますか？」

期待される回答：
- 「営業時間は9時から22時まで」
- 「休館日は毎月最終月曜日」
- 「年末年始は12月29日から1月3日まで休館」

## トラブルシューティング

### データが投入できない場合
1. Supabaseのサービスが起動しているか確認
2. 環境変数が正しく設定されているか確認
3. ブラウザのコンソールでエラーを確認

### RAG検索が動作しない場合
1. 埋め込みベクトルが生成されているか確認
2. pgvectorの設定を確認
3. `DEBUG_RAG=true` を設定してログを確認