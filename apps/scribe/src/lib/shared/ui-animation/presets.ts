/**
 * Unified Animation System
 *
 * Centralized animation presets using Svelte's built-in svelte/motion.
 * Provides consistent spring physics and easing across the entire application.
 */

// ============================================================================
// Spring Presets
// ============================================================================

/**
 * Spring configuration presets for different animation feels
 */
export const springPresets = {
  /** Gentle, smooth animations - good for subtle UI feedback */
  gentle: {
    stiffness: 120,
    damping: 14,
  },

  /** Snappy, responsive - good for interactive elements */
  snappy: {
    stiffness: 300,
    damping: 20,
  },

  /** Wobbly, playful - good for attention-grabbing animations */
  wobbly: {
    stiffness: 180,
    damping: 12,
  },

  /** Slow, smooth - good for large transitions */
  slow: {
    stiffness: 100,
    damping: 15,
  },

  /** Stiff, minimal bounce - good for precise movements */
  stiff: {
    stiffness: 400,
    damping: 30,
  },
} as const;

// ============================================================================
// Tween Presets
// ============================================================================

/**
 * Easing functions for tweened animations
 */
export const easingPresets = {
  /** Smooth ease in and out */
  easeInOut: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  /** Ease out (decelerate) */
  easeOut: (t: number) => t * (2 - t),

  /** Ease in (accelerate) */
  easeIn: (t: number) => t * t,

  /** Cubic ease out - smoother deceleration */
  cubicOut: (t: number) => {
    const f = t - 1.0;
    return f * f * f + 1.0;
  },

  /** Quintic ease out - very smooth */
  quintOut: (t: number) => {
    return --t * t * t * t * t + 1;
  },
} as const;

/**
 * Duration presets for tweened animations (in milliseconds)
 */
export const durationPresets = {
  instant: 0,
  fast: 150,
  normal: 250,
  slow: 400,
  verySlow: 600,
} as const;

// ============================================================================
// Animation Variant Configurations
// ============================================================================

/**
 * Animation variant configuration
 */
export interface AnimationVariantConfig {
  from: {
    opacity?: number;
    scale?: number;
    x?: number;
    y?: number;
    blur?: number;
  };
  to: {
    opacity?: number;
    scale?: number;
    x?: number;
    y?: number;
    blur?: number;
  };
  spring: (typeof springPresets)[keyof typeof springPresets];
}

/**
 * Beat cell animation variants
 * Each variant defines how opacity, scale, position, and filter should animate
 */
export const beatAnimationVariants: Record<string, AnimationVariantConfig> = {
  springPop: {
    from: { opacity: 0, scale: 0.3 },
    to: { opacity: 1, scale: 1 },
    spring: springPresets.snappy,
  },

  gentleBloom: {
    from: { opacity: 0, scale: 0.7, y: 10, blur: 2 },
    to: { opacity: 1, scale: 1, y: 0, blur: 0 },
    spring: springPresets.gentle,
  },

  softCascade: {
    from: { opacity: 0, x: -20 },
    to: { opacity: 1, x: 0 },
    spring: springPresets.gentle,
  },

  microFade: {
    from: { opacity: 0, scale: 0.95 },
    to: { opacity: 1, scale: 1 },
    spring: springPresets.stiff,
  },

  glassBlur: {
    from: { opacity: 0, scale: 0.9, blur: 4 },
    to: { opacity: 1, scale: 1, blur: 0 },
    spring: springPresets.gentle,
  },
} as const;

// ============================================================================
// Animation State Interpolation Helpers
// ============================================================================

/**
 * Interpolate between two values based on progress (0-1)
 */
export function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

/**
 * Generate CSS transform string from animation values
 */
export function buildTransform(values: {
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
}): string {
  const parts: string[] = [];

  if (values.x !== undefined || values.y !== undefined) {
    const x = values.x ?? 0;
    const y = values.y ?? 0;
    parts.push(`translate(${x}px, ${y}px)`);
  }

  if (values.scale !== undefined) {
    parts.push(`scale(${values.scale})`);
  }

  if (values.rotate !== undefined) {
    parts.push(`rotate(${values.rotate}deg)`);
  }

  return parts.join(" ");
}

/**
 * Generate CSS filter string from animation values
 */
export function buildFilter(values: {
  blur?: number;
  brightness?: number;
  contrast?: number;
}): string {
  const parts: string[] = [];

  if (values.blur !== undefined) {
    parts.push(`blur(${values.blur}px)`);
  }

  if (values.brightness !== undefined) {
    parts.push(`brightness(${values.brightness})`);
  }

  if (values.contrast !== undefined) {
    parts.push(`contrast(${values.contrast})`);
  }

  return parts.join(" ");
}

/**
 * Interpolate between animation variant states
 */
export function interpolateVariant(
  variant: AnimationVariantConfig,
  progress: number
) {
  const { from, to } = variant;

  return {
    opacity: lerp(from.opacity ?? 1, to.opacity ?? 1, progress),
    scale: lerp(from.scale ?? 1, to.scale ?? 1, progress),
    x: lerp(from.x ?? 0, to.x ?? 0, progress),
    y: lerp(from.y ?? 0, to.y ?? 0, progress),
    blur: lerp(from.blur ?? 0, to.blur ?? 0, progress),
  };
}

// ============================================================================
// Type Exports
// ============================================================================

export type SpringPreset = keyof typeof springPresets;
export type EasingPreset = keyof typeof easingPresets;
export type DurationPreset = keyof typeof durationPresets;
export type BeatAnimationVariant = keyof typeof beatAnimationVariants;
