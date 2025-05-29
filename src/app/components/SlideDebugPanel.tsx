'use client';

import { useState, useEffect } from 'react';
import { Bug, Eye, EyeOff, RefreshCw } from 'lucide-react';

interface SlideDebugPanelProps {
  iframeRef: React.RefObject<HTMLIFrameElement>;
  currentSlide: number;
  totalSlides: number;
  onRefresh?: () => void;
}

export default function SlideDebugPanel({ 
  iframeRef, 
  currentSlide, 
  totalSlides, 
  onRefresh 
}: SlideDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showAllSlides, setShowAllSlides] = useState(false);

  const analyzeSlides = () => {
    if (!iframeRef.current?.contentDocument) {
      setDebugInfo({ error: 'No iframe document available' });
      return;
    }

    const doc = iframeRef.current.contentDocument;
    const info: any = {
      timestamp: new Date().toLocaleTimeString(),
      methods: []
    };

    // Method 1: Marp SVG slides
    const svgSlides = doc.querySelectorAll('.marpit > svg');
    info.methods.push({
      name: 'Marp SVG (.marpit > svg)',
      count: svgSlides.length,
      elements: Array.from(svgSlides).map((el, i) => ({
        index: i,
        id: el.id,
        class: el.className,
        style: el.getAttribute('style'),
        display: window.getComputedStyle(el).display,
        visibility: window.getComputedStyle(el).visibility
      }))
    });

    // Method 2: Sections with Marp attributes
    const sectionSlides = doc.querySelectorAll('section[data-marpit-pagination]');
    info.methods.push({
      name: 'Section with data-marpit-pagination',
      count: sectionSlides.length,
      elements: Array.from(sectionSlides).map((el, i) => ({
        index: i,
        id: el.id,
        class: el.className,
        pagination: el.getAttribute('data-marpit-pagination')
      }))
    });

    // Method 3: All sections
    const allSections = doc.querySelectorAll('section');
    info.methods.push({
      name: 'All sections',
      count: allSections.length,
      elements: Array.from(allSections).map((el, i) => ({
        index: i,
        id: el.id,
        class: el.className
      }))
    });

    // Method 4: Elements with slide IDs
    const slideIdElements = doc.querySelectorAll('[id^="slide-"]');
    info.methods.push({
      name: 'Elements with slide IDs',
      count: slideIdElements.length,
      elements: Array.from(slideIdElements).map((el, i) => ({
        index: i,
        id: el.id,
        tagName: el.tagName,
        class: el.className
      }))
    });

    // General document info
    info.document = {
      title: doc.title,
      body: {
        className: doc.body?.className,
        children: doc.body?.children.length
      },
      stylesheets: doc.styleSheets.length
    };

    setDebugInfo(info);
  };

  const toggleShowAllSlides = () => {
    if (!iframeRef.current?.contentDocument) return;

    const doc = iframeRef.current.contentDocument;
    const slides = doc.querySelectorAll('.marpit > svg, section');

    slides.forEach((slide) => {
      const element = slide as HTMLElement;
      if (showAllSlides) {
        // Hide all except current
        element.style.display = slide === slides[currentSlide - 1] ? 'block' : 'none';
      } else {
        // Show all slides
        element.style.display = 'block';
        element.style.border = '2px solid red';
        element.style.margin = '10px';
      }
    });

    setShowAllSlides(!showAllSlides);
  };

  useEffect(() => {
    if (isOpen) {
      analyzeSlides();
    }
  }, [isOpen, currentSlide, totalSlides]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 px-3 py-2 bg-gray-800 text-white rounded-lg shadow-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
        title="Open Slide Debug Panel"
      >
        <Bug className="w-4 h-4" />
        <span className="text-sm font-medium">Debug</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-16 right-4 z-50 w-96 max-h-96 bg-white rounded-lg shadow-xl border border-gray-300 overflow-hidden">
      <div className="p-3 bg-red-500 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5" />
          <h3 className="font-semibold">Slide Debug Panel</h3>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-red-600 rounded"
        >
          ×
        </button>
      </div>

      <div className="p-3 max-h-80 overflow-y-auto">
        <div className="flex gap-2 mb-3">
          <button
            onClick={analyzeSlides}
            className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
          <button
            onClick={toggleShowAllSlides}
            className="flex items-center gap-1 px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
          >
            {showAllSlides ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showAllSlides ? 'Hide All' : 'Show All'}
          </button>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-1 px-2 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600"
            >
              Reload Slides
            </button>
          )}
        </div>

        <div className="text-sm space-y-2">
          <div className="p-2 bg-gray-100 rounded">
            <strong>Current State:</strong> Slide {currentSlide} of {totalSlides}
          </div>

          {debugInfo ? (
            <div className="space-y-2">
              <div className="text-xs text-gray-500">
                Last updated: {debugInfo.timestamp}
              </div>

              {debugInfo.methods.map((method: any, i: number) => (
                <div key={i} className="p-2 border rounded">
                  <div className="font-medium text-sm">{method.name}</div>
                  <div className="text-xs text-gray-600">
                    Found: {method.count} elements
                  </div>
                  {method.count > 0 && (
                    <details className="mt-1">
                      <summary className="text-xs cursor-pointer text-blue-600">
                        Show elements
                      </summary>
                      <div className="mt-1 text-xs space-y-1 max-h-20 overflow-y-auto">
                        {method.elements.map((el: any, j: number) => (
                          <div key={j} className="pl-2 border-l-2 border-gray-200">
                            {j}: {el.id || 'no-id'} ({el.tagName || 'unknown'})
                            {el.display && ` - display: ${el.display}`}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}

              {debugInfo.document && (
                <div className="p-2 border rounded">
                  <div className="font-medium text-sm">Document Info</div>
                  <div className="text-xs space-y-1">
                    <div>Title: {debugInfo.document.title || 'none'}</div>
                    <div>Body class: {debugInfo.document.body.className || 'none'}</div>
                    <div>Body children: {debugInfo.document.body.children}</div>
                    <div>Stylesheets: {debugInfo.document.stylesheets}</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-xs">Click Refresh to analyze slides</div>
          )}
        </div>
      </div>
    </div>
  );
}