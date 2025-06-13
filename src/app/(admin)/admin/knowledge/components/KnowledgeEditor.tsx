'use client';

import { useState } from 'react';
import MDEditor from '@uiw/react-md-editor';
import toast from 'react-hot-toast';

interface KnowledgeEntry {
  id?: string;
  content: string;
  category?: string;
  subcategory?: string;
  language: string;
  source?: string;
  metadata: Record<string, any>;
}

interface KnowledgeEditorProps {
  entry?: KnowledgeEntry;
  onSave?: (entry: KnowledgeEntry) => Promise<void>;
  onCancel?: () => void;
}

export function KnowledgeEditor({ entry, onSave, onCancel }: KnowledgeEditorProps) {
  const [formData, setFormData] = useState<KnowledgeEntry>({
    content: entry?.content || '',
    category: entry?.category || '',
    subcategory: entry?.subcategory || '',
    language: entry?.language || 'ja',
    source: entry?.source || '',
    metadata: entry?.metadata || {},
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🔍 Form submit triggered');
    console.log('🔍 Form data:', formData);
    
    if (!formData.content.trim()) {
      console.log('❌ Content validation failed');
      toast.error('コンテンツは必須です');
      return;
    }

    console.log('✅ Content validation passed');
    setLoading(true);
    
    try {
      if (onSave) {
        console.log('🔍 Using onSave callback');
        await onSave(formData);
      } else {
        const url = entry?.id ? `/api/admin/knowledge/${entry.id}` : '/api/admin/knowledge';
        const method = entry?.id ? 'PUT' : 'POST';
        
        console.log('🔍 Making API request:', { url, method });
        console.log('🔍 Request body:', JSON.stringify(formData, null, 2));
        
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });

        console.log('🔍 Response status:', response.status);
        console.log('🔍 Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Response error:', errorText);
          
          try {
            const error = JSON.parse(errorText);
            throw new Error(error.error || 'Failed to save');
          } catch {
            throw new Error(`Server error: ${response.status} ${errorText}`);
          }
        }

        const result = await response.json();
        console.log('✅ Success response:', result);
        
        toast.success(entry?.id ? '更新しました' : '作成しました');
        
        if (!entry?.id) {
          setFormData({
            content: '',
            category: '',
            subcategory: '',
            language: 'ja',
            source: '',
            metadata: {},
          });
        }
      }
    } catch (error) {
      console.error('❌ Save error:', error);
      toast.error(error instanceof Error ? error.message : '保存に失敗しました');
    } finally {
      setLoading(false);
      console.log('🔍 Form submit completed');
    }
  };

  const handleMetadataChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        [key]: value,
      },
    }));
  };

  const addMetadataField = () => {
    const key = prompt('メタデータのキーを入力してください:');
    if (key && key.trim()) {
      handleMetadataChange(key.trim(), '');
    }
  };

  const removeMetadataField = (key: string) => {
    setFormData(prev => {
      const newMetadata = { ...prev.metadata };
      delete newMetadata[key];
      return {
        ...prev,
        metadata: newMetadata,
      };
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            カテゴリ
          </label>
          <input
            type="text"
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="facilities, pricing, services..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            サブカテゴリ
          </label>
          <input
            type="text"
            value={formData.subcategory}
            onChange={(e) => setFormData(prev => ({ ...prev, subcategory: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="meeting_rooms, equipment..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            言語 *
          </label>
          <select
            value={formData.language}
            onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ソース
          </label>
          <input
            type="text"
            value={formData.source}
            onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="official-website, user-input..."
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          メタデータ
        </label>
        <div className="space-y-2">
          {Object.entries(formData.metadata).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <input
                type="text"
                value={key}
                readOnly
                className="w-1/3 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              />
              <input
                type="text"
                value={value as string}
                onChange={(e) => handleMetadataChange(key, e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => removeMetadataField(key)}
                className="px-3 py-2 text-red-600 hover:text-red-800"
              >
                削除
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addMetadataField}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            + メタデータを追加
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          コンテンツ * (Markdown)
        </label>
        <MDEditor
          value={formData.content}
          onChange={(value) => setFormData(prev => ({ ...prev, content: value || '' }))}
          height={400}
          data-color-mode="light"
        />
      </div>

      <div className="flex justify-end space-x-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            キャンセル
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '保存中...' : (entry?.id ? '更新' : '作成')}
        </button>
      </div>
    </form>
  );
}