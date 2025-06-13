# Engineer Cafe Navigator

> 福岡市エンジニアカフェの音声AIエージェントシステム

[![Next.js](https://img.shields.io/badge/Next.js-15.3.2-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue)](https://www.typescriptlang.org/)
[![Mastra](https://img.shields.io/badge/Mastra-0.10.1-green)](https://mastra.ai/)
[![React](https://img.shields.io/badge/React-19.1.0-61dafb)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-VRM-orange)](https://threejs.org/)

## 📖 プロジェクト概要

Engineer Cafe Navigator（エンジニアカフェナビゲーター）は、福岡市エンジニアカフェの新規顧客対応を自動化する**多言語対応音声AIエージェントシステム**です。Mastraフレームワークを活用し、スタッフの負担軽減と顧客満足度向上を目指します。

### 🆕 最新アップデート (2025/05/30)

#### ✅ 実装完了
- **Service Account認証への移行** - APIキー不要でより安全な認証方式に
- **Supabaseメモリアダプタ統合** - 永続的な会話履歴とセッション管理
- **マルチターン会話対応** - 文脈を保持した自然な対話が可能に
- **Google Cloud Voice Service** - TTS/STT完全統合、Service Account認証
- **感情認識システム** - テキストから感情を検出し、VRM表情制御に連携
- **VRM表情アニメーション** - 会話内容に応じた自動表情変化
- **会話文脈保持** - 感情を含む詳細な会話履歴の永続化

### 🎯 主な目的

- **新規顧客対応の自動化**: 音声による案内とQ&A対応
- **多言語サポート**: 日本語・英語での対応
- **インタラクティブなプレゼンテーション**: 音声制御可能なスライドシステム
- **3Dキャラクターガイド**: VRMアバターによる親しみやすい接客
- **背景カスタマイズ**: 動的な背景変更とカスタマイズ機能

### ✨ 主要機能

| 機能カテゴリ          | 機能詳細                       |
|-------------------|----------------------------|
| 🎤 **音声対話**   | リアルタイム音声認識・合成、割り込み対応 |
| 🌐 **Web Speech API** | ブラウザネイティブ音声認識（コスト削減）|
| 🎭 **感情認識**   | テキスト解析による感情検出、VRM表情制御 |
| 😊 **テキスト感情認識**   | 会話内容からの感情分析とVRM表情制御 |
| 📊 **動的スライド**   | Marp Markdown、音声ナレーション連動   |
| 🤖 **3Dキャラクター**   | VRMアバター、感情連動表情・動作制御      |
| 🌐 **多言語対応** | 日本語・英語切り替え、多言語感情認識    |
| 🔍 **RAG Q&A**    | 知識ベースからのリアルタイム回答           |
| 💾 **会話記憶**   | Supabase永続化、文脈保持機能        |
| 🔗 **外部連携**   | WebSocket受付システム統合          |
| 🎨 **背景制御**   | 動的背景画像変更、グラデーション対応     |
| 🔒 **セキュリティ**  | XSS対策、iframe サンドボックス化     |

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
        Agent[Mastra Agents]
        Tools[Mastra Tools]
        Memory[Agent Memory]
    end
    
    subgraph "外部サービス"
        GCP[Google Cloud<br/>Speech/TTS]
        Gemini[Gemini 2.5<br/>Flash Preview]
        DB[(PostgreSQL<br/>+ pgvector)]
    end
    
    UI --> Voice
    Voice --> Agent
    Slide --> Tools
    Char --> Tools
    Agent --> GCP
    Agent --> Gemini
    Memory --> DB
    Tools --> DB
```

### 🛠️ 技術スタック

#### コア技術
- **フレームワーク**: [Mastra 0.10.1](https://mastra.ai/) - AI エージェント開発フレームワーク
- **Frontend**: [Next.js 15.3.2](https://nextjs.org/) + [TypeScript 5.8.3](https://www.typescriptlang.org/)
- **AI/ML**: [Google Gemini 2.5 Flash Preview](https://ai.google.dev/)
- **音声処理**: [Google Cloud Speech-to-Text/Text-to-Speech](https://cloud.google.com/speech-to-text)

#### 専門技術
- **3Dキャラクター**: [Three.js 0.176.0](https://threejs.org/) + [@pixiv/three-vrm 3.4.0](https://github.com/pixiv/three-vrm)
- **スライドシステム**: [Marp Core 4.1.0](https://marp.app/) (Markdown Presentation Ecosystem)
- **データベース**: [PostgreSQL](https://www.postgresql.org/) + [Supabase 2.49.8](https://supabase.com/)
- **スタイリング**: [Tailwind CSS v3.4.17](https://tailwindcss.com/) ⚠️ **重要: v3を使用**

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

# 🎛️ Feature Toggles (計画中)
# NEXT_PUBLIC_ENABLE_FACIAL_EXPRESSION=false
# NEXT_PUBLIC_USE_WEB_SPEECH_API=false
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
│   │   │   └── qa/route.ts           # Q&A API
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
│   │   ├── agents/                   # AIエージェント
│   │   │   ├── qa-agent.ts           # Q&Aエージェント
│   │   │   ├── realtime-agent.ts     # リアルタイムエージェント
│   │   │   ├── slide-narrator.ts     # スライドナレーター
│   │   │   └── welcome-agent.ts      # ウェルカムエージェント
│   │   ├── tools/                    # Mastra Tools
│   │   │   ├── character-control.ts  # キャラクター制御
│   │   │   ├── external-api.ts       # 外部API連携
│   │   │   ├── language-switch.ts    # 言語切り替え
│   │   │   ├── marp-renderer.ts      # Marpレンダラー
│   │   │   ├── narration-loader.ts   # ナレーション読み込み
│   │   │   ├── page-transition.ts    # ページ遷移
│   │   │   └── slide-control.ts      # スライド制御
│   │   ├── voice/                    # 音声サービス
│   │   │   └── google-cloud-voice.ts # Google Cloud音声API
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
│   │   ├── audio-player.ts           # 音声再生
│   │   ├── marp-processor.ts         # Marp処理
│   │   ├── narration-manager.ts      # ナレーション管理
│   │   ├── supabase.ts              # Supabase設定
│   │   ├── supabase-memory.ts       # Supabaseメモリ管理
│   │   ├── voice-recorder.ts         # 音声録音
│   │   ├── vrm-utils.ts             # VRMユーティリティ
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
├── .env                              # 環境変数
├── package.json
├── pnpm-lock.yaml
├── tailwind.config.js
├── postcss.config.js
├── next.config.js
└── tsconfig.json
```

## 🎯 ハイブリッド音声認識アプローチ

### 概要
Engineer Cafe NavigatorはGoogle Cloud STTとWeb Speech APIのハイブリッドアプローチを採用し、コスト削減と品質向上を実現しています。

### 音声認識の実装
- **Google Cloud STT（Service Account認証）**: 高精度な音声認識を提供（実装済み）
- **MediaRecorder API**: WebM/Opus形式での高品質音声録音（実装済み）

### テキストベースの感情認識 (実装済み)
- **EmotionManager**: 日本語・英語のキーワード分析による感情検出
- **VRM表情制御**: 6種類の感情表現（neutral, happy, sad, angry, relaxed, surprised）
- **コンテキスト連動**: 会話履歴を考慮した感情判定

### 将来の拡張予定
以下の機能は将来のバージョンで実装予定です：

- **Web Speech API**: ブラウザネイティブ音声認識（現在はGoogle Cloud STTを使用）
- **表情認識**: face-api.jsを使ったカメラベースの表情検出
- **Enhanced Voice API**: `/api/voice/enhanced`エンドポイント

### ブラウザ互換性
- **Google Cloud STT**: すべてのモダンブラウザで動作
- **MediaRecorder API**: Chrome, Firefox, Edgeで完全対応、Safariで部分対応
- **Three.js VRM**: 全モダンブラウザ対応

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
| **総合応答時間** | **< 1.3秒** | 🔄 最適化中        |

### 同時利用者数

- **想定**: 最大10名
- **ピーク対応**: 20名
- **実装**: Mastraエージェント並列処理

## 🚀 デプロイ・運用

### Vercelへのデプロイ

```bash
# Vercel CLIインストール
pnpm install -g vercel

# プロジェクトの初期化
vercel

# 本番デプロイ
vercel --prod
```

### 環境変数設定（本番）

Vercelダッシュボードで以下を設定：

```bash
GOOGLE_CLOUD_PROJECT_ID=prod-project-id
GOOGLE_CLOUD_CREDENTIALS=./config/service-account-key.json
GOOGLE_GENERATIVE_AI_API_KEY=prod-gemini-key
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXTAUTH_SECRET=secure-production-secret
```

### 推奨本番データベース

- **[Neon](https://neon.tech/)**: Serverless PostgreSQL
- **[Supabase](https://supabase.com/)**: OSS Firebase代替
- **[Railway](https://railway.app/)**: 簡単スケーリング

> 💡 すべてのサービスでpgvector拡張が利用可能

## 🔍 監視・ログ

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
ls src/characters/models/

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
curl http://localhost:3000/api/voice?action=status
curl http://localhost:3000/api/character?action=health
curl http://localhost:3000/api/marp?action=health

# ログの確認
# 現在利用可能なコマンド
pnpm run dev         # 開発サーバー起動
pnpm run build       # ビルド
pnpm run lint        # ESLintチェック
pnpm run test:api    # APIテスト
pnpm run test:rag    # RAG検索テスト
pnpm run test:external-apis # 外部APIテスト
```

## 🔐 セキュリティ

### データ保護

- **音声データ**: 処理後即座に削除
- **会話ログ**: 暗号化保存（Mastra Memory）
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
- ✅ **音声認識精度**: 95%以上
- ✅ **システム障害時間**: 月間1時間以内

### ビジネス指標

- ✅ **スタッフ負荷削減**: 50%
- ✅ **新規登録完了率**: +10%向上
- ✅ **多言語対応効率**: 80%短縮

## 🗺️ ロードマップ

### 📅 Phase 1 (完了): MVP実装
- [x] 基本音声対話システム
- [x] スライドプレゼンテーション
- [x] 3Dキャラクター統合
- [x] 多言語対応（日英）

### 📅 Phase 2 (計画中): 高度な対話
- [ ] 会話の文脈理解向上
- [ ] 感情認識・表現
- [ ] カスタマイズ可能なキャラクター
- [ ] さらなる言語対応

### 📅 Phase 3 (将来): 拡張機能
- [ ] 予約システム統合
- [ ] QRコード読み取り
- [ ] AR/VR体験
- [ ] モバイルアプリ

### 📅 Phase 4 (発展): AI強化
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

# 利用可能なテストコマンド:
pnpm run test:api           # APIエンドポイントテスト
pnpm run test:rag           # RAG検索機能テスト
pnpm run test:external-apis # 外部API連携テスト
```

### 問題報告

バグや改善提案は [Issues](https://github.com/your-org/engineer-cafe-navigator/issues) にて報告してください。

## 📜 ライセンス

このプロジェクトは [MIT License](LICENSE) の下で公開されています。

## 📞 連絡先・サポート

### プロジェクトチーム

- **開発リーダー**: [Your Name](mailto:your.email@example.com)
- **エンジニアカフェ**: [cafe@example.com](mailto:cafe@example.com)

### 技術サポート

- **Issues**: [GitHub Issues](https://github.com/your-org/engineer-cafe-navigator/issues)
- **Discussion**: [GitHub Discussions](https://github.com/your-org/engineer-cafe-navigator/discussions)
- **Discord**: [開発コミュニティ](https://discord.gg/your-invite)

## 📖 詳細ドキュメント

### 技術ドキュメント
- **[📚 ドキュメント一覧](docs/README.md)** - 全ドキュメントのインデックス
- **[📖 API仕様書](docs/API.md)** - REST API完全仕様
- **[🔒 セキュリティガイド](docs/SECURITY.md)** - セキュリティ対策・脅威分析
- **[🛠️ 開発ガイド](docs/DEVELOPMENT.md)** - 開発者向け技術仕様
- **[🚀 デプロイガイド](docs/DEPLOYMENT.md)** - 本番環境デプロイ手順

### セキュリティハイライト
- ✅ **XSS対策**: HTMLサニタイゼーション実装済み
- ✅ **iframe保護**: サンドボックス化 + Origin検証
- ✅ **通信暗号化**: HTTPS + セキュリティヘッダー
- ✅ **入力検証**: Zodスキーマバリデーション
- ✅ **プライバシー**: UI状態同期によるデータ保護

---

<div align="center">

**Built with ❤️ by Engineer Cafe Team**

[🏠 ホーム](https://engineer-cafe.fukuoka.jp) • [📚 ドキュメント](docs/README.md) • [🚀 デモ](https://demo.engineer-cafe-navigator.vercel.app)

</div>
