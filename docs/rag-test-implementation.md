# 📊 RAGシステム自動テスト実装指示書

## 概要
RAGシステムの品質を継続的に監視し、改善点を自動的に検出するテストシステムの実装を指示します。

## 現状の課題
- RAGシステムは動作しているが、どの質問に対してどのような回答が返されるか不明確
- 営業時間情報は取得できるが、休館日などの詳細情報は取得できない可能性
- データベースに333件のデータがあるが、実際の検索精度が不明

## 実装したテストツール

### 1. 包括的テストスクリプト (`scripts/test-rag-system.js`)

#### 機能
- knowledge-baseディレクトリのマークダウンファイルから自動的に質問を生成
- 各質問に対してRAG検索を実行し、期待されるキーワードと比較
- カテゴリ別の成功率を分析
- 詳細なレポートをJSON形式で保存
- 自動的に改善提案を生成

#### 使用方法
```bash
# 全テスト実行
node scripts/test-rag-system.js

# 特定カテゴリのみ
node scripts/test-rag-system.js --category engineer-cafe

# 単一質問テスト
node scripts/test-rag-system.js --question "営業時間は？"

# ヘルプ表示
node scripts/test-rag-system.js --help
```

#### 出力例
```
=== RAGシステム自動テスト開始 ===

✅ 質問: エンジニアカフェの営業時間は？
カテゴリ: engineer-cafe / hours-operations.md
言語: ja
検索結果: 5件
最高類似度: 0.692
評価:
  - 関連性スコア: 75%
  - キーワードマッチ: 9時, 22時

=== テスト結果サマリー ===
総テスト数: 45
成功: 30 (66.7%)
失敗: 15 (33.3%)
```

### 2. 簡易テストスクリプト (`scripts/quick-test-rag.js`)

#### 機能
- 基本的な10個の質問でRAGシステムを素早くテスト
- データベースの状態を確認
- 成功率に基づいて改善提案を表示

#### 使用方法
```bash
# 簡易テスト実行
node scripts/quick-test-rag.js

# 単一質問テスト
node scripts/quick-test-rag.js エンジニアカフェの休館日は？
```

## テストで確認される項目

### 1. 営業時間関連
- 開館時間（9:00）
- 閉館時間（22:00）
- 休館日（最終月曜日）
- 年末年始休業（12/29〜1/3）
- スタッフ対応時間（13:00〜21:00）

### 2. 施設・設備関連
- 無料Wi-Fi
- 3Dプリンター、レーザー加工機
- プロジェクター、音響機器
- メーカーズスペース
- 会議室設備

### 3. 料金関連
- 施設利用料（無料）
- 機材使用料（無料、材料費のみ）

### 4. 利用条件関連
- 利用資格
- 年齢制限
- 利用時間制限

## 実装の優先順位

### 第1段階（即座に実施）
1. ✅ テストスクリプトの実行権限付与
   ```bash
   chmod +x scripts/test-rag-system.js
   chmod +x scripts/quick-test-rag.js
   ```

2. ✅ package.jsonにスクリプト追加
   ```json
   {
     "scripts": {
       "test:rag": "node scripts/quick-test-rag.js",
       "test:rag:full": "node scripts/test-rag-system.js",
       "test:rag:watch": "nodemon scripts/quick-test-rag.js"
     }
   }
   ```

3. ✅ 簡易テストを実行して現状把握
   ```bash
   pnpm test:rag
   ```

### 第2段階（本日中に実施）
1. ⬜ テスト結果に基づいてRAGシステムの調整
   - 閾値の最適化（0.3 → 0.2〜0.4で調整）
   - カテゴリ分類の改善
   - 質問パターンの拡充

2. ⬜ CI/CDパイプラインへの組み込み
   ```yaml
   # .github/workflows/rag-test.yml
   name: RAG System Test
   on:
     push:
       paths:
         - 'src/mastra/**'
         - 'data/knowledge-base/**'
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - run: pnpm install
         - run: pnpm test:rag
   ```

### 第3段階（今週中に実施）
1. ⬜ テスト結果のダッシュボード作成
2. ⬜ 自動アラート設定（成功率が70%以下の場合）
3. ⬜ A/Bテストフレームワークの実装

## 期待される成果

### 短期的効果
- RAGシステムの現在の精度を数値化
- 問題のあるカテゴリや質問パターンの特定
- 即座に改善可能な設定の発見

### 長期的効果
- 継続的な品質監視
- リグレッション防止
- データ投入時の品質保証
- ユーザー満足度の向上

## モニタリング指標

### 主要KPI
1. **検索成功率**: 70%以上を維持
2. **キーワードマッチ率**: 60%以上
3. **平均類似度スコア**: 0.6以上
4. **レスポンス時間**: 500ms以下

### アラート閾値
- 成功率50%以下: 緊急対応
- キーワードマッチ率30%以下: 要調査
- エラー率10%以上: システム確認

## トラブルシューティング

### よくある問題と対処法

1. **検索結果が0件**
   - 閾値を0.2に下げる
   - 埋め込みベクトルの再生成
   - カテゴリフィルタの確認

2. **キーワードが含まれない**
   - データベースの内容確認
   - マークダウンファイルとの差分確認
   - 追加データの投入

3. **APIエラー**
   - サーバーの起動確認
   - 環境変数の確認
   - ログファイルの確認

## 実行コマンドまとめ

```bash
# 開発環境起動
pnpm dev

# データベース状態確認
curl "http://localhost:3000/api/admin/knowledge" | jq '.total'

# 簡易テスト
pnpm test:rag

# 詳細テスト
pnpm test:rag:full

# 単一質問テスト
node scripts/quick-test-rag.js "営業時間は？"

# テスト結果確認
ls -la test-results/

# 最新レポート表示
cat test-results/rag-test-*.json | jq '.summary'
```

## 次のアクション

1. **今すぐ**: `pnpm test:rag`を実行して現状把握
2. **15分後**: テスト結果を確認し、閾値調整の必要性を判断
3. **1時間後**: 問題のあるカテゴリのデータを管理UIから追加投入
4. **本日中**: CI/CDパイプラインにテストを組み込み

このテストシステムにより、RAGシステムの品質を定量的に測定し、継続的に改善することが可能になります。