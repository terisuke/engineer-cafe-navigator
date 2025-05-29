# Engineer Cafe Navigator

> 福岡市エンジニアカフェの音声AIエージェントシステム

[![Next.js](https://img.shields.io/badge/Next.js-15.x-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Mastra](https://img.shields.io/badge/Mastra-0.9.x-green)](https://mastra.ai/)
[![React](https://img.shields.io/badge/React-19.x-61dafb)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-VRM-orange)](https://threejs.org/)

## 📖 プロジェクト概要

Engineer Cafe Navigator（エンジニアカフェナビゲーター）は、福岡市エンジニアカフェの新規顧客対応を自動化する**多言語対応音声AIエージェントシステム**です。Mastraフレームワークを活用し、スタッフの負担軽減と顧客満足度向上を目指します。

### 🎯 主な目的

- **新規顧客対応の自動化**: 音声による案内とQ&A対応
- **多言語サポート**: 日本語・英語での対応
- **インタラクティブなプレゼンテーション**: 音声制御可能なスライドシステム
- **3Dキャラクターガイド**: VRMアバターによる親しみやすい接客

### ✨ 主要機能

| 機能カテゴリ          | 機能詳細                       |
|-------------------|----------------------------|
| 🎤 **音声対話**   | リアルタイム音声認識・合成、割り込み対応 |
| 📊 **動的スライド**   | Marp Markdown、音声ナレーション連動   |
| 🤖 **3Dキャラクター**   | VRMアバター、表情・動作制御          |
| 🌐 **多言語対応** | 日本語・英語切り替え              |
| 🔍 **RAG Q&A**    | 知識ベースからのリアルタイム回答           |
| 🔗 **外部連携**   | WebSocket受付システム統合          |

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
- **フレームワーク**: [Mastra](https://mastra.ai/) - AI エージェント開発フレームワーク
- **Frontend**: [Next.js 15](https://nextjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **AI/ML**: [Google Gemini 2.5 Flash Preview](https://ai.google.dev/)
- **音声処理**: [Google Cloud Speech-to-Text/Text-to-Speech](https://cloud.google.com/speech-to-text)

#### 専門技術
- **3Dキャラクター**: [Three.js](https://threejs.org/) + [@pixiv/three-vrm](https://github.com/pixiv/three-vrm)
- **スライドシステム**: [Marp](https://marp.app/) (Markdown Presentation Ecosystem)
- **データベース**: [PostgreSQL](https://www.postgresql.org/) + [pgvector](https://github.com/pgvector/pgvector)
- **スタイリング**: [Tailwind CSS v3.4.14](https://tailwindcss.com/) ⚠️ **重要: v3を使用**

## ⚠️ 重要: Tailwind CSS バージョンについて

このプロジェクトは **Tailwind CSS v3.4.14** を使用しています。Tailwind CSS v4にはアップグレードしないでください。v4には破壊的変更があり、異なる設定要件があります。

### CSS フレームワーク依存関係
- `tailwindcss@3.4.14` - CSSフレームワーク (v3、v4ではありません)
- `postcss@8.4.47` - CSSプロセッサー
- `autoprefixer@10.4.20` - ベンダープレフィックス追加

### インストール
```bash
pnpm add -D tailwindcss@3.4.14 postcss@8.4.47 autoprefixer@10.4.20
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
# 🔑 Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
GOOGLE_SPEECH_API_KEY=your-speech-api-key
GOOGLE_TRANSLATE_API_KEY=your-translate-api-key

# 🤖 Gemini AI
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash-preview-04-17

# 🗄️ Database
POSTGRES_URL=postgresql://user:password@localhost:5432/engineer_cafe_navigator

# 🌐 Next.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# 🔌 External Integration
WEBSOCKET_URL=ws://localhost:8080
RECEPTION_API_URL=http://localhost:8080/api
```

### 4. データベースのセットアップ

```bash
# PostgreSQL + pgvectorのインストール (macOS)
brew install postgresql pgvector

# データベース作成
createdb engineer_cafe_navigator

# pgvector拡張の有効化
psql engineer_cafe_navigator -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 5. VRMキャラクターモデルの配置

VRMファイルを以下に配置：

```
src/characters/models/
├── engineer-guide.vrm      # メインガイド
└── engineer-greeter.vrm    # 受付キャラクター
```

> 💡 **VRMモデルの入手方法**
> - [VRoid Hub](https://hub.vroid.com/) - 無料モデル多数
> - [Booth](https://booth.pm/) - 有料・高品質モデル
> - [VRoid Studio](https://vroid.com/studio) - 自作も可能

### 6. 開発サーバーの起動

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
│   │   │   ├── backgrounds/route.ts  # 背景画像API
│   │   │   └── qa/route.ts           # Q&A API
│   │   ├── components/               # React Components
│   │   ├── hooks/                    # React Hooks
│   │   ├── utils/                    # 共通ユーティリティ
│   │   └── page.tsx                  # メインページ
│   ├── mastra/                       # Mastra設定
│   │   ├── agents/                   # AIエージェント
│   │   ├── tools/                    # Mastra Tools
│   │   └── voice/                    # 音声サービス
│   ├── slides/                       # スライドコンテンツ
│   │   ├── themes/                   # カスタムテーマ
│   │   └── narration/                # ナレーションJSON
│   ├── characters/                   # キャラクターアセット
│   │   ├── models/                   # VRMモデル
│   │   ├── animations/               # アニメーション
│   │   └── expressions/              # 表情データ
│   ├── lib/                          # 共通ライブラリ
│   └── types/                        # 型定義
├── public/
│   └── backgrounds/                  # 背景画像 (自動検出)
├── config/
│   └── service-account-key.json      # GCPサービスアカウントキー (Git追跡対象外)
├── supabase/                         # Supabase migration & config
├── scripts/                          # 補助スクリプト
├── .env                              # 環境変数
├── package.json
├── pnpm-lock.yaml
├── tailwind.config.js
├── postcss.config.js
├── next.config.js
└── tsconfig.json
```

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
GOOGLE_GENERATIVE_AI_API_KEY=prod-gemini-key
POSTGRES_URL=postgresql://prod-db-url
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

# 3. Google Cloud APIキーの確認
echo $GOOGLE_SPEECH_API_KEY
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
pnpm run marp:validate

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
pnpm run logs:voice     # 音声処理ログ
pnpm run logs:character # キャラクターログ  
pnpm run logs:marp      # スライドログ
```

## 🔐 セキュリティ

### データ保護

- **音声データ**: 処理後即座に削除
- **会話ログ**: 暗号化保存（Mastra Memory）
- **個人情報**: GDPR・個人情報保護法準拠

### API セキュリティ

```typescript
// Rate limiting example
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});

// Input validation
const schema = z.object({
  audioData: z.string().max(10000000), // 10MB limit
  sessionId: z.string().uuid(),
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

# 型チェック
pnpm run type-check

# テスト実行
pnpm run test
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

---

<div align="center">

**Built with ❤️ by Engineer Cafe Team**

[🏠 ホーム](https://engineer-cafe.fukuoka.jp) • [📖 ドキュメント](docs/) • [🚀 デモ](https://demo.engineer-cafe-navigator.vercel.app)

</div>
