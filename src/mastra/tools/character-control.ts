import { z } from 'zod';
import { EmotionManager, EmotionData } from '@/lib/emotion-manager';
import { EmotionMapping } from '@/lib/emotion-mapping';

export class CharacterControlTool {
  name = 'character-control';
  description = 'Control 3D character animations and expressions';

  schema = z.object({
    action: z.enum([
      'setExpression', 
      'playAnimation', 
      'setPosition', 
      'setRotation',
      'loadModel',
      'resetPose',
      'setEmotion',
      'detectEmotion',
      'startLipSync',
      'stopLipSync',
      'setViseme',
      'enableAutoBlink',
      'disableAutoBlink'
    ]),
    expression: z.string().optional().describe('Expression name (e.g., "happy", "neutral", "thinking")'),
    animation: z.string().optional().describe('Animation name (e.g., "greeting", "explaining", "idle")'),
    position: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    }).optional().describe('3D position coordinates'),
    rotation: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    }).optional().describe('3D rotation angles in radians'),
    modelPath: z.string().optional().describe('Path to VRM model file'),
    duration: z.number().optional().describe('Animation duration in milliseconds'),
    transition: z.boolean().optional().default(true).describe('Whether to use smooth transitions'),
    emotion: z.string().optional().describe('Emotion name for expression mapping'),
    text: z.string().optional().describe('Text content for emotion detection'),
    language: z.enum(['ja', 'en']).optional().default('ja').describe('Language for emotion detection'),
    viseme: z.string().optional().describe('Viseme name for lip-sync (A, I, U, E, O, Closed)'),
    intensity: z.number().optional().describe('Intensity of viseme or expression (0-1)'),
    audioBlob: z.any().optional().describe('Audio blob for lip-sync analysis'),
  });

  private currentExpression: string = 'neutral';
  private currentAnimation: string = 'idle';
  private currentPosition = { x: 0, y: 0, z: 0 };
  private currentRotation = { x: 0, y: 0, z: 0 };
  private currentModel: string = '';

  async execute(params: z.infer<typeof this.schema>): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      const { action } = params;

      switch (action) {
        case 'setExpression':
          return await this.setExpression(params.expression!, params.transition);
        case 'playAnimation':
          return await this.playAnimation(params.animation!, params.duration, params.transition);
        case 'setPosition':
          return await this.setPosition(params.position!, params.transition);
        case 'setRotation':
          return await this.setRotation(params.rotation!, params.transition);
        case 'loadModel':
          return await this.loadModel(params.modelPath!);
        case 'resetPose':
          return await this.resetPose(params.transition);
        case 'setEmotion':
          return await this.setEmotion(params.emotion!, params.transition);
        case 'detectEmotion':
          return await this.detectEmotion(params.text!, params.language);
        case 'startLipSync':
          return await this.startLipSync(params.audioBlob);
        case 'stopLipSync':
          return await this.stopLipSync();
        case 'setViseme':
          return await this.setViseme(params.viseme!, params.intensity);
        case 'enableAutoBlink':
          return await this.enableAutoBlink();
        case 'disableAutoBlink':
          return await this.disableAutoBlink();
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error('Character control error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async setExpression(expression: string, transition: boolean = true): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      // Validate expression name using centralized emotion mapping
      const supportedEmotions = EmotionMapping.getSupportedEmotions();
      const additionalExpressions = ['thinking', 'speaking', 'listening', 'greeting', 'explaining'];
      const validExpressions = [...supportedEmotions, ...additionalExpressions];

      if (!validExpressions.includes(expression)) {
        return {
          success: false,
          error: `Invalid expression: ${expression}. Valid expressions: ${validExpressions.join(', ')}`,
        };
      }

      // TODO: Send command to VRM character system
      // This would interface with the 3D character renderer
      console.log(`Setting expression to: ${expression} (transition: ${transition})`);

      this.currentExpression = expression;

      return {
        success: true,
        result: {
          expression,
          transition,
          previousExpression: this.currentExpression,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async playAnimation(
    animation: string, 
    duration?: number, 
    transition: boolean = true
  ): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      // Validate animation name
      const validAnimations = [
        'idle', 'greeting', 'waving', 'pointing', 'explaining', 
        'thinking', 'nodding', 'bowing', 'presenting', 'listening'
      ];

      if (!validAnimations.includes(animation)) {
        return {
          success: false,
          error: `Invalid animation: ${animation}. Valid animations: ${validAnimations.join(', ')}`,
        };
      }

      // Set default duration if not provided
      const animationDuration = duration || this.getDefaultAnimationDuration(animation);

      // TODO: Send command to VRM character system
      console.log(`Playing animation: ${animation} (duration: ${animationDuration}ms, transition: ${transition})`);

      this.currentAnimation = animation;

      return {
        success: true,
        result: {
          animation,
          duration: animationDuration,
          transition,
          previousAnimation: this.currentAnimation,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private getDefaultAnimationDuration(animation: string): number {
    const durations: Record<string, number> = {
      'greeting': 2000,
      'waving': 1500,
      'pointing': 1000,
      'explaining': 3000,
      'thinking': 2000,
      'nodding': 1000,
      'bowing': 2000,
      'presenting': 2500,
      'listening': 0, // Continuous
      'idle': 0, // Continuous
    };

    return durations[animation] || 1500;
  }

  private async setPosition(
    position: { x: number; y: number; z: number }, 
    transition: boolean = true
  ): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      // TODO: Send position command to VRM character system
      console.log(`Setting position to: ${JSON.stringify(position)} (transition: ${transition})`);

      const previousPosition = { ...this.currentPosition };
      this.currentPosition = position;

      return {
        success: true,
        result: {
          position,
          transition,
          previousPosition,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async setRotation(
    rotation: { x: number; y: number; z: number }, 
    transition: boolean = true
  ): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      // TODO: Send rotation command to VRM character system
      console.log(`Setting rotation to: ${JSON.stringify(rotation)} (transition: ${transition})`);

      const previousRotation = { ...this.currentRotation };
      this.currentRotation = rotation;

      return {
        success: true,
        result: {
          rotation,
          transition,
          previousRotation,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async loadModel(modelPath: string): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      // Validate model path
      if (!modelPath.endsWith('.vrm')) {
        return {
          success: false,
          error: 'Model path must point to a .vrm file',
        };
      }

      // TODO: Load VRM model
      console.log(`Loading VRM model: ${modelPath}`);

      const previousModel = this.currentModel;
      this.currentModel = modelPath;

      // Reset to default pose when loading new model
      this.currentExpression = 'neutral';
      this.currentAnimation = 'idle';
      this.currentPosition = { x: 0, y: 0, z: 0 };
      this.currentRotation = { x: 0, y: 0, z: 0 };

      return {
        success: true,
        result: {
          modelPath,
          previousModel,
          resetPose: true,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async resetPose(transition: boolean = true): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      // TODO: Reset VRM character to default pose
      console.log(`Resetting character pose (transition: ${transition})`);

      const previousState = {
        expression: this.currentExpression,
        animation: this.currentAnimation,
        position: { ...this.currentPosition },
        rotation: { ...this.currentRotation },
      };

      // Reset to defaults
      this.currentExpression = 'neutral';
      this.currentAnimation = 'idle';
      this.currentPosition = { x: 0, y: 0, z: 0 };
      this.currentRotation = { x: 0, y: 0, z: 0 };

      return {
        success: true,
        result: {
          transition,
          previousState,
          newState: {
            expression: this.currentExpression,
            animation: this.currentAnimation,
            position: this.currentPosition,
            rotation: this.currentRotation,
          },
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async getCurrentState(): Promise<{
    expression: string;
    animation: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    model: string;
  }> {
    return {
      expression: this.currentExpression,
      animation: this.currentAnimation,
      position: { ...this.currentPosition },
      rotation: { ...this.currentRotation },
      model: this.currentModel,
    };
  }

  async preloadAnimations(animations: string[]): Promise<{
    success: boolean;
    loaded: string[];
    failed: string[];
  }> {
    // TODO: Preload animation files for faster playback
    console.log(`Preloading animations: ${animations.join(', ')}`);

    const validAnimations = [
      'idle', 'greeting', 'waving', 'pointing', 'explaining', 
      'thinking', 'nodding', 'bowing', 'presenting', 'listening'
    ];

    const loaded = animations.filter(anim => validAnimations.includes(anim));
    const failed = animations.filter(anim => !validAnimations.includes(anim));

    return {
      success: failed.length === 0,
      loaded,
      failed,
    };
  }

  async getSupportedFeatures(): Promise<{
    expressions: string[];
    animations: string[];
    emotions: string[];
    capabilities: string[];
  }> {
    return {
      expressions: [
        'neutral', 'happy', 'sad', 'angry', 'curious', 
        'thinking', 'speaking', 'listening', 'greeting', 'explaining'
      ],
      animations: [
        'idle', 'greeting', 'waving', 'pointing', 'explaining', 
        'thinking', 'nodding', 'bowing', 'presenting', 'listening'
      ],
      emotions: EmotionManager.getAvailableExpressions(),
      capabilities: [
        'expression-blending', 'animation-layering', 'smooth-transitions',
        'position-control', 'rotation-control', 'model-switching',
        'emotion-detection', 'emotion-mapping', 'context-awareness'
      ],
    };
  }

  private async setEmotion(emotion: string, transition: boolean = true): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      if (!EmotionManager.isEmotionSupported(emotion)) {
        return {
          success: false,
          error: `Unsupported emotion: ${emotion}. Supported emotions: ${EmotionManager.getAvailableExpressions().join(', ')}`,
        };
      }

      // Create emotion data with default values
      const emotionData: EmotionData = {
        emotion,
        intensity: 0.8,
        confidence: 0.9,
        duration: 2000,
      };

      // Map emotion to VRM expression
      const vrmMapping = EmotionManager.mapEmotionToVRM(emotionData);

      console.log(`Setting emotion: ${emotion}`, vrmMapping);
      
      // Update current expression to match emotion
      this.currentExpression = vrmMapping.primary;

      return {
        success: true,
        result: {
          emotion,
          vrmMapping,
          emotionData,
          transition,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async detectEmotion(text: string, language: 'ja' | 'en' = 'ja'): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      const emotionData = EmotionManager.detectEmotion(text, language);
      const vrmMapping = EmotionManager.mapEmotionToVRM(emotionData);

      console.log(`Detected emotion from text: "${text}"`, emotionData);

      return {
        success: true,
        result: {
          text,
          language,
          emotionData,
          vrmMapping,
          suggestions: {
            expression: vrmMapping.primary,
            animation: this.getAnimationForEmotion(emotionData.emotion),
          },
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private getAnimationForEmotion(emotion: string): string {
    const emotionAnimationMap: Record<string, string> = {
      'happy': 'greeting',
      'sad': 'thinking',
      'angry': 'explaining',
      'curious': 'greeting',
      'thinking': 'thinking',
      'explaining': 'explaining',
      'greeting': 'greeting',
      'speaking': 'explaining',
      'listening': 'idle',
      'neutral': 'idle',
    };

    return emotionAnimationMap[emotion] || 'idle';
  }

  private async startLipSync(audioBlob?: any): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      // This would be handled on the frontend with the LipSyncAnalyzer
      // The tool provides an interface but actual processing happens client-side
      console.log('Starting lip-sync analysis');
      
      return {
        success: true,
        result: {
          message: 'Lip-sync started',
          audioBlob: !!audioBlob,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async stopLipSync(): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      console.log('Stopping lip-sync');
      
      return {
        success: true,
        result: {
          message: 'Lip-sync stopped',
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async setViseme(viseme: string, intensity: number = 1.0): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      const validVisemes = ['A', 'I', 'U', 'E', 'O', 'Closed'];
      
      if (!validVisemes.includes(viseme)) {
        console.warn(`Invalid viseme: ${viseme}. Valid visemes: ${validVisemes.join(', ')}`);
        return {
          success: false,
          error: `Invalid viseme: ${viseme}. Valid visemes: ${validVisemes.join(', ')}`,
        };
      }

      const normalizedIntensity = Math.max(0, Math.min(1, intensity));
      
      console.log(`[Character Control] Setting viseme: ${viseme} with intensity: ${normalizedIntensity}`);
      
      // NOTE: This is server-side logging only. The actual BlendShape control 
      // needs to happen on the client-side where the VRM model is loaded.
      
      return {
        success: true,
        result: {
          viseme,
          intensity: normalizedIntensity,
          message: 'Viseme command processed on server, client-side application needed',
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async enableAutoBlink(): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      console.log('Enabling automatic blinking');
      
      return {
        success: true,
        result: {
          message: 'Auto-blink enabled',
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async disableAutoBlink(): Promise<{
    success: boolean;
    result?: any;
    error?: string;
  }> {
    try {
      console.log('Disabling automatic blinking');
      
      return {
        success: true,
        result: {
          message: 'Auto-blink disabled',
        },
      };
    } catch (error) {
      throw error;
    }
  }
}
