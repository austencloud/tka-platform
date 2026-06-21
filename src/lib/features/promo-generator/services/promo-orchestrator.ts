/**
 * Promo Orchestrator Implementation
 *
 * Main entry point for the promo generator feature.
 * Coordinates scene management, animations, and video export.
 */

import type { PromoSceneManager } from "./promo-scene-manager";
import type { ScreenshotInjector } from "./screenshot-injector";
import type { PromoAnimationController } from "./promo-animation-controller";
import type { AnimationProgressCallback } from "./types";
import type { PromoVideoExporter } from "./promo-video-exporter";
import type { ExportProgressCallback, ExportResult } from "./types";
import type {
  DeviceType,
  EnvironmentType,
  EnvironmentConfig,
  AnimationPreset,
  ExportConfig,
  PromoGeneratorState,
  ScreenshotContent,
} from "../domain/promo-models";

export class PromoOrchestrator {
  private animationFrame: number | null = null;
  private subscribers: Set<(state: PromoGeneratorState) => void> = new Set();

  // Internal state
  private state: PromoGeneratorState = {
    isReady: false,
    isExporting: false,
    exportProgress: 0,
    error: null,
    currentDevice: null,
    currentPreset: null,
    screenshots: [],
  };

  constructor(
    private readonly sceneManager: PromoSceneManager,
    private readonly screenshotInjector: ScreenshotInjector,
    private readonly animationController: PromoAnimationController,
    private readonly videoExporter: PromoVideoExporter
  ) {}

  async initialize(
    canvas: HTMLCanvasElement,
    width: number,
    height: number
  ): Promise<void> {
    try {
      // Initialize scene
      await this.sceneManager.initialize(canvas, width, height);

      // Initialize video exporter with scene refs
      const refs = this.sceneManager.getSceneRefs();
      if (refs.renderer && refs.scene && refs.camera) {
        this.videoExporter.initialize(refs.renderer, refs.scene, refs.camera);
      }

      this.updateState({ isReady: true, error: null });

      // Start render loop
      this.startRenderLoop();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to initialize";
      this.updateState({ error: message });
      throw error;
    }
  }

  async loadDevice(device: DeviceType | string): Promise<void> {
    try {
      if (typeof device === "string" && !device.startsWith("/")) {
        // Custom path
        await this.sceneManager.loadDeviceFromPath(device);
        this.updateState({ currentDevice: "custom" as DeviceType });
      } else if (typeof device === "string") {
        await this.sceneManager.loadDeviceFromPath(device);
        this.updateState({ currentDevice: "custom" as DeviceType });
      } else {
        await this.sceneManager.loadDevice(device);
        this.updateState({ currentDevice: device });
      }

      // Initialize screenshot injector with screen mesh
      const screenMesh = this.sceneManager.getScreenMesh();
      if (screenMesh) {
        this.screenshotInjector.initialize(screenMesh);
      }

      // Initialize animation controller with device, camera, and distance for scaling
      const deviceGroup = this.sceneManager.getDevice();
      const camera = this.sceneManager.getCamera();
      const cameraDistance = this.sceneManager.getCameraDistance();
      if (deviceGroup && camera) {
        this.animationController.initialize(deviceGroup, camera, cameraDistance);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load device";
      this.updateState({ error: message });
      throw error;
    }
  }

  async loadScreenshot(source: string): Promise<void> {
    try {
      await this.screenshotInjector.loadScreenshot(source);
      this.updateState({ screenshots: [source] });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load screenshot";
      this.updateState({ error: message });
      throw error;
    }
  }

  async loadScreenshots(screenshots: ScreenshotContent[]): Promise<void> {
    try {
      await this.screenshotInjector.preloadScreenshots(screenshots);
      this.updateState({ screenshots: screenshots.map((s) => s.source) });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load screenshots";
      this.updateState({ error: message });
      throw error;
    }
  }

  setEnvironment(environment: EnvironmentType | EnvironmentConfig): void {
    this.sceneManager.setEnvironment(environment);
  }

  usePreset(presetId: string): void {
    this.animationController.loadPresetById(presetId);
    this.updateState({ currentPreset: presetId });
  }

  useCustomPreset(preset: AnimationPreset): void {
    this.animationController.loadPreset(preset);
    this.updateState({ currentPreset: preset.id });
  }

  preview(onProgress?: AnimationProgressCallback): void {
    this.animationController.play((progress, currentTime) => {
      // Update screenshot for current time
      this.screenshotInjector.updateForTime(progress);

      // Forward progress callback
      onProgress?.(progress, currentTime);
    });
  }

  pausePreview(): void {
    this.animationController.pause();
  }

  resumePreview(): void {
    this.animationController.resume();
  }

  stopPreview(): void {
    this.animationController.stop();
  }

  seekPreview(normalizedTime: number): void {
    this.animationController.seek(normalizedTime);
    this.screenshotInjector.updateForTime(normalizedTime);
  }

  async export(
    config: ExportConfig,
    onProgress?: ExportProgressCallback
  ): Promise<ExportResult> {
    if (this.state.isExporting) {
      return {
        success: false,
        error: "Export already in progress",
      };
    }

    this.updateState({ isExporting: true, exportProgress: 0, error: null });

    // Stop preview if running
    this.stopPreview();

    // Get animation duration
    const playbackState = this.animationController.getPlaybackState();
    const duration = playbackState.duration;

    try {
      const result = await this.videoExporter.export(
        config,
        duration,
        (normalizedTime: number) => {
          // Seek animation to this time
          this.animationController.seek(normalizedTime);

          // Update screenshot for current time
          this.screenshotInjector.updateForTime(normalizedTime);

          // Render is handled by the exporter
        },
        (progress, stage) => {
          this.updateState({ exportProgress: progress });
          onProgress?.(progress, stage);
        }
      );

      if (result.success) {
        // Auto-download
        this.videoExporter.downloadLastExport(config.filename + ".mp4");
      }

      return result;
    } finally {
      this.updateState({ isExporting: false });
    }
  }

  cancelExport(): void {
    this.videoExporter.cancel();
  }

  getState(): PromoGeneratorState {
    return { ...this.state };
  }

  subscribe(callback: (state: PromoGeneratorState) => void): () => void {
    this.subscribers.add(callback);
    // Immediately call with current state
    callback(this.getState());
    return () => {
      this.subscribers.delete(callback);
    };
  }

  getAvailablePresets(): AnimationPreset[] {
    return this.animationController.getAvailablePresets();
  }

  getAvailableDevices(): DeviceType[] {
    return this.sceneManager.getAvailableDevices().map((d) => d.id);
  }

  resize(width: number, height: number): void {
    this.sceneManager.resize(width, height);
  }

  render(): void {
    this.sceneManager.render();
  }

  dispose(): void {
    // Stop render loop
    this.stopRenderLoop();

    // Dispose all services
    this.animationController.dispose();
    this.screenshotInjector.dispose();
    this.videoExporter.dispose();
    this.sceneManager.dispose();

    // Clear subscribers
    this.subscribers.clear();
  }

  private startRenderLoop(): void {
    const render = () => {
      this.sceneManager.render();
      this.animationFrame = requestAnimationFrame(render);
    };
    render();
  }

  private stopRenderLoop(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  private updateState(partial: Partial<PromoGeneratorState>): void {
    this.state = { ...this.state, ...partial };
    this.notifySubscribers();
  }

  private notifySubscribers(): void {
    const state = this.getState();
    this.subscribers.forEach((callback) => {
      try {
        callback(state);
      } catch (error) {
        console.error(
          "[PromoOrchestrator] Subscriber error:",
          error
        );
      }
    });
  }
}
