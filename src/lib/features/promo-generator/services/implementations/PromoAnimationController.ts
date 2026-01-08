/**
 * Promo Animation Controller Implementation
 *
 * Controls device and camera animations using GSAP timelines.
 * Manages animation presets and provides playback control.
 */

import { injectable } from "inversify";
import * as THREE from "three";
import gsap from "gsap";
import type {
  IPromoAnimationController,
  AnimationPlaybackState,
  AnimationProgressCallback,
} from "../contracts/IPromoAnimationController";
import type {
  AnimationPreset,
  AnimationKeyframe,
  CameraState,
  DeviceState,
} from "../../domain/promo-models";
import {
  ANIMATION_PRESETS,
  getPresetById,
  DEFAULT_PRESET_ID,
} from "../../presets/animation-presets";

@injectable()
export class PromoAnimationController implements IPromoAnimationController {
  private device: THREE.Group | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private timeline: gsap.core.Timeline | null = null;
  private currentPreset: AnimationPreset | null = null;
  private registeredPresets: Map<string, AnimationPreset> = new Map();
  private progressCallback: AnimationProgressCallback | null = null;
  private speed: number = 1;

  // Animation state
  private _isPlaying: boolean = false;
  private _isPaused: boolean = false;

  constructor() {
    // Register built-in presets
    ANIMATION_PRESETS.forEach((preset) => {
      this.registeredPresets.set(preset.id, preset);
    });
  }

  initialize(device: THREE.Group, camera: THREE.PerspectiveCamera): void {
    this.device = device;
    this.camera = camera;

    // Load default preset
    this.loadPresetById(DEFAULT_PRESET_ID);

    console.log("[PromoAnimationController] Initialized");
  }

  loadPreset(preset: AnimationPreset): void {
    this.currentPreset = preset;

    // Apply default states
    this.setDeviceState(preset.defaultDevice);
    this.setCameraState(preset.defaultCamera);

    // Build the timeline
    this.buildTimeline(preset);

    console.log(`[PromoAnimationController] Loaded preset: ${preset.name}`);
  }

  loadPresetById(presetId: string): void {
    const preset =
      this.registeredPresets.get(presetId) || getPresetById(presetId);
    if (!preset) {
      console.warn(
        `[PromoAnimationController] Preset not found: ${presetId}, using default`
      );
      const defaultPreset = this.registeredPresets.get(DEFAULT_PRESET_ID);
      if (defaultPreset) {
        this.loadPreset(defaultPreset);
      }
      return;
    }
    this.loadPreset(preset);
  }

  createAnimation(keyframes: AnimationKeyframe[], duration: number): void {
    const customPreset: AnimationPreset = {
      id: "custom",
      name: "Custom Animation",
      description: "Custom animation from keyframes",
      duration,
      keyframes,
      defaultCamera: keyframes[0]?.camera
        ? {
            position: keyframes[0].camera.position || [0, 0, 5],
            lookAt: keyframes[0].camera.lookAt || [0, 0, 0],
            fov: keyframes[0].camera.fov,
          }
        : { position: [0, 0, 5], lookAt: [0, 0, 0] },
      defaultDevice: keyframes[0]?.device
        ? {
            position: keyframes[0].device.position || [0, 0, 0],
            rotation: keyframes[0].device.rotation || [0, 0, 0],
            scale: keyframes[0].device.scale,
          }
        : { position: [0, 0, 0], rotation: [0, 0, 0] },
    };

    this.loadPreset(customPreset);
  }

  private buildTimeline(preset: AnimationPreset): void {
    // Kill existing timeline
    if (this.timeline) {
      this.timeline.kill();
    }

    // Create new timeline
    this.timeline = gsap.timeline({
      paused: true,
      onUpdate: () => {
        if (this.timeline && this.progressCallback) {
          const progress = this.timeline.progress();
          const currentTime = progress * preset.duration;
          this.progressCallback(progress, currentTime);
        }
      },
      onComplete: () => {
        this._isPlaying = false;
        this._isPaused = false;
      },
    });

    // Sort keyframes by time
    const sortedKeyframes = [...preset.keyframes].sort(
      (a, b) => a.time - b.time
    );

    // Build animation from keyframes
    // GSAP requires animating the Vector3/Euler objects directly, not string paths
    for (let i = 0; i < sortedKeyframes.length; i++) {
      const keyframe = sortedKeyframes[i];
      if (!keyframe) continue;
      const prevKeyframe = sortedKeyframes[i - 1];

      // Calculate timing
      const startTime = prevKeyframe
        ? prevKeyframe.time * preset.duration
        : 0;
      const endTime = keyframe.time * preset.duration;
      const duration = endTime - startTime;

      if (duration <= 0) continue;

      // Get easing
      const ease = keyframe.easing || "power2.inOut";

      // Animate device position
      if (keyframe.device?.position && this.device) {
        this.timeline.to(
          this.device.position,
          {
            x: keyframe.device.position[0],
            y: keyframe.device.position[1],
            z: keyframe.device.position[2],
            duration,
            ease,
          },
          startTime
        );
      }

      // Animate device rotation
      if (keyframe.device?.rotation && this.device) {
        this.timeline.to(
          this.device.rotation,
          {
            x: keyframe.device.rotation[0],
            y: keyframe.device.rotation[1],
            z: keyframe.device.rotation[2],
            duration,
            ease,
          },
          startTime
        );
      }

      // Animate device scale
      if (keyframe.device?.scale !== undefined && this.device) {
        this.timeline.to(
          this.device.scale,
          {
            x: keyframe.device.scale,
            y: keyframe.device.scale,
            z: keyframe.device.scale,
            duration,
            ease,
          },
          startTime
        );
      }

      // Animate camera position
      if (keyframe.camera?.position && this.camera) {
        this.timeline.to(
          this.camera.position,
          {
            x: keyframe.camera.position[0],
            y: keyframe.camera.position[1],
            z: keyframe.camera.position[2],
            duration,
            ease,
          },
          startTime
        );
      }

      // Animate camera FOV
      if (keyframe.camera?.fov !== undefined && this.camera) {
        const camera = this.camera;
        this.timeline.to(
          this.camera,
          {
            fov: keyframe.camera.fov,
            duration,
            ease,
            onUpdate: () => {
              camera.updateProjectionMatrix();
            },
          },
          startTime
        );
      }

      // Animate lookAt if specified
      if (keyframe.camera?.lookAt && this.camera) {
        const prevLookAt = prevKeyframe?.camera?.lookAt || [0, 0, 0];
        const lookAtProxy = {
          x: prevLookAt[0],
          y: prevLookAt[1],
          z: prevLookAt[2],
        };
        const camera = this.camera;

        this.timeline.to(
          lookAtProxy,
          {
            x: keyframe.camera.lookAt[0],
            y: keyframe.camera.lookAt[1],
            z: keyframe.camera.lookAt[2],
            duration,
            ease,
            onUpdate: () => {
              camera.lookAt(lookAtProxy.x, lookAtProxy.y, lookAtProxy.z);
            },
          },
          startTime
        );
      }
    }

    // Set timeline speed
    this.timeline.timeScale(this.speed);
  }

  play(onProgress?: AnimationProgressCallback): void {
    if (!this.timeline) {
      console.warn("[PromoAnimationController] No timeline to play");
      return;
    }

    this.progressCallback = onProgress || null;
    this._isPlaying = true;
    this._isPaused = false;

    this.timeline.restart();

    console.log("[PromoAnimationController] Playing animation");
  }

  pause(): void {
    if (!this.timeline || !this._isPlaying) return;

    this.timeline.pause();
    this._isPaused = true;

    console.log("[PromoAnimationController] Paused");
  }

  resume(): void {
    if (!this.timeline || !this._isPaused) return;

    this.timeline.resume();
    this._isPaused = false;

    console.log("[PromoAnimationController] Resumed");
  }

  stop(): void {
    if (!this.timeline) return;

    this.timeline.pause();
    this.timeline.progress(0);
    this._isPlaying = false;
    this._isPaused = false;

    // Reset to default states
    if (this.currentPreset) {
      this.setDeviceState(this.currentPreset.defaultDevice);
      this.setCameraState(this.currentPreset.defaultCamera);
    }

    console.log("[PromoAnimationController] Stopped");
  }

  seek(normalizedTime: number): void {
    if (!this.timeline) return;

    const clampedTime = Math.max(0, Math.min(1, normalizedTime));
    this.timeline.progress(clampedTime);
  }

  getPlaybackState(): AnimationPlaybackState {
    const duration = this.currentPreset?.duration || 0;
    const progress = this.timeline?.progress() || 0;

    return {
      isPlaying: this._isPlaying,
      isPaused: this._isPaused,
      progress,
      currentTime: progress * duration,
      duration,
    };
  }

  getProgress(): number {
    return this.timeline?.progress() || 0;
  }

  setCameraState(state: CameraState): void {
    if (!this.camera) return;

    this.camera.position.set(
      state.position[0],
      state.position[1],
      state.position[2]
    );

    this.camera.lookAt(state.lookAt[0], state.lookAt[1], state.lookAt[2]);

    if (state.fov !== undefined) {
      this.camera.fov = state.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  setDeviceState(state: DeviceState): void {
    if (!this.device) return;

    this.device.position.set(
      state.position[0],
      state.position[1],
      state.position[2]
    );

    this.device.rotation.set(
      state.rotation[0],
      state.rotation[1],
      state.rotation[2]
    );

    if (state.scale !== undefined) {
      this.device.scale.setScalar(state.scale);
    }
  }

  getAvailablePresets(): AnimationPreset[] {
    return Array.from(this.registeredPresets.values());
  }

  registerPreset(preset: AnimationPreset): void {
    this.registeredPresets.set(preset.id, preset);
    console.log(`[PromoAnimationController] Registered preset: ${preset.id}`);
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.1, Math.min(10, speed));
    if (this.timeline) {
      this.timeline.timeScale(this.speed);
    }
  }

  dispose(): void {
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }

    this.device = null;
    this.camera = null;
    this.currentPreset = null;
    this.progressCallback = null;
    this._isPlaying = false;
    this._isPaused = false;

    console.log("[PromoAnimationController] Disposed");
  }
}
