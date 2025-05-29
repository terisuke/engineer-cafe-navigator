# API ドキュメント

> Engineer Cafe Navigator REST API 仕様書

## 📖 概要

Engineer Cafe Navigator は以下のRESTful APIエンドポイントを提供します：

- **音声処理**: 音声認識、合成、AI応答生成
- **スライド制御**: Marpスライドの表示・操作
- **キャラクター制御**: VRMキャラクターの表情・動作
- **外部連携**: WebSocket受付システム統合
- **Q&A**: AIによる質問回答システム

## 🔗 ベースURL

```
本番環境: https://engineer-cafe-navigator.vercel.app
開発環境: http://localhost:3000
```

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
  "audioData": "data:audio/wav;base64,UklGRt4DAABXQVZFZm10...",
  "sessionId": "uuid-session-id",
  "language": "ja"
}
```

**Parameters:**
- `action` (string, required): 実行する操作
  - `process_voice`: 音声データ処理
  - `supported_languages`: サポート言語一覧
  - `status`: サービス状態確認
- `audioData` (string): Base64エンコードされた音声データ
- `sessionId` (string): セッション識別子
- `language` (string): 言語コード (`ja`, `en`)

#### レスポンス

**成功 (200):**
```json
{
  "success": true,
  "transcript": "エンジニアカフェについて教えてください",
  "response": "エンジニアカフェは福岡市にある...",
  "audioResponse": "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAWGluZ...",
  "shouldUpdateCharacter": true,
  "characterAction": "greeting",
  "sessionId": "uuid-session-id"
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
  - `setLighting`: ライティング調整
  - `supported_features`: 対応機能一覧
- `expression` (string): 表情名
  - `neutral`: 中立
  - `friendly`: フレンドリー
  - `surprised`: 驚き
  - `thinking`: 考え中
- `animation` (string): アニメーション名
- `transition` (boolean): スムーズ遷移の有無
- `duration` (number): 持続時間（ミリ秒）

#### レスポンス

```json
{
  "success": true,
  "message": "表情を 'friendly' に設定しました",
  "currentState": {
    "expression": "friendly",
    "animation": "idle",
    "lighting": {
      "intensity": 1.0,
      "ambient": 0.3
    }
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

### 更新履歴

- **v1.0.0** (2024-01-20): 初期リリース
- **v1.1.0** (2024-01-25): セキュリティ強化、XSS対策追加
- **v1.2.0** (2024-01-30): 背景制御API追加

---

<div align="center">

**Built with ❤️ by Engineer Cafe Team**

[🏠 ホーム](../README.md) • [📖 メインドキュメント](../README.md) • [🚀 デモ](https://demo.engineer-cafe-navigator.vercel.app)

</div>