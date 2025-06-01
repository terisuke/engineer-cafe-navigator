'use client';

import React, { useState, useEffect } from 'react';
import MarpViewer from '@/app/components/MarpViewer';
import { audioStateManager } from '@/lib/audio-state-manager';

export default function TestSyncPage() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [slideChangeCount, setSlideChangeCount] = useState(0);

  const addTestResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    const handleAudioComplete = () => {
      addTestResult('✅ Audio processing completed - slide should advance');
    };

    window.addEventListener('audioProcessingComplete', handleAudioComplete);
    
    return () => {
      window.removeEventListener('audioProcessingComplete', handleAudioComplete);
    };
  }, []);

  const handleSlideChange = (slideNumber: number) => {
    setSlideChangeCount(prev => prev + 1);
    addTestResult(`📍 Slide changed to: ${slideNumber}`);
  };

  const runSynchronizationTest = async () => {
    setIsTestRunning(true);
    setTestResults([]);
    addTestResult('🚀 Starting synchronization test...');
    
    // Test 1: Check if audio state manager is working
    addTestResult(`🔧 Audio processing status: ${audioStateManager.isAudioProcessing()}`);
    
    // Test 2: Simulate audio queueing
    const testAudioBlob = new Blob(['test'], { type: 'audio/mp3' });
    const testAudioUrl = URL.createObjectURL(testAudioBlob);
    
    audioStateManager.queueAudio(testAudioUrl, () => {
      addTestResult('✅ Test audio completed successfully');
      URL.revokeObjectURL(testAudioUrl);
    });
    
    setTimeout(() => {
      setIsTestRunning(false);
      addTestResult('🏁 Test completed');
    }, 3000);
  };

  const clearResults = () => {
    setTestResults([]);
    setSlideChangeCount(0);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto p-4">
        <div className="bg-white rounded-lg shadow-lg mb-6 p-6">
          <h1 className="text-2xl font-bold mb-4">AITuber-Kit Style Sync Test</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded">
              <h3 className="font-semibold text-blue-800">Test Controls</h3>
              <div className="space-y-2 mt-2">
                <button
                  onClick={runSynchronizationTest}
                  disabled={isTestRunning}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
                >
                  {isTestRunning ? 'Testing...' : 'Run Sync Test'}
                </button>
                <button
                  onClick={clearResults}
                  className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Clear Results
                </button>
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded">
              <h3 className="font-semibold text-green-800">Statistics</h3>
              <div className="mt-2 space-y-1">
                <p className="text-sm">Slide Changes: <span className="font-mono">{slideChangeCount}</span></p>
                <p className="text-sm">Audio Processing: <span className="font-mono">{audioStateManager.isAudioProcessing() ? 'Active' : 'Idle'}</span></p>
                <p className="text-sm">Test Results: <span className="font-mono">{testResults.length}</span></p>
              </div>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded">
              <h3 className="font-semibold text-yellow-800">Success Criteria</h3>
              <div className="mt-2 space-y-1 text-sm">
                <p>✅ Slides advance only after audio</p>
                <p>✅ No audio overlap</p>
                <p>✅ Character animations sync</p>
                <p>✅ Smooth transitions</p>
                <p>✅ Memory cleanup working</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded max-h-64 overflow-y-auto">
            <h3 className="font-semibold mb-2">Test Results Log</h3>
            {testResults.length === 0 ? (
              <p className="text-gray-500 italic">No test results yet. Run a test to see output.</p>
            ) : (
              <div className="space-y-1">
                {testResults.map((result, index) => (
                  <div key={index} className="text-sm font-mono bg-white p-2 rounded border">
                    {result}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg" style={{ height: '70vh' }}>
          <MarpViewer
            slideFile="engineer-cafe"
            language="ja"
            autoPlay={false}
            onSlideChange={handleSlideChange}
            onQuestionAsked={(question) => addTestResult(`❓ Question asked: ${question}`)}
          />
        </div>
      </div>
    </div>
  );
}