import * as THREE from 'three';
import { VRM, VRMLoaderPlugin, VRMExpressionManager, VRMHumanoid, VRMLookAt } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface VRMAnimationClip {
  name: string;
  duration: number;
  tracks: THREE.KeyframeTrack[];
}

export interface VRMExpression {
  name: string;
  weight: number;
  morphTargets: Record<string, number>;
}

export interface VRMPose {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  humanoidBones: Record<string, {
    position: THREE.Vector3;
    rotation: THREE.Quaternion;
  }>;
}

export interface VRMLoadOptions {
  castShadow?: boolean;
  receiveShadow?: boolean;
  frustumCulled?: boolean;
  renderOrder?: number;
}

export class VRMUtils {
  private static expressionNames = [
    'neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised',
    'aa', 'ih', 'ou', 'ee', 'oh', // Viseme expressions
    'blink', 'blinkLeft', 'blinkRight',
    'lookUp', 'lookDown', 'lookLeft', 'lookRight'
  ];

  private static humanoidBoneNames = [
    'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
    'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
    'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
    'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
    'rightUpperLeg', 'rightLowerLeg', 'rightFoot'
  ];

  // VRM Loading
  static async loadVRM(
    url: string,
    options: VRMLoadOptions = {}
  ): Promise<VRM> {
    try {
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));

      const gltf = await loader.loadAsync(url);
      const vrm = gltf.userData.vrm as VRM;

      if (!vrm) {
        throw new Error('Failed to load VRM from GLTF');
      }

      // Apply options
      if (options.castShadow !== undefined) {
        VRMUtils.setShadowCasting(vrm, options.castShadow);
      }

      if (options.receiveShadow !== undefined) {
        VRMUtils.setShadowReceiving(vrm, options.receiveShadow);
      }

      if (options.frustumCulled !== undefined) {
        VRMUtils.setFrustumCulled(vrm, options.frustumCulled);
      }

      if (options.renderOrder !== undefined) {
        VRMUtils.setRenderOrder(vrm, options.renderOrder);
      }

      return vrm;
    } catch (error) {
      throw new Error(`Failed to load VRM: ${error}`);
    }
  }

  static async loadFromArrayBuffer(
    arrayBuffer: ArrayBuffer,
    options: VRMLoadOptions = {}
  ): Promise<VRM> {
    try {
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));

      return new Promise((resolve, reject) => {
        loader.parse(
          arrayBuffer,
          '',
          (gltf) => {
            const vrm = gltf.userData.vrm as VRM;
            if (!vrm) {
              reject(new Error('Failed to load VRM from ArrayBuffer'));
              return;
            }

            // Apply options
            if (options.castShadow !== undefined) {
              VRMUtils.setShadowCasting(vrm, options.castShadow);
            }

            resolve(vrm);
          },
          (error) => reject(error)
        );
      });
    } catch (error) {
      throw new Error(`Failed to load VRM from ArrayBuffer: ${error}`);
    }
  }

  // Expression Management
  static setExpression(
    vrm: VRM,
    expressionName: string,
    weight: number = 1.0,
    duration: number = 0.5
  ): void {
    const expressionManager = vrm.expressionManager;
    if (!expressionManager) return;

    // Validate expression name
    if (!VRMUtils.expressionNames.includes(expressionName)) {
      console.warn(`Unknown expression: ${expressionName}`);
      return;
    }

    // Set expression weight
    if (duration <= 0) {
      // Immediate change
      expressionManager.setValue(expressionName, weight);
    } else {
      // Animated transition
      const startWeight = expressionManager.getValue(expressionName) || 0;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease-in-out interpolation
        const eased = progress < 0.5 
          ? 2 * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        const currentWeight = startWeight + (weight - startWeight) * eased;
        expressionManager.setValue(expressionName, currentWeight);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      animate();
    }
  }

  static blendExpressions(
    vrm: VRM,
    expressions: Record<string, number>,
    duration: number = 0.5
  ): void {
    const expressionManager = vrm.expressionManager;
    if (!expressionManager) return;

    // Reset all expressions to 0 first
    VRMUtils.expressionNames.forEach(name => {
      if (!(name in expressions)) {
        VRMUtils.setExpression(vrm, name, 0, duration);
      }
    });

    // Apply new expressions
    Object.entries(expressions).forEach(([name, weight]) => {
      VRMUtils.setExpression(vrm, name, weight, duration);
    });
  }

  static getExpressionWeight(vrm: VRM, expressionName: string): number {
    const expressionManager = vrm.expressionManager;
    if (!expressionManager) return 0;

    return expressionManager.getValue(expressionName) || 0;
  }

  static getAllExpressionWeights(vrm: VRM): Record<string, number> {
    const expressionManager = vrm.expressionManager;
    if (!expressionManager) return {};

    const weights: Record<string, number> = {};
    VRMUtils.expressionNames.forEach(name => {
      weights[name] = expressionManager.getValue(name) || 0;
    });

    return weights;
  }

  // Humanoid Bone Management
  static getHumanoidBone(vrm: VRM, boneName: string): THREE.Object3D | null {
    const humanoid = vrm.humanoid;
    if (!humanoid) return null;

    const bone = humanoid.getNormalizedBoneNode(boneName as any);
    return bone || null;
  }

  static setHumanoidBoneRotation(
    vrm: VRM,
    boneName: string,
    rotation: THREE.Euler | THREE.Quaternion,
    duration: number = 0
  ): void {
    const bone = VRMUtils.getHumanoidBone(vrm, boneName);
    if (!bone) return;

    const targetQuaternion = rotation instanceof THREE.Euler 
      ? new THREE.Quaternion().setFromEuler(rotation)
      : rotation.clone();

    if (duration <= 0) {
      bone.quaternion.copy(targetQuaternion);
    } else {
      const startQuaternion = bone.quaternion.clone();
      const startTime = Date.now();

      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);

        bone.quaternion.slerpQuaternions(startQuaternion, targetQuaternion, progress);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      animate();
    }
  }

  static getPose(vrm: VRM): VRMPose {
    const pose: VRMPose = {
      position: vrm.scene.position.clone(),
      rotation: vrm.scene.quaternion.clone(),
      humanoidBones: {},
    };

    VRMUtils.humanoidBoneNames.forEach(boneName => {
      const bone = VRMUtils.getHumanoidBone(vrm, boneName);
      if (bone) {
        pose.humanoidBones[boneName] = {
          position: bone.position.clone(),
          rotation: bone.quaternion.clone(),
        };
      }
    });

    return pose;
  }

  static setPose(vrm: VRM, pose: VRMPose, duration: number = 0): void {
    // Set root position and rotation
    if (duration <= 0) {
      vrm.scene.position.copy(pose.position);
      vrm.scene.quaternion.copy(pose.rotation);
    } else {
      const startPosition = vrm.scene.position.clone();
      const startRotation = vrm.scene.quaternion.clone();
      const startTime = Date.now();

      const animateRoot = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);

        vrm.scene.position.lerpVectors(startPosition, pose.position, progress);
        vrm.scene.quaternion.slerpQuaternions(startRotation, pose.rotation, progress);

        if (progress < 1) {
          requestAnimationFrame(animateRoot);
        }
      };

      animateRoot();
    }

    // Set bone positions and rotations
    Object.entries(pose.humanoidBones).forEach(([boneName, boneData]) => {
      VRMUtils.setHumanoidBoneRotation(vrm, boneName, boneData.rotation, duration);
    });
  }

  // Look At Management
  static setLookAtTarget(vrm: VRM, target: THREE.Vector3 | THREE.Object3D): void {
    const lookAt = vrm.lookAt;
    if (!lookAt) return;

    if (target instanceof THREE.Vector3) {
      lookAt.target = target;
    } else {
      lookAt.target = target.position;
    }
  }

  static enableAutoLookAt(vrm: VRM, enabled: boolean): void {
    const lookAt = vrm.lookAt;
    if (!lookAt) return;

    lookAt.enabled = enabled;
  }

  static setLookAtEyeDirection(vrm: VRM, direction: THREE.Vector3): void {
    // Convert direction to look-at target
    const headBone = VRMUtils.getHumanoidBone(vrm, 'head');
    if (!headBone) return;

    const targetPosition = headBone.position.clone().add(direction.multiplyScalar(10));
    VRMUtils.setLookAtTarget(vrm, targetPosition);
  }

  // Animation
  static createSimpleAnimation(
    vrm: VRM,
    keyframes: Array<{
      time: number;
      pose?: Partial<VRMPose>;
      expressions?: Record<string, number>;
    }>,
    duration: number
  ): THREE.AnimationClip {
    const tracks: THREE.KeyframeTrack[] = [];

    // Create position tracks
    const positionTimes = keyframes.map(kf => kf.time);
    const positionValues: number[] = [];

    keyframes.forEach(keyframe => {
      const position = keyframe.pose?.position || vrm.scene.position;
      positionValues.push(position.x, position.y, position.z);
    });

    tracks.push(new THREE.VectorKeyframeTrack(
      'vrm.scene.position',
      positionTimes,
      positionValues
    ));

    // Create rotation tracks
    const rotationValues: number[] = [];
    keyframes.forEach(keyframe => {
      const rotation = keyframe.pose?.rotation || vrm.scene.quaternion;
      rotationValues.push(rotation.x, rotation.y, rotation.z, rotation.w);
    });

    tracks.push(new THREE.QuaternionKeyframeTrack(
      'vrm.scene.quaternion',
      positionTimes,
      rotationValues
    ));

    // Create expression tracks
    const expressionManager = vrm.expressionManager;
    if (expressionManager) {
      VRMUtils.expressionNames.forEach(expressionName => {
        const expressionValues: number[] = [];
        let hasValues = false;

        keyframes.forEach(keyframe => {
          const weight = keyframe.expressions?.[expressionName] || 0;
          expressionValues.push(weight);
          if (weight !== 0) hasValues = true;
        });

        if (hasValues) {
          tracks.push(new THREE.NumberKeyframeTrack(
            `vrm.expressionManager.${expressionName}`,
            positionTimes,
            expressionValues
          ));
        }
      });
    }

    return new THREE.AnimationClip(`VRM_Animation_${Date.now()}`, duration, tracks);
  }

  // Utility Functions
  static setShadowCasting(vrm: VRM, castShadow: boolean): void {
    vrm.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = castShadow;
      }
    });
  }

  static setShadowReceiving(vrm: VRM, receiveShadow: boolean): void {
    vrm.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.receiveShadow = receiveShadow;
      }
    });
  }

  static setFrustumCulled(vrm: VRM, frustumCulled: boolean): void {
    vrm.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.frustumCulled = frustumCulled;
      }
    });
  }

  static setRenderOrder(vrm: VRM, renderOrder: number): void {
    vrm.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.renderOrder = renderOrder;
      }
    });
  }

  static updateMaterialsForLight(vrm: VRM, lightDirection: THREE.Vector3): void {
    vrm.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material) {
        // Update materials if they support light direction
        const material = object.material as any;
        if (material.uniforms && material.uniforms.lightDirection) {
          material.uniforms.lightDirection.value.copy(lightDirection);
        }
      }
    });
  }

  static getModelInfo(vrm: VRM): {
    title?: string;
    version?: string;
    author?: string;
    contactInformation?: string;
    reference?: string;
    allowedUserName?: string;
    violentUssageName?: string;
    sexualUssageName?: string;
    commercialUssageName?: string;
    otherPermissionUrl?: string;
    licenseName?: string;
    otherLicenseUrl?: string;
  } {
    const meta = vrm.meta;
    if (!meta) return {};

    return {
      title: meta.name,
      version: meta.version,
      author: meta.authors?.[0],
      contactInformation: meta.contactInformation,
      reference: meta.references?.[0],
      allowedUserName: meta.allowedUserName,
      violentUssageName: meta.violentUssageName,
      sexualUssageName: meta.sexualUssageName,
      commercialUssageName: meta.commercialUssageName,
      otherPermissionUrl: meta.otherPermissionUrl,
      licenseName: meta.licenseName,
      otherLicenseUrl: meta.otherLicenseUrl,
    };
  }

  static getBoundingBox(vrm: VRM): THREE.Box3 {
    const box = new THREE.Box3();
    box.setFromObject(vrm.scene);
    return box;
  }

  static centerModel(vrm: VRM): void {
    const box = VRMUtils.getBoundingBox(vrm);
    const center = box.getCenter(new THREE.Vector3());
    vrm.scene.position.sub(center);
  }

  static scaleToFit(vrm: VRM, targetSize: number): void {
    const box = VRMUtils.getBoundingBox(vrm);
    const size = box.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);
    const scale = targetSize / maxDimension;
    
    vrm.scene.scale.multiplyScalar(scale);
  }

  static dispose(vrm: VRM): void {
    // Dispose of geometries and materials
    vrm.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (object.geometry) {
          object.geometry.dispose();
        }

        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      }
    });

    // Dispose of the VRM itself
    vrm.dispose();
  }

  // Animation Presets
  static createIdleAnimation(vrm: VRM): THREE.AnimationClip {
    return VRMUtils.createSimpleAnimation(vrm, [
      { time: 0, expressions: { neutral: 1 } },
      { time: 2, expressions: { neutral: 1 } },
      { time: 3, expressions: { blink: 1 } },
      { time: 3.2, expressions: { neutral: 1 } },
      { time: 5, expressions: { neutral: 1 } },
    ], 5);
  }

  static createWaveAnimation(vrm: VRM): THREE.AnimationClip {
    const armBone = VRMUtils.getHumanoidBone(vrm, 'rightUpperArm');
    if (!armBone) return VRMUtils.createIdleAnimation(vrm);

    const initialRotation = armBone.quaternion.clone();
    const waveRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 3));

    return VRMUtils.createSimpleAnimation(vrm, [
      { time: 0, expressions: { happy: 1 } },
      { time: 0.5, expressions: { happy: 1 } },
      { time: 1.5, expressions: { happy: 1 } },
      { time: 2, expressions: { happy: 1 } },
    ], 2);
  }

  static createNodAnimation(vrm: VRM): THREE.AnimationClip {
    return VRMUtils.createSimpleAnimation(vrm, [
      { time: 0, expressions: { neutral: 1 } },
      { time: 0.3, expressions: { neutral: 1 } },
      { time: 0.6, expressions: { neutral: 1 } },
      { time: 1, expressions: { neutral: 1 } },
    ], 1);
  }

  static preloadAnimations(vrm: VRM): Record<string, THREE.AnimationClip> {
    return {
      idle: VRMUtils.createIdleAnimation(vrm),
      wave: VRMUtils.createWaveAnimation(vrm),
      nod: VRMUtils.createNodAnimation(vrm),
    };
  }
}

// VRM Animation Manager
export class VRMAnimationManager {
  private mixer: THREE.AnimationMixer;
  private clips: Map<string, THREE.AnimationClip> = new Map();
  private currentAction: THREE.AnimationAction | null = null;
  private fadeDuration = 0.5;

  constructor(private vrm: VRM) {
    this.mixer = new THREE.AnimationMixer(vrm.scene);
  }

  addClip(name: string, clip: THREE.AnimationClip): void {
    this.clips.set(name, clip);
  }

  playAnimation(name: string, fadeIn = true, loop = true): THREE.AnimationAction | null {
    const clip = this.clips.get(name);
    if (!clip) return null;

    const action = this.mixer.clipAction(clip);
    action.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;

    if (this.currentAction && fadeIn) {
      this.currentAction.fadeOut(this.fadeDuration);
      action.reset().fadeIn(this.fadeDuration).play();
    } else {
      action.reset().play();
    }

    this.currentAction = action;
    return action;
  }

  stopCurrentAnimation(fadeOut = true): void {
    if (this.currentAction) {
      if (fadeOut) {
        this.currentAction.fadeOut(this.fadeDuration);
      } else {
        this.currentAction.stop();
      }
      this.currentAction = null;
    }
  }

  update(deltaTime: number): void {
    this.mixer.update(deltaTime);
  }

  setFadeDuration(duration: number): void {
    this.fadeDuration = duration;
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.clips.clear();
    this.currentAction = null;
  }
}
