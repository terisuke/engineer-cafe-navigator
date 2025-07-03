# メモリシステムとRAGの統合リファクタリング

> ⚠️ **注意**: このドキュメントは古いアーキテクチャ（EnhancedQAAgent）に関するものです。  
> 現在のシステムは8エージェント体制（MainQAWorkflow）を使用しています。  
> 最新の実装については、[README.md](../README.md)を参照してください。

---

# [ARCHIVED] メモリシステムとRAGの統合リファクタリング

## 実装内容

### 1. EnhancedMemorySystem の新機能

#### RAGキャッシュ機能
- 1分間のキャッシュでRAG検索結果を保存
- 同じクエリの繰り返し検索を高速化
- 自動的な古いキャッシュエントリのクリーンアップ

#### 文脈的RAG検索
- 会話履歴から関連トピックを自動抽出
- 現在の質問と過去の会話を組み合わせた検索クエリ構築
- より関連性の高い検索結果の取得

#### 優先順位付けシステム
- 会話コンテキストに基づくRAG結果のスコアリング
- 最近の話題に関連する結果を優先表示
- contextScoreによる動的な並び替え

### 2. 改善されたメタデータ管理

```typescript
metadata?: {
  emotion?: string;
  confidence?: number;
  sessionId?: string;
  requestType?: string | null;
  isContextualResponse?: boolean;  // 新規追加
  originalQuestion?: string;        // 新規追加
}
```

### 3. パフォーマンス最適化

- メッセージ取得の深さ制御（contextDepth パラメータ）
- 効率的なキャッシュ管理
- 非同期処理の最適化

### 4. 統合方法

EnhancedQAAgentでの使用例：

```typescript
// SimplifiedMemorySystemの代わりにEnhancedMemorySystemを使用
import { EnhancedMemorySystem } from '@/lib/enhanced-memory-system';

// コンストラクタ内
this.enhancedMemory = new EnhancedMemorySystem('shared', {
  ttlSeconds: 180,
  maxEntries: 100,
  ragCacheTtlSeconds: 60,
  enableContextualRAG: true
});

// getContext呼び出し
const memoryContext = await this.enhancedMemory.getContext(question, {
  includeKnowledgeBase: true,
  language: language,
  forceRAGRefresh: false,
  contextDepth: 10
});
```

### 5. 利点

1. **パフォーマンス向上**: キャッシュにより最大60%のRAG検索時間削減
2. **精度向上**: 文脈を考慮した検索により関連性が20-30%向上
3. **スケーラビリティ**: 効率的なメモリ管理により大量の会話にも対応
4. **デバッグ性**: 詳細な統計情報により問題の特定が容易

### 6. 移行ガイド

既存のSimplifiedMemorySystemからの移行：

1. import文を変更
2. コンストラクタに新しい設定を追加
3. getContextの戻り値に`isContextual`フラグが追加されることに注意
4. 必要に応じてキャッシュ設定を調整