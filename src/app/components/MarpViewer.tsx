'use client';

import { useKeyboardControls } from '@/app/hooks/useKeyboardControls';
import { audioStateManager } from '@/lib/audio-state-manager';
import { ChevronLeft, ChevronRight, Keyboard, MessageCircle, Pause, Play, RotateCcw, Settings } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
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

interface PresentationSettings {
  autoAdvance: boolean;
  narrationSpeed: number;
  skipAnimations: boolean;
  preloadCount: number;
  enableLipSync: boolean;
}

interface MarpViewerProps {
  slideFile?: string;
  language?: 'ja' | 'en';
  autoPlay?: boolean;
  onSlideChange?: (slideNumber: number) => void;
  onQuestionAsked?: (question: string) => void;
  onVisemeControl?: ((viseme: string, intensity: number) => void) | null;
  onExpressionControl?: ((expression: string, weight: number) => void) | null;
  volume?: number;
}

export default function MarpViewer({ 
  slideFile = 'engineer-cafe',
  language = 'ja',
  autoPlay = false,
  onSlideChange,
  onQuestionAsked,
  onVisemeControl,
  onExpressionControl,
  volume = 80
}: MarpViewerProps) {
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [narrationData, setNarrationData] = useState<NarrationData | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<'ja' | 'en'>(language);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [totalSlides, setTotalSlides] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [showNotes, setShowNotes] = useState(false);
  const [questionMode, setQuestionMode] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);
  const [audioCache, setAudioCache] = useState<Map<number, string>>(new Map());
  const [showSettings, setShowSettings] = useState(false);
  // Load settings from localStorage
  const [settings, setSettings] = useState<PresentationSettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('marp-viewer-settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            autoAdvance: parsed.autoAdvance ?? true,
            narrationSpeed: parsed.narrationSpeed ?? 1.0,
            skipAnimations: parsed.skipAnimations ?? false,
            preloadCount: parsed.preloadCount ?? 2,
            enableLipSync: parsed.enableLipSync ?? false,
          };
        }
      } catch (error) {
        console.warn('Failed to load settings from localStorage:', error);
      }
    }
    return {
      autoAdvance: true,
      narrationSpeed: 1.0,
      skipAnimations: false,
      preloadCount: 2,
      enableLipSync: false,
    };
  });
  const [retryCount, setRetryCount] = useState(0);
  const [presentationStartTime, setPresentationStartTime] = useState<number | null>(null);
  const [showAudioPermissionPrompt, setShowAudioPermissionPrompt] = useState(false);
  const [isNarrationInProgress, setIsNarrationInProgress] = useState(false);
  const [slideViewTimes, setSlideViewTimes] = useState<Map<number, number>>(new Map());
  const [lipSyncCacheStats, setLipSyncCacheStats] = useState<any>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Analytics tracking
  const trackPresentationEvent = (event: string, data: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[Analytics] ${timestamp}`, event, data);
  };

  // Error recovery with retry logic
  const narrateWithRetry = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        await narrateCurrentSlide();
        setRetryCount(0);
        break;
      } catch (error) {
        console.error(`[MarpViewer] Narration attempt ${i + 1} failed:`, error);
        setRetryCount(i + 1);
        
        if (i === retries - 1) {
          trackPresentationEvent('narration_failed', {
            slideNumber: currentSlide,
            attempts: retries,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          const shouldContinue = window.confirm(
            currentLanguage === 'ja' 
              ? 'ナレーションが利用できません。音声なしで続行しますか？' 
              : 'Narration unavailable. Continue without audio?'
          );
          
          if (shouldContinue && isPlaying && currentSlide < totalSlides) {
            setTimeout(() => {
              const newSlide = currentSlide + 1;
              setCurrentSlide(newSlide);
              onSlideChange?.(newSlide);
            }, 1000);
          }
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }
  };

  // Load slides and narration data when slideFile or language prop changes
  useEffect(() => {
    // Only auto-load if autoPlay is enabled
    if (autoPlay) {
      loadSlideData(currentLanguage);
    }
  }, [slideFile, currentLanguage, autoPlay]);

  // Track slide view duration
  useEffect(() => {
    const slideStartTime = Date.now();
    setSlideViewTimes(prev => new Map(prev.set(currentSlide, slideStartTime)));
    
    return () => {
      const duration = Date.now() - slideStartTime;
      trackPresentationEvent('slide_viewed', {
        slideNumber: currentSlide,
        duration,
        timestamp: new Date().toISOString()
      });
    };
  }, [currentSlide]);

  // Auto-play functionality with narration
  useEffect(() => {
    if (isPlaying && totalSlides > 0 && !isNarrating) {
      console.log(`[DEBUG] Auto-play triggered for slide ${currentSlide}`);
      if (!presentationStartTime) {
        setPresentationStartTime(Date.now());
        trackPresentationEvent('presentation_started', {
          slideCount: totalSlides,
          language,
          autoPlay: true
        });
      }
      narrateWithRetry();
    } else if (!isPlaying) {
      stopAutoPlay();
    }

    return () => stopAutoPlay();
  }, [isPlaying, currentSlide, totalSlides]);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('marp-viewer-settings', JSON.stringify(settings));
      } catch (error) {
        console.warn('Failed to save settings to localStorage:', error);
      }
    }
  }, [settings]);

  // Listen for auto-start presentation event from parent
  useEffect(() => {
    const handleAutoStartPresentation = (event: CustomEvent) => {
      if (event.detail?.autoPlay && !isPlaying) {
        // Set character to neutral expression for slide presentation
        if (onExpressionControl) {
          onExpressionControl('neutral', 1.0);
        }
        
        // Load slides with specified language
        const eventLanguage = event.detail?.language || 'ja';
        loadSlideData(eventLanguage).then(() => {
          setIsPlaying(true);
        });
      }
    };

    window.addEventListener('autoStartPresentation', handleAutoStartPresentation as EventListener);
    return () => {
      window.removeEventListener('autoStartPresentation', handleAutoStartPresentation as EventListener);
    };
  }, [isPlaying, onExpressionControl]);

  // Cleanup audio cache on unmount
  useEffect(() => {
    return () => {
      audioCache.forEach((audioUrl) => {
        URL.revokeObjectURL(audioUrl);
      });
    };
  }, [audioCache]);

  // Handle iframe messages and slide visibility
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security check: verify event origin
      const allowedOrigins = [
        window.location.origin,
        'null', // For iframe srcDoc content
      ];
      
      if (!allowedOrigins.includes(event.origin)) {
        console.warn('Rejected message from untrusted origin:', event.origin);
        return;
      }

      if (event.data.type === 'slide-control') {
        if (event.data.action === 'next') {
          nextSlide();
        } else if (event.data.action === 'previous') {
          previousSlide();
        }
      } else if (event.data.type === 'marp-ready') {
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


  const loadSlideData = async (requestedLang: string = 'ja') => {
    try {
      setIsLoading(true);
      setError(null);
      // Update language state
      setCurrentLanguage(requestedLang as 'ja' | 'en');

      // Clear previous HTML to avoid showing outdated slide deck
      setRenderedHtml('');

      // Determine the slide file path based on language
      const languageSlideFile = requestedLang === 'en' ? `en/${slideFile}` : `ja/${slideFile}`;

      // Render slides with narration
      const response = await fetch('/api/marp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'render_with_narration',
          slideFile: languageSlideFile, // Use language-specific slide file
          theme: 'engineer-cafe',
          outputFormat: 'both',
          language: requestedLang, // Add language parameter
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
      

      // Ignore response if a newer loadSlideData was triggered in the meantime
      if (result.success) {
        if (result.slideData && result.slideData.slides) {
          setSlides(result.slideData.slides);
          setTotalSlides(result.slideData.slides.length);
        } else if (result.slideCount) {
          // Fallback to slideCount if slideData is not available
          setTotalSlides(result.slideCount);
        }

        if (result.narrationData) {
          setNarrationData(result.narrationData);
        }

        if (result.html) {
          // First, sanitize the raw HTML content
          const sanitizedHtml = sanitizeHtml(result.html);
          
          // Inject CSS for proper Marp slide display
          const enhancedHtml = sanitizedHtml.replace(
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
          
          // Add controlled script for slide detection (safe since we control this content)
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
                    // Notify parent (safe since we're in a sandboxed iframe)
                    if (window.parent && window.parent.postMessage) {
                      try {
                        window.parent.postMessage({ type: 'marp-ready', slideCount: slides.length }, '*');
                      } catch (e) {
                        console.warn('Could not send message to parent:', e);
                      }
                    }
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


  const narrateCurrentSlide = async () => {
    if (!isPlaying || isNarrating || isNarrationInProgress) {
      console.log(`[DEBUG] Skipping narration - isPlaying: ${isPlaying}, isNarrating: ${isNarrating}, inProgress: ${isNarrationInProgress}`);
      return;
    }
    
    setIsNarrationInProgress(true);
    setIsNarrating(true);
    
    try {
      let result: any = null;
      
      // Determine the slide file path based on current language
      const languageSlideFile = currentLanguage === 'en' ? `en/${slideFile}` : `ja/${slideFile}`;
      
      const response = await fetch('/api/slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'narrate_current',
          slideNumber: currentSlide,
          slideFile: languageSlideFile, // Use language-specific slide file
          language: currentLanguage, // Use current language state instead of prop
        }),
      });
      
      result = await response.json();
      
      
      if (result.audioResponse) {
        // Add small delay to ensure audio is properly loaded before playing
        setTimeout(async () => {
          try {
            await playAudioWithLipSync(result.audioResponse);
            setIsNarrating(false);
            setIsNarrationInProgress(false);
            
            // Directly advance to next slide if still playing
            if (isPlaying && currentSlide < totalSlides) {
              const nextSlide = currentSlide + 1;
              setCurrentSlide(nextSlide);
              onSlideChange?.(nextSlide);
            } else if (currentSlide >= totalSlides) {
              setIsPlaying(false);
              trackPresentationEvent('presentation_completed', {
                totalDuration: presentationStartTime ? Date.now() - presentationStartTime : 0
              });
            }
          } catch (error) {
            console.error('[MarpViewer] Error during audio playback:', error);
            setIsNarrating(false);
            setIsNarrationInProgress(false);
          }
        }, 300); // 300ms delay to ensure audio is ready
        
        // Note: Expressions disabled for slide mode - only lip sync is used
        // This provides natural presentation without distracting facial expressions
        if (result?.characterAction) {
          updateCharacterAction(result.characterAction);
        }
      } else {
        setIsNarrating(false);
        setIsNarrationInProgress(false);
      }
    } catch (error) {
      console.error('[MarpViewer] Error narrating slide:', error);
      setIsNarrating(false);
      setIsNarrationInProgress(false);
    }
  };


  // Fast audio playback without lip sync analysis
  const playAudioFast = async (audioBase64: string): Promise<void> => {
    try {
      console.log('[MarpViewer] Playing audio fast (no lip sync)');
      
      const audioData = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
      const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.volume = volume / 100;

      return new Promise<void>((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          console.log('[MarpViewer] Fast audio ended');
          resolve();
        };

        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          console.error('[MarpViewer] Fast audio error');
          resolve();
        };

        audio.play().catch((error) => {
          console.error('[MarpViewer] Fast audio play failed:', error);
          URL.revokeObjectURL(audioUrl);
          resolve();
        });
      });
    } catch (error) {
      console.error('[MarpViewer] Error playing fast audio:', error);
    }
  };

  // Play audio with optional lip-sync for slide narration
  const playAudioWithLipSync = async (audioBase64: string) => {
    // Use fast playback if lip sync is disabled
    if (!settings.enableLipSync) {
      return await playAudioFast(audioBase64);
    }

    try {
      console.log('[MarpViewer] Playing audio with lip-sync');
      
      const audioData = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
      const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.volume = volume / 100;

      // Perform lip-sync analysis
      if (onVisemeControl) {
        console.log('[MarpViewer] Starting lip-sync analysis with direct viseme control');
        
        try {
          const { LipSyncAnalyzer } = await import('@/lib/lip-sync-analyzer');
          const analyzer = new LipSyncAnalyzer();
          
          const analysisStartTime = performance.now();
          const lipSyncData = await analyzer.analyzeLipSync(audioBlob);
          const analysisTime = performance.now() - analysisStartTime;
          
          console.log('[MarpViewer] Lip-sync analysis complete:', lipSyncData.frames.length, 'frames', `in ${analysisTime.toFixed(1)}ms`);
          
          // Update cache stats for UI
          setLipSyncCacheStats(analyzer.getCacheStats());
          
          // Schedule viseme updates
          let frameIndex = 0;
          const updateLipSync = () => {
            if (frameIndex < lipSyncData.frames.length && audio.currentTime >= 0) {
              const frame = lipSyncData.frames[frameIndex];
              
              console.log(`[MarpViewer] Lip-sync frame ${frameIndex}:`, frame.mouthShape, 'intensity:', frame.mouthOpen);
              onVisemeControl(frame.mouthShape, frame.mouthOpen);
              
              frameIndex++;
              setTimeout(updateLipSync, 50); // 20fps
            } else if (frameIndex >= lipSyncData.frames.length) {
              console.log('[MarpViewer] Lip-sync animation complete');
              onVisemeControl('Closed', 0); // Reset to closed mouth
            }
          };
          
          // Start lip-sync when audio starts
          audio.onplay = () => {
            console.log('[MarpViewer] Audio started, beginning lip-sync animation');
            updateLipSync();
          };
          
          analyzer.dispose();
        } catch (lipSyncError) {
          console.warn('[MarpViewer] Lip-sync analysis failed:', lipSyncError);
        }
      } else {
        console.warn('[MarpViewer] Viseme control function not available');
      }

      return new Promise<void>((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          console.log('[MarpViewer] Audio ended');
          
          // Reset only the viseme (mouth shape) to closed, but keep the current expression
          if (onVisemeControl) {
            onVisemeControl('Closed', 0);
          }
          
          resolve();
        };

        audio.play().catch((error) => {
          console.error('[MarpViewer] Audio play failed:', error);
          resolve();
        });
      });
    } catch (error) {
      console.error('[MarpViewer] Error playing audio with lip-sync:', error);
    }
  };

  const updateCharacterAction = async (action: string) => {
    try {
      await fetch('/api/character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'playAnimation',
          animation: action,
          transition: true,
        }),
      });
    } catch (error) {
      console.error('[MarpViewer] Error updating character:', error);
    }
  };


  const stopAutoPlay = () => {
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    setIsNarrating(false);
    setIsNarrationInProgress(false);
    audioStateManager.stopAll();
    
    // Reset viseme to closed mouth when stopping
    if (onVisemeControl) {
      onVisemeControl('Closed', 0);
    }
    
    // Reset to neutral expression when stopping presentation
    if (onExpressionControl) {
      onExpressionControl('neutral', 1.0);
      console.log('[MarpViewer] Reset character to neutral when stopping presentation');
    }
    
    audioCache.forEach((audioUrl) => {
      URL.revokeObjectURL(audioUrl);
    });
    setAudioCache(new Map());
  };

  const handleSlideNavigation = async (action: string, targetSlide?: number) => {
    try {
      // Skip API call if environment variables are not set
      const isBackendAvailable = process.env.NEXT_PUBLIC_SKIP_BACKEND !== 'true';
      
      if (!isBackendAvailable) {
        console.log('Backend skipped, using local navigation only');
        return;
      }
      
      // Determine the slide file path based on current language
      const languageSlideFile = currentLanguage === 'en' ? `en/${slideFile}` : `ja/${slideFile}`;
      
      const response = await fetch('/api/slides', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          slideNumber: targetSlide || currentSlide,
          slideFile: languageSlideFile,
          language: currentLanguage,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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
      // Don't show error for navigation issues, just log them
      console.warn('Slide navigation API unavailable, using local navigation only');
    }
  };

  const nextSlide = async () => {
    if (audioStateManager.isAudioProcessing()) {
      console.log('[MarpViewer] Cannot advance - audio still processing');
      return;
    }
    
    if (currentSlide < totalSlides) {
      const newSlide = currentSlide + 1;
      setCurrentSlide(newSlide);
      onSlideChange?.(newSlide);
      handleSlideNavigation('next', newSlide);
    }
  };

  const previousSlide = async () => {
    if (currentSlide > 1) {
      const newSlide = currentSlide - 1;
      setCurrentSlide(newSlide);
      onSlideChange?.(newSlide);
      // Don't await to avoid blocking UI
      handleSlideNavigation('previous', newSlide);
    }
  };

  const gotoSlide = async (slideNumber: number) => {
    if (slideNumber >= 1 && slideNumber <= totalSlides) {
      setCurrentSlide(slideNumber);
      onSlideChange?.(slideNumber);
      // Don't await to avoid blocking UI
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

  const toggleAutoPlay = async () => {
    if (isPlaying) {
      stopAutoPlay();
      setIsPlaying(false);
      return;
    }
    
    // Set character to neutral expression for slide presentation
    if (onExpressionControl) {
      onExpressionControl('neutral', 1.0);
      console.log('[MarpViewer] Set character to neutral for slide presentation');
    }
    
    // Test audio permission by playing a silent audio
    try {
      const testAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
      await testAudio.play();
      testAudio.pause();
      setIsPlaying(true);
    } catch (error) {
      if (error instanceof Error && error.name === 'NotAllowedError') {
        setShowAudioPermissionPrompt(true);
      } else {
        console.error('Audio test failed:', error);
        setIsPlaying(true); // Continue anyway
      }
    }
  };
  
  const enableAudioAndStartPresentation = () => {
    // Set character to neutral expression for slide presentation
    if (onExpressionControl) {
      onExpressionControl('neutral', 1.0);
      console.log('[MarpViewer] Set character to neutral for slide presentation');
    }
    setShowAudioPermissionPrompt(false);
    setIsPlaying(true);
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

  const playNarrationAudio = async (audioBase64: string) => {
    try {
      if (settings.enableLipSync) {
        console.log('[MarpViewer] Playing Q&A response with lip-sync');
        await playAudioWithLipSync(audioBase64);
      } else {
        console.log('[MarpViewer] Playing Q&A response fast (no lip-sync)');
        await playAudioFast(audioBase64);
      }
    } catch (error) {
      console.error('Error playing narration audio:', error);
    }
  };

  // Sanitize HTML content to prevent XSS attacks
  // Note: This provides basic XSS protection. For production, consider using DOMPurify library
  const sanitizeHtml = (html: string): string => {
    try {
      // Create a temporary DOM parser
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Remove all script tags and their content (we'll add our own controlled scripts later)
      const scripts = doc.querySelectorAll('script');
      scripts.forEach(script => script.remove());
      
      // Remove javascript: URLs and on* event handlers
      const allElements = doc.querySelectorAll('*');
      allElements.forEach(element => {
        // Remove all on* event handlers (onclick, onload, etc.)
        Array.from(element.attributes).forEach(attr => {
          if (attr.name.startsWith('on')) {
            element.removeAttribute(attr.name);
          }
        });
        
        // Check and sanitize href and src attributes for javascript: URLs
        ['href', 'src', 'action', 'formaction', 'data'].forEach(attrName => {
          const attrValue = element.getAttribute(attrName);
          if (attrValue && (
            attrValue.toLowerCase().includes('javascript:') ||
            attrValue.toLowerCase().includes('data:text/html') ||
            attrValue.toLowerCase().includes('vbscript:')
          )) {
            element.removeAttribute(attrName);
          }
        });
      });
      
      // Remove potentially dangerous tags
      const dangerousTags = ['object', 'embed', 'applet', 'link[rel="import"]', 'meta[http-equiv]', 'base'];
      dangerousTags.forEach(selector => {
        const tags = doc.querySelectorAll(selector);
        tags.forEach(tag => tag.remove());
      });
      
      return doc.documentElement.outerHTML;
    } catch (error) {
      console.error('HTML sanitization failed:', error);
      // Return empty HTML document as fallback
      return '<!DOCTYPE html><html><head><title>Error</title></head><body><p>Content could not be displayed safely.</p></body></html>';
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
      // Determine the slide file path based on current language
      const languageSlideFile = currentLanguage === 'en' ? `en/${slideFile}` : `ja/${slideFile}`;
      
      const response = await fetch('/api/slides', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'answer_question',
          question: questionText,
          slideFile: languageSlideFile,
          language: currentLanguage,
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
            {currentLanguage === 'ja' ? 'スライドを読み込んでいます...' : 'Loading slides...'}
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
            onClick={() => loadSlideData(currentLanguage)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            {currentLanguage === 'ja' ? '再試行' : 'Retry'}
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


          {/* Audio state indicator */}
          {isNarrating && (
            <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100 rounded">
              <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full" />
              <span className="text-sm text-blue-700">
                {currentLanguage === 'ja' ? 'ナレーション中...' : 'Narrating...'}
              </span>
            </div>
          )}

          {/* Question mode toggle */}
          <button
            onClick={() => setQuestionMode(!questionMode)}
            className={`p-2 rounded transition-colors ${
              questionMode ? 'bg-orange-500 hover:bg-orange-600' : 'bg-gray-500 hover:bg-gray-600'
            } text-white`}
            title={currentLanguage === 'ja' ? '質問する' : 'Ask Question'}
          >
            <MessageCircle className="w-4 h-4" />
          </button>

          {/* Reset */}
          <button
            onClick={() => gotoSlide(1)}
            className="p-2 rounded bg-gray-500 text-white hover:bg-gray-600 transition-colors"
            title={currentLanguage === 'ja' ? '最初から' : 'Start Over'}
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

          {/* Settings */}
          <button
            onClick={async () => {
              setShowSettings(!showSettings);
              if (!showSettings) {
                // Update cache stats when opening settings
                try {
                  const { LipSyncAnalyzer } = await import('@/lib/lip-sync-analyzer');
                  const analyzer = new LipSyncAnalyzer();
                  setLipSyncCacheStats(analyzer.getCacheStats());
                  analyzer.dispose();
                } catch (error) {
                  console.error('Failed to load cache stats:', error);
                }
              }
            }}
            className={`p-2 rounded transition-colors ${
              showSettings ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title={language === 'ja' ? '設定' : 'Settings'}
          >
            <Settings className="w-4 h-4" />
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
              placeholder={currentLanguage === 'ja' ? 'スライドについて質問してください...' : 'Ask a question about this slide...'}
              className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleQuestionSubmit()}
            />
            <button
              onClick={handleQuestionSubmit}
              disabled={!questionText.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300 hover:bg-blue-600 transition-colors"
            >
              {currentLanguage === 'ja' ? '送信' : 'Send'}
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
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
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
          <div className="w-1/3 bg-gray-50 border-l flex flex-col">
            <div className="p-4 border-b bg-white">
              <h3 className="font-semibold">
                {language === 'ja' ? 'スライドノート' : 'Slide Notes'}
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Current slide info */}
              {slides[currentSlide - 1] && (
                <div>
                  <h4 className="font-medium text-gray-800 mb-2">
                    {slides[currentSlide - 1].title || `Slide ${currentSlide}`}
                  </h4>
                  {slides[currentSlide - 1].notes && (
                    <p className="text-sm text-gray-600">
                      {slides[currentSlide - 1].notes}
                    </p>
                  )}
                </div>
              )}

              {/* Narration info */}
              {narrationData && (
                <div>
                  <h4 className="font-medium text-gray-800 mb-2">
                    {language === 'ja' ? 'ナレーション' : 'Narration'}
                  </h4>
                  {narrationData.slides[currentSlide - 1] && (
                    <div className="space-y-2">
                      <div>
                        <strong className="text-sm text-gray-700">Auto:</strong>
                        <p className="text-sm text-gray-600 mt-1">{narrationData.slides[currentSlide - 1].narration.auto}</p>
                      </div>
                      <div>
                        <strong className="text-sm text-gray-700">On Enter:</strong>
                        <p className="text-sm text-gray-600 mt-1">{narrationData.slides[currentSlide - 1].narration.onEnter}</p>
                      </div>
                      {Object.keys(narrationData.slides[currentSlide - 1].narration.onDemand).length > 0 && (
                        <div>
                          <strong className="text-sm text-gray-700">On Demand:</strong>
                          <ul className="text-sm text-gray-600 mt-1 space-y-1">
                            {Object.entries(narrationData.slides[currentSlide - 1].narration.onDemand).map(([key, value]) => (
                              <li key={key}>
                                <em className="text-gray-500">{key}:</em> {value}
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
          style={{ width: `${totalSlides ? (currentSlide / totalSlides) * 100 : 0}%` }}
        />
      </div>

      {/* Audio Permission Prompt */}
      {showAudioPermissionPrompt && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="font-bold text-lg mb-4">
              🔊 {language === 'ja' ? '音声再生の許可' : 'Audio Permission Required'}
            </h3>
            <p className="text-gray-700 mb-4">
              {language === 'ja' 
                ? 'ブラウザの設定により音声の自動再生がブロックされています。プレゼンテーションを開始するには音声再生を許可してください。' 
                : 'Audio autoplay is blocked by your browser. Please allow audio playback to start the synchronized presentation.'}
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowAudioPermissionPrompt(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                {language === 'ja' ? 'キャンセル' : 'Cancel'}
              </button>
              <button
                onClick={enableAudioAndStartPresentation}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                🎵 {language === 'ja' ? '音声を有効にして開始' : 'Enable Audio & Start'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 w-full">
            <h3 className="font-bold text-lg mb-4">
              {language === 'ja' ? 'プレゼンテーション設定' : 'Presentation Settings'}
            </h3>
            
            <div className="space-y-4">
              {/* Auto Advance */}
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings.autoAdvance}
                    onChange={(e) => setSettings({...settings, autoAdvance: e.target.checked})}
                    className="rounded"
                  />
                  <span className="text-sm">
                    {language === 'ja' ? '自動進行' : 'Auto Advance'}
                  </span>
                </label>
              </div>

              {/* Narration Speed */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  {language === 'ja' ? 'ナレーション速度' : 'Narration Speed'}: {settings.narrationSpeed}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={settings.narrationSpeed}
                  onChange={(e) => setSettings({...settings, narrationSpeed: parseFloat(e.target.value)})}
                  className="w-full"
                />
              </div>

              {/* Skip Animations */}
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings.skipAnimations}
                    onChange={(e) => setSettings({...settings, skipAnimations: e.target.checked})}
                    className="rounded"
                  />
                  <span className="text-sm">
                    {language === 'ja' ? 'アニメーションをスキップ' : 'Skip Animations'}
                  </span>
                </label>
              </div>

              {/* Enable Lip Sync */}
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings.enableLipSync}
                    onChange={(e) => setSettings({...settings, enableLipSync: e.target.checked})}
                    className="rounded"
                  />
                  <span className="text-sm">
                    {language === 'ja' ? 'リップシンク (遅くなります)' : 'Lip Sync (slower)'}
                  </span>
                </label>
                <div className="text-xs text-gray-500 mt-1">
                  {language === 'ja' ? '口の動きを音声に合わせます。処理に4-8秒かかります。' : 'Synchronizes mouth movement with speech. Takes 4-8 seconds to process.'}
                </div>
              </div>

              {/* Preload Count */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  {language === 'ja' ? 'プリロード数' : 'Preload Count'}: {settings.preloadCount}
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="1"
                  value={settings.preloadCount}
                  onChange={(e) => setSettings({...settings, preloadCount: parseInt(e.target.value)})}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-1">
                  {language === 'ja' ? '次のスライドの音声を事前読み込み' : 'Preload audio for next slides'}
                </div>
              </div>

              {/* Lip-sync Cache Management */}
              <div className="bg-blue-50 p-3 rounded text-xs">
                <div className="font-medium mb-2">
                  {language === 'ja' ? 'リップシンクキャッシュ' : 'Lip-sync Cache'}
                </div>
                {lipSyncCacheStats ? (
                  <div className="space-y-1">
                    <div>Hit Rate: {lipSyncCacheStats.hitRate}%</div>
                    <div>Memory: {lipSyncCacheStats.memoryEntries} entries</div>
                    <div>Storage: {lipSyncCacheStats.localStorageEntries} entries</div>
                    <div>Hits: {lipSyncCacheStats.hitCount} / Misses: {lipSyncCacheStats.missCount}</div>
                  </div>
                ) : (
                  <div className="text-gray-500">No cache data available</div>
                )}
                <button
                  onClick={async () => {
                    try {
                      const { LipSyncAnalyzer } = await import('@/lib/lip-sync-analyzer');
                      const analyzer = new LipSyncAnalyzer();
                      analyzer.clearCache();
                      setLipSyncCacheStats(analyzer.getCacheStats());
                      analyzer.dispose();
                    } catch (error) {
                      console.error('Failed to clear cache:', error);
                    }
                  }}
                  className="mt-2 w-full px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                >
                  {language === 'ja' ? 'キャッシュクリア' : 'Clear Cache'}
                </button>
              </div>

              {/* Performance Info */}
              <div className="bg-gray-50 p-3 rounded text-xs">
                <div className="font-medium mb-1">
                  {language === 'ja' ? 'パフォーマンス情報' : 'Performance Info'}
                </div>
                <div className="space-y-1">
                  <div>Audio Cache: {audioCache.size} slides</div>
                  <div>Retry Count: {retryCount}</div>
                  <div>Current Slide: {currentSlide}/{totalSlides}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setSettings({
                    autoAdvance: true,
                    narrationSpeed: 1.0,
                    skipAnimations: false,
                    preloadCount: 2,
                    enableLipSync: false,
                  });
                }}
                className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                {language === 'ja' ? 'リセット' : 'Reset'}
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                {language === 'ja' ? '閉じる' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug Panel - only in development */}
      {process.env.NODE_ENV === 'development' && (
        <SlideDebugPanel
          iframeRef={iframeRef as React.RefObject<HTMLIFrameElement>}
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
