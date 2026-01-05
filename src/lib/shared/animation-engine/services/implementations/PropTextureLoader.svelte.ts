/**
 * Prop Texture Service Implementation
 *
 * Handles prop texture loading for AnimatorCanvas.
 * Uses reactive state ownership - service owns $state, component derives from it.
 */

import type { IAnimationRenderer } from "$lib/features/compose/services/contracts/IAnimationRenderer";
import type { ISVGGenerator } from "$lib/features/compose/services/contracts/ISVGGenerator";
import type { ITrailCapturer } from "$lib/features/compose/services/contracts/ITrailCapturer";
import type {
  IPropTextureLoader,
  PropTextureState,
} from "../contracts/IPropTextureLoader";
import {
  DEFAULT_PROP_DIMENSIONS,
  getPropDimensions,
} from "../contracts/IPropTextureLoader";

export class PropTextureLoader implements IPropTextureLoader {
  // Reactive state - owned by service, read by component via $derived
  state = $state<PropTextureState>({
    blueDimensions: { ...DEFAULT_PROP_DIMENSIONS },
    redDimensions: { ...DEFAULT_PROP_DIMENSIONS },
    isLoaded: false,
    isLoading: false,
    error: null,
  });

  private renderer: IAnimationRenderer | null = null;
  private svgGenerator: ISVGGenerator | null = null;
  private TrailCapturer: ITrailCapturer | null = null;

  initialize(
    renderer: IAnimationRenderer,
    svgGenerator: ISVGGenerator,
    TrailCapturer: ITrailCapturer | null
  ): void {
    this.renderer = renderer;
    this.svgGenerator = svgGenerator;
    this.TrailCapturer = TrailCapturer;
  }

  async loadPropTextures(
    bluePropType: string,
    redPropType: string,
    darkMode?: boolean
  ): Promise<void> {
    if (!this.renderer || !this.svgGenerator) {
      console.warn(
        "[PropTextureLoader] Cannot load textures - not initialized"
      );
      this.state.error = "Service not initialized";
      return;
    }

    // IMMEDIATELY set dimensions from lookup table before async loading
    // This prevents "smooshed" props on initial render
    this.state.blueDimensions = getPropDimensions(bluePropType);
    this.state.redDimensions = getPropDimensions(redPropType);

    this.state.isLoading = true;
    this.state.error = null;

    try {
      // Load textures for both prop colors
      // Pass darkMode to use local preview state instead of global
      await this.renderer.loadPerColorPropTextures(
        bluePropType,
        redPropType,
        darkMode
      );

      // Get prop dimensions for each color (may be different types!)
      // Pass darkMode for consistent color generation
      const [bluePropData, redPropData] = await Promise.all([
        this.svgGenerator.generateBluePropSvg(bluePropType, darkMode),
        this.svgGenerator.generateRedPropSvg(redPropType, darkMode),
      ]);

      // Update own state - no callbacks needed
      this.state.blueDimensions = {
        width: bluePropData.width,
        height: bluePropData.height,
      };
      this.state.redDimensions = {
        width: redPropData.width,
        height: redPropData.height,
      };
      this.state.isLoaded = true;

      // Direct service-to-service communication (no component middleman)
      this.TrailCapturer?.updateConfig({
        bluePropDimensions: this.state.blueDimensions,
        redPropDimensions: this.state.redDimensions,
      });
    } catch (err) {
      console.error("[PropTextureLoader] Failed to load prop textures:", err);
      this.state.error = err instanceof Error ? err.message : "Load failed";
    } finally {
      this.state.isLoading = false;
    }
  }

  dispose(): void {
    this.renderer = null;
    this.svgGenerator = null;
    this.TrailCapturer = null;
    // Reset state
    this.state.isLoaded = false;
    this.state.isLoading = false;
    this.state.error = null;
  }
}
