'use client';

import { EmotionData, EmotionManager } from '@/lib/emotion-manager';
import { ExpressionController } from '@/lib/expression-controller';
import { LipSyncAnalyzer } from '@/lib/lip-sync-analyzer';
import { VRMBlendShapeController, VRMUtils } from '@/lib/vrm-utils';
import { VRM, VRMLoaderPlugin } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import { Settings } from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface CharacterState {
  expression: string;
  animation: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  model: string;
}

export interface BackgroundOption {
  id?: string;
  name?: string;
  type: 'solid' | 'gradient' | 'image';
  value?: string;
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
  cameraPositionOffset?: { x: number; y: number; z: number };
  modelPositionOffset?: { x: number; y: number; z: number };
  modelRotationOffset?: { x: number; y: number; z: number };
  enableClickAnimation?: boolean;
  onCharacterLoad?: (character: VRM) => void;
  onStateChange?: (state: CharacterState) => void;
  onEmotionUpdate?: (applyEmotion: (emotion: EmotionData) => void) => void;
  onVisemeControl?: (setViseme: (viseme: string, intensity: number) => void) => void;
  onExpressionControl?: (setExpression: (expression: string, weight: number) => void) => void;
}

export default function CharacterAvatar({
  modelPath = '/characters/models/sakura.vrm',
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
  cameraPositionOffset = { x: 0, y: 0, z: 0 },
  modelPositionOffset = { x: 0, y: 0, z: 0 },
  modelRotationOffset = { x: 0, y: 0, z: 0 },
  enableClickAnimation = false,
  onCharacterLoad,
  onStateChange,
  onEmotionUpdate,
  onVisemeControl,
  onExpressionControl,
}: CharacterAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const charactersRef = useRef<VRM | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const clockRef = useRef<THREE.Clock | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const isPlayingSequence = useRef(false);
  const isIdleAnimationActive = useRef(false);
  const currentAnimationUrlRef = useRef<string | null>(null);
  const blendShapeControllerRef = useRef<VRMBlendShapeController | null>(null);
  const lipSyncAnalyzerRef = useRef<LipSyncAnalyzer | null>(null);
  const expressionControllerRef = useRef<ExpressionController | null>(null);
  const autoBlinkCleanupRef = useRef<(() => void) | null>(null);
  const currentExpressionRef = useRef<{ expression: string; weight: number }>({ expression: 'neutral', weight: 1.0 });
  const expressionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
// useEffect 内
useEffect(() => {
  if (!containerRef.current) return;

 const disposeScene = initializeScene();

  loadCharacter();
  return () => {
     cleanup();
    disposeScene?.();   // ← 追加
  };
}, []);
  // Handle model path changes
  useEffect(() => {
    if (characterState.model !== modelPath) {
      setCharacterState(prev => ({ ...prev, model: modelPath }));
      loadCharacter();
    }
  }, [modelPath]);

  // Update camera position when offset changes
  useEffect(() => {
    if (cameraRef.current) {
      cameraRef.current.position.set(
        0 + cameraPositionOffset.x,
        1.4 + cameraPositionOffset.y,
        1.5 + cameraPositionOffset.z
      );
      cameraRef.current.lookAt(0 + cameraPositionOffset.x, 1, 0);
    }
  }, [cameraPositionOffset]);

  // Update model position when offset changes
  useEffect(() => {
    if (charactersRef.current) {
      // Check if current animation is idle
      const isCurrentlyIdle = currentAnimationUrlRef.current === '/animations/idle_loop.vrma' || isIdleAnimationActive.current;
      
      if (isCurrentlyIdle) {
        // Apply idle animation position adjustment
        charactersRef.current.scene.position.set(
          modelPositionOffset.x + 0.15,
          modelPositionOffset.y,
          modelPositionOffset.z
        );
      } else {
        charactersRef.current.scene.position.set(
          modelPositionOffset.x,
          modelPositionOffset.y,
          modelPositionOffset.z
        );
      }
    }
  }, [modelPositionOffset]);

  // Update model rotation when offset changes
  useEffect(() => {
    if (charactersRef.current) {
      charactersRef.current.scene.rotation.set(
        modelRotationOffset.x,
        Math.PI + modelRotationOffset.y,
        modelRotationOffset.z
      );
    }
  }, [modelRotationOffset]);

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
    } else if (options.type === 'image' && (options.imageUrl || options.value)) {
      const loader = new THREE.TextureLoader();
      const imageUrl = options.imageUrl || options.value || '';
      if (imageUrl) {
        loader.load(
          imageUrl,
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
      }
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
    camera.position.set(
      0 + cameraPositionOffset.x, 
      1.4 + cameraPositionOffset.y, 
      1.5 + cameraPositionOffset.z
    );
    camera.lookAt(0 + cameraPositionOffset.x, 1, 0);
    cameraRef.current = camera;

    // Renderer with performance optimizations
    // iOS detection removed - focusing on desktop/PC experience
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, // Enable antialiasing for desktop
      alpha: true,
      powerPreference: "low-power" // Use low-power GPU on mobile devices
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    
    // Use native pixel ratio for desktop
    const pixelRatio = window.devicePixelRatio;
    renderer.setPixelRatio(pixelRatio);
    
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    // Enable shadows for desktop
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // Add click event listener
    renderer.domElement.addEventListener('click', handleCanvasClick);
    renderer.domElement.style.cursor = enableClickAnimation ? 'pointer' : 'default';

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

  const loadVRMAnimation = async (animationUrl: string, vrm: VRM, loop: boolean = true, isIdleAnimation: boolean = false) => {
    currentAnimationUrlRef.current = animationUrl;
    const loader = new GLTFLoader();
    loader.crossOrigin = 'anonymous';
    
    // Register the VRMAnimationLoaderPlugin
    loader.register((parser) => {
      return new VRMAnimationLoaderPlugin(parser);
    });

    try {
      const gltf = await loader.loadAsync(animationUrl);
      
      // Try different ways to access the animation
      const vrmAnimation = gltf.userData.vrmAnimations?.[0] || gltf.userData.vrmAnimation;
      
      if (vrmAnimation) {
        const clip = createVRMAnimationClip(vrmAnimation, vrm as any);
        
        if (!mixerRef.current) {
          mixerRef.current = new THREE.AnimationMixer(vrm.scene);
        }
        
        // Stop current animation if exists
        if (currentActionRef.current) {
          currentActionRef.current.stop();
        }
        
        // Play new animation
        const action = mixerRef.current.clipAction(clip);
        if (loop) {
          action.setLoop(THREE.LoopRepeat, Infinity);
        } else {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }
        action.play();
        currentActionRef.current = action;
        
        // Set animation state flag and position
        isIdleAnimationActive.current = isIdleAnimation;
        
        // Ensure position offset is maintained during animation
        if (isIdleAnimation) {
          // For idle animation, apply a small adjustment to center it better
          vrm.scene.position.set(
            modelPositionOffset.x + 0.15, // Slight adjustment to the right
            modelPositionOffset.y,
            modelPositionOffset.z
          );
        } else {
          vrm.scene.position.set(
            modelPositionOffset.x,
            modelPositionOffset.y,
            modelPositionOffset.z
          );
        }
        
        
        return { success: true, duration: clip.duration };
      } else {
        
        // Try using the gltf animations directly
        if (gltf.animations && gltf.animations.length > 0) {
          
          if (!mixerRef.current) {
            mixerRef.current = new THREE.AnimationMixer(vrm.scene);
          }
          
          const clip = gltf.animations[0];
          const action = mixerRef.current.clipAction(clip);
          if (loop) {
            action.setLoop(THREE.LoopRepeat, Infinity);
          } else {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
          }
          action.play();
          currentActionRef.current = action;
          
          // Set animation state flag and position
          isIdleAnimationActive.current = isIdleAnimation;
          
          // Ensure position offset is maintained during animation
          if (isIdleAnimation) {
            // For idle animation, apply a small adjustment to center it better
            vrm.scene.position.set(
              modelPositionOffset.x + 0.15, // Slight adjustment to the right
              modelPositionOffset.y,
              modelPositionOffset.z
            );
          } else {
            vrm.scene.position.set(
              modelPositionOffset.x,
              modelPositionOffset.y,
              modelPositionOffset.z
            );
          }
          
          console.log('Playing standard GLTF animation');
          
          return { success: true, duration: clip.duration };
        }
      }
    } catch (error) {
      console.error('Error loading VRM animation:', error);
    }
    
    return { success: false, duration: 0 };
  };

  const playRandomAnimation = async (vrm: VRM) => {
    if (isPlayingSequence.current) return;
    
    isPlayingSequence.current = true;
    const animations = ['VRMA_03', 'VRMA_04', 'VRMA_05', 'VRMA_06', 'VRMA_07'];
    
    // Select a random animation
    const randomIndex = Math.floor(Math.random() * animations.length);
    const animName = animations[randomIndex];
    const animUrl = `/animations/${animName}.vrma`;
    
    console.log(`Playing animation: ${animName}`);
    
    try {
      // Load animation without looping and get its duration
      const result = await loadVRMAnimation(animUrl, vrm, false);
      
      if (result.success) {
        // Wait for the animation to complete based on its actual duration
        const waitTime = (result.duration * 1000) + 100; // Add 100ms buffer
        console.log(`Animation duration: ${result.duration}s, waiting: ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        // Fallback wait time if duration couldn't be determined
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`Failed to play animation ${animName}:`, error);
    }
    
    // Return to idle animation
    await loadVRMAnimation('/animations/idle_loop.vrma', vrm, true, true);
    isPlayingSequence.current = false;
  };

  const handleCanvasClick = () => {
    if (enableClickAnimation && charactersRef.current && !isPlayingSequence.current) {
      playRandomAnimation(charactersRef.current);
    }
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
      vrm.scene.rotation.set(
        modelRotationOffset.x,
        Math.PI + modelRotationOffset.y,
        modelRotationOffset.z
      );
      
      // Set initial position
      vrm.scene.position.set(
        modelPositionOffset.x,
        modelPositionOffset.y,
        modelPositionOffset.z
      );

      // Initialize lip-sync and expression controllers
      blendShapeControllerRef.current = new VRMBlendShapeController(vrm);
      expressionControllerRef.current = new ExpressionController();
      
      // Initialize LipSyncAnalyzer without AudioContext (will be initialized on first use)
      lipSyncAnalyzerRef.current = new LipSyncAnalyzer();
      
      // Log available expressions
      const availableExpressions = blendShapeControllerRef.current.getAvailableExpressions();
      console.log('Available VRM expressions:', availableExpressions);
      
      // Debug: Check expression map directly
      if (vrm.expressionManager?.expressionMap) {
        console.log('Expression map keys:', Object.keys(vrm.expressionManager.expressionMap));
        console.log('Full expression map:', vrm.expressionManager.expressionMap);
      }
      
      // Check if surprised exists
      const hasSurprised = availableExpressions.includes('surprised');
      if (!hasSurprised) {
        console.warn('⚠️ "surprised" expression not found in VRM model!');
        console.log('Available expressions for mapping:', availableExpressions);
      }

      // Start automatic blinking
      if (autoBlinkCleanupRef.current) {
        autoBlinkCleanupRef.current();
      }
      autoBlinkCleanupRef.current = blendShapeControllerRef.current.startAutoBlink();
      console.log('Auto-blink started');

      // Set initial pose
      await updateCharacterExpression(characterState.expression);
      await updateCharacterAnimation(characterState.animation);

      // Get available expressions and animations
      await fetchAvailableFeatures();
      
      // Load default idle animation
      await loadVRMAnimation('/animations/idle_loop.vrma', vrm, true, true);

      // Create viseme control function
      const setViseme = (viseme: string, intensity: number) => {
        if (blendShapeControllerRef.current) {
          // Map viseme to VRM expression name
          const visemeMap: Record<string, string> = {
            'A': 'aa',
            'I': 'ih',
            'U': 'ou',
            'E': 'ee',
            'O': 'oh',
            'Closed': 'neutral'
          };
          
          const vrmExpression = visemeMap[viseme] || 'neutral';
          blendShapeControllerRef.current.setViseme(vrmExpression, intensity);
        } else {
          console.warn('[CharacterAvatar] BlendShape controller not available');
        }
      };

      // Create expression control function
      const setExpression = (expression: string, weight: number) => {
        
        // Clear existing timeout if any
        if (expressionTimeoutRef.current) {
          clearTimeout(expressionTimeoutRef.current);
          expressionTimeoutRef.current = null;
        }
        
        // Map expressions to available ones if VRM doesn't support them
        // Fallback to expressions that are guaranteed to exist in the VRM model
        const expressionFallbackMap: Record<string, string> = {
          'curious': 'neutral',     // curious doesn't exist in VRM
          'surprised': 'happy',     // surprised might not exist in some VRM models, use happy as fallback
        };
        
        const mappedExpression = expressionFallbackMap[expression] || expression;
        
        if (blendShapeControllerRef.current) {
          // Use the VRM expression manager to set expressions
          const expressionManager = vrm.expressionManager;
          console.log(`[CharacterAvatar] Expression manager available:`, !!expressionManager);
          
          if (expressionManager) {
            // Log available expressions for debugging
            const availableExpressions = Object.keys(expressionManager.expressionMap);
            console.log(`[CharacterAvatar] Available expressions:`, availableExpressions);
            console.log(`[CharacterAvatar] Current expression values:`, availableExpressions.map(name => ({ 
              name, 
              value: expressionManager.getValue(name) 
            })));
            
            // Reset all expressions first if weight is significant
            if (weight > 0.1) {
              console.log(`[CharacterAvatar] Resetting all expressions except ${expression}`);
              availableExpressions.forEach(name => {
                if (name !== expression) {
                  const oldValue = expressionManager.getValue(name);
                  expressionManager.setValue(name, 0);
                  console.log(`[CharacterAvatar] Reset ${name}: ${oldValue} -> 0`);
                }
              });
            }
            
            // Set the target expression
            if (expressionManager.expressionMap[mappedExpression]) {
              const oldValue = expressionManager.getValue(mappedExpression);
              expressionManager.setValue(mappedExpression, weight);
              console.log(`[CharacterAvatar] Set ${mappedExpression}: ${oldValue} -> ${weight}`);
              if (mappedExpression !== expression) {
                console.log(`[CharacterAvatar] (Mapped from ${expression} to ${mappedExpression})`);
              }
              console.log(`[CharacterAvatar] Verified ${mappedExpression} value:`, expressionManager.getValue(mappedExpression));
              
              // Store current expression for restoration after lip-sync
              currentExpressionRef.current = { expression: mappedExpression, weight };
              console.log(`[CharacterAvatar] Stored current expression:`, currentExpressionRef.current);
              
              // Set timer to return to neutral after 5 seconds (only for non-neutral expressions)
              if (mappedExpression !== 'neutral' && weight > 0.1) {
                console.log(`[CharacterAvatar] Setting timer to return to neutral in 5 seconds`);
                expressionTimeoutRef.current = setTimeout(() => {
                  console.log(`[CharacterAvatar] Timer triggered: returning to neutral`);
                  // Gradually transition back to neutral
                  availableExpressions.forEach(name => {
                    if (name !== 'neutral') {
                      expressionManager.setValue(name, 0);
                    }
                  });
                  expressionManager.setValue('neutral', 1.0);
                  currentExpressionRef.current = { expression: 'neutral', weight: 1.0 };
                  console.log(`[CharacterAvatar] Returned to neutral expression`);
                }, 5000);
              }
            } else {
              console.warn(`[CharacterAvatar] Expression ${mappedExpression} not found in VRM model. Available:`, availableExpressions);
              
              // Try to find a similar expression
              const similarExpression = availableExpressions.find(name => 
                name.toLowerCase().includes(mappedExpression.toLowerCase()) ||
                mappedExpression.toLowerCase().includes(name.toLowerCase())
              );
              
              if (similarExpression) {
                console.log(`[CharacterAvatar] Using similar expression: ${similarExpression}`);
                const oldValue = expressionManager.getValue(similarExpression);
                expressionManager.setValue(similarExpression, weight);
                console.log(`[CharacterAvatar] Set ${similarExpression}: ${oldValue} -> ${weight}`);
                // Store current expression for restoration after lip-sync
                currentExpressionRef.current = { expression: similarExpression, weight };
                
                // Set timer to return to neutral after 5 seconds (only for non-neutral expressions)
                if (similarExpression !== 'neutral' && weight > 0.1) {
                  console.log(`[CharacterAvatar] Setting timer to return to neutral in 5 seconds`);
                  expressionTimeoutRef.current = setTimeout(() => {
                    console.log(`[CharacterAvatar] Timer triggered: returning to neutral`);
                    // Gradually transition back to neutral
                    availableExpressions.forEach(name => {
                      if (name !== 'neutral') {
                        expressionManager.setValue(name, 0);
                      }
                    });
                    expressionManager.setValue('neutral', 1.0);
                    currentExpressionRef.current = { expression: 'neutral', weight: 1.0 };
                    console.log(`[CharacterAvatar] Returned to neutral expression`);
                  }, 5000);
                }
              } else {
                console.warn(`[CharacterAvatar] No similar expression found for: ${mappedExpression} (original: ${expression}). Using neutral as fallback.`);
                // Fallback to neutral expression which should always exist
                const neutralValue = expressionManager.getValue('neutral');
                expressionManager.setValue('neutral', 1.0);
                console.log(`[CharacterAvatar] Set neutral: ${neutralValue} -> 1.0 (fallback from ${expression})`);
                currentExpressionRef.current = { expression: 'neutral', weight: 1.0 };
              }
            }
          } else {
            console.error('[CharacterAvatar] Expression manager not available');
          }
        } else {
          console.error('[CharacterAvatar] BlendShape controller not available');
        }
        console.log(`[CharacterAvatar] === setExpression end ===`);
      };

      // Initialize with neutral expression
      try {
        setExpression('neutral', 1.0);
        console.log('[CharacterAvatar] Initialized with neutral expression');
      } catch (error) {
        console.error('[CharacterAvatar] Error setting initial neutral expression:', error);
      }

      onCharacterLoad?.(vrm);
      onEmotionUpdate?.(applyEmotionToCharacter);
      onVisemeControl?.(setViseme);
      onExpressionControl?.(setExpression);
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
    if (!charactersRef.current || !expression) return;

    try {
      const requestBody = {
        action: 'setExpression',
        expression,
        transition: true,
      };

      console.log('Sending character expression request:', requestBody);

      const response = await fetch('/api/character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Apply expression to VRM model
        const expressionManager = charactersRef.current.expressionManager;
        if (expressionManager) {
          // Map emotion names to VRM expression names if needed
          const expressionMapping: Record<string, string> = {
            'neutral': 'neutral',
            'happy': 'happy',
            'sad': 'sad',
            'angry': 'angry',
            'surprised': 'curious',  // VRMモデルがsurprisedをサポートしていない場合はcuriousにマッピング
            'relaxed': 'relaxed',
            // Additional mappings for character actions
            'thinking': 'relaxed',
            'speaking': 'neutral',
            'listening': 'neutral',
            'greeting': 'happy',
            'explaining': 'neutral'
          };
          
          const vrmExpression = expressionMapping[expression] || expression;
          console.log(`Mapping expression '${expression}' to VRM expression '${vrmExpression}'`);
          
          // Get available expressions for debugging
          const availableExpressions = Object.keys(expressionManager.expressionMap);
          console.log('Available VRM expressions:', availableExpressions);
          
          // Reset all expressions with gradual transition
          Object.keys(expressionManager.expressionMap).forEach(name => {
            const currentValue = expressionManager.getValue(name) || 0;
            if (currentValue > 0 && name !== vrmExpression) {
              // Gradual fade out for smooth transition
              expressionManager.setValue(name, 0);
            }
          });

          // Set new expression with full intensity
          if (expressionManager.expressionMap[vrmExpression]) {
            console.log(`Setting VRM expression '${vrmExpression}' to 1.0`);
            expressionManager.setValue(vrmExpression, 1);
            // Store current expression for restoration after lip-sync
            currentExpressionRef.current = { expression: vrmExpression, weight: 1.0 };
          } else {
            console.warn(`VRM expression '${vrmExpression}' not found in model`);
            // Try to find a similar expression
            const similarExpression = availableExpressions.find(expr => 
              expr.toLowerCase().includes(vrmExpression.toLowerCase()) ||
              vrmExpression.toLowerCase().includes(expr.toLowerCase())
            );
            if (similarExpression) {
              console.log(`Using similar expression: ${similarExpression}`);
              expressionManager.setValue(similarExpression, 1);
              // Store current expression for restoration after lip-sync
              currentExpressionRef.current = { expression: similarExpression, weight: 1.0 };
            }
          }
        }

        setCharacterState(prev => ({ ...prev, expression }));
        onStateChange?.({ ...characterState, expression });
      }
    } catch (error) {
      console.error('Error updating expression:', error);
    }
  };

  const applyEmotionToCharacter = (emotionData: EmotionData, transitionDuration: number = 500) => {
    if (!charactersRef.current) return;

    try {
      // Use the EmotionManager to apply emotion to VRM
      EmotionManager.applyEmotionToVRM(charactersRef.current, emotionData, transitionDuration);
      
      // Update character state
      const mapping = EmotionManager.mapEmotionToVRM(emotionData);
      setCharacterState(prev => ({ ...prev, expression: mapping.primary }));
      onStateChange?.({ ...characterState, expression: mapping.primary });

      console.log('Applied emotion to character:', emotionData);
    } catch (error) {
      console.error('Error applying emotion to character:', error);
    }
  };

  const updateCharacterAnimation = async (animation: string) => {
    if (!charactersRef.current || !animation) return;

    try {
      const requestBody = {
        action: 'playAnimation',
        animation,
        transition: true,
      };

      console.log('Sending character animation request:', requestBody);

      const response = await fetch('/api/character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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
    if (!charactersRef.current) return;

    try {
      const requestBody = {
        action: 'resetPose',
        transition: true,
      };

      console.log('Sending character reset request:', requestBody);

      const response = await fetch('/api/character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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
    
    // Skip frame for performance on mobile devices
    // iOS detection removed - focusing on desktop/PC experience
    // Removed iOS frame skipping - desktop can handle full frame rate

    // Update animation mixer
    if (mixerRef.current && deltaTime > 0) {
      mixerRef.current.update(deltaTime);
    }

    // Update VRM
    if (charactersRef.current) {
      charactersRef.current.update(deltaTime);
      
      // Ensure position offset is maintained every frame during animation
      if (isPlayingSequence.current) {
        charactersRef.current.scene.position.set(
          modelPositionOffset.x,
          modelPositionOffset.y,
          modelPositionOffset.z
        );
      }
    }

    // Auto-rotate
    if (autoRotate && charactersRef.current) {
      charactersRef.current.scene.rotation.y += 0.005;
    }

    rendererRef.current.render(sceneRef.current, cameraRef.current);
  };
  
  let frameCount = 0;

  const cleanup = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Clear expression timeout
    if (expressionTimeoutRef.current) {
      clearTimeout(expressionTimeoutRef.current);
      expressionTimeoutRef.current = null;
    }
    
    // Stop and clean up animations
    if (currentActionRef.current) {
      currentActionRef.current.stop();
      currentActionRef.current = null;
    }
    
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
      mixerRef.current = null;
    }

    // Dispose of background texture if it exists
    if (sceneRef.current?.background instanceof THREE.Texture) {
      sceneRef.current.background.dispose();
    }

    if (rendererRef.current && containerRef.current) {
      rendererRef.current.domElement.removeEventListener('click', handleCanvasClick);
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
