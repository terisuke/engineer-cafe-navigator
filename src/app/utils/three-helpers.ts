import * as THREE from 'three';

export interface GradientOptions {
  colors: string[];
  angle: number;
  width?: number;
  height?: number;
}

export interface LightingPreset {
  name: string;
  ambient: number;
  directional: number;
  fill: number;
  rim: number;
  shadowIntensity?: number;
}

/**
 * Create a gradient texture for Three.js backgrounds
 */
export function createGradientTexture(options: GradientOptions): THREE.Texture {
  const { colors, angle, width = 2, height = 512 } = options;
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  
  // Calculate gradient coordinates based on angle
  const angleRad = (angle * Math.PI) / 180;
  const x1 = Math.cos(angleRad) * width;
  const y1 = Math.sin(angleRad) * height;
  
  const gradient = context.createLinearGradient(
    width / 2 - x1 / 2,
    height / 2 - y1 / 2,
    width / 2 + x1 / 2,
    height / 2 + y1 / 2
  );
  
  // Add color stops evenly distributed
  colors.forEach((color, index) => {
    gradient.addColorStop(index / (colors.length - 1), color);
  });
  
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  return texture;
}

/**
 * Create a solid color background
 */
export function createSolidBackground(color: string): THREE.Color {
  return new THREE.Color(color);
}

/**
 * Lighting presets for different moods
 */
export const LIGHTING_PRESETS: Record<string, LightingPreset> = {
  default: {
    name: 'デフォルト',
    ambient: 0.7,
    directional: 0.8,
    fill: 0.3,
    rim: 0.4,
    shadowIntensity: 0.5
  },
  bright: {
    name: '明るい',
    ambient: 0.9,
    directional: 1.0,
    fill: 0.5,
    rim: 0.6,
    shadowIntensity: 0.3
  },
  soft: {
    name: 'ソフト',
    ambient: 0.8,
    directional: 0.6,
    fill: 0.4,
    rim: 0.3,
    shadowIntensity: 0.2
  },
  dramatic: {
    name: 'ドラマチック',
    ambient: 0.4,
    directional: 1.2,
    fill: 0.2,
    rim: 0.8,
    shadowIntensity: 0.8
  },
  studio: {
    name: 'スタジオ',
    ambient: 0.6,
    directional: 1.0,
    fill: 0.6,
    rim: 0.5,
    shadowIntensity: 0.4
  }
};

/**
 * Apply lighting preset to a scene
 */
export function applyLightingPreset(
  scene: THREE.Scene,
  preset: LightingPreset,
  lights: {
    ambient?: THREE.AmbientLight;
    directional?: THREE.DirectionalLight;
    fill?: THREE.DirectionalLight;
    rim?: THREE.DirectionalLight;
  }
) {
  if (lights.ambient) {
    lights.ambient.intensity = preset.ambient;
  }
  
  if (lights.directional) {
    lights.directional.intensity = preset.directional;
    if (preset.shadowIntensity !== undefined) {
      lights.directional.shadow.intensity = preset.shadowIntensity;
    }
  }
  
  if (lights.fill) {
    lights.fill.intensity = preset.fill;
  }
  
  if (lights.rim) {
    lights.rim.intensity = preset.rim;
  }
}

/**
 * Create environment map for reflections
 */
export function createEnvironmentMap(scene: THREE.Scene, type: 'studio' | 'outdoor' = 'studio') {
  const pmremGenerator = new THREE.PMREMGenerator(new THREE.WebGLRenderer());
  pmremGenerator.compileEquirectangularShader();
  
  let environment: THREE.Texture;
  
  if (type === 'studio') {
    // Create a simple studio environment
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256);
    const cubeCamera = new THREE.CubeCamera(0.1, 10, cubeRenderTarget);
    
    // Add some colored planes for reflections
    const geometry = new THREE.PlaneGeometry(10, 10);
    const materials = [
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ color: 0xf0f0f0, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ color: 0xe0e0e0, side: THREE.DoubleSide })
    ];
    
    const planes: THREE.Mesh[] = [];
    materials.forEach((material, i) => {
      const plane = new THREE.Mesh(geometry, material);
      plane.position.set(0, i * 3 - 3, -5);
      planes.push(plane);
      scene.add(plane);
    });
    
    cubeCamera.update(new THREE.WebGLRenderer(), scene);
    
    // Clean up temporary objects
    planes.forEach(plane => scene.remove(plane));
    
    environment = cubeRenderTarget.texture;
  } else {
    // For outdoor, you would load an HDR environment map
    // This is a placeholder - in production, load actual HDR
    const loader = new THREE.CubeTextureLoader();
    environment = new THREE.Texture(); // Placeholder
  }
  
  scene.environment = environment;
  
  pmremGenerator.dispose();
}

/**
 * Animate camera for smooth transitions
 */
export function animateCamera(
  camera: THREE.Camera,
  target: { position?: THREE.Vector3; rotation?: THREE.Euler },
  duration: number = 1000,
  onComplete?: () => void
) {
  const startPosition = camera.position.clone();
  const startRotation = camera.rotation.clone();
  const startTime = Date.now();
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease-in-out curve
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    if (target.position) {
      camera.position.lerpVectors(startPosition, target.position, eased);
    }
    
    if (target.rotation) {
      camera.rotation.x = startRotation.x + (target.rotation.x - startRotation.x) * eased;
      camera.rotation.y = startRotation.y + (target.rotation.y - startRotation.y) * eased;
      camera.rotation.z = startRotation.z + (target.rotation.z - startRotation.z) * eased;
    }
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else if (onComplete) {
      onComplete();
    }
  };
  
  animate();
}

/**
 * Create screenshot from Three.js renderer
 */
export function captureScreenshot(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number = 1920,
  height: number = 1080
): string {
  // Store original size
  const originalSize = new THREE.Vector2();
  renderer.getSize(originalSize);
  
  // Set desired size
  renderer.setSize(width, height);
  renderer.render(scene, camera);
  
  // Get data URL
  const dataURL = renderer.domElement.toDataURL('image/png');
  
  // Restore original size
  renderer.setSize(originalSize.x, originalSize.y);
  
  return dataURL;
}