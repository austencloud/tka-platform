/**
 * UFO Domain Types
 *
 * Shared types for the UFO system services.
 * Extracted from UFOSystem.ts to enable service decomposition.
 */

import type { QualityLevel } from "../../../shared/domain/types/background-types";

/** Visual modifiers for each mood state */
export interface MoodVisuals {
  lightSpeed: number;
  bobDepth: number;
  shieldBrightness: number;
}

/** Wobble animation offset for rendering */
export interface WobbleOffset {
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

export interface UFOConfig {
  size: number;
  colors: {
    hull: string;
    hullDark: string;
    dome: string;
    domeHighlight: string;
    shield: string;
    beam: string;
    beamGlow: string;
    lights: string[];
  };
  speed: number;
  bounceMargin: number;
  // Curved exploration movement
  turnSpeed?: number;
  turnVariation?: number;
  driftChance?: number;
  driftSpeedMultiplier?: number;
  // Timing
  interval: number;
  enterDuration: number;
  exitDuration: number;
  minActiveDuration: number;
  maxActiveDuration: number;
  // Behavior
  pauseChance: number;
  pauseDuration: { min: number; max: number };
  scanStarChance: number;
  groundScanChance: number;
  justVibeChance?: number;
  scanDuration: { min: number; max: number };
  beamChargeFrames: number;
  // Animation
  shieldPulseSpeed: number;
  lightChaseSpeed: number;
  hoverBobSpeed: number;
  hoverBobAmount: number;
  // Mood system
  mood?: {
    excitedDecay: number;
    startledDecay: number;
    playfulDecay: number;
    boredThreshold: number;
    tirednessRate: number;
    tiredThreshold: number;
    moodVisuals: Record<UFOMood, MoodVisuals>;
  };
  enabledOnQuality: QualityLevel[];
}

export type UFOState =
  | "entering"
  | "wandering"
  | "paused"
  | "scanning_star"
  | "scanning_ground"
  | "tracking_event"
  | "chasing"
  | "giving_up"
  | "collecting_sample"
  | "photographing"
  | "investigating_ground"
  | "panicking"
  | "surfing"
  | "communicating"
  | "napping"
  | "hiding"
  | "peeking"
  | "celebrating"
  | "following"
  | "exiting"
  | "inactive";

/** UFO emotional state - affects behavior and visuals */
export type UFOMood =
  | "curious"
  | "excited"
  | "bored"
  | "startled"
  | "playful"
  | "tired";

/** How the UFO appears */
export type UFOEntranceType = "fade" | "warp" | "zoom" | "descend";

/** How the UFO leaves */
export type UFOExitType = "fade" | "warp" | "zoom" | "shootUp";

/** Wobble animation types for personality */
export type WobbleType =
  | "none"
  | "curious_tilt"
  | "startled_jolt"
  | "disappointed_shake"
  | "happy_bounce"
  | "yawn_stretch";

/** Narrative phase for multi-step interactions */
export type NarrativePhase =
  | "none"
  | "detection"
  | "approach"
  | "action"
  | "resolution"
  | "transition";

/** A particle effect (sample, ground dust, etc.) */
export interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  progress: number;
  color: string;
  size: number;
  type: "sample" | "dust" | "sparkle" | "z";
}

/** Communication pulse for morse-like patterns */
export interface CommPulse {
  duration: number;
  isOn: boolean;
}

/** External star data for beam targeting */
export interface StarInfo {
  x: number;
  y: number;
  brightness: number;
}

/** External event position for tracking */
export interface EventPosition {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  active: boolean;
}

/**
 * UFO render state - the data needed for rendering
 * Subset of full UFO state focused on visual properties
 */
export interface UFORenderState {
  // Position
  x: number;
  y: number;
  z: number; // Depth: 0 = close (100% size), 1 = far (30% size)
  size: number;

  // State
  state: UFOState;

  // Animation phases
  shieldPhase: number;
  lightPhase: number;
  beamPhase: number;
  hoverPhase: number;

  // Visual properties
  opacity: number;
  scale: number;
  flashIntensity: number;

  // Beam
  beamTarget: { x: number; y: number } | null;
  beamIntensity: number;

  // Narrative effects
  cameraFlashTimer: number;
  sampleParticle: Particle | null;
  groundParticles: Particle[];
  afterimagePositions: Array<{ x: number; y: number; opacity: number }>;
  sleepZs: Particle[];
  rainbowPhase: number;
  celebrationBouncePhase: number;
  commTarget: { x: number; y: number } | null;
  commPattern: CommPulse[];
  commPatternIndex: number;
  commPulseTimer: number;
}

/**
 * Full UFO state - complete state for the state machine
 */
export interface UFO extends UFORenderState {
  // Depth targeting (for smooth depth transitions)
  targetZ: number; // Target depth we're moving toward

  // Movement
  heading: number;
  turnRate: number;

  // State machine
  stateTimer: number;
  stateDuration: number;
  activeDuration: number;
  totalTime: number;

  // Entrance/exit
  entranceType: UFOEntranceType;
  exitType: UFOExitType;
  targetY: number;
  startY: number;
  decloakPhase: number;

  // Movement style
  isDrifting: boolean;

  // Mood system
  mood: UFOMood;
  moodTimer: number;
  tiredness: number;
  lastInterestTime: number;

  // Click interaction
  lastClickTime: number;
  clickCount: number;
  clickTarget: { x: number; y: number } | null;

  // Chase behavior
  chaseTarget: { x: number; y: number; vx: number; vy: number } | null;
  chaseStartTime: number;
  lastChaseDistance: number;
  giveUpTimer: number;

  // Wobble/idle animations
  wobbleType: WobbleType;
  wobbleTimer: number;
  wobbleIntensity: number;
  spinAngle: number;
  isSneaky: boolean;
  scannedStars: Set<string>;
  lookAroundTimer: number;

  // Narrative arc
  narrativePhase: NarrativePhase;
  narrativeTimer: number;
  narrativePhaseDuration: number;

  // Sample collection
  collectedSamples: number;

  // Star photography
  photographedStars: Set<string>;
  photoTarget: { x: number; y: number } | null;

  // Ground investigation
  anomalyPosition: { x: number; y: number } | null;

  // Panic/evasion
  panicDirection: number;
  panicSpeed: number;

  // Comet surfing
  surfTarget: { x: number; y: number; vx: number; vy: number } | null;
  surfOffset: { x: number; y: number };

  // Communication
  awaitingResponse: boolean;

  // Napping
  napStartY: number;

  // Peek-a-boo
  hidePosition: { x: number; y: number } | null;
  peekProgress: number;
  peekDirection: number;

  // Celebration
  celebrationSpinSpeed: number;

  // Buddy system
  buddyTarget: { x: number; y: number; vx: number; vy: number } | null;
  buddyOffset: number;

  // Rare discovery tracking
  rareDiscoveries: number;
}
