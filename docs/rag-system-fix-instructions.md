# 🚨 RAGシステム動作不良の原因分析と修正指示書

## 問題の概要
音声Q&AシステムでRAG検索が機能していない。質問「エンジニアカフェが何時から何時まで開いているんですか？」に対して「情報が見つかりません」と回答している。

## 根本原因
**データベースが空のため、RAG検索が結果を返せない状態**

### 詳細な問題フロー
```
1. ユーザー: 「エンジニアカフェが何時から何時まで開いているんですか？」
   ↓
2. RealtimeAgent.generateResponse() が呼ばれる
   ↓
3. QAAgent.answerQuestion() を呼び出し
   ↓
4. QAAgent が RAGSearchTool.searchKnowledgeBase() を実行
   ↓
5. データベースが空なので結果なし
   ↓
6. フォールバック: 「ご提示いただいた情報の中には...記載がございません」
```

## 技術的な確認事項

### 1. データベースの状態
```bash
# 確認コマンド
curl "http://localhost:3001/api/admin/knowledge"
# 結果: {"data":[],"total":0,"page":1,"limit":20}  ← 空
```

### 2. RAGシステムの実装は正しい
- ✅ RealtimeAgent → QAAgent の連携
- ✅ QAAgent → RAGSearchTool の連携
- ✅ 埋め込みベクトル生成（768次元）
- ✅ pgvector検索機能
- ❌ データが投入されていない

## 緊急修正手順

### ステップ1: データ投入の確認
```bash
# knowledge_baseテーブルの確認
curl "http://localhost:3001/api/knowledge/search" \
  -X GET

# 期待される結果
{
  "status": "ok",
  "hasData": false,  # ← 現在false
  "message": "Knowledge base is empty or not properly configured"
}
```

### ステップ2: 手動データ投入（即効性のある対応）

#### A. 管理UIからの投入（推奨）
1. http://localhost:3001/admin/knowledge にアクセス
2. 「新規作成」ボタンをクリック
3. 以下のデータを投入：

**エンジニアカフェ営業時間（日本語）**
```
カテゴリ: engineer-cafe
サブカテゴリ: hours
言語: ja
ソース: engineercafe-structured-data
メタデータ:
  - title: エンジニアカフェ営業時間
  - importance: critical
  - tags: 営業時間,アクセス,利用時間

コンテンツ:
エンジニアカフェは年中無休で24時間営業しています。
深夜・早朝でも利用可能で、セキュリティカードによる入退室管理を行っています。
スタッフ常駐時間は平日10:00-19:00、土日祝日は10:00-17:00です。
```

**エンジニアカフェ営業時間（英語）**
```
カテゴリ: engineer-cafe
サブカテゴリ: hours
言語: en
ソース: engineercafe-structured-data
メタデータ:
  - title: Engineer Cafe Operating Hours
  - importance: critical
  - tags: hours,access,opening-times

コンテンツ:
Engineer Cafe is open 24/7, 365 days a year.
Available for use even late at night and early morning with security card access control.
Staff available: Weekdays 10:00-19:00, Weekends/Holidays 10:00-17:00.
```

#### B. スクリプトでの一括投入（時間がある場合）
```bash
# import-markdown-knowledge.tsの修正が必要
# 768次元に対応させる必要がある
```

### ステップ3: 投入後の確認
```bash
# データ投入確認
curl "http://localhost:3001/api/admin/knowledge"
# 期待: dataに投入したレコードが表示される

# RAG検索テスト
curl -X POST "http://localhost:3001/api/knowledge/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "エンジニアカフェの営業時間",
    "language": "ja"
  }'
```

### ステップ4: 音声Q&Aでの確認
1. ブラウザで http://localhost:3001 にアクセス
2. 「エンジニアカフェは何時から開いていますか？」と質問
3. 「24時間営業」という回答が返ってくることを確認

## 長期的な改善提案

### 1. データ投入の自動化
```typescript
// scripts/seed-knowledge-base.ts の作成
import { knowledgeBaseUtils } from '@/lib/knowledge-base-utils';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

async function seedKnowledgeBase() {
  const markdownDir = path.join(process.cwd(), 'data/knowledge-base/markdown');
  const files = fs.readdirSync(markdownDir, { recursive: true });
  
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    
    const content = fs.readFileSync(path.join(markdownDir, file), 'utf-8');
    const { data: frontmatter, content: markdown } = matter(content);
    
    // 言語ごとに分割して投入
    const sections = markdown.split(/^## (Japanese|English)$/m);
    // ... 投入ロジック
  }
}
```

### 2. ヘルスチェックエンドポイント
```typescript
// /api/health/knowledge
export async function GET() {
  const stats = await knowledgeBaseUtils.getStats();
  return NextResponse.json({
    healthy: stats.total > 0,
    stats,
    recommendation: stats.total === 0 ? 'Run data seeding script' : 'OK'
  });
}
```

### 3. デバッグモードの追加
```typescript
// QAAgent に詳細ログを追加
if (process.env.DEBUG_RAG === 'true') {
  console.log('[QA Agent] Query:', query);
  console.log('[QA Agent] RAG Results:', context);
  console.log('[QA Agent] Final Response:', response);
}
```

## アクションアイテム

### 即座に実施（30分以内）
1. ✅ 管理UIから最低限のデータを手動投入
   - 営業時間情報（日英）
   - 施設情報（日英）
   - アクセス情報（日英）

### 本日中に実施
2. ✅ 全12ファイルのマークダウンを管理UIから投入
3. ✅ RAG検索の動作確認

### 今週中に実施
4. ⬜ import-markdown-knowledge.tsスクリプトの修正
5. ⬜ 自動シードスクリプトの作成
6. ⬜ CI/CDパイプラインへの組み込み

## 確認用コマンド集
```bash
# データベース確認
curl "http://localhost:3001/api/admin/knowledge" | jq

# RAG検索テスト
curl -X POST "http://localhost:3001/api/knowledge/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "営業時間", "language": "ja"}' | jq

# 音声認識テスト（base64音声データが必要）
curl -X POST "http://localhost:3001/api/voice" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "process_text",
    "text": "エンジニアカフェの営業時間は？",
    "language": "ja"
  }' | jq
```

## 結論
**RAGシステム自体は正常に実装されているが、データベースが空のため機能していない。**
まずは管理UIから手動でデータを投入し、動作確認を行うことが最優先。