'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { VRM, VRMLoaderPlugin } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Settings, RotateCcw, Maximize2, Download } from 'lucide-react';
import { VRMUtils } from '@/lib/vrm-utils';

interface CharacterState {
  expression: string;
  animation: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  model: string;
}

export interface BackgroundOption {
  type: 'solid' | 'gradient' | 'image';
  color1?: string;
  color2?: string;
  angle?: number;
  imageUrl?: string;
}

interface CharacterAvatarProps {
  modelPath?: string;
  initialExpression?: string;
  initialAnimation?: string;
  autoRotate?: boolean;
  showControls?: boolean;
  background?: BackgroundOption;
  lightingIntensity?: number;
  onCharacterLoad?: (character: VRM) => void;
  onStateChange?: (state: CharacterState) => void;
}

export default function CharacterAvatar({
  modelPath = '/characters/models/engineer-guide.vrm',
  initialExpression = 'neutral',
  initialAnimation = 'idle',
  autoRotate = false,
  showControls = true,
  background = {
    type: 'gradient',
    color1: '#e0e7ff',
    color2: '#c7d2fe',
    angle: 135
  },
  lightingIntensity = 1,
  onCharacterLoad,
  onStateChange,
}: CharacterAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const charactersRef = useRef<VRM | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const clockRef = useRef<THREE.Clock | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [characterState, setCharacterState] = useState<CharacterState>({
    expression: initialExpression,
    animation: initialAnimation,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    model: modelPath,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [availableExpressions, setAvailableExpressions] = useState<string[]>([]);
  const [availableAnimations, setAvailableAnimations] = useState<string[]>([]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    initializeScene();
    loadCharacter();

    return () => {
      cleanup();
    };
  }, []);

  // Handle model path changes
  useEffect(() => {
    if (characterState.model !== modelPath) {
      setCharacterState(prev => ({ ...prev, model: modelPath }));
      loadCharacter();
    }
  }, [modelPath]);

  // Update character state when props change
  useEffect(() => {
    if (charactersRef.current) {
      updateCharacterExpression(initialExpression);
      updateCharacterAnimation(initialAnimation);
    }
  }, [initialExpression, initialAnimation]);

  // Update background when options change
  useEffect(() => {
    if (sceneRef.current && background) {
      updateSceneBackground(background);
    }
  }, [background]);

  // Update lighting when intensity changes
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.traverse((child) => {
        if (child instanceof THREE.Light) {
          if (child instanceof THREE.AmbientLight) {
            child.intensity = 0.7 * lightingIntensity;
          } else if (child instanceof THREE.DirectionalLight) {
            const position = child.position;
            if (position.x === 2 && position.y === 3 && position.z === 2) {
              child.intensity = 0.9 * lightingIntensity; // Main key light
            } else if (position.x === -2 && position.y === 2 && position.z === 2) {
              child.intensity = 0.4 * lightingIntensity; // Fill light
            } else if (position.x === 0 && position.y === 2 && position.z === -3) {
              child.intensity = 0.3 * lightingIntensity; // Rim light
            }
          }
        }
      });
    }
  }, [lightingIntensity]);

  const parseGradientColors = (color: string): string => {
    // Parse CSS gradient values like "linear-gradient(45deg, #ff0000, #00ff00)"
    const gradientMatch = color.match(/linear-gradient\((.*)\)/);
    if (gradientMatch) {
      const parts = gradientMatch[1].split(',').map(s => s.trim());
      if (parts.length >= 2) {
        // Return the first color from the gradient
        return parts[1].replace(/\s+\d+%?$/, '');
      }
    }
    return color;
  };

  const createGradientTexture = (options: BackgroundOption): THREE.Texture => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const context = canvas.getContext('2d')!;
    
    // Parse colors if they contain gradient values
    const color1 = parseGradientColors(options.color1 || '#e0e7ff');
    const color2 = parseGradientColors(options.color2 || '#c7d2fe');
    
    // Calculate gradient angle
    const angle = (options.angle || 0) * Math.PI / 180;
    const x1 = canvas.width / 2 - Math.cos(angle) * canvas.width / 2;
    const y1 = canvas.height / 2 - Math.sin(angle) * canvas.height / 2;
    const x2 = canvas.width / 2 + Math.cos(angle) * canvas.width / 2;
    const y2 = canvas.height / 2 + Math.sin(angle) * canvas.height / 2;
    
    const gradient = context.createLinearGradient(x1, y1, x2, y2);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  };

  const updateSceneBackground = (options: BackgroundOption) => {
    if (!sceneRef.current) return;

    // Dispose of previous background texture if it exists
    const previousBackground = sceneRef.current.background;
    if (previousBackground instanceof THREE.Texture) {
      previousBackground.dispose();
    }

    if (options.type === 'solid') {
      const color = parseGradientColors(options.color1 || '#f5f5f5');
      sceneRef.current.background = new THREE.Color(color);
    } else if (options.type === 'gradient') {
      sceneRef.current.background = createGradientTexture(options);
    } else if (options.type === 'image' && options.imageUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(
        options.imageUrl,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          if (sceneRef.current) {
            // Dispose of previous texture
            const prev = sceneRef.current.background;
            if (prev instanceof THREE.Texture) {
              prev.dispose();
            }
            sceneRef.current.background = texture;
          }
        },
        undefined,
        (error) => {
          console.error('Error loading background image:', error);
          // Fallback to solid color
          if (sceneRef.current) {
            sceneRef.current.background = new THREE.Color('#f5f5f5');
          }
        }
      );
    } else {
      sceneRef.current.background = new THREE.Color('#f5f5f5');
    }
  };

  const initializeScene = () => {
    if (!containerRef.current) return;

    // Scene with better background
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    // Set initial background
    if (background) {
      updateSceneBackground(background);
    } else {
      scene.background = new THREE.Color('#f5f5f5');
    }
    
    scene.fog = new THREE.Fog(0xf5f5f5, 5, 10);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      50,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1.4, 1.5);
    camera.lookAt(0, 1, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Enhanced lighting setup
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7 * lightingIntensity);
    scene.add(ambientLight);

    // Main key light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9 * lightingIntensity);
    directionalLight.position.set(2, 3, 2);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 10;
    directionalLight.shadow.camera.left = -2;
    directionalLight.shadow.camera.right = 2;
    directionalLight.shadow.camera.top = 2;
    directionalLight.shadow.camera.bottom = -2;
    scene.add(directionalLight);

    // Fill light to reduce harsh shadows
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4 * lightingIntensity);
    fillLight.position.set(-2, 2, 2);
    scene.add(fillLight);

    // Rim/back light for character outline
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3 * lightingIntensity);
    rimLight.position.set(0, 2, -3);
    scene.add(rimLight);

    // Clock for animations
    clockRef.current = new THREE.Clock();

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;

      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    // Start render loop
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  };

  const loadCharacter = async () => {
    if (!sceneRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      // Remove existing character
      if (charactersRef.current) {
        sceneRef.current.remove(charactersRef.current.scene);
        charactersRef.current = null;
      }

      // Load VRM model
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));

      const gltf = await loader.loadAsync(modelPath);
      const vrm = gltf.userData.vrm as VRM;

      if (!vrm) {
        throw new Error('Failed to load VRM from file');
      }

      // Add to scene
      sceneRef.current.add(vrm.scene);
      charactersRef.current = vrm;

      // Rotate character 180 degrees to face forward
      vrm.scene.rotation.y = Math.PI;

      // Set initial pose
      await updateCharacterExpression(characterState.expression);
      await updateCharacterAnimation(characterState.animation);

      // Get available expressions and animations
      await fetchAvailableFeatures();

      onCharacterLoad?.(vrm);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading character:', error);
      setError('Failed to load character model');
      setIsLoading(false);
    }
  };

  const fetchAvailableFeatures = async () => {
    try {
      const response = await fetch('/api/character?action=supported_features');
      const result = await response.json();

      if (result.success) {
        setAvailableExpressions(result.expressions || []);
        setAvailableAnimations(result.animations || []);
      }
    } catch (error) {
      console.error('Error fetching available features:', error);
    }
  };

  const updateCharacterExpression = async (expression: string) => {
    if (!charactersRef.current) return;

    try {
      const response = await fetch('/api/character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'setExpression',
          expression,
          transition: true,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Apply expression to VRM model
        const expressionManager = charactersRef.current.expressionManager;
        if (expressionManager) {
          // Reset all expressions
          Object.keys(expressionManager.expressionMap).forEach(name => {
            expressionManager.setValue(name, 0);
          });

          // Set new expression
          if (expressionManager.expressionMap[expression]) {
            expressionManager.setValue(expression, 1);
          }
        }

        setCharacterState(prev => ({ ...prev, expression }));
        onStateChange?.({ ...characterState, expression });
      }
    } catch (error) {
      console.error('Error updating expression:', error);
    }
  };

  const updateCharacterAnimation = async (animation: string) => {
    if (!charactersRef.current) return;

    try {
      const response = await fetch('/api/character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'playAnimation',
          animation,
          transition: true,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // TODO: Implement animation system for VRM
        // This would typically involve loading and playing animation clips

        setCharacterState(prev => ({ ...prev, animation }));
        onStateChange?.({ ...characterState, animation });
      }
    } catch (error) {
      console.error('Error updating animation:', error);
    }
  };

  const updateCharacterPosition = (position: { x: number; y: number; z: number }) => {
    if (!charactersRef.current) return;

    charactersRef.current.scene.position.set(position.x, position.y, position.z);
    setCharacterState(prev => ({ ...prev, position }));
    onStateChange?.({ ...characterState, position });
  };

  const updateCharacterRotation = (rotation: { x: number; y: number; z: number }) => {
    if (!charactersRef.current) return;

    charactersRef.current.scene.rotation.set(rotation.x, rotation.y, rotation.z);
    setCharacterState(prev => ({ ...prev, rotation }));
    onStateChange?.({ ...characterState, rotation });
  };

  const resetCharacter = async () => {
    try {
      const response = await fetch('/api/character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'resetPose',
          transition: true,
        }),
      });

      const result = await response.json();

      if (result.success && charactersRef.current) {
        charactersRef.current.scene.position.set(0, 0, 0);
        charactersRef.current.scene.rotation.set(0, 0, 0);
        
        await updateCharacterExpression('neutral');
        await updateCharacterAnimation('idle');
      }
    } catch (error) {
      console.error('Error resetting character:', error);
    }
  };

  const animate = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    animationFrameRef.current = requestAnimationFrame(animate);

    const deltaTime = clockRef.current?.getDelta() || 0;

    // Update VRM
    if (charactersRef.current) {
      charactersRef.current.update(deltaTime);
    }

    // Auto-rotate
    if (autoRotate && charactersRef.current) {
      charactersRef.current.scene.rotation.y += 0.005;
    }

    rendererRef.current.render(sceneRef.current, cameraRef.current);
  };

  const cleanup = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Dispose of background texture if it exists
    if (sceneRef.current?.background instanceof THREE.Texture) {
      sceneRef.current.background.dispose();
    }

    if (rendererRef.current && containerRef.current) {
      containerRef.current.removeChild(rendererRef.current.domElement);
      rendererRef.current.dispose();
    }

    if (charactersRef.current) {
      VRMUtils.dispose(charactersRef.current);
    }
  };

  const takeScreenshot = () => {
    if (!rendererRef.current) return;

    const canvas = rendererRef.current.domElement;
    const link = document.createElement('a');
    link.download = `character-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadCharacter}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full bg-gray-100 rounded-lg overflow-hidden">
      {/* 3D Scene Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading character...</p>
          </div>
        </div>
      )}

      {/* Controls */}
      {showControls && !isLoading && (
        <div className="absolute top-4 right-4 flex flex-col space-y-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full shadow-md transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          <button
            onClick={resetCharacter}
            className="p-2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full shadow-md transition-colors"
            title="Reset Pose"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={takeScreenshot}
            className="p-2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full shadow-md transition-colors"
            title="Screenshot"
          >
            <Download className="w-5 h-5" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full shadow-md transition-colors"
            title="Fullscreen"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-4 left-4 bg-white bg-opacity-95 rounded-lg p-4 shadow-lg max-w-xs">
          <h3 className="font-semibold mb-3">Character Settings</h3>

          {/* Expression Control */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Expression</label>
            <select
              value={characterState.expression}
              onChange={(e) => updateCharacterExpression(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableExpressions.map(expression => (
                <option key={expression} value={expression}>
                  {expression.charAt(0).toUpperCase() + expression.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Animation Control */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Animation</label>
            <select
              value={characterState.animation}
              onChange={(e) => updateCharacterAnimation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableAnimations.map(animation => (
                <option key={animation} value={animation}>
                  {animation.charAt(0).toUpperCase() + animation.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Position Controls */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Position</label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <label className="text-xs w-4">X:</label>
                <input
                  type="range"
                  min="-2"
                  max="2"
                  step="0.1"
                  value={characterState.position.x}
                  onChange={(e) => updateCharacterPosition({
                    ...characterState.position,
                    x: parseFloat(e.target.value)
                  })}
                  className="flex-1"
                />
                <span className="text-xs w-12">{characterState.position.x.toFixed(1)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-xs w-4">Y:</label>
                <input
                  type="range"
                  min="-2"
                  max="2"
                  step="0.1"
                  value={characterState.position.y}
                  onChange={(e) => updateCharacterPosition({
                    ...characterState.position,
                    y: parseFloat(e.target.value)
                  })}
                  className="flex-1"
                />
                <span className="text-xs w-12">{characterState.position.y.toFixed(1)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-xs w-4">Z:</label>
                <input
                  type="range"
                  min="-2"
                  max="2"
                  step="0.1"
                  value={characterState.position.z}
                  onChange={(e) => updateCharacterPosition({
                    ...characterState.position,
                    z: parseFloat(e.target.value)
                  })}
                  className="flex-1"
                />
                <span className="text-xs w-12">{characterState.position.z.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* Rotation Controls */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Rotation</label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <label className="text-xs w-4">Y:</label>
                <input
                  type="range"
                  min="-3.14"
                  max="3.14"
                  step="0.1"
                  value={characterState.rotation.y}
                  onChange={(e) => updateCharacterRotation({
                    ...characterState.rotation,
                    y: parseFloat(e.target.value)
                  })}
                  className="flex-1"
                />
                <span className="text-xs w-12">{characterState.rotation.y.toFixed(1)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowSettings(false)}
            className="w-full px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
