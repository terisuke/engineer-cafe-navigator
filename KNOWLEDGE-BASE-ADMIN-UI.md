# 知識ベース管理 UI 実装指示書

最終更新: 2025-06-13  
担当: RAG チーム / フロントエンド チーム

---

## 目的
Supabase に保存された RAG 知識ベース (`knowledge_base` テーブル) をブラウザから CRUD 操作できる **隠し管理画面**を実装し、運用・編集コストを削減する。

* URL: `http://localhost:3000/admin/knowledge`
* 当面は認証レス（将来 Supabase Auth でガード予定）
* 公開サイトからのリンクは設置しない（隠しパス）

---

## 1. 事前準備

### 1-1. パッケージ追加
```
pnpm add react-markdown @uiw/react-md-editor react-hot-toast swr
```

### 1-2. knowledgeBaseUtils 拡張
`src/lib/knowledge-base-utils.ts` に以下メソッドを追加。
* `getAll()` – 一覧取得 (filter / pagination 対応)
* `getById(id)` – 1件取得
* `updateEntry(id, updates)` – 更新 (content 変更時は embedding 再生成)

実装サンプルは既存の `src/lib/knowledge-base-utils.ts` を参照してください。

---

## 2. API レイヤ (App Router)

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/admin/knowledge` | 一覧取得 (query: `page` `limit` `language` `category` `search`)
| POST | `/api/admin/knowledge` | 新規作成 (embedding 自動生成)
| GET | `/api/admin/knowledge/[id]` | 個別取得 |
| PUT | `/api/admin/knowledge/[id]` | 更新 (embedding 再生成) |
| DELETE | `/api/admin/knowledge/[id]` | 削除 |

`src/app/api/admin/knowledge` 以下に実装。Supabase Service Role Key を使用。

---

## 3. フロントページ構成

```
src/app/(admin)/admin/knowledge/
├── page.tsx            # 一覧
├── new/page.tsx        # 新規追加
├── [id]/page.tsx       # 詳細 & 編集
└── components/
    ├── KnowledgeTable.tsx      # 一覧テーブル
    ├── KnowledgeEditor.tsx     # MDEditor + プレビュー
    ├── MarkdownViewer.tsx      # remark → HTML 表示
    └── DeleteConfirmDialog.tsx # 削除確認
```

### UI ライブラリ
* TailwindCSS (既存) でレイアウト
* Headless UI Dialog でモーダル
* toast: `react-hot-toast`

### 表示 / 編集モード
* 詳細ページは read-only ビュー (`MarkdownViewer`) と「編集」ボタン
* 編集モードで `@uiw/react-md-editor` 使用。保存時に PUT → toast

### ページネーション & 検索
* `limit` = 20/ページ
* SWR でデータ取得 → `?page=1&search=foo`
* サーバ側で `ilike` 検索

---

## 4. 開発フェーズ

| フェーズ    | 期限  | 内容                                                                      |
|---------|------|-------------------------------------------------------------------------|
| Phase-1 | +2 日 | ① Utils 拡張 ② API CRUD 実装 ③ KnowledgeTable ④ MarkdownViewer            |
| Phase-2 | +1 日 | ⑤ KnowledgeEditor ⑥ DeleteDialog ⑦ toast/error handling ⑧ SWR キャッシュ最適化 |
| Phase-3 | 任意  | ⑨ 検索バー ⑩ CSV/JSON エクスポート ⑪ 一括削除・タグ編集                              |

---

## 5. 動作確認
1. `pnpm dev` で起動
2. `/admin/knowledge` へ直接アクセス
3. **シードデータ**が無い場合は `pnpm seed:knowledge` で投入
4. CRUD 操作時に
   * Supabase にレコードが追加 / 更新されている
   * `updated_at` が自動で更新される
   * 保存時 toast で成否を通知
5. RAG 検索 (`scripts/test-rag-search.ts`) で内容が反映されることを確認

---

## 6. セキュリティ & 今後
* 現段階では URL 秘匿のみ → 後日 Supabase Auth で保護予定
* XSS 対策: remark-html デフォルト + `dangerouslySetInnerHTML` 前にサニタイズ設定
* 大量データ対策: fetch には `range()` + ページネーション必須

---

### 質問・レビュー
疑問点や設計変更提案があれば、チーム Slack #rag-dev まで。  