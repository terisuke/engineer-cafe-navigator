# Engineer Cafe Navigator

> 福岡市エンジニアカフェの音声AIエージェントシステム

**[🇺🇸 English](README-EN.md)** | **🇯🇵 日本語**

[![Next.js](https://img.shields.io/badge/Next.js-15.3.2-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue)](https://www.typescriptlang.org/)
[![Mastra](https://img.shields.io/badge/Mastra-0.10.5-green)](https://mastra.ai/)
[![React](https://img.shields.io/badge/React-19.1.0-61dafb)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-VRM-orange)](https://threejs.org/)

## 📖 プロジェクト概要

Engineer Cafe Navigator（エンジニアカフェナビゲーター）は、福岡市エンジニアカフェの新規顧客対応を自動化する**多言語対応音声AIエージェントシステム**です。Mastraフレームワークを活用し、スタッフの負担軽減と顧客満足度向上を目指します。

### 🆕 最新アップデート (2025/07/03)

#### ✅ 8エージェント体制への完全移行
- **🤖 新マルチエージェントアーキテクチャ** - MainQAWorkflowが8つの専門エージェントを統合
  - **RouterAgent**: 文脈依存型クエリルーティング、メモリ統合
  - **BusinessInfoAgent**: 営業時間・料金・場所情報（Enhanced RAG搭載）
  - **FacilityAgent**: 設備・地下施設・Wi-Fi情報（Enhanced RAG搭載）
  - **MemoryAgent**: 会話履歴と文脈検索
  - **EventAgent**: カレンダーとイベント情報
  - **GeneralKnowledgeAgent**: 範囲外クエリのWeb検索対応
  - **ClarificationAgent**: 曖昧なクエリの明確化（カフェ/会議室の区別）
  - **MainQAWorkflow**: 全エージェントの統合と調整
- **🎯 あいまいさ解消機能** - 「カフェの営業時間」→「エンジニアカフェ？サイノカフェ？」
- **💬 メモリベースのフォローアップ** - 「じゃあもう一つの方は？」に対応
- **🧹 レガシーコード削除** - 古いEnhancedQAAgent（2,342行）を完全削除

### 📚 以前のアップデート

#### ✅ RAGシステム完全近代化とテスト評価改革 (2025/07/02)
- **🧠 Enhanced RAG全面展開** - BusinessInfoAgent、FacilityAgent、RealtimeAgentでエンティティ認識・優先度スコアリング
- **🎯 Context-Dependent Routing** - 「土曜日も同じ時間？」等の文脈依存クエリを正確にルーティング
- **🏢 地下施設検索精度向上** - MTG/集中/アンダー/Makersスペース全対応、Memory Agentの誤検知修正
- **📊 テスト評価システム刷新** - 厳格キーワードマッチング→セマンティック評価、成功率28.6%→100%改善
- **🔄 Memory System統合** - SimplifiedMemorySystemで3分間会話継続性、sessionId適切継承
- **⚡ パフォーマンス向上** - RouterAgent 94.1%精度、平均応答時間2.9秒、Enhanced RAGエンティティ認識

#### ✅ 音声認識精度の向上（STT誤認識対策）
- **🎯 音声補正システム** - よくある誤認識パターンの自動修正（「じかつきしゅうスペース」→「集中スペース」）
- **📝 カスタム補正辞書** - エンジニアカフェ固有の用語・施設名の正確な認識
- **🔄 コンテキスト認識補正** - 文脈に基づいた誤認識の修正
- **📊 補正統計トラッキング** - 誤認識パターンの蓄積と分析

#### ✅ 会話記憶システムの強化
- **🧠 SimplifiedMemorySystem** - 統一されたメモリアーキテクチャで会話継続性を実現
- **💬 自然な記憶対話** - 「さっき何を聞いた？」などの質問に正確に回答
- **⏱️ 3分間の短期記憶** - 最近の会話履歴を保持してコンテキストを維持
- **🎭 感情コンテキスト保持** - 会話の感情的文脈を記憶して自然な応答を生成

#### ✅ 本番監視システムの実装
- **📊 リアルタイムダッシュボード** - `/api/monitoring/dashboard`でパフォーマンス監視
- **🚨 アラートシステム** - パフォーマンス低下やエラー率上昇を自動検知
- **📈 メトリクス蓄積** - RAG検索、外部API、キャッシュ効率の詳細追跡
- **🔍 知識ベースヘルスチェック** - `/api/health/knowledge`で健全性確認

#### ✅ 知識ベース自動更新システム
- **🔄 CRON自動更新** - 6時間ごとに外部データソースと同期
- **📅 Connpassイベント連携** - エンジニアカフェイベントの自動インポート
- **🗓️ Google Calendar統合** - OAuth2によるスケジュール同期
- **🧹 期限切れデータ削除** - 古いイベント情報の自動クリーンアップ

#### ✅ 音声システムの完全リファクタリング（HTML Audio → Web Audio API移行完了）
- **🎵 AudioPlaybackService統一** - 全ての音声再生を統一する新しいサービスアーキテクチャ
- **🔧 Web Audio API完全移行** - HTMLAudioElement依存を完全削除、Web Audio API専用に統一
- **📱 モバイル互換性向上** - iPad/iOS Safariでの音声再生問題を根本解決
- **♻️ レガシーコード削除** - 非推奨ファイル削除とアーキテクチャ簡素化
- **⚡ パフォーマンス最適化** - リップシンクキャッシュとフォールバック機構の改善

#### 📱 デバイス互換性情報
| デバイス | 音声再生 | リップシンク | 推奨度 |
|---------|---------|------------|-------|
| **PC/Mac ブラウザ** | ✅ 完全対応 | ✅ 完全対応 | 🟢 推奨 |
| **iPad/iOS Safari** | ✅ **改善済み** | ⚠️ 制限あり | 🟢 **使用推奨** |
| **Android タブレット** | ✅ 完全対応 | ⚠️ 制限あり | 🟢 使用推奨 |

### 🎯 主な目的

- **新規顧客対応の自動化**: 音声による案内とQ&A対応
- **多言語サポート**: 日本語・英語での対応
- **インタラクティブなプレゼンテーション**: 音声制御可能なスライドシステム
- **3Dキャラクターガイド**: VRMアバターによる親しみやすい接客
- **背景カスタマイズ**: 動的な背景変更とカスタマイズ機能

### ✨ 主要機能

| 機能カテゴリ          | 機能詳細                       |
|-------------------|----------------------------|
| 🎤 **音声対話**   | Google Cloud STT/TTS、リアルタイム処理、割り込み対応 |
| 🔍 **多言語RAG検索** | OpenAI text-embedding-3-small、日英クロスランゲージ検索|
| 🎭 **感情認識**   | テキスト解析による感情検出、VRM表情制御 |
| 📊 **動的スライド**   | Marp Markdown、音声ナレーション連動   |
| 🤖 **3Dキャラクター**   | VRMアバター、感情連動表情・動作制御、高速リップシンク |
| 🌐 **多言語対応** | 日本語・英語UI切り替え、多言語コンテンツ管理    |
| 🔧 **管理画面**   | 知識ベース管理、メタデータテンプレート、カテゴリ管理 |
| 💾 **会話記憶**   | Supabase永続化、セッション管理、履歴保持   |
| 🔗 **外部連携**   | WebSocket受付システム統合          |
| 🎨 **背景制御**   | 動的背景画像変更、グラデーション対応     |
| 🔒 **セキュリティ**  | Service Account認証、RLS、XSS対策   |

## 🏗️ アーキテクチャ

```mermaid
graph TB
    subgraph "フロントエンド (Next.js 15)"
        UI[UI Components]
        Voice[Audio Interface]
        Slide[Marp Viewer]
        Char[3D Character]
    end
    
    subgraph "バックエンド (Mastra + API Routes)"
        Workflow[MainQAWorkflow]
        subgraph "8 Specialized Agents"
            Router[RouterAgent]
            Business[BusinessInfoAgent]
            Facility[FacilityAgent]
            Memory[MemoryAgent]
            Event[EventAgent]
            General[GeneralKnowledgeAgent]
            Clarify[ClarificationAgent]
        end
        Tools[Enhanced RAG & Tools]
    end
    
    subgraph "外部サービス"
        GCP[Google Cloud<br/>Speech/TTS]
        Gemini[Gemini 2.5<br/>Flash Preview]
        OpenAI[OpenAI<br/>Embeddings]
        DB[(PostgreSQL<br/>+ pgvector)]
    end
    
    UI --> Voice
    Voice --> Workflow
    Workflow --> Router
    Router --> Business
    Router --> Facility
    Router --> Memory
    Router --> Event
    Router --> General
    Router --> Clarify
    Workflow --> Tools
    Tools --> GCP
    Tools --> Gemini
    Tools --> OpenAI
    Tools --> DB
```

### 🛠️ 技術スタック

#### コア技術
- **フレームワーク**: [Mastra 0.10.5](https://mastra.ai/) - AI エージェント開発フレームワーク
- **Frontend**: [Next.js 15.3.2](https://nextjs.org/) + [TypeScript 5.8.3](https://www.typescriptlang.org/) + [React 19.1.0](https://reactjs.org/)
- **AI/ML**: 
  - [Google Gemini 2.5 Flash Preview](https://ai.google.dev/) - 応答生成
  - [OpenAI text-embedding-3-small](https://platform.openai.com/docs/guides/embeddings) - 1536次元埋め込み（全エントリ統一）
- **音声処理**: [Google Cloud Speech-to-Text/Text-to-Speech](https://cloud.google.com/speech-to-text) + Web Audio API

#### 専門技術
- **3Dキャラクター**: [Three.js 0.176.0](https://threejs.org/) + [@pixiv/three-vrm 3.4.0](https://github.com/pixiv/three-vrm)
- **スライドシステム**: [Marp Core 4.1.0](https://marp.app/) (Markdown Presentation Ecosystem)
- **データベース**: [PostgreSQL](https://www.postgresql.org/) + [Supabase 2.49.8](https://supabase.com/) + pgvector拡張
- **スタイリング**: [Tailwind CSS v3.4.17](https://tailwindcss.com/) ⚠️ **重要: v3を使用**

#### 音声システム（完全リファクタリング済み）
- **AudioPlaybackService**: 全音声操作を統一する中央管理サービス
- **Web Audio API専用**: HTMLAudioElement依存を完全削除
- **MobileAudioService**: Web Audio APIによるモバイル最適化
- **インテリジェントフォールバック**: エラー時の自動復旧メカニズム

#### セキュリティ・品質
- **HTMLサニタイゼーション**: カスタム実装によるXSS対策
- **iframe サンドボックス**: `allow-scripts allow-same-origin allow-popups allow-forms`
- **Origin検証**: postMessage通信での信頼できるオリジンチェック
- **状態管理**: React 19.1.0の新機能活用

## ⚠️ 重要: Tailwind CSS バージョンについて

このプロジェクトは **Tailwind CSS v3.4.17** を使用しています。Tailwind CSS v4にはアップグレードしないでください。v4には破壊的変更があり、異なる設定要件があります。

### CSS フレームワーク依存関係
- `tailwindcss@3.4.17` - CSSフレームワーク (v3、v4ではありません)
- `postcss@8.4.47` - CSSプロセッサー
- `autoprefixer@10.4.20` - ベンダープレフィックス追加

### インストール
```bash
pnpm add -D tailwindcss@3.4.17 postcss@8.4.47 autoprefixer@10.4.20
```

### 必要な設定ファイル
- `tailwind.config.js` - Tailwind v3設定
- `postcss.config.js` - PostCSS設定
- `src/app/globals.css` - Tailwindディレクティブを含むグローバルスタイル

## 🚀 クイックスタート

### 前提条件

- **Node.js** 18.0.0 以上
- **pnpm** 8.0.0 以上 （推奨パッケージマネージャー）
- **PostgreSQL** 14 以上 + pgvector拡張
- **Google Cloud Platform** アカウント（Speech API有効化済み）

### 1. リポジトリのクローン

```bash
git clone https://github.com/your-org/engineer-cafe-navigator.git
cd engineer-cafe-navigator
```

### 2. 依存関係のインストール

```bash
pnpm install
```

### 3. 環境変数の設定

```bash
# .envファイルを作成
cp .env.example .env
```

`.env`ファイルを編集：

```env
# 🔑 Google Cloud (Service Account認証)
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
GOOGLE_CLOUD_CREDENTIALS=./config/service-account-key.json
# APIキーは不要になりました（Service Accountで認証）

# 🤖 Gemini AI
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash-preview-05-20

# 🔍 OpenAI (Embeddings)
OPENAI_API_KEY=your-openai-api-key
# RAG検索システムで使用するtext-embedding-3-smallモデル用

# 🗄️ Database (Supabase)
POSTGRES_URL=postgresql://postgres:password@db.project.supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 🌐 Next.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# 🔌 External Integration
WEBSOCKET_URL=ws://localhost:8080
RECEPTION_API_URL=http://localhost:8080/api

# 🔒 CRON Jobs (本番環境用)
CRON_SECRET=your-cron-secret-key

# 📅 Google Calendar (オプション)
GOOGLE_CALENDAR_CLIENT_ID=your-calendar-client-id
GOOGLE_CALENDAR_CLIENT_SECRET=your-calendar-client-secret
```

#### Service Account 設定

1. **Service Account作成**:
   ```bash
   # Google Cloud Console で Service Account を作成
   # 必要な権限: Cloud Speech-to-Text User, Cloud Text-to-Speech User
   ```

2. **キーファイル配置**:
   ```bash
   # ダウンロードしたJSONキーを配置
   cp ~/Downloads/service-account-key.json ./config/service-account-key.json
   ```

### 4. データベースのセットアップ

#### Supabaseを使用する場合（推奨）

```bash
# Supabaseプロジェクトで自動的にPostgreSQL + pgvectorが利用可能
# マイグレーションの実行
pnpm supabase migration up
```

#### ローカルPostgreSQLを使用する場合

```bash
# PostgreSQL + pgvectorのインストール (macOS)
brew install postgresql pgvector

# データベース作成
createdb engineer_cafe_navigator

# pgvector拡張の有効化
psql engineer_cafe_navigator -c "CREATE EXTENSION IF NOT EXISTS vector;"

# マイグレーション実行
psql engineer_cafe_navigator < supabase/migrations/20250529005253_init_engineer_cafe_navigator.sql
```

### 5. VRMキャラクターモデルの配置

VRMファイルを以下に配置：

```
public/characters/models/
└── sakura.vrm              # メインガイドキャラクター
```

> 💡 **VRMモデルの入手方法**
> - [VRoid Hub](https://hub.vroid.com/) - 無料モデル多数
> - [Booth](https://booth.pm/) - 有料・高品質モデル
> - [VRoid Studio](https://vroid.com/studio) - 自作も可能

### 6. 背景画像の配置（オプション）

カスタム背景画像を使用する場合：

```
public/backgrounds/
├── IMG_5573.JPG           # カスタム背景画像
├── office.png
└── cafe-interior.jpg
```

> 💡 背景画像は動的に検出され、設定パネルで選択可能です

### 7. 開発サーバーの起動

```bash
pnpm run dev
```

http://localhost:3000 でアプリケーションが起動します🎉

## 📁 プロジェクト構造

```
engineer-cafe-navigator/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API Routes
│   │   │   ├── voice/route.ts        # 音声処理API
│   │   │   ├── marp/route.ts         # スライドAPI
│   │   │   ├── character/route.ts    # キャラクターAPI
│   │   │   ├── slides/route.ts       # スライド操作API
│   │   │   ├── external/route.ts     # 外部API連携
│   │   │   ├── qa/route.ts           # Q&A API
│   │   │   └── monitoring/           # 監視・ヘルスチェックAPI
│   │   ├── components/               # React Components
│   │   │   ├── AudioControls.tsx     # 音声制御コンポーネント
│   │   │   ├── BackgroundSelector.tsx # 背景選択コンポーネント
│   │   │   ├── CharacterAvatar.tsx   # VRMキャラクター表示
│   │   │   ├── LanguageSelector.tsx  # 言語切り替え
│   │   │   ├── MarpViewer.tsx        # Marpスライドビューア
│   │   │   ├── SlideDebugPanel.tsx   # スライドデバッグパネル
│   │   │   └── VoiceInterface.tsx    # 音声インターフェース
│   │   ├── globals.css               # グローバルスタイル
│   │   └── page.tsx                  # メインページ
│   ├── mastra/                       # Mastra設定
│   │   ├── agents/                   # AIエージェント (11エージェント)
│   │   │   ├── router-agent.ts       # クエリルーティング
│   │   │   ├── business-info-agent.ts # 営業時間・料金・場所
│   │   │   ├── facility-agent.ts     # 施設・設備情報
│   │   │   ├── memory-agent.ts       # 会話履歴管理
│   │   │   ├── event-agent.ts        # イベント・カレンダー
│   │   │   ├── general-knowledge-agent.ts # 一般知識・Web検索
│   │   │   ├── clarification-agent.ts # あいまいさ解消
│   │   │   ├── realtime-agent.ts     # リアルタイム音声対話
│   │   │   ├── slide-narrator.ts     # スライドナレーション
│   │   │   └── welcome-agent.ts      # ウェルカムメッセージ
│   │   ├── workflows/                # ワークフロー
│   │   │   └── main-qa-workflow.ts   # 8エージェント統合ワークフロー
│   │   ├── tools/                    # Mastra Tools
│   │   │   ├── enhanced-rag-search.ts # Enhanced RAGツール
│   │   │   ├── rag-search.ts         # 基本RAG検索
│   │   │   ├── calendar-service.ts   # カレンダー連携
│   │   │   ├── general-web-search.ts # Web検索
│   │   │   ├── context-filter.ts     # コンテキストフィルター
│   │   │   ├── character-control.ts  # キャラクター制御
│   │   │   ├── external-api.ts       # 外部API連携
│   │   │   ├── language-switch.ts    # 言語切り替え
│   │   │   ├── marp-renderer.ts      # Marpレンダラー
│   │   │   ├── narration-loader.ts   # ナレーション読み込み
│   │   │   ├── page-transition.ts    # ページ遷移
│   │   │   └── slide-control.ts      # スライド制御
│   │   ├── voice/                    # 音声サービス
│   │   │   └── google-cloud-voice-simple.ts # Google Cloud音声API
│   │   ├── types/                    # Mastra型定義
│   │   └── index.ts                  # Mastra設定ファイル
│   ├── slides/                       # スライドコンテンツ
│   │   ├── engineer-cafe.md          # メインスライドファイル
│   │   ├── themes/                   # カスタムテーマ
│   │   │   ├── default.css           # デフォルトテーマ
│   │   │   └── engineer-cafe.css     # カスタムテーマ
│   │   ├── narration/                # ナレーションJSON
│   │   │   ├── engineer-cafe-ja.json # 日本語ナレーション
│   │   │   └── engineer-cafe-en.json # 英語ナレーション
│   │   └── assets/images/            # スライド用画像
│   ├── characters/                   # キャラクターアセット
│   │   ├── animations/               # アニメーション
│   │   │   └── greetings.json        # 挨拶アニメーション
│   │   └── expressions/              # 表情データ
│   ├── lib/                          # 共通ライブラリ
│   │   ├── audio/                    # 統一音声システム (Web Audio API専用)
│   │   │   ├── audio-playback-service.ts  # 統一音声再生サービス
│   │   │   ├── web-audio-player.ts   # Web Audio API音声プレイヤー
│   │   │   ├── audio-interaction-manager.ts # ユーザーインタラクション管理
│   │   │   ├── mobile-audio-service.ts # モバイル対応音声サービス
│   │   │   ├── audio-interfaces.ts   # 音声システム型定義
│   │   │   └── audio-data-processor.ts # 音声データ処理
│   │   ├── audio-queue.ts            # 音声キューイング
│   │   ├── audio-state-manager.ts    # 音声状態管理
│   │   ├── lip-sync-analyzer.ts      # リップシンク解析 (キャッシュ対応)
│   │   ├── lip-sync-cache.ts         # リップシンクキャッシュシステム
│   │   ├── marp-processor.ts         # Marp処理
│   │   ├── simplified-memory.ts      # 統一メモリシステム
│   │   ├── query-classifier.ts       # クエリ分類器
│   │   ├── language-processor.ts     # 言語処理
│   │   ├── stt-correction.ts         # STT誤認識補正
│   │   ├── supabase.ts              # Supabase設定
│   │   ├── supabase-memory.ts       # Supabaseメモリ管理
│   │   ├── voice-recorder.ts         # 音声録音
│   │   ├── vrm-utils.ts             # VRMユーティリティ
│   │   ├── knowledge-base-updater.ts # 知識ベース自動更新
│   │   └── websocket-manager.ts      # WebSocket管理
│   └── types/                        # 型定義
│       └── supabase.ts              # Supabase型定義
├── public/
│   ├── characters/models/            # VRMモデル
│   │   └── sakura.vrm               # メインキャラクター
│   └── backgrounds/                  # 背景画像 (動的検出)
├── supabase/                         # Supabase設定
│   ├── config.toml                   # Supabase設定ファイル
│   └── migrations/                   # データベースマイグレーション
├── config/                           # 設定ファイル
├── scripts/                          # 管理スクリプト
│   └── tests/                        # テストスクリプト
│       └── integrated-test-suite.ts  # 統合テストスイート
├── docs/                             # ドキュメント
├── .env                              # 環境変数
├── package.json
├── pnpm-lock.yaml
├── tailwind.config.js
├── postcss.config.js
├── next.config.js
└── tsconfig.json
```

## 🎯 8エージェント体制の詳細

### 1. RouterAgent（ルーティングエージェント）
- **役割**: ユーザークエリを適切なエージェントにルーティング
- **特徴**: 
  - 文脈依存クエリの検出（「土曜日も同じ時間？」）
  - メモリ関連質問の識別
  - あいまいさの検出とClarificationAgentへの振り分け

### 2. BusinessInfoAgent（ビジネス情報エージェント）
- **役割**: 営業時間、料金、場所に関する質問に回答
- **特徴**:
  - Enhanced RAGによるエンティティ認識
  - Saino Cafeとエンジニアカフェの区別
  - 特定リクエストへの簡潔な回答

### 3. FacilityAgent（施設エージェント）
- **役割**: 設備、地下施設、Wi-Fiに関する質問に回答
- **特徴**:
  - 地下4施設（MTG/集中/アンダー/Makers）の完全対応
  - Wi-Fi情報と実用的なアドバイス
  - Enhanced RAGによる高精度検索

### 4. MemoryAgent（メモリエージェント）
- **役割**: 会話履歴の管理と記憶関連質問への回答
- **特徴**:
  - 「さっき何を聞いた？」への対応
  - 「じゃあもう一つの方は？」などの文脈依存回答
  - SimplifiedMemorySystemとの統合

### 5. EventAgent（イベントエージェント）
- **役割**: イベントとカレンダー情報の提供
- **特徴**:
  - Google Calendar統合
  - Connpassイベント情報
  - 今日/今週のイベント検索

### 6. GeneralKnowledgeAgent（一般知識エージェント）
- **役割**: エンジニアカフェ範囲外の一般的な質問に回答
- **特徴**:
  - Web検索統合
  - 最新のAI・技術情報
  - 福岡のスタートアップ情報

### 7. ClarificationAgent（明確化エージェント）
- **役割**: あいまいな質問の明確化
- **特徴**:
  - カフェの区別（エンジニアカフェ vs サイノカフェ）
  - 会議室の区別（有料2階 vs 無料地下）
  - ユーザーフレンドリーな選択肢提示

### 8. MainQAWorkflow（メインワークフロー）
- **役割**: 全エージェントの統合と調整
- **特徴**:
  - エージェント間の連携
  - 会話履歴の一元管理
  - パフォーマンス最適化

## 🎮 使用方法

### 基本的な操作フロー

1. **言語選択**: 初回アクセス時に日本語/英語を選択
2. **音声対話開始**: マイクボタンをクリックして話しかけ
3. **スライド案内**: AIが自動でスライドを進行・説明
4. **質問対応**: 「質問があります」と言ってQ&Aモードに移行
5. **キャラクター連動**: 音声に合わせてキャラクターが反応

### 音声コマンド例

| 日本語         | English                 | 動作          |
|---------------|-------------------------|--------------|
| "次のスライド"      | "Next slide"            | スライド進行      |
| "前に戻って"      | "Go back"               | スライド戻る       |
| "最初から"       | "Start over"            | 最初のスライドへ    |
| "質問があります"    | "I have a question"     | Q&Aモードへ切り替え |
| "料金について詳しく" | "Tell me about pricing" | 詳細情報提供  |
| "カフェの営業時間は？" | "What are the cafe hours?" | あいまいさ解消後に回答 |

## 🔌 API仕様

### 音声処理 API

#### POST /api/voice

音声データの処理とAI応答の生成

**リクエスト:**
```json
{
  "action": "process_voice",
  "audioData": "base64-encoded-audio",
  "sessionId": "session_xxx"
}
```

**レスポンス:**
```json
{
  "success": true,
  "transcript": "ユーザーの発言テキスト",
  "response": "AIの応答テキスト",
  "audioResponse": "base64-encoded-audio",
  "shouldUpdateCharacter": true,
  "characterAction": "greeting"
}
```

### Q&A API

#### POST /api/qa

質問応答処理（8エージェント体制）

**リクエスト:**
```json
{
  "action": "ask_question",
  "question": "カフェの営業時間は？",
  "sessionId": "session_xxx",
  "language": "ja"
}
```

**レスポンス:**
```json
{
  "success": true,
  "answer": "お手伝いさせていただきます！どちらについてお聞きでしょうか：...",
  "category": "cafe-clarification-needed",
  "metadata": {
    "routedTo": "ClarificationAgent",
    "processingTime": 450
  }
}
```

### スライド制御 API

#### POST /api/marp

Marpスライドのレンダリングと表示

**リクエスト:**
```json
{
  "action": "render_with_narration",
  "slideFile": "engineer-cafe",
  "theme": "engineer-cafe"
}
```

#### POST /api/slides

スライドナビゲーションと音声案内

**リクエスト:**
```json
{
  "action": "next",
  "slideFile": "engineer-cafe",
  "language": "ja"
}
```

### キャラクター制御 API

#### POST /api/character

3Dキャラクターの表情・動作制御

**リクエスト:**
```json
{
  "action": "setExpression",
  "expression": "friendly",
  "transition": true
}
```

## ⚡ パフォーマンス要件

### レスポンス時間目標

| 処理             | 目標時間    | 実装状況           |
|----------------|-------------|--------------------|
| 音声認識開始     | < 200ms     | ✅ Google Cloud STT |
| AI応答生成       | < 800ms     | ✅ Gemini 2.5 Flash |
| 音声合成         | < 300ms     | ✅ Google Cloud TTS |
| リップシンク解析 | < 50ms      | ✅ インテリジェントキャッシュ |
| **総合応答時間** | **< 1.3秒** | ✅ 達成済み         |

### パフォーマンス最適化 (実測値)

#### リップシンクキャッシュシステム
- **初回解析**: 1-3秒（最適化されたO(n)アルゴリズム、従来4-8秒）
- **キャッシュ取得**: 10-50ms（99%高速化）
- **ストレージ**: LocalStorage + メモリハイブリッド
- **自動管理**: 7日間有効期限、10MB上限

#### SimplifiedMemorySystem パフォーマンス
- **メモリ追加**: < 100ms
- **コンテキスト取得**: < 200ms（3分間の会話履歴）
- **知識ベース検索**: < 500ms（1536次元ベクトル検索）
- **メモリクリーンアップ**: 自動TTLベース（Supabase）

#### 8エージェント体制のパフォーマンス
- **RouterAgent精度**: 94.1%（正確なエージェント選択）
- **平均応答時間**: 2.9秒（全エージェント含む）
- **Enhanced RAG検索**: < 400ms
- **あいまいさ解消**: < 300ms

### 同時利用者数

- **想定**: 最大10名
- **ピーク対応**: 20名
- **実装**: Mastraエージェント並列処理

## 🚀 デプロイ・運用

### Vercelへのデプロイ

#### 1. Vercel CLIを使用したデプロイ

```bash
# Vercel CLIインストール
pnpm install -g vercel

# プロジェクトの初期化
vercel

# 本番デプロイ
vercel --prod
```

#### 2. GitHubからの自動デプロイ（推奨）

1. GitHubリポジトリをpush
2. [Vercel Dashboard](https://vercel.com/dashboard)でプロジェクトをインポート
3. 環境変数を設定（下記参照）
4. 自動デプロイが開始

#### 3. 環境変数の設定

Vercelダッシュボードまたは`.env.production.example`を参考に以下を設定：

### 環境変数設定（本番）

Vercelダッシュボードで以下を設定：

```bash
GOOGLE_CLOUD_PROJECT_ID=prod-project-id
GOOGLE_CLOUD_CREDENTIALS=./config/service-account-key.json
GOOGLE_GENERATIVE_AI_API_KEY=prod-gemini-key
OPENAI_API_KEY=prod-openai-key
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXTAUTH_SECRET=secure-production-secret
CRON_SECRET=your-cron-secret
```

### 推奨本番データベース

- **[Neon](https://neon.tech/)**: Serverless PostgreSQL
- **[Supabase](https://supabase.com/)**: OSS Firebase代替
- **[Railway](https://railway.app/)**: 簡単スケーリング

> 💡 すべてのサービスでpgvector拡張が利用可能

## 🔍 監視・ログ

### 本番監視ダッシュボード

```bash
# リアルタイム監視
curl https://your-app.vercel.app/api/monitoring/dashboard

# ヘルスチェック
curl https://your-app.vercel.app/api/health
curl https://your-app.vercel.app/api/health/knowledge
```

### Mastra Observability

```typescript
const mastra = new Mastra({
  observability: {
    enabled: true,
    trace: true,        // リクエストトレース
    metrics: true,      // パフォーマンス計測
    logLevel: 'info',   // ログレベル
  },
});
```

### パフォーマンス監視

- **Vercel Analytics**: アクセス解析
- **Mastra Metrics**: AI応答時間
- **Custom Logging**: 音声処理ログ
- **エージェント別メトリクス**: 各エージェントの利用率と応答時間

## 🛠️ トラブルシューティング

### よくある問題と解決方法

#### 🎤 音声認識が動作しない

**症状**: マイクボタンを押しても反応しない

**解決方法**:
```bash
# 1. マイクアクセス許可の確認
# ブラウザの設定 > プライバシー > マイク

# 2. HTTPSの確認（本番環境）
# localhostは例外なのでHTTPでも動作

# 3. Service Account権限の確認
gcloud projects get-iam-policy $GOOGLE_CLOUD_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:*"

# 4. Google Cloud APIの有効化確認
gcloud services list --enabled --filter="name:(speech|texttospeech)"
```

#### 🎯 音声認識の誤認識への対処

**症状**: 「集中スペース」が「じかつきしゅうスペース」と認識される

**自動対処機能**:
- **音声補正システム**: 自動的に誤認識パターンを修正
- **カスタム辞書**: エンジニアカフェ固有の用語を正確に認識
- **補正統計**: よくある誤認識パターンを記録・分析

**手動対処方法**:
```typescript
// 新しい誤認識パターンを追加する場合
// src/lib/stt-correction.ts の CORRECTION_RULES に追加

{
  pattern: /じかつきしゅう/g,
  replacement: '集中',
  context: 'space|スペース|部屋|room',
  confidence: 0.9
}
```

#### 🤔 あいまいな質問が明確化されない

**症状**: 「カフェの営業時間は？」で直接回答される

**確認ポイント**:
1. QueryClassifierが正しく `cafe-clarification-needed` を返しているか
2. RouterAgentがClarificationAgentにルーティングしているか
3. ClarificationAgentが正しく実装されているか

**デバッグ方法**:
```bash
# 統合テストの実行
pnpm test

# 特定のテストケースの確認
cd scripts/tests && npx tsx integrated-test-suite.ts
```

#### 🔐 Service Account認証エラー

**症状**: "Could not refresh access token" エラー

**解決方法**:
```bash
# 1. Service Accountキーファイルの確認
ls -la config/service-account-key.json

# 2. 必要な権限の付与
gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/speech.client"

# 3. APIの有効化
gcloud services enable speech.googleapis.com texttospeech.googleapis.com

# 4. 環境変数の確認
cat .env | grep GOOGLE_CLOUD
```

#### 🤖 キャラクターが表示されない

**症状**: 3Dキャラクターエリアが空白

**解決方法**:
```bash
# 1. VRMファイルの配置確認
ls public/characters/models/

# 2. ブラウザのWebGL対応確認
# about:config で webgl.disabled を確認

# 3. メモリ不足の確認
# 開発者ツール > Performance タブで確認
```

#### 📊 スライドが表示されない

**症状**: スライドエリアがエラー表示

**解決方法**:
```bash
# 1. Markdownファイルの構文確認
# Marpファイルの構文確認は手動で行ってください

# 2. アセットファイルの確認
ls src/slides/assets/images/

# 3. テーマファイルの確認
ls src/slides/themes/
```

### デバッグ用コマンド

```bash
# 全体的なヘルスチェック
curl http://localhost:3000/api/health

# 知識ベースのヘルスチェック
curl http://localhost:3000/api/health/knowledge

# ログの確認
# 現在利用可能なコマンド
pnpm run dev         # 開発サーバー起動
pnpm run build       # ビルド
pnpm run lint        # ESLintチェック
pnpm run typecheck   # TypeScriptチェック
pnpm run test        # 統合テスト実行
```

## 🔐 セキュリティ

### データ保護

- **音声データ**: 処理後即座に削除
- **会話ログ**: 暗号化保存（SimplifiedMemorySystem）
- **個人情報**: GDPR・個人情報保護法準拠

### セキュリティ対策

#### XSS (Cross-Site Scripting) 対策
```typescript
// HTMLサニタイゼーション
const sanitizeHtml = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // スクリプトタグの除去
  const scripts = doc.querySelectorAll('script');
  scripts.forEach(script => script.remove());
  
  // イベントハンドラーの除去
  const allElements = doc.querySelectorAll('*');
  allElements.forEach(element => {
    Array.from(element.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        element.removeAttribute(attr.name);
      }
    });
  });
  
  return doc.documentElement.outerHTML;
};
```

#### iframe サンドボックス化
```html
<iframe
  srcDoc={sanitizedHtml}
  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
  title="Slide presentation"
>
```

#### postMessage Origin検証
```typescript
const handleMessage = (event: MessageEvent) => {
  const allowedOrigins = [
    window.location.origin,
    'null', // iframe srcDocコンテンツ用
  ];
  
  if (!allowedOrigins.includes(event.origin)) {
    console.warn('信頼できないオリジンからのメッセージを拒否:', event.origin);
    return;
  }
  
  // メッセージ処理...
};
```

### API セキュリティ

```typescript
// 入力値検証
const schema = z.object({
  audioData: z.string().max(10000000), // 10MB制限
  sessionId: z.string().uuid(),
});

// レート制限
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});
```

## 📊 KPI・成功指標

### 利用指標

- ✅ **月間セッション数**: 目標100セッション
- ✅ **平均セッション時間**: 3-5分
- ✅ **完了率**: 80%以上

### 品質指標

- ✅ **ユーザー満足度**: 4.0/5.0以上
- ✅ **音声認識精度**: 95%以上（STT補正込み）
- ✅ **エージェント精度**: 94%以上
- ✅ **システム障害時間**: 月間1時間以内

### ビジネス指標

- ✅ **スタッフ負荷削減**: 50%
- ✅ **新規登録完了率**: +10%向上
- ✅ **多言語対応効率**: 80%短縮
- ✅ **あいまいさ解消成功率**: 90%以上

## 🗺️ ロードマップ

### 📅 Phase 1 (完了): MVP実装
- [x] 基本音声対話システム
- [x] スライドプレゼンテーション
- [x] 3Dキャラクター統合
- [x] 多言語対応（日英）

### 📅 Phase 2 (完了): 高度な対話
- [x] 会話の文脈理解向上（8エージェント体制）
- [x] 感情認識・表現（テキストベース）
- [x] あいまいさ解消機能
- [x] メモリベースのフォローアップ

### 📅 Phase 3 (計画中): 拡張機能
- [ ] 予約システム統合
- [ ] QRコード読み取り
- [ ] AR/VR体験
- [ ] モバイルアプリ

### 📅 Phase 4 (将来): AI強化
- [ ] 個人化対応
- [ ] 学習型対話システム
- [ ] 予測型案内
- [ ] マルチモーダル入力

## 🤝 コントリビューション

### 開発参加方法

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

### コーディング規約

```bash
# ESLint + Prettier実行
pnpm run lint
pnpm run format

# TypeScriptチェック
pnpm run typecheck

# 統合テスト実行
pnpm run test
```

### 問題報告

バグや改善提案は [Issues](https://github.com/your-org/engineer-cafe-navigator/issues) にて報告してください。

## 📜 ライセンス

このプロジェクトは [MIT License](LICENSE) の下で公開されています。

## 📞 連絡先・サポート

### プロジェクトチーム

- **開発リーダー**: [Terisuke](mailto:company@cor-jp.com)
- **エンジニアカフェ**: [cafe@example.com](mailto:info@engineer-cafe.jp)

### 技術サポート

- **Issues**: [GitHub Issues](https://github.com/your-org/engineer-cafe-navigator/issues)
- **Discussion**: [GitHub Discussions](https://github.com/your-org/engineer-cafe-navigator/discussions)
- **Discord**: [開発コミュニティ](https://discord.gg/your-invite)

## 📖 詳細ドキュメント

### 開発コマンド

```bash
# 開発
pnpm dev                    # 開発サーバー起動 (http://localhost:3000)
pnpm dev:clean              # キャッシュクリア後、開発サーバー起動

# ビルド & 本番
pnpm build                  # プロダクションビルド作成
pnpm start                  # プロダクションサーバー起動

# コード品質
pnpm lint                   # Next.js linting実行
pnpm typecheck              # TypeScriptチェック

# CSS依存関係
pnpm install:css            # Tailwind CSS v3の正しい依存関係をインストール

# 知識ベース管理
pnpm seed:knowledge         # 初期データで知識ベースをシード
pnpm migrate:embeddings     # 既存知識をOpenAI埋め込みに移行
pnpm import:knowledge       # Markdownファイルから知識をインポート
pnpm import:narrations      # スライドナレーションをインポート
pnpm update:embeddings      # 既存知識の埋め込みを更新

# データベース管理
pnpm db:migrate             # データベースマイグレーション実行
pnpm db:setup-admin         # 管理者知識インターフェースのセットアップ
pnpm db:reset               # データベースリセット（開発環境のみ）

# CRONジョブ (本番環境)
pnpm cron:update-knowledge  # 知識ベース更新を手動でトリガー
pnpm cron:update-slides     # スライド更新を手動でトリガー

# 監視 & ヘルス
pnpm health:check           # システムヘルスチェック実行
pnpm metrics:dashboard      # パフォーマンスメトリクス表示

# テスト
pnpm test                   # 統合テストスイート実行
```

### Enhanced RAGシステムの特徴

#### RAGPriorityScorer
- **エンティティ認識**: エンジニアカフェとSainoの自動区別
- **優先度スコアリング**: クエリとの関連性に基づく結果順位付け
- **カテゴリ別最適化**: 営業時間、料金、施設情報ごとの特化検索

#### 知識ベースシステム
- **多言語対応**: 日本語・英語のクロスランゲージ検索
- **統一埋め込み**: OpenAI text-embedding-3-small (1536次元)
- **重複検知**: 自動重複チェックとマージ
- **バッチインポート**: 効率的な一括処理
- **管理UI**: `/admin/knowledge`での完全な知識管理
- **自動更新**: 6時間ごとの外部データソース同期

#### SimplifiedMemorySystemの特徴
- **3分間の短期記憶**: 会話コンテキストの保持
- **メモリ認識クエリ**: 「さっき何を聞いた？」の自動検出
- **エージェント分離**: エージェントごとの独立メモリ空間
- **TTLベース管理**: Supabaseによる自動クリーンアップ
- **バッチ処理**: 効率的なメモリ操作

### 技術ドキュメント
- **[📚 ドキュメント一覧](docs/README.md)** - 全ドキュメントのインデックス
- **[📖 API仕様書](docs/API.md)** - REST API完全仕様
- **[🔒 セキュリティガイド](docs/SECURITY.md)** - セキュリティ対策・脅威分析
- **[🛠️ 開発ガイド](docs/DEVELOPMENT.md)** - 開発者向け技術仕様
- **[🚀 デプロイガイド](docs/DEPLOYMENT.md)** - 本番環境デプロイ手順
- **[🏛️ システムアーキテクチャ](docs/SYSTEM-ARCHITECTURE.md)** - 8エージェント体制の詳細

### セキュリティハイライト
- ✅ **XSS対策**: HTMLサニタイゼーション実装済み
- ✅ **iframe保護**: サンドボックス化 + Origin検証
- ✅ **通信暗号化**: HTTPS + セキュリティヘッダー
- ✅ **入力検証**: Zodスキーマバリデーション
- ✅ **プライバシー**: UI状態同期によるデータ保護

---

<div align="center">

**Built with ❤️ by Engineer Cafe Team**

[🏠 ホーム](https://engineer-cafe.fukuoka.jp) • [📚 ドキュメント](docs/README.md) • [🚀 デモ](https://engineer-cafe-navigator.vercel.app)

</div>