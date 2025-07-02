# Engineer Cafe Navigator 開発者ガイド

最終更新日: 2025年7月3日

## 📋 目次

1. [プロジェクト概要](#プロジェクト概要)
2. [現在の状況](#現在の状況)
3. [クイックスタート](#クイックスタート)
4. [アーキテクチャ](#アーキテクチャ)
5. [実装ガイド](#実装ガイド)
6. [テスト戦略](#テスト戦略)
7. [トラブルシューティング](#トラブルシューティング)
8. [今後の開発計画](#今後の開発計画)

---

## プロジェクト概要

Engineer Cafe Navigator は、福岡市中央区天神にあるエンジニアカフェの AI アシスタントシステムです。

### 主な機能
- 多言語対応（日本語・英語）
- 音声インターフェース（Google Cloud Speech-to-Text/Text-to-Speech）
- 3D VRM キャラクター表示
- RAG (Retrieval-Augmented Generation) による知識ベース検索
- 短期記憶機能（3分間の会話コンテキスト保持）
- カレンダー統合
- Web検索統合

### 技術スタック
- **Frontend**: Next.js 15.3.2 + React 19.1.0 + TypeScript 5.8.3
- **AI Framework**: Mastra 0.10.5
- **AI Models**: 
  - Google Gemini 2.0 Flash (応答生成)
  - OpenAI text-embedding-3-small (埋め込みベクトル)
- **Database**: PostgreSQL + pgvector
- **Voice**: Google Cloud Speech/TTS
- **3D Graphics**: Three.js + @pixiv/three-vrm

---

## 現在の状況

### 二つのアーキテクチャが共存

#### 1. 既存システム（本番稼働中）
- **中心**: EnhancedQAAgent（2,342行の巨大クラス）
- **テスト成功率**: 71.4%
- **平均応答時間**: 6.7秒

#### 2. 新システム（実装済み・テスト済み）
- **構成**: 7つの専門エージェント
  - RouterAgent: クエリルーティング
  - BusinessInfoAgent: 営業時間・料金・場所
  - FacilityAgent: 設備・Wi-Fi情報
  - MemoryAgent: 会話履歴管理
  - EventAgent: イベント・カレンダー
  - GeneralKnowledgeAgent: 一般知識・Web検索
  - MainQAWorkflow: 統合ワークフロー
- **テスト成功率**: 71.4%（既存と同等）
- **平均応答時間**: 4.6秒

---

## クイックスタート

### 1. 環境セットアップ（10分）

```bash
# リポジトリをクローン
git clone [repository-url]
cd engineer-cafe-navigator

# 環境変数の設定
cp .env.example .env.local
# .env.local を編集して必要な API キーを設定

# 依存関係のインストール
pnpm install

# データベースのセットアップ
pnpm db:migrate
pnpm seed:knowledge
```

### 2. 開発サーバー起動（5分）

```bash
# 開発サーバー起動
pnpm dev

# 別ターミナルで動作確認
curl -X POST http://localhost:3000/api/qa \
  -H "Content-Type: application/json" \
  -d '{"action": "ask_question", "question": "エンジニアカフェの営業時間は？", "language": "ja"}'
```

### 3. テスト実行（5分）

```bash
# 既存システムのテスト
pnpm tsx scripts/final-comprehensive-test.ts

# 新アーキテクチャのテスト
pnpm tsx scripts/test-new-architecture.ts

# RouterAgentのテスト
pnpm tsx scripts/test-router-agent.ts
```

---

## アーキテクチャ

### ディレクトリ構造

```
src/
├── app/                    # Next.js App Router
│   └── api/               # API エンドポイント
├── components/            # React コンポーネント
├── lib/                   # ユーティリティ
│   ├── audio/            # 音声処理
│   ├── simplified-memory.ts  # メモリシステム
│   └── query-classifier.ts   # クエリ分類
└── mastra/               # AI エージェント
    ├── agents/           # エージェント実装
    ├── tools/            # ツール実装
    └── workflows/        # ワークフロー
```

### データフロー

```
[ユーザー入力]
    ↓
[RouterAgent] → クエリ分析・ルーティング
    ↓
[専門エージェント] → 情報処理
    ↓
[MainQAWorkflow] → レスポンス生成
    ↓
[ユーザーへ返答]
```

---

## 実装ガイド

### 最重要：ツール管理パターン

```typescript
// ❌ 間違った実装（直接インポート）
import { ragSearchTool } from '@/mastra/tools/rag-search';
const result = await ragSearchTool.execute({ ... });

// ✅ 正しい実装（ツールマップから取得）
export class MyAgent extends Agent {
  private _tools: Map<string, any> = new Map();

  addTool(name: string, tool: any) {
    this._tools.set(name, tool);
  }

  async processQuery() {
    const ragTool = this._tools.get('ragSearch');
    if (!ragTool) {
      return this.getDefaultResponse();
    }
    
    try {
      const result = await ragTool.execute({ ... });
      // 結果の処理
    } catch (error) {
      console.error('[MyAgent] Tool error:', error);
      return this.getDefaultResponse();
    }
  }
}
```

### RAG検索結果の処理

```typescript
// 両方の形式に対応する必要がある
let context = '';
if (searchResult.results && Array.isArray(searchResult.results)) {
  // 標準RAGツールの形式
  context = searchResult.results
    .map(r => r.content)
    .join('\n\n');
} else if (searchResult.data && searchResult.data.context) {
  // エンハンスドRAGツールの形式
  context = searchResult.data.context;
}

if (!context) {
  return this.getDefaultResponse(language);
}
```

### 新しいエージェントの追加手順

1. **エージェントクラスの作成**
```typescript
// src/mastra/agents/my-new-agent.ts
export class MyNewAgent extends Agent {
  private _tools: Map<string, any> = new Map();
  
  // 実装...
}
```

2. **RouterAgentに追加**
```typescript
// src/mastra/agents/router-agent.ts
private selectAgent(category: string, requestType: string | null): string {
  const agentMap: Record<string, string> = {
    // ... 既存のマッピング
    'my-category': 'MyNewAgent',  // 追加
  };
}
```

3. **MainQAWorkflowに統合**
```typescript
// src/mastra/workflows/main-qa-workflow.ts
// コンストラクタで初期化
this.myNewAgent = new MyNewAgent(config);

// switch文に追加
case 'MyNewAgent':
  answer = await this.myNewAgent.processQuery(query, language);
  break;
```

---

## テスト戦略

### テストスクリプト一覧

#### 必須テスト（3個）
- `scripts/final-comprehensive-test.ts` - 既存システムの統合テスト
- `scripts/test-new-architecture.ts` - 新アーキテクチャの統合テスト
- `scripts/test-router-agent.ts` - ルーティング精度テスト

#### デバッグ用（必要時のみ使用）
- `scripts/test-specific-queries.ts` - 特定クエリのテスト
- `scripts/debug-categorization.ts` - カテゴリ分類のデバッグ
- `scripts/test-wifi-query.ts` - Wi-Fi関連クエリのテスト

### 成功基準
- **目標成功率**: 95%以上
- **平均応答時間**: 3秒以内
- **ルーティング精度**: 95%以上

---

## トラブルシューティング

### よくある問題と解決方法

#### 1. RAG検索結果が0件
```bash
# デバッグコマンド
pnpm tsx scripts/check-knowledge-base.ts
```
**原因**: カテゴリフィルタリングの問題
**解決**: カテゴリパラメータを削除、またはlimitパラメータを使用

#### 2. ツールが見つからない
```typescript
// エラー: Cannot read property 'execute' of undefined
```
**原因**: ツールが正しく登録されていない
**解決**: MainQAWorkflowの`initializeTools()`を確認

#### 3. 日本語/英語の混在
**原因**: 言語検出の問題
**解決**: LanguageProcessorの動作を確認

#### 4. メモリー機能が動作しない
**原因**: SessionIdが正しく伝播されていない
**解決**: SimplifiedMemorySystemのログを確認

---

## 今後の開発計画

### Phase 1: 短期目標（1-2週間）

#### 1. テストケースの改善
現在のテストはキーワードマッチングで厳しすぎる。意味的な正しさを評価する方法に変更。

#### 2. カレンダー統合の完成
EventAgentのカレンダーツール統合を完成させる。

#### 3. エンジニアカフェの正しい所在地情報
- **所在地**: 福岡県福岡市中央区天神1-15-30（赤煉瓦文化館内）
- **最寄り駅**: 地下鉄天神駅

### Phase 2: 中期目標（1ヶ月）

#### 1. 本番環境への段階的移行
- A/Bテストの実施
- パフォーマンス監視
- 段階的なトラフィック移行

#### 2. エンハンスドRAGの活用
現在は標準RAGツールのみ使用。エンハンスドRAGで検索精度向上。

### Phase 3: 長期目標（3ヶ月）

#### 1. 既存システムの廃止
EnhancedQAAgentを完全に新アーキテクチャに置き換え。

#### 2. パフォーマンス最適化
- キャッシュ戦略の実装
- 応答時間を2秒以内に

---

## 環境変数

```bash
# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# AI Models
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Calendar (Optional)
GOOGLE_CALENDAR_CLIENT_ID=your-calendar-client-id
GOOGLE_CALENDAR_CLIENT_SECRET=your-calendar-client-secret

# CRON Jobs
CRON_SECRET=your-cron-secret
```

---

## コマンドリファレンス

### 開発
```bash
pnpm dev                    # 開発サーバー起動
pnpm build                  # プロダクションビルド
pnpm start                  # プロダクションサーバー起動
pnpm lint                   # ESLint実行
pnpm typecheck              # TypeScriptの型チェック
```

### データベース
```bash
pnpm db:migrate             # マイグレーション実行
pnpm seed:knowledge         # 知識ベースの初期データ投入
pnpm db:reset               # データベースリセット（開発環境のみ）
```

### テスト
```bash
pnpm test:all               # 全テスト実行
pnpm test:architecture      # 新アーキテクチャのテスト
pnpm test:router            # ルーティングテスト
```

---

## 参考リンク

- [Mastra Documentation](https://mastra.dev)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Google Cloud Speech-to-Text](https://cloud.google.com/speech-to-text/docs)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)

---

## お問い合わせ

技術的な質問や提案がある場合は、GitHubのIssueを作成してください。

---

*このドキュメントは継続的に更新されます。最新版は常にリポジトリのmainブランチを参照してください。*