'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, RotateCcw, ExternalLink, MessageCircle, Keyboard } from 'lucide-react';
import { useKeyboardControls } from '@/app/hooks/useKeyboardControls';
import SlideDebugPanel from './SlideDebugPanel';

interface SlideData {
  slideNumber: number;
  title?: string;
  content: string;
  notes?: string;
}

interface NarrationData {
  metadata: {
    title: string;
    language: string;
    speaker: string;
    version: string;
  };
  slides: Array<{
    slideNumber: number;
    narration: {
      auto: string;
      onEnter: string;
      onDemand: Record<string, string>;
    };
    transitions: {
      next: string | null;
      previous: string | null;
    };
  }>;
}

interface MarpViewerProps {
  slideFile?: string;
  language?: 'ja' | 'en';
  autoPlay?: boolean;
  onSlideChange?: (slideNumber: number) => void;
  onQuestionAsked?: (question: string) => void;
}

export default function MarpViewer({ 
  slideFile = 'engineer-cafe',
  language = 'ja',
  autoPlay = false,
  onSlideChange,
  onQuestionAsked 
}: MarpViewerProps) {
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [narrationData, setNarrationData] = useState<NarrationData | null>(null);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [totalSlides, setTotalSlides] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showNotes, setShowNotes] = useState(false);
  const [questionMode, setQuestionMode] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load slides and narration data
  useEffect(() => {
    loadSlideData();
  }, [slideFile, language]);

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying && totalSlides > 0) {
      startAutoPlay();
    } else {
      stopAutoPlay();
    }

    return () => stopAutoPlay();
  }, [isPlaying, currentSlide, totalSlides, playbackSpeed]);

  // Handle iframe messages and slide visibility
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'slide-control') {
        if (event.data.action === 'next') {
          nextSlide();
        } else if (event.data.action === 'previous') {
          previousSlide();
        }
      } else if (event.data.type === 'marp-ready') {
        console.log('Marp ready with', event.data.slideCount, 'slides');
        // Delay to ensure rendering is complete
        setTimeout(() => {
          updateIframeSlide(currentSlide);
        }, 300);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentSlide, totalSlides]);

  // Update slide visibility when currentSlide changes
  useEffect(() => {
    if (renderedHtml && iframeRef.current && currentSlide > 0) {
      // Add a small delay to ensure iframe is ready
      const timer = setTimeout(() => {
        updateIframeSlide(currentSlide);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [currentSlide, renderedHtml]);


  const loadSlideData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Render slides with narration
      const response = await fetch('/api/marp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'render_with_narration',
          slideFile,
          theme: 'engineer-cafe',
          outputFormat: 'both',
          options: {
            // Ensure proper Marp rendering options
            html: true,
            markdown: {
              breaks: true,
            },
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        if (result.slideData && result.slideData.slides) {
          setSlides(result.slideData.slides);
          setTotalSlides(result.slideData.slides.length);
          console.log(`Loaded ${result.slideData.slides.length} slides from slideData`);
        } else if (result.slideCount) {
          // Fallback to slideCount if slideData is not available
          setTotalSlides(result.slideCount);
          console.log(`Set total slides to ${result.slideCount} from slideCount`);
        }

        if (result.narrationData) {
          setNarrationData(result.narrationData);
        }

        if (result.html) {
          // Inject CSS for proper Marp slide display
          const enhancedHtml = result.html.replace(
            '</head>',
            `<style>
              /* Reset and base styles */
              html, body {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                overflow: hidden;
                background: white;
              }
              
              /* Marp container styles */
              .marpit {
                width: 100%;
                height: 100vh;
                position: relative;
              }
              
              /* Handle both SVG and section-based slides */
              .marpit > svg,
              section[data-marpit-fragment],
              [data-marpit-svg] {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: none;
              }
              
              /* Show visible slides */
              .marpit > svg[style*="display: block"],
              section[style*="display: block"] {
                display: block !important;
              }
              
              /* Ensure content is visible */
              * {
                visibility: visible !important;
              }
            </style>
            </head>`
          );
          
          // Also ensure script execution
          const scriptEnhancedHtml = enhancedHtml.replace(
            '</body>',
            `<script>
              // Wait for Marp to finish rendering
              window.addEventListener('DOMContentLoaded', function() {
                console.log('DOM loaded, checking for slides...');
                const checkSlides = setInterval(() => {
                  const slides = document.querySelectorAll('.marpit > svg, section[data-marpit-fragment]');
                  if (slides.length > 0) {
                    console.log('Slides found:', slides.length);
                    clearInterval(checkSlides);
                    // Notify parent
                    window.parent.postMessage({ type: 'marp-ready', slideCount: slides.length }, '*');
                  }
                }, 100);
              });
            </script>
            </body>`
          );
          
          setRenderedHtml(scriptEnhancedHtml);
        }

        // Give iframe time to render, then show first slide
        setTimeout(() => {
          setCurrentSlide(1);
          updateIframeSlide(1);
        }, 1000);
      } else {
        setError(result.error || 'Failed to load slides');
      }
    } catch (error) {
      console.error('Error loading slides:', error);
      setError('Error loading slides');
    } finally {
      setIsLoading(false);
    }
  };

  const startAutoPlay = () => {
    stopAutoPlay(); // Clear any existing timer

    const interval = 30000 / playbackSpeed; // 30 seconds base interval
    autoPlayTimerRef.current = setTimeout(() => {
      nextSlide();
    }, interval);
  };

  const stopAutoPlay = () => {
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  };

  const handleSlideNavigation = async (action: string, targetSlide?: number) => {
    try {
      // For local navigation without API call when slide data is already loaded
      if (action === 'goto' && targetSlide !== undefined) {
        if (targetSlide >= 1 && targetSlide <= totalSlides) {
          setCurrentSlide(targetSlide);
          onSlideChange?.(targetSlide);
          return;
        }
      }
      
      const response = await fetch('/api/slides', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          slideNumber: targetSlide || currentSlide,
          slideFile,
          language,
        }),
      });

      const result = await response.json();

      if (result.success && result.slideNumber) {
        // Only update if we got a valid slide number
        if (result.slideNumber !== currentSlide) {
          setCurrentSlide(result.slideNumber);
          onSlideChange?.(result.slideNumber);
        }

        // Play narration audio if available
        if (result.audioResponse) {
          playNarrationAudio(result.audioResponse);
        }
      } else if (result.transitionMessage) {
        // Handle end of presentation or other transition messages
        console.log('Transition message:', result.transitionMessage);
      }
    } catch (error) {
      console.error('Error navigating slides:', error);
    }
  };

  const nextSlide = () => {
    if (currentSlide < totalSlides) {
      const newSlide = currentSlide + 1;
      setCurrentSlide(newSlide);
      onSlideChange?.(newSlide);
      handleSlideNavigation('next');
    }
  };

  const previousSlide = () => {
    if (currentSlide > 1) {
      const newSlide = currentSlide - 1;
      setCurrentSlide(newSlide);
      onSlideChange?.(newSlide);
      handleSlideNavigation('previous');
    }
  };

  const gotoSlide = (slideNumber: number) => {
    if (slideNumber >= 1 && slideNumber <= totalSlides) {
      setCurrentSlide(slideNumber);
      onSlideChange?.(slideNumber);
      handleSlideNavigation('goto', slideNumber);
    }
  };

  const toggleFullscreen = () => {
    if (!iframeRef.current) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      iframeRef.current.requestFullscreen();
    }
  };

  const toggleAutoPlay = () => {
    setIsPlaying(!isPlaying);
  };

  // Use keyboard controls
  const { shortcuts } = useKeyboardControls({
    onNext: nextSlide,
    onPrevious: previousSlide,
    onReset: () => gotoSlide(1),
    onTogglePlay: toggleAutoPlay,
    onToggleNotes: () => setShowNotes(!showNotes),
    onToggleFullscreen: toggleFullscreen,
    onQuestionMode: () => setQuestionMode(!questionMode),
    onEscape: () => {
      setQuestionMode(false);
      setShowKeyboardHelp(false);
    },
    onNumberKey: (num) => gotoSlide(num),
    enabled: !questionMode // Disable shortcuts when typing a question
  });

  const playNarrationAudio = (audioBase64: string) => {
    try {
      const audioData = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
      const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);
      audio.play();

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
    } catch (error) {
      console.error('Error playing narration audio:', error);
    }
  };

  const debugSlideStructure = () => {
    if (!iframeRef.current?.contentDocument) {
      console.log('=== Slide Debug Info ===');
      console.log('No iframe document available');
      return;
    }

    try {
      const doc = iframeRef.current.contentDocument;
      console.log('=== Slide Debug Info ===');
      console.log('Document ready state:', doc.readyState);
      console.log('Document body:', !!doc.body);
      console.log('Marpit container:', doc.querySelector('.marpit'));
      console.log('All SVGs:', doc.querySelectorAll('svg').length);
      console.log('Slide SVGs (id*="slide"):', doc.querySelectorAll('svg[id*="slide"]').length);
      console.log('Slide SVGs (id^="slide-"):', doc.querySelectorAll('svg[id^="slide-"]').length);
      console.log('Sections:', doc.querySelectorAll('section').length);
      console.log('First SVG:', doc.querySelector('svg'));
      console.log('First SVG id:', doc.querySelector('svg')?.id);
      
      // Log all SVG IDs for debugging
      const allSvgs = doc.querySelectorAll('svg');
      if (allSvgs.length > 0) {
        console.log('All SVG IDs:', Array.from(allSvgs).map(svg => svg.id).filter(id => id));
      }
    } catch (error) {
      console.error('Error in debugSlideStructure:', error);
    }
  };

  const updateIframeSlide = (slideNumber: number, retryCount = 0) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
        
        // Try multiple selectors for better compatibility
        let slides = iframeDoc.querySelectorAll('section[data-marpit-fragment]');
        
        if (slides.length === 0) {
          slides = iframeDoc.querySelectorAll('.marpit > svg');
        }
        
        if (slides.length === 0) {
          slides = iframeDoc.querySelectorAll('[data-marpit-svg]');
        }
        
        if (slides.length === 0) {
          slides = iframeDoc.querySelectorAll('div.marpit > svg');
        }
        
        // If still no slides and haven't retried too many times, retry after delay
        if (slides.length === 0 && retryCount < 10) {
          console.log(`Retrying slide detection (attempt ${retryCount + 1})`);
          setTimeout(() => {
            updateIframeSlide(slideNumber, retryCount + 1);
          }, 200);
          return;
        }
        
        if (slides.length === 0) {
          console.error('No slides found after multiple attempts');
          return;
        }
        
        console.log(`Found ${slides.length} slides, showing slide ${slideNumber}`);
        
        // Hide all slides
        slides.forEach((slide) => {
          const el = slide as HTMLElement;
          el.style.display = 'none';
          el.style.visibility = 'hidden';
        });
        
        // Show only the current slide
        if (slides[slideNumber - 1]) {
          const currentSlide = slides[slideNumber - 1] as HTMLElement;
          currentSlide.style.display = 'block';
          currentSlide.style.visibility = 'visible';
          currentSlide.style.position = 'relative';
          currentSlide.style.width = '100%';
          currentSlide.style.height = '100%';
        }
        
        // Update counter
        const slideCounter = iframeDoc.getElementById('slideCounter');
        if (slideCounter) {
          slideCounter.textContent = `Slide ${slideNumber} of ${slides.length}`;
        }
      } catch (error) {
        console.error('Error updating slide visibility:', error);
      }
    }
  };

  const handleQuestionSubmit = async () => {
    if (!questionText.trim()) return;

    try {
      const response = await fetch('/api/slides', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'answer_question',
          question: questionText,
          slideFile,
          language,
        }),
      });

      const result = await response.json();

      if (result.success) {
        onQuestionAsked?.(questionText);
        
        // Play answer audio if available
        if (result.audioResponse) {
          playNarrationAudio(result.audioResponse);
        }

        // Show answer in some way (could be passed to parent component)
        console.log('Answer:', result.answer);
      }
    } catch (error) {
      console.error('Error asking question:', error);
    } finally {
      setQuestionText('');
      setQuestionMode(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {language === 'ja' ? 'スライドを読み込んでいます...' : 'Loading slides...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadSlideData}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            {language === 'ja' ? '再試行' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Controls */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center space-x-2">
          <button
            onClick={previousSlide}
            disabled={currentSlide === 1}
            className="p-2 rounded bg-blue-500 text-white disabled:bg-gray-300 hover:bg-blue-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="text-sm font-medium text-gray-700">
            {currentSlide} / {totalSlides}
          </span>
          
          <button
            onClick={nextSlide}
            disabled={currentSlide === totalSlides}
            className="p-2 rounded bg-blue-500 text-white disabled:bg-gray-300 hover:bg-blue-600 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {/* Auto-play controls */}
          <button
            onClick={toggleAutoPlay}
            className={`p-2 rounded transition-colors ${
              isPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
            } text-white`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          {/* Speed control */}
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            className="px-2 py-1 border rounded text-sm"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>

          {/* Question mode toggle */}
          <button
            onClick={() => setQuestionMode(!questionMode)}
            className={`p-2 rounded transition-colors ${
              questionMode ? 'bg-orange-500 hover:bg-orange-600' : 'bg-gray-500 hover:bg-gray-600'
            } text-white`}
            title={language === 'ja' ? '質問する' : 'Ask Question'}
          >
            <MessageCircle className="w-4 h-4" />
          </button>

          {/* Reset */}
          <button
            onClick={() => gotoSlide(1)}
            className="p-2 rounded bg-gray-500 text-white hover:bg-gray-600 transition-colors"
            title={language === 'ja' ? '最初から' : 'Start Over'}
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Notes toggle */}
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              showNotes ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {language === 'ja' ? 'ノート' : 'Notes'}
          </button>

          {/* Keyboard shortcuts help */}
          <button
            onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
            className={`p-2 rounded transition-colors ${
              showKeyboardHelp ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title={language === 'ja' ? 'キーボードショートカット' : 'Keyboard Shortcuts'}
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Question input */}
      {questionMode && (
        <div className="p-4 bg-yellow-50 border-b">
          <div className="flex space-x-2">
            <input
              type="text"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder={language === 'ja' ? 'スライドについて質問してください...' : 'Ask a question about this slide...'}
              className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && handleQuestionSubmit()}
            />
            <button
              onClick={handleQuestionSubmit}
              disabled={!questionText.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 hover:bg-blue-600 transition-colors"
            >
              {language === 'ja' ? '送信' : 'Send'}
            </button>
          </div>
        </div>
      )}

      {/* Slide content */}
      <div className="flex-1 flex">
        {/* Main slide area */}
        <div className={`${showNotes ? 'w-2/3' : 'w-full'} h-full`}>
          {renderedHtml ? (
            <iframe
              ref={iframeRef}
              srcDoc={renderedHtml}
              className="w-full h-full border-0"
              title="Slide presentation"
              onLoad={() => {
                setTimeout(() => {
                  debugSlideStructure();
                  
                  if (iframeRef.current?.contentDocument) {
                    const doc = iframeRef.current.contentDocument;
                    
                    // Correct way to count Marp slides
                    let slideCount = 0;
                    
                    // Marp generates SVG elements with specific pattern
                    const svgSlides = doc.querySelectorAll('.marpit > svg[id*="slide"]');
                    console.log('SVG slides found:', svgSlides.length);
                    
                    if (svgSlides.length > 0) {
                      slideCount = svgSlides.length;
                    } else {
                      // Fallback: count sections
                      const sections = doc.querySelectorAll('section[id*="slide"]');
                      if (sections.length > 0) {
                        slideCount = sections.length;
                      }
                    }
                    
                    console.log(`Correctly detected ${slideCount} slides in iframe`);
                    
                    // Only update if count is reasonable (between 1 and 100)
                    if (slideCount > 0 && slideCount <= 100 && slideCount !== totalSlides) {
                      setTotalSlides(slideCount);
                    }
                    
                    // Initialize the first slide display
                    updateIframeSlide(currentSlide || 1);
                  }
                }, 500);
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-100">
              <p className="text-gray-500">
                {language === 'ja' ? 'スライドが利用できません' : 'No slides available'}
              </p>
            </div>
          )}
        </div>

        {/* Notes area */}
        {showNotes && (
          <div className="w-1/3 bg-gray-50 border-l p-4 overflow-y-auto">
            <h3 className="font-semibold mb-3">
              {language === 'ja' ? 'スライドノート' : 'Slide Notes'}
            </h3>
            
            {/* Current slide info */}
            {slides[currentSlide - 1] && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-800 mb-2">
                  {slides[currentSlide - 1].title || `Slide ${currentSlide}`}
                </h4>
                {slides[currentSlide - 1].notes && (
                  <p className="text-sm text-gray-600 mb-3">
                    {slides[currentSlide - 1].notes}
                  </p>
                )}
              </div>
            )}

            {/* Narration info */}
            {narrationData && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-800 mb-2">
                  {language === 'ja' ? 'ナレーション' : 'Narration'}
                </h4>
                {narrationData.slides[currentSlide - 1] && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Auto:</strong> {narrationData.slides[currentSlide - 1].narration.auto}
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>On Enter:</strong> {narrationData.slides[currentSlide - 1].narration.onEnter}
                    </p>
                    {Object.keys(narrationData.slides[currentSlide - 1].narration.onDemand).length > 0 && (
                      <div>
                        <strong className="text-sm">On Demand:</strong>
                        <ul className="text-sm text-gray-600 mt-1">
                          {Object.entries(narrationData.slides[currentSlide - 1].narration.onDemand).map(([key, value]) => (
                            <li key={key} className="mb-1">
                              <em>{key}:</em> {value}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Navigation hints */}
            <div>
              <h4 className="font-medium text-gray-800 mb-2">
                {language === 'ja' ? 'ナビゲーション' : 'Navigation'}
              </h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>← → {language === 'ja' ? 'スライド移動' : 'Navigate slides'}</li>
                <li>Space {language === 'ja' ? '次のスライド' : 'Next slide'}</li>
                <li>R {language === 'ja' ? '最初から' : 'Reset'}</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Keyboard shortcuts help modal */}
      {showKeyboardHelp && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="font-bold text-lg mb-4">
              {language === 'ja' ? 'キーボードショートカット' : 'Keyboard Shortcuts'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {shortcuts.map((shortcut) => (
                <div key={shortcut.key} className="flex justify-between">
                  <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">
                    {shortcut.key}
                  </kbd>
                  <span className="text-sm text-gray-600 ml-2">
                    {shortcut.description}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowKeyboardHelp(false)}
              className="mt-4 w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              {language === 'ja' ? '閉じる' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="h-1 bg-gray-200">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${(currentSlide / totalSlides) * 100}%` }}
        />
      </div>

      {/* Debug Panel - only in development */}
      {process.env.NODE_ENV === 'development' && (
        <SlideDebugPanel
          iframeRef={iframeRef}
          currentSlide={currentSlide}
          totalSlides={totalSlides}
          onRefresh={() => {
            if (iframeRef.current) {
              iframeRef.current.src = iframeRef.current.src;
            }
          }}
        />
      )}
    </div>
  );
}
