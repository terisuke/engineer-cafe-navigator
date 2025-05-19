import VoiceInterface from './components/VoiceInterface';
import MarpViewer from './components/MarpViewer';
import CharacterAvatar from './components/CharacterAvatar';
import LanguageSelector from './components/LanguageSelector';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            Engineer Cafe Navigator
          </h1>
          <LanguageSelector />
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-120px)]">
          {/* Character Avatar Section */}
          <div className="col-span-12 lg:col-span-4">
            <div className="bg-white rounded-lg shadow-md h-full">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-800">
                  AI Guide
                </h2>
              </div>
              <div className="p-4 h-[calc(100%-64px)]">
                <CharacterAvatar />
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="col-span-12 lg:col-span-8">
            <div className="bg-white rounded-lg shadow-md h-full">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-800">
                  Presentation & Q&A
                </h2>
              </div>
              <div className="h-[calc(100%-64px)]">
                <MarpViewer />
              </div>
            </div>
          </div>
        </div>

        {/* Voice Interface */}
        <div className="fixed bottom-6 right-6">
          <VoiceInterface />
        </div>
      </div>
    </main>
  );
}
