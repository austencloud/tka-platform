import { inject, injectable } from "inversify";
import type { AccessibilitySettings } from "../../shared/domain/models/background-models";
import type {
  Dimensions,
  PerformanceMetrics,
  QualityLevel,
} from "../../shared/domain/types/background-types";
import type { IBackgroundSystem } from "../../shared/services/contracts/IBackgroundSystem";
import { TYPES } from "../../../inversify/types";
import type { DeepOceanState } from "../domain/models/DeepOceanModels";

// Physics & Animation contracts
import type { IBubblePhysics } from "./contracts/IBubblePhysics";
import type { IParticleSystem } from "./contracts/IParticleSystem";
import type { ILightRayCalculator } from "./contracts/ILightRayCalculator";
import type { IFishAnimator } from "./contracts/IFishAnimator";
import type { IJellyfishAnimator } from "./contracts/IJellyfishAnimator";

// Renderer contracts
import type { IGradientRenderer } from "./contracts/IGradientRenderer";
import type { ILightRayRenderer } from "./contracts/ILightRayRenderer";
import type { IBubbleRenderer } from "./contracts/IBubbleRenderer";
import type { IParticleRenderer } from "./contracts/IParticleRenderer";
import type { IFishRenderer } from "./contracts/IFishRenderer";
import type { IJellyfishRenderer } from "./contracts/IJellyfishRenderer";

// Performance monitoring
import {
  DeepOceanPerformanceMonitor,
  setMonitorInstance,
} from "./implementations/DeepOceanPerformanceMonitor";

/**
 * Deep Ocean Background Orchestrator
 *
 * Thin coordinator that delegates to focused, single-responsibility services.
 * Each service handles exactly one concern (physics, animation, or rendering).
 */
export interface DeepOceanLayers {
  gradient: boolean;
  lightRays: boolean;
  caustics: boolean;
  particles: boolean;
  bubbles: boolean;
  fish: boolean;
  jellyfish: boolean;
}

@injectable()
export class DeepOceanBackgroundOrchestrator implements IBackgroundSystem {
  private state: DeepOceanState;
  private quality: QualityLevel = "medium";
  private accessibility: AccessibilitySettings = {
    reducedMotion: false,
    highContrast: false,
    visibleParticleSize: 1,
  };
  private animationTime = 0;
  private perfMonitor = new DeepOceanPerformanceMonitor();

  // Layer visibility for lab mode
  private layerVisibility: DeepOceanLayers = {
    gradient: true,
    lightRays: true,
    caustics: true,
    particles: true,
    bubbles: true,
    fish: true,
    jellyfish: true,
  };

  constructor(
    // Physics services
    @inject(TYPES.IBubblePhysics) private bubblePhysics: IBubblePhysics,
    @inject(TYPES.IParticleSystem) private particleSystem: IParticleSystem,
    @inject(TYPES.ILightRayCalculator)
    private lightRayCalculator: ILightRayCalculator,

    // Animator services
    @inject(TYPES.IFishAnimator) private fishAnimator: IFishAnimator,
    @inject(TYPES.IJellyfishAnimator)
    private jellyfishAnimator: IJellyfishAnimator,

    // Renderer services
    @inject(TYPES.IGradientRenderer)
    private gradientRenderer: IGradientRenderer,
    @inject(TYPES.ILightRayRenderer)
    private lightRayRenderer: ILightRayRenderer,
    @inject(TYPES.IBubbleRenderer) private bubbleRenderer: IBubbleRenderer,
    @inject(TYPES.IParticleRenderer)
    private particleRenderer: IParticleRenderer,
    @inject(TYPES.IFishRenderer) private fishRenderer: IFishRenderer,
    @inject(TYPES.IJellyfishRenderer)
    private jellyfishRenderer: IJellyfishRenderer
  ) {
    this.state = this.createEmptyState();

    // Expose perf monitor to console (call enableDeepOceanPerf() in console to activate)
    setMonitorInstance(this.perfMonitor);
  }

  private createEmptyState(): DeepOceanState {
    return {
      bubbles: [],
      fish: [],
      jellyfish: [],
      particles: [],
      currentGradient: { top: "#0d2d47", bottom: "#091a2b" },
      lightRays: [],
      caustics: null,
      gradientState: null,
      pendingFishSpawns: [],
      schools: new Map(),
    };
  }

  async initialize(
    dimensions: Dimensions,
    quality: QualityLevel
  ): Promise<void> {
    this.quality = quality;
    this.animationTime = 0;

    // Initialize bubbles
    const bubbleCount = this.bubblePhysics.getBubbleCount(quality);
    this.state.bubbles = this.bubblePhysics.initializeBubbles(
      dimensions,
      bubbleCount
    );

    // Initialize fish (async for sprite loading)
    const fishCount = this.fishAnimator.getFishCount(quality);
    this.state.fish = await this.fishAnimator.initializeFish(
      dimensions,
      fishCount
    );

    // Initialize jellyfish
    const jellyfishCount = this.jellyfishAnimator.getJellyfishCount(quality);
    this.state.jellyfish = this.jellyfishAnimator.initializeJellyfish(
      dimensions,
      jellyfishCount
    );

    // Initialize particles
    const particleCount = this.particleSystem.getParticleCount(quality);
    this.state.particles = this.particleSystem.initializeParticles(
      dimensions,
      particleCount
    );

    // Initialize light rays
    const lightRayCount = this.lightRayCalculator.getLightRayCount(quality);
    this.state.lightRays = this.lightRayCalculator.initializeLightRays(
      dimensions,
      lightRayCount
    );

    // Initialize caustics (medium/high quality only)
    if (this.lightRayCalculator.getCausticsEnabled(quality)) {
      this.state.caustics = this.lightRayCalculator.initializeCaustics(dimensions);
    }

    // Initialize gradient state for animated effects
    this.state.gradientState = this.gradientRenderer.initializeGradientState(dimensions);

    // Pre-populate for smooth initial animation
    this.prePopulateElements(dimensions);
  }

  private prePopulateElements(dimensions: Dimensions): void {
    // Spread bubbles across full height
    this.state.bubbles.forEach((bubble) => {
      bubble.y = Math.random() * dimensions.height;
    });

    // Spread particles across full height
    this.state.particles.forEach((particle) => {
      particle.y = Math.random() * dimensions.height;
    });

    // Randomize animation time for varied light ray states
    this.animationTime = Math.random() * 1000;
  }

  update(dimensions: Dimensions, frameMultiplier: number = 1.0): void {
    this.perfMonitor.startFrame();

    const accessibilityMultiplier = this.accessibility.reducedMotion
      ? 0.3
      : 1.0;
    const effectiveMultiplier = frameMultiplier * accessibilityMultiplier;

    this.animationTime += 0.016 * effectiveMultiplier;

    // Update gradient animation
    if (this.state.gradientState) {
      this.state.gradientState = this.gradientRenderer.updateGradientState(
        this.state.gradientState,
        effectiveMultiplier
      );
    }

    // Update physics
    this.state.bubbles = this.bubblePhysics.updateBubbles(
      this.state.bubbles,
      dimensions,
      effectiveMultiplier,
      this.animationTime
    );

    this.state.particles = this.particleSystem.updateParticles(
      this.state.particles,
      dimensions,
      effectiveMultiplier
    );

    this.state.lightRays = this.lightRayCalculator.updateLightRays(
      this.state.lightRays,
      effectiveMultiplier
    );

    // Update caustics
    if (this.state.caustics) {
      this.state.caustics = this.lightRayCalculator.updateCaustics(
        this.state.caustics,
        dimensions,
        effectiveMultiplier
      );
    }

    // Update animators
    this.state.fish = this.fishAnimator.updateFish(
      this.state.fish,
      dimensions,
      effectiveMultiplier,
      this.animationTime
    );

    this.state.jellyfish = this.jellyfishAnimator.updateJellyfish(
      this.state.jellyfish,
      dimensions,
      effectiveMultiplier
    );

    // Process pending fish spawns
    const newFish = this.fishAnimator.processPendingSpawns(
      dimensions,
      this.animationTime
    );
    this.state.fish.push(...newFish);

    this.perfMonitor.endUpdate();
  }

  draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    // Layer order: gradient -> rays -> caustics -> particles -> bubbles -> fish -> jellyfish

    if (this.layerVisibility.gradient) {
      this.gradientRenderer.drawOceanGradient(ctx, dimensions, this.state.gradientState);
    } else {
      // Draw simple dark background if gradient disabled
      ctx.fillStyle = "#0a1628";
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    }

    if (this.layerVisibility.lightRays) {
      this.lightRayRenderer.drawLightRays(
        ctx,
        dimensions,
        this.state.lightRays,
        this.quality
      );
    }

    // Draw caustics (after rays, before particles)
    if (this.state.caustics && this.layerVisibility.caustics) {
      this.lightRayRenderer.drawCaustics(
        ctx,
        dimensions,
        this.state.caustics,
        this.quality
      );
    }

    // Draw particles (background layer)
    if (this.layerVisibility.particles) {
      this.particleRenderer.drawParticles(ctx, this.state.particles);
    }

    // Draw bubbles
    if (this.layerVisibility.bubbles) {
      this.bubbleRenderer.drawBubbles(ctx, this.state.bubbles);
    }

    // Draw fish (sorted by depth internally)
    if (this.layerVisibility.fish) {
      this.fishRenderer.drawFish(ctx, this.state.fish);
    }

    // Draw jellyfish (foreground)
    if (this.layerVisibility.jellyfish) {
      this.jellyfishRenderer.drawJellyfish(ctx, this.state.jellyfish);
    }

    this.perfMonitor.endRender(
      this.state.fish.length,
      this.state.jellyfish.length,
      this.state.bubbles.length
    );
  }

  setQuality(quality: QualityLevel): void {
    this.quality = quality;
  }

  setAccessibilitySettings(settings: AccessibilitySettings): void {
    this.accessibility = settings;
  }

  setThumbnailMode(enabled: boolean): void {
    this.state.currentGradient = enabled
      ? { top: "#1d4d77", bottom: "#194a5b" }
      : { top: "#0d2d47", bottom: "#091a2b" };
  }

  setLayerVisibility(layers: Partial<DeepOceanLayers>): void {
    this.layerVisibility = { ...this.layerVisibility, ...layers };
  }

  getLayerVisibility(): DeepOceanLayers {
    return { ...this.layerVisibility };
  }

  getStats(): { fish: number; jellyfish: number; bubbles: number; particles: number } {
    return {
      fish: this.state.fish.length,
      jellyfish: this.state.jellyfish.length,
      bubbles: this.state.bubbles.length,
      particles: this.state.particles.length,
    };
  }

  getMetrics(): PerformanceMetrics {
    return {
      fps: 60,
      warnings: [],
      particleCount:
        this.state.bubbles.length +
        this.state.fish.length +
        this.state.jellyfish.length +
        this.state.particles.length,
      renderTime: 0,
      memoryUsage: 0,
    };
  }

  handleResize(oldDimensions: Dimensions, newDimensions: Dimensions): void {
    // Scale positions of existing elements
    const scaleX = newDimensions.width / oldDimensions.width;
    const scaleY = newDimensions.height / oldDimensions.height;

    this.state.bubbles.forEach((bubble) => {
      bubble.x *= scaleX;
      bubble.y *= scaleY;
    });

    this.state.particles.forEach((particle) => {
      particle.x *= scaleX;
      particle.y *= scaleY;
    });

    this.state.fish.forEach((fish) => {
      fish.x *= scaleX;
      fish.y *= scaleY;
    });

    this.state.jellyfish.forEach((jelly) => {
      jelly.x *= scaleX;
      jelly.y *= scaleY;
    });
  }

  cleanup(): void {
    this.state = this.createEmptyState();
  }

  dispose(): void {
    this.cleanup();
  }
}
