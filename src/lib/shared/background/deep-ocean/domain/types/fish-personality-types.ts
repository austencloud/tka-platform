/**
 * Fish Personality & Mood System Types
 *
 * Defines the personality traits, mood states, and visual expression types
 * that give each fish individual character and behavior.
 */

// =============================================================================
// PERSONALITY TRAITS
// =============================================================================

/**
 * Individual personality traits (0-1 scale)
 * These are fixed at spawn and influence behavior probabilities
 */
export interface FishPersonality {
  /**
   * Boldness: How willing to approach threats/stimuli
   * Low = shy, cautious, flees easily
   * High = brave, investigates, stands ground
   */
  boldness: number;

  /**
   * Sociability: Preference for being near other fish
   * Low = solitary, avoids schools
   * High = seeks company, joins schools readily
   */
  sociability: number;

  /**
   * Activity: Base energy level and movement intensity
   * Low = slow, lazy, rests often
   * High = energetic, fast, always moving
   */
  activity: number;

  /**
   * Curiosity: Interest in novel stimuli
   * Low = ignores changes, predictable paths
   * High = investigates, browses, changes direction often
   */
  curiosity: number;
}

// =============================================================================
// MOOD STATES
// =============================================================================

/**
 * Fish mood states - transient emotional states that affect behavior
 * Moods decay over time back to 'calm'
 */
export type FishMood =
  | "calm" // Default cruising state
  | "curious" // Investigating something interesting
  | "alert" // Detected potential threat, heightened awareness
  | "playful" // Energetic, darting around, having fun
  | "hungry" // Seeking food, more aggressive movement
  | "tired" // Low energy, slow movement, may rest
  | "social"; // Seeking other fish, wants company

/**
 * Visual modifiers applied based on current mood
 * These affect how the fish is rendered
 */
export interface MoodVisuals {
  /** Fin flutter frequency multiplier (1.0 = normal) */
  finFrequency: number;

  /** Tail beat intensity multiplier (1.0 = normal) */
  tailIntensity: number;

  /** Bioluminescence pulse intensity (0 = none, 1 = max) */
  glowPulse: number;

  /** Color saturation multiplier (1.0 = normal) */
  colorSaturation: number;
}

/**
 * Configuration for mood decay and thresholds
 */
export interface MoodConfig {
  /** How quickly this mood decays back to calm (per second) */
  decayRate: number;

  /** Visual modifiers for this mood */
  visuals: MoodVisuals;
}

// =============================================================================
// WOBBLE ANIMATIONS
// =============================================================================

/**
 * Wobble animation types for expressing personality/mood
 * Like UFO wobbles, these are brief expressive animations
 */
export type FishWobbleType =
  | "none" // No wobble active
  | "curious_tilt" // Slight rotation, rises up - investigating
  | "startled_dart" // Quick backward jerk - surprised
  | "playful_wiggle" // Side-to-side shimmy - happy/playful
  | "tired_drift" // Slow sinking - exhausted
  | "feeding_lunge" // Forward acceleration pose - hunting
  | "social_shimmer" // Gentle pulsing - greeting other fish
  // Rare special behaviors
  | "barrel_roll" // Full 360° rotation - playful delight
  | "freeze" // Complete stillness - alert reaction
  | "double_take" // Quick look-back - curiosity
  | "happy_flip" // Quick upward arc - joy/excitement
  | "sync_pulse"; // Brief glow/shimmer - synchronizing with neighbor

/**
 * Wobble animation state
 */
export interface WobbleState {
  type: FishWobbleType;
  timer: number; // Frames remaining
  intensity: number; // Current intensity (0-1, decays)
}

/**
 * Offset values produced by wobble animation
 */
export interface WobbleOffset {
  rotation: number; // Added rotation
  scaleX: number; // X scale multiplier
  scaleY: number; // Y scale multiplier
  offsetX: number; // Position offset X
  offsetY: number; // Position offset Y
}

// =============================================================================
// BEHAVIOR MODIFIERS
// =============================================================================

/**
 * Modifiers to behavior probabilities based on personality
 */
export interface BehaviorModifiers {
  /** Multiplier for turn probability */
  turnChance: number;

  /** Multiplier for dart/startle probability */
  dartChance: number;

  /** Multiplier for joining school probability */
  schoolChance: number;

  /** Multiplier for exploring behavior */
  browseChance: number;

  /** Multiplier for resting behavior */
  restChance: number;

  /** Multiplier for feeding behavior */
  feedChance: number;

  /** Base speed multiplier */
  speedMultiplier: number;
}

// =============================================================================
// SPECIES PERSONALITY RANGES
// =============================================================================

/**
 * Range type for personality trait generation
 */
export type TraitRange = [min: number, max: number];

/**
 * Species-specific personality trait ranges
 */
export interface SpeciesPersonalityConfig {
  boldness: TraitRange;
  sociability: TraitRange;
  activity: TraitRange;
  curiosity: TraitRange;
}

// =============================================================================
// EXTENDED BEHAVIOR TYPES
// =============================================================================

/**
 * Extended fish behaviors beyond the basic cruise/turn/dart
 */
export type ExtendedFishBehavior =
  | "cruising" // Normal swimming
  | "turning" // Changing direction
  | "darting" // Startled burst
  | "schooling" // Following school
  | "feeding" // Pursuing food
  | "resting" // Minimal movement
  | "exploring" // Curious investigation
  | "fleeing" // Escape from threat
  | "socializing"; // Approaching other fish
