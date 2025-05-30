# Google Cloud & Gemini API 設定ガイド

## 1. Google Cloud サービスアカウント設定

### Speech-to-Text & Text-to-Speech API
1. [Google Cloud Console](https://console.cloud.google.com)にアクセス
2. プロジェクトを選択または作成
3. 「ＡＰＩとサービス」→「有効なＡＰＩとサービス」から以下を有効化：
   - Cloud Speech-to-Text API
   - Cloud Text-to-Speech API

### サービスアカウントの権限確認
- `config/service-account-key.json`が既に配置されています
- 必要な権限：
  - Cloud Speech-to-Text User
  - Cloud Text-to-Speech User

## 2. Gemini APIキーの取得

1. [Google AI Studio](https://aistudio.google.com/app/apikey)にアクセス
2. 「Get API key」をクリック
3. 新しいAPIキーを作成

## 3. 環境変数の設定

`.env`ファイルを編集：

```bash
# Google Cloud（サービスアカウント認証を使用）
GOOGLE_CLOUD_PROJECT_ID=<あなたのGCPプロジェクトID>
GOOGLE_CLOUD_CREDENTIALS=./config/service-account-key.json

# Gemini AI（APIキーが必要）
GOOGLE_GENERATIVE_AI_API_KEY=<取得したGemini APIキー>
```

## 4. 接続テスト

APIキーが正しく設定されているか確認：

```bash
pnpm test:api
```

成功すると以下のような出力が表示されます：
- ✅ Service account file found at: ./config/service-account-key.json
- ✅ Gemini API key found in environment variables
- ✅ Text-to-Speech API is working!
- ✅ Gemini API is working!

## 5. アプリケーションの起動

```bash
pnpm dev
```

ブラウザで `http://localhost:3000` にアクセスし、マイクボタンをクリックして会話を開始できます。

## トラブルシューティング

### "Permission denied" エラー
- サービスアカウントに必要な権限があるか確認
- Speech-to-Text/Text-to-Speech APIが有効化されているか確認
- サービスアカウントキーファイルのパスが正しいか確認

### "API not enabled" エラー
- Google Cloud Consoleで必要なAPIが有効化されているか確認
- プロジェクトIDが正しく設定されているか確認

### 音声が認識されない
- ブラウザのマイク権限を許可しているか確認
- Chrome/Edge等のWebRTC対応ブラウザを使用しているか確認

### Gemini APIエラー
- APIキーが正しくコピーされているか確認
- APIキーのQuotaが残っているか確認
