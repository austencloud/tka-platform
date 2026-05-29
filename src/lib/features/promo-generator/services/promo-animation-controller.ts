/**
 * Promo Animation Controller Implementation
 *
 * Controls device and camera animations using a lightweight timeline.
 * Manages animation presets and provides playback control.
 *
 * Uses MIT-licensed Timeline implementation instead of GSAP.
 */

import type * as THREE from "three";
import { Timeline, type TweenOptions } from "../animation/timeline";
import type { AnimationPlaybackState, AnimationProgressCallback } from "./types";
import type {
  AnimationPreset,
  AnimationKeyframe,
  CameraState,
  DeviceState,
} from "../domain/promo-models";
import {
  ANIMATION_PRESETS,
  getPresetById,
  DEFAULT_PRESET_ID,
} from "../presets/animation-presets";

export class PromoAnimationController {
  private device: THREE.Group | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private timeline: Timeline | null = null;
  private currentPreset: AnimationPreset | null = null;
  private registeredPresets: Map<string, AnimationPreset> = new Map();
  private progressCallback: AnimationProgressCallback | null = null;
  private speed: number = 1;

  /**
   * Scale factor for camera positions in presets.
   * Presets are authored with camera at ~5 units, so we scale based on actual model.
   */
  private cameraDistanceScale: number = 1;

  /** Base camera distance that presets are authored for */
  private static readonly BASE_CAMERA_DISTANCE = 5;

  // Animation state
  private _isPlaying: boolean = false;
  private _isPaused: boolean = false;

  constructor() {
    // Register built-in presets
    ANIMATION_PRESETS.forEach((preset) => {
      this.registeredPresets.set(preset.id, preset);
    });
  }

  initialize(
    device: THREE.Group,
    camera: THREE.PerspectiveCamera,
    cameraDistance?: number
  ): void {
    this.device = device;
    this.camera = camera;

    // Calculate camera distance scale based on actual model size
    if (cameraDistance) {
      this.cameraDistanceScale =
        cameraDistance / PromoAnimationController.BASE_CAMERA_DISTANCE;
    }

    // Load default preset (will apply scaling)
    this.loadPresetById(DEFAULT_PRESET_ID);
  }

  loadPreset(preset: AnimationPreset): void {
    this.currentPreset = preset;

    // Apply default states
    this.setDeviceState(preset.defaultDevice);
    this.setCameraState(preset.defaultCamera);

    // Build the timeline
    this.buildTimeline(preset);
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
    this.timeline = new Timeline({
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
    // When two keyframes have the same time, it's a "cut" point:
    // - The first keyframe is the END of the previous shot
    // - The second keyframe is the START of the next shot (instant set, not animation)
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

      // Check if this is a "cut" - same time as previous keyframe means instant transition
      const isCut = prevKeyframe?.time === keyframe.time;

      if (duration <= 0 && !isCut) continue;

      // Get easing
      const ease = keyframe.easing || "power2.inOut";

      // For cuts, use instant set; for smooth, use tween
      const animDuration = isCut ? 0 : duration;

      // Animate device position
      if (keyframe.device?.position && this.device) {
        if (isCut) {
          this.timeline.set(
            this.device.position as unknown as Record<string, unknown>,
            {
              x: keyframe.device.position[0],
              y: keyframe.device.position[1],
              z: keyframe.device.position[2],
            },
            startTime
          );
        } else {
          this.timeline.to(
            this.device.position as unknown as Record<string, unknown>,
            {
              x: keyframe.device.position[0],
              y: keyframe.device.position[1],
              z: keyframe.device.position[2],
              duration: animDuration,
              ease,
            } as unknown as Record<string, number> & TweenOptions,
            startTime
          );
        }
      }

      // Animate device rotation
      if (keyframe.device?.rotation && this.device) {
        if (isCut) {
          this.timeline.set(
            this.device.rotation as unknown as Record<string, unknown>,
            {
              x: keyframe.device.rotation[0],
              y: keyframe.device.rotation[1],
              z: keyframe.device.rotation[2],
            },
            startTime
          );
        } else {
          this.timeline.to(
            this.device.rotation as unknown as Record<string, unknown>,
            {
              x: keyframe.device.rotation[0],
              y: keyframe.device.rotation[1],
              z: keyframe.device.rotation[2],
              duration: animDuration,
              ease,
            } as unknown as Record<string, number> & TweenOptions,
            startTime
          );
        }
      }

      // Animate device scale
      if (keyframe.device?.scale !== undefined && this.device) {
        if (isCut) {
          this.timeline.set(
            this.device.scale as unknown as Record<string, unknown>,
            {
              x: keyframe.device.scale,
              y: keyframe.device.scale,
              z: keyframe.device.scale,
            },
            startTime
          );
        } else {
          this.timeline.to(
            this.device.scale as unknown as Record<string, unknown>,
            {
              x: keyframe.device.scale,
              y: keyframe.device.scale,
              z: keyframe.device.scale,
              duration: animDuration,
              ease,
            } as unknown as Record<string, number> & TweenOptions,
            startTime
          );
        }
      }

      // Animate camera position (scaled by camera distance factor)
      if (keyframe.camera?.position && this.camera) {
        const scale = this.cameraDistanceScale;
        if (isCut) {
          this.timeline.set(
            this.camera.position as unknown as Record<string, unknown>,
            {
              x: keyframe.camera.position[0] * scale,
              y: keyframe.camera.position[1] * scale,
              z: keyframe.camera.position[2] * scale,
            },
            startTime
          );
        } else {
          this.timeline.to(
            this.camera.position as unknown as Record<string, unknown>,
            {
              x: keyframe.camera.position[0] * scale,
              y: keyframe.camera.position[1] * scale,
              z: keyframe.camera.position[2] * scale,
              duration: animDuration,
              ease,
            } as unknown as Record<string, number> & TweenOptions,
            startTime
          );
        }
      }

      // Animate camera FOV
      if (keyframe.camera?.fov !== undefined && this.camera) {
        const camera = this.camera;
        if (isCut) {
          this.timeline.set(this.camera as unknown as Record<string, unknown>, { fov: keyframe.camera.fov }, startTime);
          // Need to update projection matrix after set
          this.timeline.call(() => camera.updateProjectionMatrix(), [], startTime);
        } else {
          this.timeline.to(
            this.camera as unknown as Record<string, unknown>,
            {
              fov: keyframe.camera.fov,
              duration: animDuration,
              ease,
              onUpdate: () => {
                camera.updateProjectionMatrix();
              },
            } as unknown as Record<string, number> & TweenOptions,
            startTime
          );
        }
      }

      // Animate lookAt if specified (scaled by camera distance factor)
      if (keyframe.camera?.lookAt && this.camera) {
        const scale = this.cameraDistanceScale;
        const camera = this.camera;
        const targetLookAt = {
          x: keyframe.camera.lookAt[0] * scale,
          y: keyframe.camera.lookAt[1] * scale,
          z: keyframe.camera.lookAt[2] * scale,
        };

        if (isCut) {
          // Instant lookAt change
          this.timeline.call(
            () => camera.lookAt(targetLookAt.x, targetLookAt.y, targetLookAt.z),
            [],
            startTime
          );
        } else {
          // Smooth lookAt animation
          const prevLookAt = prevKeyframe?.camera?.lookAt || [0, 0, 0];
          const lookAtProxy = {
            x: prevLookAt[0] * scale,
            y: prevLookAt[1] * scale,
            z: prevLookAt[2] * scale,
          };

          this.timeline.to(
            lookAtProxy as Record<string, unknown>,
            {
              x: targetLookAt.x,
              y: targetLookAt.y,
              z: targetLookAt.z,
              duration: animDuration,
              ease,
              onUpdate: () => {
                camera.lookAt(lookAtProxy.x, lookAtProxy.y, lookAtProxy.z);
              },
            } as unknown as Record<string, number> & TweenOptions,
            startTime
          );
        }
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
  }

  pause(): void {
    if (!this.timeline || !this._isPlaying) return;

    this.timeline.pause();
    this._isPaused = true;
  }

  resume(): void {
    if (!this.timeline || !this._isPaused) return;

    this.timeline.resume();
    this._isPaused = false;
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

    // Scale camera position based on model size
    const scale = this.cameraDistanceScale;
    const scaledPos = {
      x: state.position[0] * scale,
      y: state.position[1] * scale,
      z: state.position[2] * scale,
    };

    this.camera.position.set(scaledPos.x, scaledPos.y, scaledPos.z);

    // Scale lookAt as well
    this.camera.lookAt(
      state.lookAt[0] * scale,
      state.lookAt[1] * scale,
      state.lookAt[2] * scale
    );

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
  }
}
