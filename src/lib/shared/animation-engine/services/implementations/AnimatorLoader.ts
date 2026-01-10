/**
 * Animator Loader Implementation
 *
 * Handles lazy loading of animator-related services.
 * Provides access to core animation dependencies.
 */

import { container } from "$lib/shared/di";
import type { IAnimationRenderer } from "$lib/features/compose/services/contracts/IAnimationRenderer";
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
        svgGenerator: container.items.svgGenerator,
        settingsService: container.items.settingsState,
        orchestrator: container.items.sequenceAnimationOrchestrator,
        TrailCapturer: container.items.trailCapturer,
        turnsTupleGenerator: container.items.turnsTupleGenerator,
      };

      if (!services.svgGenerator) {
        console.error(
          "[AnimatorLoader] CRITICAL: container.items.svgGenerator returned null/undefined!"
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
      // Note: IAnimationRenderer may not be migrated to ITI yet
      // Check if it exists in the container
      const renderer = (container.items as any).animationRenderer as IAnimationRenderer | undefined;
      if (!renderer) {
        return {
          success: false,
          error: "animationRenderer not found in container (may not be migrated to ITI yet)",
        };
      }
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
