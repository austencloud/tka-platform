/**
 * Animator Loader Implementation
 *
 * Handles lazy loading of animator-related services.
 * Provides access to core animation dependencies.
 */

import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
import type { IAnimationRenderer } from "$lib/features/compose/services/contracts/IAnimationRenderer";
import { Canvas2DAnimationRenderer } from "$lib/features/compose/services/implementations/Canvas2DAnimationRenderer";
import { turnsTupleGenerator } from "$lib/shared/pictograph/arrow/positioning/placement/services/implementations/TurnsTupleGenerator";
import { getSVGGenerator } from "$lib/features/compose/getSVGGenerator";
import { getSequenceAnimationOrchestrator } from "$lib/features/compose/getSequenceAnimationOrchestrator";
import { getTrailCapturer } from "$lib/features/compose/getTrailCapturer";

import type {
  IAnimatorLoader,
  AnimatorServices,
  AnimatorServiceLoadResult,
  AnimationRendererLoadResult,
} from "../contracts/IAnimatorLoader";

export class AnimatorLoader implements IAnimatorLoader {
  loadAnimatorServices(): AnimatorServiceLoadResult {
    try {
      // With ITI, all services are already composed at startup - no async loading needed
      const services: AnimatorServices = {
        svgGenerator: getSVGGenerator(),
        settingsService: settingsService,
        orchestrator: getSequenceAnimationOrchestrator(),
        TrailCapturer: getTrailCapturer(),
        turnsTupleGenerator: turnsTupleGenerator,
      };

      if (!services.svgGenerator) {
        console.error(
          "[AnimatorLoader] CRITICAL: getSVGGenerator() returned null/undefined!"
        );
        return {
          success: false,
          error:
            "DI container returned null for svgGenerator (this is a container bug)",
        };
      }

      return { success: true, services };
    } catch (err) {
      console.error("[AnimatorLoader] Failed to load animator services:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  loadAnimationRenderer(): AnimationRendererLoadResult {
    try {
      // Canvas2DAnimationRenderer is not a singleton - each canvas gets its own instance
      // This matches behavior of VideoPreRenderer and SequenceFramePreRenderer
      const renderer: IAnimationRenderer = new Canvas2DAnimationRenderer();
      return { success: true, renderer };
    } catch (err) {
      console.error("Failed to load animation renderer:", err);
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to load animation renderer",
      };
    }
  }

  /** @deprecated Use loadAnimationRenderer() instead */
  loadPixiRenderer(): AnimationRendererLoadResult {
    return this.loadAnimationRenderer();
  }
}

// Singleton instance for convenience (stateless service)
const animatorLoader = new AnimatorLoader();

/**
 * Load core animator services.
 * Convenience function for direct usage.
 */
export function loadAnimatorServices(): AnimatorServiceLoadResult {
  return animatorLoader.loadAnimatorServices();
}

/**
 * Load animation renderer.
 * Convenience function for direct usage.
 */
export function loadAnimationRenderer(): AnimationRendererLoadResult {
  return animatorLoader.loadAnimationRenderer();
}

/** @deprecated Use loadAnimationRenderer() instead */
export const loadPixiRenderer = loadAnimationRenderer;
