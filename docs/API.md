# API Documentation - Engineer Cafe Navigator

> Complete REST API specification for Engineer Cafe Navigator voice AI agent system

[日本語版](./API-ja.md) | English

## 📖 Overview

Engineer Cafe Navigator provides the following RESTful API endpoints:

- **Voice Processing**: Speech recognition, synthesis, and AI response generation
- **Enhanced Voice Processing**: Voice processing with facial expression context
- **Emotion Detection**: Real-time emotion analysis from text and voice
- **Character Control**: VRM character expressions and emotion-driven animations
- **Slide Control**: Marp slide display and navigation
- **External Integration**: WebSocket reception system integration
- **Q&A System**: AI-powered question answering
- **Session Management**: Multi-turn conversation with context persistence
- **Background Control**: Dynamic background management

## 🔗 Base URL

```
Production: https://engineer-cafe-navigator.vercel.app/api
Development: http://localhost:3000/api
```

## 🔐 Authentication

The API uses Service Account authentication for Google Cloud services. Session-based authentication is used for client requests.

### Service Account Setup

1. Create a service account in Google Cloud Console
2. Grant roles: `roles/speech.client`
3. Download JSON key and place at `./config/service-account-key.json`
4. Set environment variable: `GOOGLE_CLOUD_CREDENTIALS=./config/service-account-key.json`

## 🎤 音声処理 API

### POST /api/voice

音声データの処理とAI応答の生成

#### リクエスト

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "action": "process_voice",
  "audioData": "base64-encoded-audio-data",
  "sessionId": "uuid-session-id",
  "language": "ja"
}
```

**Additional Actions:**
- `start_session`: Start a new conversation session
- `end_session`: End the current session
- `set_language`: Change session language
- `get_conversation_state`: Get current conversation state
- `clear_conversation`: Clear conversation history
- `handle_interruption`: Handle user interruption
- `detect_language`: Auto-detect language from text

**Parameters:**
- `action` (string, required): 実行する操作
  - `process_voice`: 音声データ処理
  - `supported_languages`: サポート言語一覧
  - `status`: サービス状態確認
- `audioData` (string): Base64エンコードされた音声データ
- `sessionId` (string): セッション識別子
- `language` (string): 言語コード (`ja`, `en`)

#### レスポンス

**Success (200):**
```json
{
  "success": true,
  "transcript": "エンジニアカフェについて教えてください",
  "response": "エンジニアカフェは福岡市にある...",
  "audioResponse": "base64-encoded-mp3-audio",
  "shouldUpdateCharacter": true,
  "characterAction": "greeting",
  "emotion": {
    "emotion": "explaining",
    "intensity": 0.75,
    "confidence": 0.82,
    "duration": 2500
  },
  "sessionId": "uuid-session-id"
}
```

### Session Management Examples

**Start Session:**
```json
// Request
{
  "action": "start_session",
  "visitorId": "visitor-123",
  "language": "ja"
}

// Response
{
  "success": true,
  "sessionId": "5caaff9e-bae9-4131-bf49-01c6694a3e9c"
}
```

**End Session:**
```json
// Request
{
  "action": "end_session",
  "sessionId": "5caaff9e-bae9-4131-bf49-01c6694a3e9c"
}

// Response
{
  "success": true,
  "message": "Session ended"
}
```

**エラー (400/500):**
```json
{
  "success": false,
  "error": "音声データの処理に失敗しました",
  "code": "VOICE_PROCESSING_ERROR"
}
```

### GET /api/voice

音声サービス情報の取得

#### Query Parameters

- `action` (string): 取得する情報
  - `supported_languages`: サポート言語一覧
  - `status`: サービス状態

#### レスポンス例

**サポート言語一覧:**
```json
{
  "success": true,
  "languages": [
    {
      "code": "ja",
      "name": "日本語",
      "voiceSettings": {
        "languageCode": "ja-JP",
        "name": "ja-JP-Neural2-B",
        "ssmlGender": "FEMALE"
      }
    },
    {
      "code": "en",
      "name": "English",
      "voiceSettings": {
        "languageCode": "en-US",
        "name": "en-US-Neural2-F", 
        "ssmlGender": "FEMALE"
      }
    }
  ]
}
```

## 🎭 Enhanced Voice API

### POST /api/voice/enhanced

Voice processing with facial expression context for emotion-aware responses.

#### Request

```json
{
  "action": "process_text",
  "text": "エンジニアカフェについて教えてください",
  "language": "ja",
  "expression": "happy",
  "expressionConfidence": 0.85
}
```

**Parameters:**
- `action` (string, required): Must be `process_text`
- `text` (string, required): User input text
- `language` (string): Language code (`ja` or `en`)
- `sessionId` (string): Session identifier
- `expression` (string): Detected facial expression
  - Values: `neutral`, `happy`, `sad`, `angry`, `fearful`, `disgusted`, `surprised`, `unknown`
- `expressionConfidence` (number): Confidence level (0-1)

#### Response

```json
{
  "success": true,
  "transcript": "エンジニアカフェについて教えてください",
  "response": "[happy]はい、喜んでご説明します！エンジニアカフェは...",
  "audioResponse": "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAWGluZ...",
  "shouldUpdateCharacter": true,
  "characterAction": "greeting",
  "emotion": "happy",
  "sessionId": "session_123456",
  "detectedExpression": "happy",
  "expressionConfidence": 0.85
}
```

**Expression-Based Response Behavior:**
- **Happy**: Enthusiastic, positive responses
- **Sad**: Empathetic, supportive responses
- **Angry**: Calm, understanding responses
- **Surprised**: Informative, reassuring responses
- **Neutral/Unknown**: Standard professional tone

For detailed documentation, see [Enhanced Voice API Documentation](./API-ENHANCED-VOICE.md).

## 📊 スライド API

### POST /api/marp

Marpスライドのレンダリング

#### リクエスト

```json
{
  "action": "render_with_narration",
  "slideFile": "engineer-cafe",
  "theme": "engineer-cafe",
  "outputFormat": "both",
  "options": {
    "html": true,
    "markdown": {
      "breaks": true
    }
  }
}
```

**Parameters:**
- `action` (string, required): 実行する操作
  - `render_with_narration`: ナレーション付きレンダリング
  - `health`: ヘルスチェック
- `slideFile` (string): スライドファイル名
- `theme` (string): 使用するテーマ名
- `outputFormat` (string): 出力形式 (`html`, `json`, `both`)

#### レスポンス

```json
{
  "success": true,
  "html": "<!DOCTYPE html><html>...</html>",
  "slideData": {
    "metadata": {
      "title": "エンジニアカフェガイド",
      "language": "ja"
    },
    "slides": [
      {
        "slideNumber": 1,
        "title": "エンジニアカフェへようこそ",
        "content": "# エンジニアカフェへようこそ\n\n福岡市のコワーキングスペース",
        "notes": "挨拶とウェルカムメッセージ"
      }
    ]
  },
  "slideCount": 12,
  "narrationData": {
    "metadata": {
      "title": "エンジニアカフェガイド",
      "language": "ja",
      "speaker": "AI Guide",
      "version": "1.0.0"
    },
    "slides": [
      {
        "slideNumber": 1,
        "narration": {
          "auto": "エンジニアカフェへようこそ！",
          "onEnter": "新しいスライドに移動しました。",
          "onDemand": {
            "詳細": "詳しい情報をお伝えします..."
          }
        },
        "transitions": {
          "next": "次のスライドで料金について説明します。",
          "previous": null
        }
      }
    ]
  }
}
```

### POST /api/slides

スライドナビゲーションと音声案内

#### リクエスト

```json
{
  "action": "next",
  "slideNumber": 2,
  "slideFile": "engineer-cafe",
  "language": "ja"
}
```

**Parameters:**
- `action` (string, required): ナビゲーション操作
  - `next`: 次のスライドへ
  - `previous`: 前のスライドへ
  - `goto`: 指定スライドへジャンプ
  - `answer_question`: 質問への回答
- `slideNumber` (number): 対象スライド番号
- `slideFile` (string): スライドファイル名
- `language` (string): 言語コード
- `question` (string): 質問文（answer_questionの場合）

#### レスポンス

```json
{
  "success": true,
  "slideNumber": 3,
  "transitionMessage": "次のスライドで料金プランをご紹介します。",
  "audioResponse": "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAWGluZ...",
  "characterAction": "gesture_explaining"
}
```

## 🤖 キャラクター制御 API

### POST /api/character

3Dキャラクターの表情・動作制御

#### リクエスト

```json
{
  "action": "setExpression",
  "expression": "friendly",
  "transition": true,
  "duration": 1500
}
```

**Parameters:**
- `action` (string, required): 実行する操作
  - `setExpression`: 表情設定
  - `playAnimation`: アニメーション再生
  - `setEmotion`: 感情に基づく表情設定
  - `detectEmotion`: テキストから感情検出
  - `setLighting`: ライティング調整
  - `supported_features`: 対応機能一覧
- `expression` (string): 表情名
  - `neutral`: 中立
  - `happy`: 喜び
  - `sad`: 悲しみ
  - `angry`: 怒り
  - `surprised`: 驚き
  - `thinking`: 考え中
  - `explaining`: 説明中
  - `greeting`: 挨拶
  - `speaking`: 話し中
  - `listening`: 聞いている
- `emotion` (string): 感情名（上記表情名と同様）
- `text` (string): 感情検出用テキスト
- `language` (string): 言語設定 (`ja` | `en`)
- `animation` (string): アニメーション名
- `transition` (boolean): スムーズ遷移の有無
- `duration` (number): 持続時間（ミリ秒）

#### レスポンス例

**表情設定レスポンス:**
```json
{
  "success": true,
  "message": "表情を 'happy' に設定しました",
  "currentState": {
    "expression": "happy",
    "animation": "idle",
    "lighting": {
      "intensity": 1.0,
      "ambient": 0.3
    }
  }
}
```

**感情検出レスポンス:**
```json
{
  "success": true,
  "result": {
    "text": "こんにちは！今日はとても嬉しいです！",
    "language": "ja",
    "emotionData": {
      "emotion": "happy",
      "intensity": 0.85,
      "confidence": 0.92,
      "duration": 2000
    },
    "vrmMapping": {
      "primary": "happy",
      "secondary": "relaxed",
      "weight": 0.78,
      "blinkOverride": 0.2
    },
    "suggestions": {
      "expression": "happy",
      "animation": "greeting"
    }
  }
}
```

**感情設定レスポンス:**
```json
{
  "success": true,
  "result": {
    "emotion": "happy",
    "vrmMapping": {
      "primary": "happy",
      "secondary": "relaxed",
      "weight": 0.64
    },
    "emotionData": {
      "emotion": "happy",
      "intensity": 0.8,
      "confidence": 0.9,
      "duration": 2000
    },
    "transition": true
  }
}
```

### GET /api/character

キャラクター情報の取得

#### Query Parameters

- `action` (string): 取得する情報
  - `supported_features`: 対応機能一覧
  - `current_state`: 現在の状態

#### レスポンス例

```json
{
  "success": true,
  "features": {
    "expressions": ["neutral", "friendly", "surprised", "thinking"],
    "animations": ["idle", "greeting", "explaining", "thinking"],
    "lighting": {
      "adjustable": true,
      "range": [0.1, 2.0]
    }
  },
  "vrm": {
    "model": "sakura.vrm",
    "version": "1.0",
    "capabilities": ["blendshapes", "bone_animation", "physics"]
  }
}
```

## 🔗 外部連携 API

### POST /api/external

外部システムとの連携

#### リクエスト

```json
{
  "action": "update_reception_status",
  "receptionData": {
    "waitingCount": 3,
    "averageWaitTime": 15,
    "nextAvailableTime": "14:30"
  }
}
```

**Parameters:**
- `action` (string, required): 連携操作
  - `update_reception_status`: 受付状況更新
  - `send_inquiry`: 問い合わせ送信
  - `get_events`: イベント情報取得

#### レスポンス

```json
{
  "success": true,
  "message": "受付状況を更新しました",
  "data": {
    "updated": true,
    "timestamp": "2024-01-20T14:25:00Z"
  }
}
```

## ❓ Q&A API

### POST /api/qa

AIによる質問回答システム

#### リクエスト

```json
{
  "action": "ask_question",
  "question": "料金プランについて詳しく教えてください",
  "context": {
    "currentSlide": 3,
    "language": "ja",
    "sessionId": "uuid-session-id"
  }
}
```

**Parameters:**
- `action` (string, required): Q&A操作
  - `ask_question`: 質問投稿
  - `get_faq`: よくある質問取得
- `question` (string): 質問内容
- `context` (object): コンテキスト情報

#### レスポンス

```json
{
  "success": true,
  "answer": "料金プランは以下の通りです：\n- ドロップイン: 500円/日\n- 月額プラン: 8,000円/月\n...",
  "audioResponse": "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAWGluZ...",
  "relatedSlides": [3, 4, 5],
  "confidence": 0.95,
  "sources": [
    "slides/engineer-cafe.md#料金プラン",
    "knowledge-base/pricing.md"
  ]
}
```

## 🚨 エラー処理

### エラーコード一覧

| コード | 説明 | HTTPステータス |
|--------|------|----------------|
| `VOICE_PROCESSING_ERROR` | 音声処理エラー | 400 |
| `SLIDE_NOT_FOUND` | スライドが見つからない | 404 |
| `CHARACTER_ACTION_FAILED` | キャラクター操作失敗 | 500 |
| `EXTERNAL_SERVICE_ERROR` | 外部サービス連携エラー | 502 |
| `INVALID_REQUEST` | 無効なリクエスト | 400 |
| `AUTHENTICATION_REQUIRED` | 認証が必要 | 401 |
| `RATE_LIMIT_EXCEEDED` | レート制限超過 | 429 |

### エラーレスポンス形式

```json
{
  "success": false,
  "error": "エラーメッセージ",
  "code": "ERROR_CODE",
  "details": {
    "field": "問題のあるフィールド",
    "value": "無効な値"
  },
  "timestamp": "2024-01-20T14:25:00Z"
}
```

## 🔒 認証・セキュリティ

### リクエスト制限

- **レート制限**: 10リクエスト/10秒
- **ファイルサイズ**: 音声ファイル 10MB以下
- **セッション**: UUID形式のセッションID必須

### セキュリティヘッダー

```http
Content-Security-Policy: default-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

### CORS設定

```javascript
// 許可されたオリジン
const allowedOrigins = [
  'https://engineer-cafe-navigator.vercel.app',
  'http://localhost:3000'
];
```

## 📊 監視・ログ

### ヘルスチェック

各APIエンドポイントは `?action=health` でヘルスチェック可能：

```bash
curl https://engineer-cafe-navigator.vercel.app/api/voice?action=health
```

### ログ形式

```json
{
  "timestamp": "2024-01-20T14:25:00Z",
  "level": "info",
  "service": "voice-api",
  "endpoint": "/api/voice",
  "method": "POST",
  "sessionId": "uuid-session-id",
  "duration": 850,
  "status": 200
}
```

## 🔧 開発・テスト

### ローカル開発

```bash
# 開発サーバー起動
pnpm run dev

# APIテスト
curl -X POST http://localhost:3000/api/voice \
  -H "Content-Type: application/json" \
  -d '{"action":"status"}'
```

### テスト用セッション

```json
{
  "sessionId": "test-session-12345",
  "language": "ja",
  "testMode": true
}
```

---

## 📞 サポート

### 技術サポート

- **Issues**: [GitHub Issues](https://github.com/your-org/engineer-cafe-navigator/issues)
- **API Status**: [ステータスページ](https://status.engineer-cafe-navigator.vercel.app)

### Changelog

- **v1.0.0** (2024-01-20): Initial release
- **v1.1.0** (2024-01-25): Security enhancements, XSS protection
- **v1.2.0** (2024-01-30): Background control API added
- **v2.0.0** (2025-05-30): 
  - Service Account authentication
  - Supabase memory integration
  - Multi-turn conversation support
  - Simplified voice service for Next.js compatibility
  - Session management improvements

---

<div align="center">

**Built with ❤️ by Engineer Cafe Team**

[🏠 ホーム](../README.md) • [📖 メインドキュメント](../README.md) • [🚀 デモ](https://demo.engineer-cafe-navigator.vercel.app)

</div>