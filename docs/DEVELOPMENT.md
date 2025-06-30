# 開発ガイド

> Engineer Cafe Navigator 開発者向けドキュメント

## 📖 概要

このドキュメントは Engineer Cafe Navigator の開発に参加する開発者向けの技術仕様、開発手順、およびベストプラクティスをまとめています。

## 🛠️ 開発環境セットアップ

### 必要なツール

```bash
# Node.js (推奨: v18以上)
node --version  # v18.0.0+

# pnpm (推奨パッケージマネージャー)
npm install -g pnpm

# Git
git --version

# VSCode (推奨エディタ)
code --version
```

### 推奨VSCode拡張機能

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "unifiedjs.vscode-mdx",
    "ms-vscode.vscode-json"
  ]
}
```

### 環境変数設定

```bash
# .env.local作成
cp .env.example .env.local

# 必要な環境変数
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project
GOOGLE_CLOUD_CREDENTIALS=./config/service-account-key.json
OPENAI_API_KEY=your-openai-api-key  # RAG検索用埋め込みモデル (1536次元)
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXTAUTH_SECRET=your-secret-key
CRON_SECRET=your-cron-secret  # CRON ジョブ認証用

# オプション: 外部連携
GOOGLE_CALENDAR_CLIENT_ID=your-client-id
GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret
```

## 🏗️ アーキテクチャ詳細

### フォルダ構成規則

```
src/
├── app/                    # Next.js 15 App Router
│   ├── api/               # API Routes
│   ├── components/        # UIコンポーネント
│   ├── admin/            # 管理画面
│   ├── globals.css        # グローバルスタイル
│   └── page.tsx          # メインページ
├── mastra/               # Mastra AI設定
│   ├── agents/          # AIエージェント
│   ├── tools/           # Mastraツール
│   ├── types/           # 型定義
│   └── index.ts         # Mastra設定
├── lib/                 # 共通ライブラリ
│   ├── audio/           # 音声関連サービス
│   ├── rag/             # RAG検索システム
│   └── simplified-memory.ts # メモリシステム
├── types/               # TypeScript型定義
└── slides/              # プレゼンテーションコンテンツ
    └── narration/       # スライドナレーションJSON
```

### コンポーネント設計原則

#### 1. コンポーネント分類

```typescript
// 1. プレゼンテーショナルコンポーネント（UIのみ）
interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

const Button: React.FC<ButtonProps> = ({ onClick, children, variant = 'primary' }) => {
  return (
    <button 
      onClick={onClick}
      className={`btn ${variant === 'primary' ? 'btn-primary' : 'btn-secondary'}`}
    >
      {children}
    </button>
  );
};

// 2. コンテナコンポーネント（ロジック + UI）
const VoiceInterface: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  const handleStartRecording = useCallback(() => {
    // 録音ロジック
    setIsRecording(true);
  }, []);
  
  return (
    <div className="voice-interface">
      <Button onClick={handleStartRecording}>
        {isRecording ? '録音停止' : '録音開始'}
      </Button>
      {transcript && <p>{transcript}</p>}
    </div>
  );
};

// 3. レイアウトコンポーネント（構造）
const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
};
```

#### 2. Props設計パターン

```typescript
// 基本的なProps型定義
interface ComponentProps {
  // 必須プロパティ
  id: string;
  title: string;
  
  // オプショナルプロパティ
  description?: string;
  className?: string;
  
  // イベントハンドラー
  onClick?: (event: React.MouseEvent) => void;
  onSubmit?: (data: FormData) => Promise<void>;
  
  // 子要素
  children?: React.ReactNode;
  
  // バリアント・状態
  variant?: 'default' | 'primary' | 'secondary';
  isLoading?: boolean;
  disabled?: boolean;
}

// 拡張可能なProps設計
interface BaseProps {
  className?: string;
  'data-testid'?: string;
}

interface ButtonProps extends BaseProps {
  variant: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

// 複合コンポーネントパターン
const Modal = {
  Root: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) => (
    isOpen ? <div className="modal-overlay">{children}</div> : null
  ),
  Header: ({ children }: { children: React.ReactNode }) => (
    <div className="modal-header">{children}</div>
  ),
  Body: ({ children }: { children: React.ReactNode }) => (
    <div className="modal-body">{children}</div>
  ),
  Footer: ({ children }: { children: React.ReactNode }) => (
    <div className="modal-footer">{children}</div>
  ),
};

// 使用例
<Modal.Root isOpen={isModalOpen}>
  <Modal.Header>タイトル</Modal.Header>
  <Modal.Body>コンテンツ</Modal.Body>
  <Modal.Footer>アクション</Modal.Footer>
</Modal.Root>
```

### 状態管理パターン

#### 1. ローカル状態（useState）

```typescript
// シンプルな状態管理
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [data, setData] = useState<ApiResponse | null>(null);

// 複雑なオブジェクト状態
interface UserSettings {
  language: 'ja' | 'en';
  volume: number;
  background: BackgroundOption;
}

const [settings, setSettings] = useState<UserSettings>({
  language: 'ja',
  volume: 80,
  background: defaultBackground,
});

// 設定更新ヘルパー
const updateSetting = useCallback(<K extends keyof UserSettings>(
  key: K,
  value: UserSettings[K]
) => {
  setSettings(prev => ({ ...prev, [key]: value }));
}, []);
```

#### 2. 複雑な状態（useReducer）

```typescript
interface AppState {
  currentSlide: number;
  totalSlides: number;
  isPlaying: boolean;
  character: {
    expression: string;
    animation: string;
  };
}

type AppAction =
  | { type: 'NEXT_SLIDE' }
  | { type: 'PREVIOUS_SLIDE' }
  | { type: 'GOTO_SLIDE'; payload: number }
  | { type: 'TOGGLE_PLAY' }
  | { type: 'SET_CHARACTER'; payload: Partial<AppState['character']> };

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'NEXT_SLIDE':
      return {
        ...state,
        currentSlide: Math.min(state.currentSlide + 1, state.totalSlides),
      };
    case 'PREVIOUS_SLIDE':
      return {
        ...state,
        currentSlide: Math.max(state.currentSlide - 1, 1),
      };
    case 'GOTO_SLIDE':
      return {
        ...state,
        currentSlide: Math.max(1, Math.min(action.payload, state.totalSlides)),
      };
    case 'TOGGLE_PLAY':
      return {
        ...state,
        isPlaying: !state.isPlaying,
      };
    case 'SET_CHARACTER':
      return {
        ...state,
        character: { ...state.character, ...action.payload },
      };
    default:
      return state;
  }
};

const useAppState = () => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  const actions = useMemo(() => ({
    nextSlide: () => dispatch({ type: 'NEXT_SLIDE' }),
    previousSlide: () => dispatch({ type: 'PREVIOUS_SLIDE' }),
    gotoSlide: (slide: number) => dispatch({ type: 'GOTO_SLIDE', payload: slide }),
    togglePlay: () => dispatch({ type: 'TOGGLE_PLAY' }),
    setCharacter: (character: Partial<AppState['character']>) => 
      dispatch({ type: 'SET_CHARACTER', payload: character }),
  }), []);
  
  return { state, actions };
};
```

## 🎨 スタイリング規約

### Tailwind CSS クラス命名規則

```typescript
// 1. レスポンシブ対応
const responsiveClasses = "w-full md:w-1/2 lg:w-1/3 xl:w-1/4";

// 2. 状態による条件付きクラス
const buttonClasses = `
  px-4 py-2 rounded-lg font-medium transition-colors
  ${variant === 'primary' 
    ? 'bg-blue-500 hover:bg-blue-600 text-white' 
    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
  }
  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
`;

// 3. コンポーネント特化クラス
const cardClasses = `
  bg-white rounded-lg shadow-md hover:shadow-lg 
  transition-shadow duration-200 overflow-hidden
`;

// 4. カスタムCSSクラス（globals.css）
// .btn-primary { @apply px-4 py-2 bg-primary text-white rounded-lg ... }
```

### カスタムCSS記述規則

```css
/* globals.css */

/* 1. Tailwindディレクティブ */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* 2. カスタムプロパティ（CSS変数） */
:root {
  --color-primary: #3b82f6;
  --color-secondary: #6b7280;
  --color-accent: #10b981;
  --spacing-section: 2rem;
  --border-radius-card: 0.75rem;
}

/* 3. ベースレイヤー */
@layer base {
  html {
    @apply scroll-smooth;
  }
  
  body {
    @apply text-gray-900 bg-white font-sans;
  }
  
  h1, h2, h3, h4, h5, h6 {
    @apply font-semibold leading-tight;
  }
}

/* 4. コンポーネントレイヤー */
@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-primary text-white rounded-lg 
           hover:bg-secondary transition-colors duration-200 
           font-medium shadow-sm hover:shadow-md 
           disabled:opacity-50 disabled:cursor-not-allowed;
  }
  
  .card {
    @apply bg-white rounded-lg shadow-md hover:shadow-lg 
           transition-shadow duration-200 overflow-hidden;
  }
  
  .glass {
    @apply bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg;
  }
}

/* 5. ユーティリティレイヤー */
@layer utilities {
  .text-gradient {
    @apply bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent;
  }
  
  .transition-smooth {
    @apply transition-all duration-300 ease-in-out;
  }
  
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}

/* 6. アニメーション定義 */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}
```

## 🔧 API開発規約

### API Route構造

```typescript
// app/api/[endpoint]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// 1. リクエストスキーマ定義
const RequestSchema = z.object({
  action: z.enum(['create', 'read', 'update', 'delete']),
  data: z.object({
    // データ構造定義
  }).optional(),
});

// 2. レスポンス型定義
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 3. エラーハンドリングユーティリティ
const handleApiError = (error: unknown): NextResponse<ApiResponse> => {
  console.error('API Error:', error);
  
  if (error instanceof z.ZodError) {
    return NextResponse.json({
      success: false,
      error: 'Invalid request data',
      message: error.errors.map(e => e.message).join(', '),
    }, { status: 400 });
  }
  
  return NextResponse.json({
    success: false,
    error: 'Internal server error',
    message: error instanceof Error ? error.message : 'Unknown error',
  }, { status: 500 });
};

// 4. メインハンドラー
export async function POST(request: NextRequest) {
  try {
    // リクエストボディ解析
    const body = await request.json();
    
    // バリデーション
    const validatedData = RequestSchema.parse(body);
    
    // ビジネスロジック
    const result = await processRequest(validatedData);
    
    // 成功レスポンス
    return NextResponse.json({
      success: true,
      data: result,
      message: 'Request processed successfully',
    });
    
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    // アクション別処理
    switch (action) {
      case 'status':
        return NextResponse.json({
          success: true,
          data: { status: 'healthy', timestamp: new Date().toISOString() },
        });
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Unknown action',
        }, { status: 400 });
    }
    
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Mastra Agent開発

```typescript
// mastra/agents/example-agent.ts
import { Agent } from '@mastra/core';
import { z } from 'zod';

// 1. エージェント設定スキーマ
const AgentConfigSchema = z.object({
  model: z.string().default('gemini-2.5-flash-preview-05-20'),
  temperature: z.number().min(0).max(1).default(0.7),
  maxTokens: z.number().default(1000),
});

// 2. エージェント入力スキーマ
const AgentInputSchema = z.object({
  message: z.string(),
  context: z.object({
    currentSlide: z.number().optional(),
    language: z.enum(['ja', 'en']).default('ja'),
    sessionId: z.string(),
  }),
});

// 3. エージェント実装
export const exampleAgent = new Agent({
  name: 'example-agent',
  instructions: `
    あなたはエンジニアカフェの案内AIです。
    以下の役割を担います：
    
    1. 来客への親切な対応
    2. 施設情報の提供
    3. 技術的な質問への回答
    4. 適切な日本語・英語での応答
    
    回答は簡潔で分かりやすく、親しみやすい口調で行ってください。
  `,
  model: {
    provider: 'google',
    name: 'gemini-2.5-flash-preview-05-20',
    toolChoice: 'auto',
  },
  tools: {
    // ツール定義
    slideControl: {
      description: 'スライドの操作',
      parameters: z.object({
        action: z.enum(['next', 'previous', 'goto']),
        slideNumber: z.number().optional(),
      }),
      execute: async ({ action, slideNumber }) => {
        // スライド制御ロジック
        return { success: true, action, slideNumber };
      },
    },
    characterControl: {
      description: 'キャラクターの表情・動作制御',
      parameters: z.object({
        expression: z.enum(['neutral', 'friendly', 'surprised']),
        animation: z.string().optional(),
      }),
      execute: async ({ expression, animation }) => {
        // キャラクター制御ロジック
        return { success: true, expression, animation };
      },
    },
  },
});

// 4. エージェント実行ヘルパー
export const executeAgent = async (input: z.infer<typeof AgentInputSchema>) => {
  try {
    const validatedInput = AgentInputSchema.parse(input);
    
    const result = await exampleAgent.generate(
      validatedInput.message,
      {
        context: validatedInput.context,
      }
    );
    
    return {
      success: true,
      response: result.text,
      toolCalls: result.toolCalls,
    };
    
  } catch (error) {
    console.error('Agent execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
```

## 🧪 テスト戦略

### 現在のテスト環境

現在、プロジェクトにはテストフレームワークが設定されていません。APIの統合テストのみが利用可能です。

### 利用可能なテストコマンド

```bash
# API接続テスト
pnpm test:api

# RAG検索機能テスト
pnpm test:rag

# 外部API統合テスト
pnpm test:external-apis

# ローカル環境セットアップテスト
pnpm test:local

# 本番環境デプロイメントテスト
pnpm test:production

# 外部データフェッチャーテスト
pnpm test:external-data
```

### 将来のテスト計画

1. **ユニットテスト**: Jest + React Testing Libraryの導入を検討
2. **E2Eテスト**: Playwrightによるブラウザテストの導入を検討
3. **APIテスト**: より包括的なテストスイートの構築
    await micButton.click();
    await expect(micButton).not.toHaveClass(/recording/);
  });

  test('should navigate slides', async ({ page }) => {
    await page.goto('/');
    
    // 次のスライドボタン
    const nextButton = page.getByRole('button', { name: /next/i });
    await nextButton.click();
    
    // スライド番号の確認
    const slideCounter = page.getByText(/slide 2 of/i);
    await expect(slideCounter).toBeVisible();
  });
});
```

## 🔍 デバッグ・監視

### 1. 開発時デバッグ

```typescript
// 開発環境でのみ有効なデバッグログ
const debugLog = (message: string, data?: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] ${message}`, data);
  }
};

// パフォーマンス測定
const measurePerformance = async <T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  
  debugLog(`Performance: ${name}`, `${end - start}ms`);
  return result;
};

// エラー境界コンポーネント
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // 本番環境では外部監視サービスに送信
    if (process.env.NODE_ENV === 'production') {
      // Sentry等への送信ロジック
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>エラーが発生しました</h2>
          {process.env.NODE_ENV === 'development' && (
            <details>
              <summary>エラー詳細</summary>
              <pre>{this.state.error?.stack}</pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 2. 本番監視

```typescript
// 監視用メトリクス収集
const collectMetrics = {
  // API応答時間
  apiResponseTime: (endpoint: string, duration: number) => {
    if (typeof window !== 'undefined') {
      // クライアントサイド監視
      window.gtag?.('event', 'api_response_time', {
        endpoint,
        duration,
        timestamp: Date.now(),
      });
    }
  },
  
  // エラー追跡
  error: (error: Error, context?: Record<string, any>) => {
    console.error('Application error:', error, context);
    
    // 外部監視サービスへの送信
    if (process.env.NODE_ENV === 'production') {
      // Sentry.captureException(error, { extra: context });
    }
  },
  
  // ユーザーアクション追跡
  userAction: (action: string, data?: Record<string, any>) => {
    if (typeof window !== 'undefined') {
      window.gtag?.('event', action, data);
    }
  },
};
```

## 🎯 新機能の開発ガイド

### メモリシステムの利用

```typescript
import { SimplifiedMemorySystem } from '@/lib/simplified-memory';

// エージェント用メモリの初期化
const memory = new SimplifiedMemorySystem('MyAgent');

// メッセージの追加
await memory.addMessage('user', 'エンジニアカフェの営業時間は？', {
  emotion: 'curious',
  sessionId: 'session_123'
});

// コンテキストの取得
const context = await memory.getContext('さっき何を聞いた？', {
  includeKnowledgeBase: true,
  language: 'ja'
});
```

### 音声再生サービスの利用

```typescript
import { AudioPlaybackService } from '@/lib/audio/audio-playback-service';

// リップシンク付き音声再生
await AudioPlaybackService.playAudioWithLipSync(audioBase64, {
  volume: 0.8,
  enableLipSync: true,
  onVisemeUpdate: (viseme, intensity) => {
    // キャラクターの口の形を更新
  },
  onPlaybackEnd: () => {
    console.log('再生完了');
  }
});

// 高速音声再生（リップシンクなし）
await AudioPlaybackService.playAudioFast(audioBase64, 0.8);
```

### RAG検索の実装

```typescript
import { searchKnowledgeBaseEmbedding } from '@/lib/rag/search-knowledge-base-embedding';

// 知識ベース検索
const results = await searchKnowledgeBaseEmbedding(
  '営業時間について教えて',
  0.7,  // 類似度しきい値
  5,    // 最大結果数
  'ja'  // 言語
);
```

## 📋 コード品質・規約

```json
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "react/no-unescaped-entities": "off",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

### 2. Prettier設定

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
```

### 3. TypeScript設定

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "ES6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

## 🔧 開発用コマンド一覧

### 開発・ビルド
```bash
pnpm dev                    # 開発サーバー起動 (http://localhost:3000)
pnpm dev:clean              # キャッシュクリア後に開発サーバー起動
pnpm build                  # 本番ビルド作成
pnpm start                  # 本番サーバー起動
pnpm lint                   # Next.js リンティング
```

### 依存関係管理
```bash
pnpm install:css            # Tailwind CSS v3 依存関係の正しいインストール
# 注意: Tailwind CSS v4にアップグレードしないでください
```

### 知識ベース管理
```bash
pnpm seed:knowledge         # 初期データで知識ベースをシード
pnpm migrate:embeddings     # 既存知識をOpenAI埋め込みに移行
pnpm import:knowledge       # マークダウンファイルから知識をインポート
pnpm import:narrations      # スライドナレーションをインポート
```

### データベース管理
```bash
pnpm db:migrate             # データベースマイグレーション実行
pnpm db:setup-admin         # 管理知識インターフェースのセットアップ
```

### CRONジョブ（本番環境）
```bash
pnpm cron:update-knowledge  # 知識ベース更新を手動でトリガー
pnpm cron:update-slides     # スライド更新を手動でトリガー
```

### 監視・分析
```bash
pnpm monitor:baseline       # パフォーマンスベースライン収集
pnpm monitor:migration      # マイグレーションステータス監視
pnpm compare:implementations # 実装パフォーマンス比較
pnpm validate:production    # 本番環境準備状況検証
pnpm check:deployment       # デプロイメント準備状況確認
```

## 🚀 デプロイ・CI/CD

### 1. GitHub Actions設定

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run linting
        run: pnpm lint
      
      - name: Build application
        run: pnpm build
      
      - name: Run API tests
        run: pnpm test:api

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

### 2. 本番デプロイチェックリスト

- [ ] 環境変数設定確認
- [ ] セキュリティヘッダー設定
- [ ] パフォーマンス最適化
- [ ] エラー監視設定
- [ ] バックアップ設定
- [ ] ドメイン・SSL設定

## 📚 参考資料

### 公式ドキュメント
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [React 19 Documentation](https://react.dev/)
- [Mastra Documentation](https://docs.mastra.ai/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

### 社内リソース
- [API仕様書](API.md)
- [セキュリティガイド](SECURITY.md)
- [デザインシステム](DESIGN.md)

---

<div align="center">

**🛠️ Happy Coding - Engineer Cafe Navigator**

[🏠 ホーム](../README.md) • [📖 API ドキュメント](API.md) • [🔒 セキュリティ](SECURITY.md)

</div>