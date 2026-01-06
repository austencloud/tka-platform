/**
 * Animation Precomputer Implementation
 *
 * Manages pre-computation of animation data for smooth playback:
 * - Path cache pre-computation for gap-free trail rendering
 * - Frame pre-rendering for perfect smooth playback
 *
 * Uses reactive state ownership - service owns $state, component derives from it.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { TrailSettings } from "../../domain/types/TrailTypes";
import type { ISequenceAnimationOrchestrator } from "$lib/features/compose/services/contracts/ISequenceAnimationOrchestrator";
import type { ITrailCapturer } from "$lib/features/compose/services/contracts/ITrailCapturer";
import type { IAnimationRenderer } from "$lib/features/compose/services/contracts/IAnimationRenderer";
import { AnimationPathCache } from "$lib/features/compose/services/implementations/AnimationPathCache";
import {
  SequenceFramePreRenderer,
  type PreRenderProgress,
} from "$lib/features/compose/services/implementations/SequenceFramePreRenderer";
import type {
  IAnimationPrecomputer,
  PrecomputationServiceConfig,
  PrecomputationState,
  PropDimensions,
} from "../contracts/IAnimationPrecomputer";

export class AnimationPrecomputer implements IAnimationPrecomputer {
  // Reactive state - owned by service
  state = $state<PrecomputationState>({
    pathCacheData: null,
    isCachePrecomputing: false,
    isPreRendering: false,
    preRenderProgress: null,
    preRenderedFramesReady: false,
  });

  private orchestrator: ISequenceAnimationOrchestrator | null = null;
  private TrailCapturer: ITrailCapturer | null = null;
  private renderer: IAnimationRenderer | null = null;
  private propDimensions: PropDimensions = { width: 100, height: 100 };
  private canvasSize: number = 950;
  private instanceId: string = "unknown";

  private pathCache: AnimationPathCache | null = null;
  private framePreRenderer: SequenceFramePreRenderer | null = null;

  initialize(config: PrecomputationServiceConfig): void {
    this.orchestrator = config.orchestrator;
    this.TrailCapturer = config.TrailCapturer;
    this.renderer = config.renderer;
    this.propDimensions = config.propDimensions;
    this.canvasSize = config.canvasSize;
    this.instanceId = config.instanceId ?? "unknown";
  }

  updateConfig(config: Partial<PrecomputationServiceConfig>): void {
    if (config.orchestrator !== undefined)
      this.orchestrator = config.orchestrator;
    if (config.TrailCapturer !== undefined)
      this.TrailCapturer = config.TrailCapturer;
    if (config.renderer !== undefined) this.renderer = config.renderer;
    if (config.propDimensions !== undefined)
      this.propDimensions = config.propDimensions;
    if (config.canvasSize !== undefined) this.canvasSize = config.canvasSize;
  }

  initializeFramePreRenderer(): void {
    if (this.orchestrator && this.renderer && !this.framePreRenderer) {
      this.framePreRenderer = new SequenceFramePreRenderer(
        this.orchestrator,
        this.renderer
      );
    }
  }

  async precomputeAnimationPaths(
    seqData: SequenceData,
    totalBeats: number,
    beatDurationMs: number,
    trailSettings: TrailSettings
  ): Promise<void> {
    if (
      !trailSettings.usePathCache ||
      !this.orchestrator ||
      !this.TrailCapturer
    ) {
      this.state.pathCacheData = null;
      return;
    }

    try {
      this.state.isCachePrecomputing = true;

      // Create path cache instance if needed
      // IMPORTANT: Always use standard 950x950 coordinate system for cache (matches viewBox)
      if (!this.pathCache) {
        this.pathCache = new AnimationPathCache({
          cacheFps: 120, // High FPS for ultra-smooth trails
          canvasSize: 950, // Always use standard viewBox size for resolution-independent caching
          propDimensions: this.propDimensions,
        });

        // Wire cache to trail capture service for backfill support
        this.TrailCapturer.setAnimationCacheService(
          this.pathCache as AnimationPathCache
        );
      }

      // CRITICAL: Initialize orchestrator with sequence data BEFORE pre-computation!
      const initSuccess = this.orchestrator.initializeWithDomainData(seqData);
      if (!initSuccess) {
        throw new Error("Failed to initialize orchestrator with sequence data");
      }

      // Create function to calculate prop states at any beat
      const orchestrator = this.orchestrator;
      const calculateStateFunc = (beat: number) => {
        orchestrator.calculateState(beat);
        return {
          blueProp: orchestrator.getBluePropState(),
          redProp: orchestrator.getRedPropState(),
        };
      };

      const startTime = performance.now();

      // Pre-compute paths
      const cacheData = await this.pathCache.precomputePaths(
        calculateStateFunc,
        totalBeats,
        beatDurationMs
      );

      this.state.pathCacheData = cacheData;
      console.log(
        `✅ [${this.instanceId}] Cache precomputation complete in ${(performance.now() - startTime).toFixed(1)}ms, isValid=${this.pathCache?.isValid()}`
      );
    } catch (error) {
      console.error(
        `❌ [${this.instanceId}] Failed to pre-compute animation paths:`,
        error
      );
      this.state.pathCacheData = null;
    } finally {
      this.state.isCachePrecomputing = false;
    }
  }

  async preRenderSequenceFrames(
    seqData: SequenceData,
    trailSettings: TrailSettings,
    isInitialized: () => boolean
  ): Promise<void> {
    try {
      this.state.isPreRendering = true;
      this.state.preRenderedFramesReady = false;
      this.state.preRenderProgress = null;

      // CRITICAL: Wait for renderer to be initialized before pre-rendering
      const maxWaitTime = 5000; // 5 seconds max
      const startWait = performance.now();
      while (!isInitialized() && performance.now() - startWait < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (!isInitialized()) {
        console.error(
          "⚠️ Renderer not initialized after 5s, skipping pre-render"
        );
        return;
      }

      console.log("🎬 Starting frame pre-render for perfect playback...");

      if (!this.framePreRenderer) {
        console.error("⚠️ Frame pre-renderer not available");
        return;
      }

      // Pre-render with progress updates
      await this.framePreRenderer.preRenderSequence(
        seqData,
        {
          fps: 60,
          canvasSize: this.canvasSize,
          nonBlocking: true,
          framesPerChunk: 3,
          trailSettings,
        },
        (progress: PreRenderProgress) => {
          this.state.preRenderProgress = progress;
          console.log(
            `📊 Pre-render progress: ${progress.percent.toFixed(1)}%`
          );
        }
      );

      this.state.preRenderedFramesReady = true;
      console.log(
        "✅ Frame pre-render complete! Switching to perfect playback."
      );
    } catch (error) {
      console.error("❌ Failed to pre-render frames:", error);
      this.state.preRenderedFramesReady = false;
    } finally {
      this.state.isPreRendering = false;
      this.state.preRenderProgress = null;
    }
  }

  getPathCache(): AnimationPathCache | null {
    return this.pathCache;
  }

  getFramePreRenderer(): SequenceFramePreRenderer | null {
    return this.framePreRenderer;
  }

  clearCaches(): void {
    this.pathCache?.clear();
    this.framePreRenderer?.clear();
    this.state.pathCacheData = null;
    this.state.preRenderedFramesReady = false;
  }

  clearPreRenderedFrames(): void {
    this.framePreRenderer?.clear();
    this.state.preRenderedFramesReady = false;
  }

  dispose(): void {
    this.clearCaches();
    this.orchestrator = null;
    this.TrailCapturer = null;
    this.renderer = null;
    this.pathCache = null;
    this.framePreRenderer = null;
    // Reset reactive state
    this.state.pathCacheData = null;
    this.state.isCachePrecomputing = false;
    this.state.isPreRendering = false;
    this.state.preRenderProgress = null;
    this.state.preRenderedFramesReady = false;
  }
}
