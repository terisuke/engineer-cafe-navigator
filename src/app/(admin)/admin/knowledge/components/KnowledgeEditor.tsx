'use client';

import { useState, useEffect } from 'react';
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

interface CategoryData {
  categories: string[];
  subcategories: Record<string, string[]>;
  sources: string[];
}

interface MetadataTemplates {
  templates: Record<string, Record<string, string>>;
  availableCategories: string[];
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
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null);
  const [metadataTemplates, setMetadataTemplates] = useState<MetadataTemplates | null>(null);
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [showCustomSubcategory, setShowCustomSubcategory] = useState(false);
  const [showCustomSource, setShowCustomSource] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [customSubcategory, setCustomSubcategory] = useState('');
  const [customSource, setCustomSource] = useState('');

  // Load categories and templates on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setDataLoading(true);
        setDataError(null);
        
        const [categoriesRes, templatesRes] = await Promise.all([
          fetch('/api/admin/knowledge/categories'),
          fetch('/api/admin/knowledge/metadata-templates')
        ]);
        
        if (categoriesRes.ok) {
          const catData = await categoriesRes.json();
          setCategoryData(catData);
        } else {
          throw new Error(`Failed to load categories: ${categoriesRes.status}`);
        }
        
        if (templatesRes.ok) {
          const templateData = await templatesRes.json();
          setMetadataTemplates(templateData);
        } else {
          throw new Error(`Failed to load templates: ${templatesRes.status}`);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        setDataError(error instanceof Error ? error.message : 'Failed to load data');
      } finally {
        setDataLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Apply metadata template when category changes
  const handleCategoryChange = (category: string) => {
    setFormData(prev => ({ ...prev, category, subcategory: '' }));
    
    // Apply metadata template if available
    if (metadataTemplates?.templates[category] && Object.keys(formData.metadata).length === 0) {
      setFormData(prev => ({
        ...prev,
        metadata: { ...metadataTemplates.templates[category] }
      }));
    }
  };

  // Handle custom inputs
  const handleCustomCategorySubmit = () => {
    if (customCategory.trim()) {
      handleCategoryChange(customCategory.trim());
      setShowCustomCategory(false);
      setCustomCategory('');
    }
  };

  const handleCustomSubcategorySubmit = () => {
    if (customSubcategory.trim()) {
      setFormData(prev => ({ ...prev, subcategory: customSubcategory.trim() }));
      setShowCustomSubcategory(false);
      setCustomSubcategory('');
    }
  };

  const handleCustomSourceSubmit = () => {
    if (customSource.trim()) {
      setFormData(prev => ({ ...prev, source: customSource.trim() }));
      setShowCustomSource(false);
      setCustomSource('');
    }
  };

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

  const handleMetadataChange = (key: string, value: string | string[]) => {
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

  // Predefined metadata field configurations
  const metadataFieldTypes: Record<string, { type: 'text' | 'select' | 'tags' | 'date'; options?: string[] }> = {
    importance: { type: 'select', options: ['critical', 'high', 'medium', 'low'] },
    last_updated: { type: 'date' },
    tags: { type: 'tags' },
    title: { type: 'text' },
    source: { type: 'text' },
    category: { type: 'text' },
    slideNumber: { type: 'text' },
    original_file: { type: 'text' }
  };

  const renderMetadataField = (key: string, value: any) => {
    const fieldConfig = metadataFieldTypes[key] || { type: 'text' };
    
    switch (fieldConfig.type) {
      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => handleMetadataChange(key, e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">選択してください...</option>
            {fieldConfig.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      case 'date':
        return (
          <input
            type="date"
            value={value ? new Date(value).toISOString().split('T')[0] : ''}
            onChange={(e) => handleMetadataChange(key, e.target.value ? new Date(e.target.value).toISOString() : '')}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        );
      case 'tags': {
        const tagsArray = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',').map(t => t.trim()).filter(Boolean) : []);
        return (
          <div className="flex-1">
            <input
              type="text"
              value={tagsArray.join(', ')}
              onChange={(e) => {
                const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                handleMetadataChange(key, tags);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="タグをカンマ区切りで入力 (例: tag1, tag2, tag3)"
            />
            {tagsArray.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {tagsArray.map((tag, index) => (
                  <span key={index} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      }
      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleMetadataChange(key, e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="値"
          />
        );
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

  // Show loading state
  if (dataLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (dataError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">エラーが発生しました</h3>
            <p className="mt-1 text-sm text-red-700">{dataError}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md"
            >
              再読み込み
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            カテゴリ
          </label>
          {!showCustomCategory ? (
            <div className="space-y-2">
              <select
                value={formData.category}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setShowCustomCategory(true);
                  } else {
                    handleCategoryChange(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">カテゴリを選択...</option>
                {categoryData?.categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="__custom__">+ 新しいカテゴリを追加</option>
              </select>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="新しいカテゴリ名..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleCustomCategorySubmit()}
              />
              <button
                type="button"
                onClick={handleCustomCategorySubmit}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                追加
              </button>
              <button
                type="button"
                onClick={() => { setShowCustomCategory(false); setCustomCategory(''); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            サブカテゴリ
          </label>
          {!showCustomSubcategory ? (
            <div className="space-y-2">
              <select
                value={formData.subcategory}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setShowCustomSubcategory(true);
                  } else {
                    setFormData(prev => ({ ...prev, subcategory: e.target.value }));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={!formData.category}
              >
                <option value="">サブカテゴリを選択...</option>
                {formData.category && categoryData?.subcategories[formData.category]?.map(subcat => (
                  <option key={subcat} value={subcat}>{subcat}</option>
                ))}
                <option value="__custom__">+ 新しいサブカテゴリを追加</option>
              </select>
              {!formData.category && (
                <p className="text-sm text-gray-500">まずカテゴリを選択してください</p>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={customSubcategory}
                onChange={(e) => setCustomSubcategory(e.target.value)}
                placeholder="新しいサブカテゴリ名..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleCustomSubcategorySubmit()}
              />
              <button
                type="button"
                onClick={handleCustomSubcategorySubmit}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                追加
              </button>
              <button
                type="button"
                onClick={() => { setShowCustomSubcategory(false); setCustomSubcategory(''); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          )}
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
          {!showCustomSource ? (
            <div className="space-y-2">
              <select
                value={formData.source}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setShowCustomSource(true);
                  } else {
                    setFormData(prev => ({ ...prev, source: e.target.value }));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">ソースを選択...</option>
                {categoryData?.sources.map(source => (
                  <option key={source} value={source}>{source}</option>
                ))}
                <option value="__custom__">+ 新しいソースを追加</option>
              </select>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={customSource}
                onChange={(e) => setCustomSource(e.target.value)}
                placeholder="新しいソース名..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleCustomSourceSubmit()}
              />
              <button
                type="button"
                onClick={handleCustomSourceSubmit}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                追加
              </button>
              <button
                type="button"
                onClick={() => { setShowCustomSource(false); setCustomSource(''); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            メタデータ
          </label>
          {formData.category && metadataTemplates?.templates[formData.category] && (
            <button
              type="button"
              onClick={() => {
                const template = (formData.category && metadataTemplates.templates[formData.category]) || metadataTemplates.templates.default;
                setFormData(prev => ({
                  ...prev,
                  metadata: { ...template }
                }));
              }}
              className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
            >
              テンプレートを適用
            </button>
          )}
        </div>
        
        <div className="space-y-3">
          {Object.entries(formData.metadata).map(([key, value]) => (
            <div key={key} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => {
                      const newKey = e.target.value;
                      const oldKey = key;
                      if (newKey !== oldKey) {
                        setFormData(prev => {
                          const newMetadata = { ...prev.metadata };
                          delete newMetadata[oldKey];
                          newMetadata[newKey] = value;
                          return { ...prev, metadata: newMetadata };
                        });
                      }
                    }}
                    className="px-2 py-1 text-sm font-medium border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                    placeholder="キー名"
                  />
                  {metadataFieldTypes[key] && (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                      {metadataFieldTypes[key].type}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeMetadataField(key)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  ✕
                </button>
              </div>
              <div className="flex gap-2">
                {renderMetadataField(key, value)}
              </div>
            </div>
          ))}
          
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addMetadataField}
              className="text-blue-600 hover:text-blue-800 text-sm px-3 py-1 border border-blue-300 rounded-lg hover:bg-blue-50"
            >
              + カスタムフィールド
            </button>
            
            {/* Quick add common metadata fields */}
            {Object.entries(metadataFieldTypes).map(([fieldKey, config]) => {
              if (!Object.hasOwn(formData.metadata, fieldKey)) {
                return (
                  <button
                    key={fieldKey}
                    type="button"
                    onClick={() => {
                      const defaultValue = config.type === 'tags' ? [] : 
                                         config.type === 'date' ? new Date().toISOString() :
                                         config.type === 'select' && config.options ? config.options[0] : '';
                      handleMetadataChange(fieldKey, defaultValue);
                    }}
                    className="text-gray-600 hover:text-gray-800 text-sm px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    + {fieldKey}
                  </button>
                );
              }
              return null;
            })}
            
            {metadataTemplates?.templates.default && (
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    metadata: { ...prev.metadata, ...metadataTemplates.templates.default }
                  }));
                }}
                className="text-green-600 hover:text-green-800 text-sm px-3 py-1 border border-green-300 rounded-lg hover:bg-green-50"
              >
                基本テンプレート適用
              </button>
            )}
          </div>
          
          {formData.category && metadataTemplates?.templates[formData.category] && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">推奨メタデータフィールド ({formData.category}):</p>
              <div className="flex flex-wrap gap-1">
                {Object.keys(metadataTemplates.templates[formData.category]).map(field => (
                  <span key={field} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}
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