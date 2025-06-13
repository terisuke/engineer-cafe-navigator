'use client';

import { Toaster } from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KnowledgeEditor } from '../components/KnowledgeEditor';

export default function NewKnowledgePage() {
  const router = useRouter();

  const handleSave = async (formData: any) => {
    console.log('🔍 handleSave called with:', formData);
    
    try {
      const response = await fetch('/api/admin/knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      console.log('🔍 API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API error:', errorText);
        throw new Error(`Failed to save: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Save successful:', result);
      
      // Success - redirect to list page
      router.push('/admin/knowledge');
    } catch (error) {
      console.error('❌ Save error:', error);
      throw error; // Re-throw so KnowledgeEditor can handle it
    }
  };

  const handleCancel = () => {
    router.push('/admin/knowledge');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Toaster position="top-right" />
      
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                新規知識ベースエントリ作成
              </h1>
              <Link
                href="/admin/knowledge"
                className="text-gray-600 hover:text-gray-800"
              >
                一覧に戻る
              </Link>
            </div>
          </div>

          <div className="p-6">
            <KnowledgeEditor onSave={handleSave} onCancel={handleCancel} />
          </div>
        </div>
      </div>
    </div>
  );
}