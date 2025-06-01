# Engineer Cafe Navigator - Presentation Mode Guide

## 概要 / Overview

Engineer Cafe Navigatorのプレゼンテーションモードは、AITuber-Kit風の同期プレゼンテーション機能を提供します。音声ナレーションとスライドの完全同期により、シームレスなプレゼンテーション体験を実現します。

The Presentation Mode provides AITuber-Kit style synchronized presentations with perfect audio-slide synchronization for seamless presentation experiences.

## クイックスタート / Quick Start

### 1. プレゼンテーション開始 / Starting a Presentation

1. メインページで**「初めての方へ」**ボタンをクリック
2. **Play/Pause**ボタンで自動進行を制御
3. 矢印ボタンで手動ナビゲーション

1. Click **"初めての方へ"** button on the main page
2. Use **Play/Pause** button to control auto-advance
3. Navigate manually with arrow buttons

### 2. 基本操作 / Basic Controls

| ボタン / Button | 機能 / Function |
|----------------|----------------|
| ▶️ Play | 自動プレゼンテーション開始 / Start auto-presentation |
| ⏸️ Pause | 一時停止 / Pause |
| ⬅️➡️ 矢印 / Arrows | 手動ナビゲーション / Manual navigation |
| 🔄 Reset | 最初から開始 / Restart from beginning |
| ⚙️ Settings | 設定モーダル / Settings modal |

## 主要機能 / Key Features

### 🎯 同期ナレーション / Synchronized Narration
- 音声が完了してから次のスライドに進む
- 音声の重複なし
- スムーズな遷移

- Slides advance only after audio completes
- No audio overlap
- Smooth transitions

### 🚀 スマートキャッシング / Smart Caching
- 次のスライドを事前読み込み
- 遷移時間の短縮
- メモリ効率的な管理

- Preloads next slides
- Reduces transition delays
- Memory-efficient management

### 📊 視覚フィードバック / Visual Feedback
- ナレーション中の表示
- リアルタイム状態確認
- プログレスバー

- Shows when narration is active
- Real-time status indication
- Progress bar

### 🎛️ 割り込み対応 / Interruption Support
- いつでもスライド変更可能
- 現在の音声を停止して即座に切り替え
- ユーザー制御を優先

- Change slides anytime
- Stops current audio and switches immediately
- User control takes priority

## 設定オプション / Settings Options

### 自動進行 / Auto Advance
- ✅ 有効: 音声完了後に自動で次のスライドへ
- ❌ 無効: 手動操作でのみスライド変更

- ✅ Enabled: Auto-advance after audio completion
- ❌ Disabled: Manual navigation only

### ナレーション速度 / Narration Speed
- 範囲: 0.5x - 2.0x
- デフォルト: 1.0x
- リアルタイム調整可能

- Range: 0.5x - 2.0x
- Default: 1.0x
- Real-time adjustment

### プリロード数 / Preload Count
- 範囲: 0-5スライド
- デフォルト: 2スライド
- 多いほど滑らかだが、メモリ使用量増加

- Range: 0-5 slides
- Default: 2 slides
- More = smoother, but higher memory usage

### アニメーションスキップ / Skip Animations
- キャラクターアニメーションの省略
- パフォーマンス向上
- 高速プレゼンテーション向け

- Skip character animations
- Performance improvement
- For fast presentations

## キーボードショートカット / Keyboard Shortcuts

| キー / Key | 機能 / Function |
|-----------|----------------|
| **Space** | Play/Pause切り替え / Toggle Play/Pause |
| **←→** | スライド移動 / Navigate slides |
| **R** | リスタート / Restart presentation |
| **Q** | 質問モード / Question mode |
| **N** | ノート表示切り替え / Toggle notes |
| **F** | フルスクリーン / Fullscreen |
| **H** | ヘルプ表示 / Show help |
| **1-9** | スライド番号ジャンプ / Jump to slide number |
| **Esc** | モーダル閉じる / Close modals |

## パフォーマンス目標 / Performance Targets

### 🎯 最適化指標 / Optimization Metrics

| 項目 / Metric | 目標 / Target | 説明 / Description |
|--------------|--------------|-------------------|
| 初回ナレーション / First narration | < 1秒 / < 1s | 最初のスライド音声開始まで |
| キャッシュ済み遷移 / Cached transition | < 100ms | プリロード済みスライド遷移 |
| メモリ使用量 / Memory usage | 安定 / Stable | 10+スライドでも増加なし |
| エラー率 / Error rate | < 1% | ナレーション失敗率 |

### 📈 パフォーマンス監視 / Performance Monitoring

ブラウザコンソールで以下のログを確認できます：
You can monitor performance via browser console logs:

```
[Performance] API call for slide 1 took 245ms
[Performance] Cache retrieval took 3ms
[Performance] Slide 1 narration took 2847ms total
[Analytics] presentation_started {"slideCount": 10, "language": "ja"}
```

## トラブルシューティング / Troubleshooting

### 🔧 よくある問題 / Common Issues

#### ナレーションが再生されない / Narration not playing
1. 音量設定を確認
2. ブラウザの自動再生ポリシーを確認
3. ネットワーク接続を確認
4. エラーコンソールを確認

1. Check volume settings
2. Check browser autoplay policy
3. Check network connection
4. Check error console

#### スライドが自動進行しない / Slides not auto-advancing
1. Play/Pauseボタンの状態確認
2. 設定で「自動進行」が有効か確認
3. 音声完了まで待機
4. エラーログを確認

1. Check Play/Pause button state
2. Verify "Auto Advance" is enabled in settings
3. Wait for audio completion
4. Check error logs

#### 遷移が遅い / Slow transitions
1. プリロード数を増やす（設定で2-5に）
2. ネットワーク速度を確認
3. キャッシュクリア後に再試行

1. Increase preload count (2-5 in settings)
2. Check network speed
3. Clear cache and retry

#### メモリ使用量が多い / High memory usage
1. プリロード数を減らす
2. ブラウザタブを閉じる
3. ページをリロード

1. Reduce preload count
2. Close browser tabs
3. Reload page

### 🚨 エラー回復 / Error Recovery

システムは自動的に3回まで再試行します。最終的に失敗した場合：
The system automatically retries up to 3 times. If it finally fails:

1. 「音声なしで続行しますか？」ダイアログが表示
2. 「OK」で音声なしプレゼンテーション続行
3. 「キャンセル」で現在のスライドに留まる

1. "Continue without audio?" dialog appears
2. "OK" continues presentation without audio
3. "Cancel" stays on current slide

## ベストプラクティス / Best Practices

### 📋 推奨設定 / Recommended Settings

#### 高品質プレゼンテーション / High-Quality Presentation
```
自動進行: ✅ 有効
ナレーション速度: 1.0x
プリロード数: 3
アニメーションスキップ: ❌ 無効
```

#### 高速プレゼンテーション / Fast Presentation
```
自動進行: ✅ 有効
ナレーション速度: 1.5x
プリロード数: 2
アニメーションスキップ: ✅ 有効
```

#### 低帯域環境 / Low Bandwidth
```
自動進行: ✅ 有効
ナレーション速度: 1.0x
プリロード数: 1
アニメーションスキップ: ✅ 有効
```

### 💡 使用のコツ / Usage Tips

1. **事前準備**: プレゼンテーション開始前に設定を確認
2. **ネットワーク**: 安定した接続環境で使用
3. **音量調整**: 適切な音量レベルに設定
4. **フルスクリーン**: より没入感のある体験のため
5. **練習**: 重要なプレゼンテーション前に練習

1. **Preparation**: Check settings before starting
2. **Network**: Use stable connection
3. **Volume**: Set appropriate audio level
4. **Fullscreen**: For immersive experience
5. **Practice**: Test before important presentations

## 技術仕様 / Technical Specifications

### 対応ブラウザ / Supported Browsers
- Chrome 90+ (推奨 / Recommended)
- Firefox 88+
- Safari 14+
- Edge 90+

### システム要件 / System Requirements
- RAM: 4GB以上推奨 / 4GB+ recommended
- ネットワーク: ブロードバンド接続 / Broadband connection
- JavaScript: 有効 / Enabled
- WebAudio API: 対応 / Support required

### 制限事項 / Limitations
- 最大スライド数: 100スライド / 100 slides max
- 音声ファイルサイズ: 10MB以下 / < 10MB per audio
- 同時キャッシュ: 5スライドまで / Up to 5 slides cached

---

## サポート / Support

問題が発生した場合は、以下の情報と共にお問い合わせください：
If you encounter issues, please contact support with:

- ブラウザとバージョン / Browser and version
- エラーメッセージ / Error messages
- 再現手順 / Steps to reproduce
- コンソールログ / Console logs

---

**Engineer Cafe Navigator Presentation Mode** - Powered by AITuber-Kit synchronization technology 🚀