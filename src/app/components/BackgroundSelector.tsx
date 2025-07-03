'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ImageIcon, Palette, Check } from 'lucide-react';

export interface BackgroundOption {
  id: string;
  name: string;
  type: 'gradient' | 'image' | 'solid';
  value: string;
  thumbnail?: string;
}

interface BackgroundSelectorProps {
  onBackgroundChange: (background: BackgroundOption) => void;
  currentBackground?: BackgroundOption;
}

export default function BackgroundSelector({ 
  onBackgroundChange,
  currentBackground
}: BackgroundSelectorProps) {
  const [backgrounds, setBackgrounds] = useState<BackgroundOption[]>([
    // Gradient backgrounds
    {
      id: 'gradient-sky',
      name: 'Sky Gradient',
      type: 'gradient',
      value: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 50%, #fce4ec 100%)',
    },
    {
      id: 'gradient-sunset',
      name: 'Sunset',
      type: 'gradient',
      value: 'linear-gradient(135deg, #fed7aa 0%, #fbbf24 50%, #f59e0b 100%)',
    },
    {
      id: 'gradient-ocean',
      name: 'Ocean',
      type: 'gradient',
      value: 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 50%, #3b82f6 100%)',
    },
    {
      id: 'gradient-forest',
      name: 'Forest',
      type: 'gradient',
      value: 'linear-gradient(135deg, #dcfce7 0%, #86efac 50%, #22c55e 100%)',
    },
    // Solid colors
    {
      id: 'solid-white',
      name: 'Studio White',
      type: 'solid',
      value: '#ffffff',
    },
    {
      id: 'solid-gray',
      name: 'Warm Gray',
      type: 'solid',
      value: '#f5f5f5',
    },
    {
      id: 'solid-blue',
      name: 'Cool Blue',
      type: 'solid',
      value: '#f0f9ff',
    },
  ]);

  const [selectedBg, setSelectedBg] = useState<BackgroundOption>(
    currentBackground || backgrounds[0]
  );
  const [isLoading, setIsLoading] = useState(true);

  const loadBackgroundImages = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Dynamically scan for all image files in the backgrounds folder
      const response = await fetch('/api/backgrounds');
      const data = await response.json();
      const imagePaths = data.images || [];
      
      console.log('Loading background images:', imagePaths);

      const imageBackgrounds: BackgroundOption[] = [];
      
      for (const filename of imagePaths) {
        const fullPath = `/backgrounds/${filename}`;
        try {
          // Verify image can be loaded
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = fullPath;
          });
          
          // Create unique ID using timestamp to prevent duplicates
          const uniqueId = `image-${filename}-${Date.now()}`;
          
          imageBackgrounds.push({
            id: uniqueId,
            name: formatImageName(filename),
            type: 'image',
            value: fullPath,
            thumbnail: fullPath,
          });
          
          console.log(`Successfully loaded background: ${filename}`);
        } catch (e) {
          console.warn(`Failed to load background image: ${filename}`, e);
        }
      }

      if (imageBackgrounds.length > 0) {
        // Replace previous images instead of appending to avoid duplicates
        setBackgrounds(prev => [
          ...prev.filter(bg => bg.type !== 'image'), // Keep gradients and solids
          ...imageBackgrounds
        ]);
        console.log(`Added ${imageBackgrounds.length} background images`);
      } else {
        console.log('No background images found in /public/backgrounds/');
      }
    } catch (error) {
      console.error('Error loading background images:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load background images from public folder
  useEffect(() => {
    loadBackgroundImages();
  }, [loadBackgroundImages]);

  // Update selected background when prop changes
  useEffect(() => {
    if (currentBackground && currentBackground.id !== selectedBg.id) {
      setSelectedBg(currentBackground);
    }
  }, [currentBackground, selectedBg.id]);

  const formatImageName = (filename: string) => {
    return filename
      .split('.')[0]
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const parseGradientColors = (gradientValue: string): string[] => {
    // Simple regex to extract colors from linear-gradient
    const colorMatches = gradientValue.match(/#[0-9a-fA-F]{6}|rgb\([^)]+\)|rgba\([^)]+\)/g);
    return colorMatches || ['#e3f2fd', '#f3e5f5', '#fce4ec'];
  };

  const getPreviewStyle = (bg: BackgroundOption) => {
    switch (bg.type) {
      case 'image':
        return {
          backgroundImage: `url(${bg.value})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        };
      case 'gradient':
        return {
          background: bg.value,
        };
      case 'solid':
        return {
          backgroundColor: bg.value,
        };
      default:
        return {};
    }
  };

  const handleBackgroundSelect = (bg: BackgroundOption) => {
    setSelectedBg(bg);
    onBackgroundChange(bg);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Background Settings
        </h3>
        <div className="animate-pulse">
          <div className="grid grid-cols-3 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-lg aspect-video" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Palette className="w-4 h-4" />
        Background Settings
      </h3>
      
      <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
        {backgrounds.map((bg) => (
          <button
            key={bg.id}
            onClick={() => handleBackgroundSelect(bg)}
            className={`relative rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
              selectedBg.id === bg.id 
                ? 'border-primary shadow-md ring-2 ring-primary/20' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            style={{ aspectRatio: '16/9' }}
            title={bg.name}
          >
            {/* Background preview */}
            <div 
              className="w-full h-full flex items-center justify-center"
              style={getPreviewStyle(bg)}
            >
              {bg.type === 'image' && (
                <ImageIcon className="w-6 h-6 text-white/70 drop-shadow-lg" />
              )}
            </div>
            
            {/* Label */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white text-xs p-1">
              <div className="font-medium truncate">{bg.name}</div>
            </div>
            
            {/* Selected indicator */}
            {selectedBg.id === bg.id && (
              <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-lg">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
            
            {/* Type indicator */}
            <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/50 rounded text-xs text-white font-medium">
              {bg.type === 'gradient' ? 'G' : bg.type === 'image' ? 'I' : 'S'}
            </div>
          </button>
        ))}
      </div>
      
      {/* Instructions */}
      <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
        <div className="font-medium mb-1">💡 Custom Backgrounds</div>
        <div>Add images to <code className="bg-white px-1 rounded">/public/backgrounds/</code> folder</div>
        <div>Supported: JPG, PNG, WebP (recommended: 1920×1080, &lt;5MB)</div>
      </div>
      
      {/* Current selection info */}
      <div className="mt-2 p-2 bg-primary/5 rounded">
        <div className="text-xs font-medium text-primary">
          Current: {selectedBg.name}
        </div>
        <div className="text-xs text-gray-500">
          Type: {selectedBg.type.charAt(0).toUpperCase() + selectedBg.type.slice(1)}
        </div>
      </div>
    </div>
  );
}