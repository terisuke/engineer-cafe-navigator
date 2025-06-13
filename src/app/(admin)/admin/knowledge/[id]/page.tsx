'use client';

import { useState, use } from 'react';
import useSWR from 'swr';
import { Toaster } from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MarkdownViewer } from '../components/MarkdownViewer';
import { KnowledgeEditor } from '../components/KnowledgeEditor';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface KnowledgeDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function KnowledgeDetailPage({ params }: KnowledgeDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const { data: entry, error, mutate } = useSWR(
    `/api/admin/knowledge/${id}`,
    fetcher
  );

  const handleSave = async () => {
    await mutate();
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm('削除してもよろしいですか？この操作は取り消せません。')) return;

    try {
      const response = await fetch(`/api/admin/knowledge/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('削除に失敗しました');
      }

      router.push('/admin/knowledge');
    } catch (error) {
      console.error('Delete error:', error);
      alert('削除に失敗しました');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">エラーが発生しました: {error.message}</p>
            <Link
              href="/admin/knowledge"
              className="text-blue-600 hover:text-blue-800 underline mt-2 inline-block"
            >
              一覧に戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Toaster position="top-right" />
      
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditing ? '知識ベースエントリ編集' : '知識ベースエントリ詳細'}
              </h1>
              <div className="flex space-x-2">
                <Link
                  href="/admin/knowledge"
                  className="text-gray-600 hover:text-gray-800"
                >
                  一覧に戻る
                </Link>
                {!isEditing && (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={handleDelete}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      削除
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="p-6">
            {isEditing ? (
              <KnowledgeEditor
                entry={entry}
                onSave={handleSave}
                onCancel={() => setIsEditing(false)}
              />
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-1">ID</h3>
                    <p className="text-sm text-gray-900 font-mono">{entry.id}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-1">言語</h3>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      entry.language === 'ja' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {entry.language}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-1">カテゴリ</h3>
                    <p className="text-sm text-gray-900">{entry.category || '-'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-1">サブカテゴリ</h3>
                    <p className="text-sm text-gray-900">{entry.subcategory || '-'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-1">ソース</h3>
                    <p className="text-sm text-gray-900">{entry.source || '-'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-1">更新日時</h3>
                    <p className="text-sm text-gray-900">{formatDate(entry.updated_at)}</p>
                  </div>
                </div>

                {Object.keys(entry.metadata).length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">メタデータ</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <pre className="text-sm text-gray-900 whitespace-pre-wrap">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">コンテンツ</h3>
                  <div className="border border-gray-200 rounded-lg p-4 bg-white">
                    <MarkdownViewer content={entry.content} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}