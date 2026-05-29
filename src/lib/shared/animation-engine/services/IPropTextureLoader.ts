/**
 * Prop Texture Service Interface
 *
 * Handles prop texture loading for AnimatorCanvas.
 * Uses reactive state ownership - service owns $state, component derives from it.
 */

import type { IAnimationRenderer } from "$lib/shared/animation-engine/services/IAnimationRenderer";
import type { ISVGGenerator } from "$lib/shared/animation-engine/services/ISVGGenerator";
import type { ITrailCapturer } from "$lib/shared/animation-engine/services/ITrailCapturer";

/**
 * Prop dimensions
 */
export interface PropDimensions {
  width: number;
  height: number;
}

/**
 * Prop dimensions lookup by prop type
 * These are the exact viewBox dimensions from each prop SVG in /images/props/animated/
 * Used to display correct dimensions before async texture loading completes.
 */
export const PROP_DIMENSIONS: Record<string, PropDimensions> = {
  // Staff family
  staff: { width: 270, height: 83.1 },
  simple_staff: { width: 270, height: 83.1 },
  bigstaff: { width: 600, height: 54.5 },
  staff_v2: { width: 300, height: 48.6 },

  // Club family
  club: { width: 300, height: 39.63 },
  bigclub: { width: 300.5, height: 77.2 },

  // Fan family
  fan: { width: 300, height: 239.4 },
  bigfan: { width: 600, height: 567.4 },

  // Triad family
  triad: { width: 300, height: 264.22 },
  bigtriad: { width: 600, height: 523.5 },

  // Hoop family
  minihoop: { width: 300.9, height: 161.1 },
  bighoop: { width: 600, height: 300 },

  // Buugeng family
  buugeng: { width: 300, height: 155.26 },
  bigbuugeng: { width: 600, height: 293.1 },
  fractalgeng: { width: 300, height: 228.36 },

  // Hand - matches animated/hand.svg viewBox (same as static version)
  hand: { width: 75, height: 100 },

  // Triquetra family
  triquetra: { width: 300, height: 175.27 },
  triquetra2: { width: 300, height: 175.32 },

  // Sword
  sword: { width: 578.8, height: 64 },

  // Chicken family
  chicken: { width: 300, height: 28 },
  bigchicken: { width: 300, height: 52.7 },

  // Guitar family
  guitar: { width: 593.4, height: 168 },
  ukulele: { width: 350, height: 71.5 },

  // Doublestar family
  doublestar: { width: 300, height: 150 },
  bigdoublestar: { width: 600, height: 300 },

  // Eightrings family
  eightrings: { width: 300, height: 159.85 },
  bigeightrings: { width: 600, height: 309.5 },

  // Quiad
  quiad: { width: 300, height: 300 },

  // Contact ball family
  contactball: { width: 300, height: 150 },
  bigcontactball: { width: 600, height: 300 },
  doublecontactball: { width: 300, height: 150 },
  bigdoublecontactball: { width: 600, height: 300 },

  // Glass ball family
  glassball: { width: 300, height: 150 },
  doubleglassball: { width: 300, height: 150 },
  bigglassball: { width: 600, height: 300 },
  bigdoubleglassball: { width: 600, height: 300 },

  // PMMA ball family
  pmmaball: { width: 300, height: 150 },
  doublepmmaball: { width: 300, height: 150 },
  bigpmmaball: { width: 600, height: 300 },
  bigdoublepmmaball: { width: 600, height: 300 },

  // Frosted ball family
  frostedball: { width: 300, height: 150 },
  doublefrostedball: { width: 300, height: 150 },
  bigfrostedball: { width: 600, height: 300 },
  bigdoublefrostedball: { width: 600, height: 300 },

  // Torch family
  torch: { width: 300, height: 15.5 },
  bigtorch: { width: 325, height: 32.6 },
};

/**
 * Default prop dimensions (staff dimensions)
 * Fallback when prop type is unknown.
 */
export const DEFAULT_PROP_DIMENSIONS: PropDimensions = {
  width: 300,
  height: 92.33,
};

/**
 * Get prop dimensions for a given prop type
 * Uses the lookup table, falls back to default (staff) if unknown
 */
export function getPropDimensions(propType: string): PropDimensions {
  const normalized = propType.toLowerCase();
  return PROP_DIMENSIONS[normalized] ?? { ...DEFAULT_PROP_DIMENSIONS };
}

/**
 * Reactive state for prop textures
 */
export interface PropTextureState {
  blueDimensions: PropDimensions;
  redDimensions: PropDimensions;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Service for managing prop texture loading
 */
export interface IPropTextureLoader {
  /**
   * Reactive state - owned by service, read by component via $derived
   */
  state: PropTextureState;

  /**
   * Initialize the service with required dependencies
   */
  initialize(
    renderer: IAnimationRenderer,
    svgGenerator: ISVGGenerator,
    TrailCapturer: ITrailCapturer | null
  ): void;

  /**
   * Load textures for both prop colors
   * @param bluePropType - Type of blue prop
   * @param redPropType - Type of red prop
   * @param darkMode - When provided, uses this instead of global dark mode state (for preview isolation)
   */
  loadPropTextures(
    bluePropType: string,
    redPropType: string,
    darkMode?: boolean
  ): Promise<void>;

  /**
   * Clean up resources
   */
  dispose(): void;
}
