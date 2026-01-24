// Deep Ocean Background Models

/** Bubble size category affecting behavior and visuals */
export type BubbleSize = "small" | "medium" | "large";

/** Trail particle from bubble motion */
export interface BubbleTrailParticle {
  x: number;
  y: number;
  age: number; // 0-1, fades as it ages
  size: number;
}

/**
 * Enhanced Bubble with physics, iridescence, and visual depth
 */
export interface Bubble {
  // Position
  x: number;
  y: number;
  startY: number;

  // Depth for parallax (0 = close, 1 = far)
  depth: number;

  // Size and category
  radius: number;
  sizeCategory: BubbleSize;

  // Physics
  speed: number;
  baseSpeed: number; // Original speed for reference
  acceleration: number; // Current acceleration (buoyancy effect)
  sway: number;
  swayOffset: number;
  turbulenceX: number; // Random horizontal jitter
  turbulencePhase: number; // Phase for turbulence animation

  // Wobble (non-circular deformation)
  wobblePhase: number;
  wobbleAmplitude: number; // How much it deforms (0-0.15)
  wobbleSpeed: number;

  // Visual
  opacity: number;
  baseOpacity: number;
  iridescentPhase: number; // Phase for rainbow shimmer
  iridescentSpeed: number;
  rimHighlightAngle: number; // Dynamic light direction

  // Trail particles
  trailParticles: BubbleTrailParticle[];
  lastTrailSpawn: number; // Animation time of last trail spawn

  // Clustering (optional)
  clusterId?: number; // Bubbles with same ID rise together
  clusterOffset?: { x: number; y: number }; // Offset from cluster leader

  // Lifecycle
  age: number; // 0-1, for fade-in/fade-out effects
  fadeZone: number; // Y position where fade-out begins
}

export type MarineLifeType = "fish" | "jellyfish";

interface MarineLifeBase {
  type: MarineLifeType;
  x: number;
  y: number;
  opacity: number;
  animationPhase: number;
}

/** Depth layer for parallax effect */
export type DepthLayer = "far" | "mid" | "near";

/** Fish behavior state */
export type FishBehavior =
  | "cruising"
  | "turning"
  | "darting"
  | "schooling"
  | "passing"      // Fast direct swimmer - no bobbing, straight line
  | "ascending"    // Swimming upward with vertical focus
  | "descending"   // Swimming downward with vertical focus
  | "approaching"  // Swimming toward camera (z decreasing)
  | "receding"     // Swimming away from camera (z increasing)
  | "fleeing"      // Escaping from predator - sustained burst
  | "stalking"     // Predator slowly approaching prey
  | "chasing";     // Predator in active pursuit

/** Fish species with different body shapes and characteristics */
export type FishSpecies = "tropical" | "sleek" | "deep" | "schooling";

/** Fin state with physics */
export interface FinState {
  angle: number; // Current angle offset
  velocity: number; // Angular velocity
  targetAngle: number; // Target angle (spring physics)
  length: number; // Fin length relative to body
  width: number; // Fin width at base
  segments: number; // Number of segments for smooth curve
}

/** Tail fin state (more complex - forked/fan) */
export interface TailState extends FinState {
  forkAngle: number; // Angle between fork tines
  forkDepth: number; // How deep the fork is (0-1)
  wavePhase: number; // For undulating motion
  waveAmplitude: number;
}

/** Fish color palette */
export interface FishColorPalette {
  bodyTop: string; // Dorsal color
  bodyBottom: string; // Ventral color (usually lighter)
  accent: string; // Stripes, spots, or fin edges
  eye: string; // Iris color
  finTint: string; // Fin tint/transparency
}

/** Wake trail particle */
export interface WakeParticle {
  x: number;
  y: number;
  age: number;
  size: number;
  opacity: number;
}

// ============================================================================
// SPINE-CHAIN FISH TYPES (New organic animation system)
// ============================================================================

/** Species-specific spine configuration */
export interface SpineConfig {
  jointCount: number;
  widthProfile: number[]; // Normalized widths (0-1) at each joint
  angleConstraint: number; // Max bend between segments (radians)
  segmentLength: number; // Base distance between joints
}

/** Fin attached to spine segment */
export interface SpineFin {
  attachmentSegment: number; // Which spine joint this fin attaches to
  attachmentSide: "top" | "bottom" | "left" | "right"; // Which side of body
  baseAngle: number; // Angle relative to spine direction
  length: number; // Fin length
  width: number; // Fin width at base
  segments: number; // Segments for fin rays
  curvatureResponse: number; // How much fin responds to body curve (0-1)
}

/** Spine-chain fish configuration */
export const SPINE_CONFIGS: Record<FishSpecies, SpineConfig> = {
  tropical: {
    jointCount: 8,
    widthProfile: [0.3, 0.7, 1.0, 1.0, 0.9, 0.7, 0.4, 0.15],
    angleConstraint: Math.PI / 6, // More flexible
    segmentLength: 10,
  },
  sleek: {
    jointCount: 10,
    widthProfile: [0.2, 0.4, 0.6, 0.7, 0.7, 0.65, 0.5, 0.35, 0.2, 0.1],
    angleConstraint: Math.PI / 10, // Stiffer
    segmentLength: 12,
  },
  deep: {
    jointCount: 7,
    widthProfile: [0.4, 0.8, 1.0, 0.95, 0.7, 0.4, 0.15],
    angleConstraint: Math.PI / 7,
    segmentLength: 11,
  },
  schooling: {
    jointCount: 6,
    widthProfile: [0.25, 0.6, 0.85, 0.7, 0.4, 0.1],
    angleConstraint: Math.PI / 8,
    segmentLength: 8,
  },
};

/** Species-specific swimming parameters */
export const SWIM_PARAMS: Record<FishSpecies, { tailAmplitude: number; swimSpeed: number }> = {
  tropical: { tailAmplitude: 0.8, swimSpeed: 0.08 },  // Gentle sway
  sleek: { tailAmplitude: 0.5, swimSpeed: 0.1 },      // Subtle, efficient
  deep: { tailAmplitude: 0.6, swimSpeed: 0.06 },      // Slow, eerie
  schooling: { tailAmplitude: 0.7, swimSpeed: 0.09 }, // Coordinated, calm
};

/**
 * Procedural Fish with anatomical detail
 *
 * Supports two rendering modes:
 * 1. Legacy: Static bezier curves + sine wave body flex (useSpineChain = false)
 * 2. Spine-chain: Dynamic joint-based body (useSpineChain = true)
 *
 * The spine-chain approach creates more organic movement where
 * each body segment follows the one ahead.
 */
export interface FishMarineLife extends MarineLifeBase {
  type: "fish";

  // Species and appearance
  species: FishSpecies;
  colors: FishColorPalette;

  // Body dimensions
  bodyLength: number; // Total length in pixels
  bodyHeight: number; // Max height (at widest point)
  bodyAspect: number; // Length to height ratio

  // Position and movement
  direction: 1 | -1;
  speed: number;
  baseSpeed: number;
  verticalDrift: number;
  bobAmplitude: number;
  bobSpeed: number;
  depthBand: { min: number; max: number };
  baseY: number;

  // Depth/parallax
  depthLayer: DepthLayer;
  depthScale: number;

  // 3D Depth (UFO-style continuous depth system)
  /** Continuous depth position: 0 = close/large, 1 = far/small */
  z: number;
  /** Target depth for smooth transitions via lerp */
  targetZ: number;
  /** Target Y position for vertical movement behaviors */
  targetY?: number;

  // Behavior
  behavior: FishBehavior;
  behaviorTimer: number;
  targetDirection?: 1 | -1;
  dartSpeed?: number;

  // Schooling
  schoolId?: number;
  leaderOffset?: { x: number; y: number };

  // Body shape and animation
  rotation: number;
  bodyFlexPhase: number; // S-curve animation for swimming
  bodyFlexAmount: number; // How much body bends (0-1)

  // Fins with physics
  dorsalFin: FinState;
  pectoralFinTop: FinState;
  pectoralFinBottom: FinState;
  pelvicFin: FinState;
  analFin: FinState;
  tailFin: TailState;

  // Visual details
  scalePhase: number; // Shimmer animation phase
  scaleSpeed: number;
  eyeSize: number; // Relative to body height
  gillPhase: number; // Breathing animation
  gillSpeed: number;
  hasBioluminescence: boolean; // Deep species only
  glowPhase: number;
  glowIntensity: number;

  // Wake effects
  wakeTrail: WakeParticle[];
  lastWakeSpawn: number;

  // ============================================================================
  // SPINE-CHAIN PROPERTIES (New organic animation system)
  // ============================================================================

  /** Whether this fish uses spine-chain animation (vs legacy bezier) */
  useSpineChain?: boolean;

  /**
   * Spine joint positions - array of {x, y, angle, width} objects
   * Populated when useSpineChain is true
   * Import SpineChain class to manipulate this
   */
  spineJoints?: Array<{
    x: number;
    y: number;
    angle: number;
    width: number;
    segmentLength: number;
  }>;

  /** Spine configuration reference */
  spineConfig?: SpineConfig;

  /** Current swimming phase for tail oscillation */
  swimPhase?: number;

  /** Tail oscillation amplitude (pixels) */
  tailAmplitude?: number;

  /** Swimming speed multiplier for undulation */
  swimSpeed?: number;

  /** Fins attached to spine (replaces individual fin states when using spine) */
  spineFins?: SpineFin[];

  // ============================================================================
  // PERSONALITY & MOOD SYSTEM
  // ============================================================================

  /**
   * Individual personality traits (0-1 for each)
   * Generated at spawn, influences behavior throughout lifetime
   */
  personality?: {
    boldness: number;
    sociability: number;
    activity: number;
    curiosity: number;
  };

  /**
   * Current emotional state
   * Affects behavior decisions and visual expression
   */
  mood?: "calm" | "curious" | "alert" | "playful" | "hungry" | "tired" | "social";

  /** Time spent in current mood (for decay calculations) */
  moodTimer?: number;

  /** Time since last interesting stimulus */
  lastStimulusTime?: number;

  /** Current energy level (0-1), affects speed and rest behavior */
  energy?: number;

  /** Current hunger level (0-1), drives feeding behavior */
  hunger?: number;

  /** Current wobble animation for expression */
  wobbleType?:
    | "none"
    | "curious_tilt"
    | "startled_dart"
    | "playful_wiggle"
    | "tired_drift"
    | "feeding_lunge"
    | "social_shimmer"
    // Rare behaviors
    | "barrel_roll"
    | "freeze"
    | "double_take"
    | "happy_flip"
    | "sync_pulse";

  /** Frames remaining in current wobble */
  wobbleTimer?: number;

  /** Current wobble intensity (0-1, decays) */
  wobbleIntensity?: number;

  /** Target point for behaviors (feeding, exploring) */
  behaviorTarget?: { x: number; y: number };

  /** What the fish is "looking at" */
  focusPoint?: { x: number; y: number };

  // ============================================================================
  // HOME ZONE & SOCIAL MEMORY
  // ============================================================================

  /**
   * Preferred vertical position within depth band (0 = top, 1 = bottom)
   * Set at spawn based on species, influences behavioral drift
   */
  preferredVerticalPosition?: number;

  /**
   * Home zone - rough area where fish spawned
   * Fish have a slight tendency to drift back toward this zone
   */
  homeZone?: {
    x: number;
    y: number;
    /** How strongly fish is drawn back (0-1) */
    affinity: number;
  };

  /**
   * Social memory - IDs of fish this fish has interacted with
   * Used for recognizing "friends" and triggering sync behaviors
   */
  socialMemory?: Set<number>;

  /**
   * Last interaction time - prevents interaction spam
   */
  lastInteractionTime?: number;

  /**
   * Unique ID for social memory tracking
   */
  fishId?: number;

  // ============================================================================
  // HUNTING SYSTEM
  // ============================================================================

  /**
   * Hunt state for predators (sleek, deep)
   */
  huntState?: "idle" | "stalking" | "chasing" | "cooldown";

  /**
   * ID of fish being hunted (for predators)
   */
  huntingTarget?: number;

  /**
   * Time since hunt started (for chase duration limits)
   */
  huntStartTime?: number;

  /**
   * Cooldown end time (animation time when can hunt again)
   */
  huntCooldownEnd?: number;

  /**
   * Whether this fish is currently being hunted (for prey)
   */
  isBeingHunted?: boolean;

  /**
   * ID of predator chasing this fish (for flee direction)
   */
  hunterId?: number;

  // ============================================================================

  // Legacy compatibility (for existing behavior code)
  width: number;
  height: number;
  tailPhase: number;
}

/** Tentacle segment for fluid physics simulation */
export interface TentacleSegment {
  /** Angle offset from parent segment */
  angle: number;
  /** Length of this segment */
  length: number;
  /** Current velocity for physics */
  velocity: number;
  /** Phase offset for wave animation */
  phase: number;
}

/** Individual tentacle with multiple segments */
export interface Tentacle {
  /** Starting X offset from bell center (as fraction of bell width) */
  originX: number;
  /** Segments making up this tentacle */
  segments: TentacleSegment[];
  /** Base thickness at origin */
  thickness: number;
  /** Opacity multiplier */
  opacity: number;
}

/** Oral arm (thick inner tentacle near mouth) */
export interface OralArm {
  /** Starting angle from center */
  angle: number;
  /** Length as fraction of bell size */
  length: number;
  /** Thickness as fraction of bell size */
  thickness: number;
  /** Wave phase offset */
  phase: number;
}

/** Jellyfish species with different visual characteristics */
export type JellyfishSpecies = "moon" | "crystal" | "lionsMane" | "phantom";

/** Gonad configuration for internal anatomy */
export interface GonadConfig {
  /** Number of lobes (typically 4 for moon jellyfish) */
  lobeCount: number;
  /** Size relative to bell */
  size: number;
  /** Rotation offset */
  rotation: number;
  /** Color (usually matches accent) */
  color: string;
}

export interface JellyfishMarineLife extends MarineLifeBase {
  type: "jellyfish";
  /** Species determines visual characteristics */
  species: JellyfishSpecies;
  /** Base size (bell diameter at rest) */
  size: number;
  /** Primary color */
  color: string;
  /** Secondary/accent color for glow */
  accentColor: string;
  /** Tertiary color for details */
  detailColor: string;
  /** Horizontal drift speed */
  horizontalSpeed: number;
  /** Vertical speed (affected by pulse) */
  verticalSpeed: number;
  /** Base vertical position */
  baseY: number;

  // Depth/parallax (0 = close/large, 1 = far/small)
  /** Continuous depth position for parallax effect */
  depth: number;

  // Bell anatomy
  /** Current pulse phase (0-1, 0=relaxed, 0.5=contracted) */
  pulsePhase: number;
  /** Pulse speed (cycles per second) */
  pulseSpeed: number;
  /** Bell height-to-width ratio (affects dome shape) */
  bellAspect: number;
  /** Number of margin frills */
  frillCount: number;
  /** Frill wave phase */
  frillPhase: number;
  /** Bell deformation seeds for asymmetric pulse */
  bellDeformSeeds: number[];

  // Internal structure
  /** Number of radial channels visible */
  radialChannels: number;
  /** Oral arms (thick inner tentacles) */
  oralArms: OralArm[];
  /** Gonad configuration (internal organs) */
  gonads: GonadConfig | null;
  /** Mesoglea vein seeds for internal texture */
  mesogleaSeeds: number[];

  // Trailing tentacles
  /** Main trailing tentacles with physics */
  tentacles: Tentacle[];

  // Bioluminescence
  /** Current glow intensity (0-1) */
  glowIntensity: number;
  /** Glow pulse phase (traveling wave) */
  glowPhase: number;
  /** Glow pulse speed */
  glowSpeed: number;

  // Particle trail
  /** Recent positions for particle spawning */
  trailPositions: { x: number; y: number; age: number }[];

  // Legacy compatibility
  /** @deprecated Use tentacles array instead */
  tentacleSeeds: number[];
  /** @deprecated Use pulsePhase instead */
  waveAmplitude: number;
  /** @deprecated Use pulseSpeed instead */
  waveFrequency: number;
}

export interface OceanParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface MarineLifeSpawn {
  type: MarineLifeType;
  spawnTime: number; // When to spawn (in animation time)
}

/** Dust particle visible in light beam */
export interface LightDustParticle {
  x: number; // Relative to ray center
  y: number; // Relative to ray top
  size: number;
  opacity: number;
  drift: number; // Horizontal drift speed
  phase: number; // Animation phase
}

/**
 * Enhanced Light Ray from surface
 *
 * Volumetric god rays with wave distortion, color shifting,
 * dappled edges, and visible dust particles
 */
export interface LightRay {
  // Position
  x: number;
  baseX: number; // Original X position for wave calculation

  // Dimensions
  width: number;
  baseWidth: number; // Original width for pulsing

  // Angle and distortion
  angle: number; // Base angle in degrees
  wavePhase: number; // Phase for wave distortion
  waveAmplitude: number; // How much ray sways
  waveSpeed: number;

  // Opacity and intensity
  opacity: number;
  baseOpacity: number;
  intensityPhase: number; // For slow brightness pulsing
  intensitySpeed: number;

  // Animation
  phase: number;
  speed: number;

  // Volumetric properties
  glowIntensity: number; // Soft edge glow amount
  depthFade: number; // How quickly it fades with depth (0.5-0.8)

  // Color
  colorShiftPhase: number; // For subtle color variation
  colorShiftSpeed: number;

  // Dappled edges (organic, not rectangular)
  edgeSeeds: number[]; // Random seeds for edge variation

  // Dust particles in beam
  dustParticles: LightDustParticle[];
}

/** Caustic pattern cell for underwater light effect */
export interface CausticCell {
  x: number;
  y: number;
  size: number;
  intensity: number;
  phase: number;
  speed: number;
}

/** Caustic pattern state */
export interface CausticsState {
  cells: CausticCell[];
  globalPhase: number;
  driftX: number;
  driftY: number;
}

/** Distant bioluminescent glow spot */
export interface DistantGlow {
  x: number;
  y: number;
  size: number;
  intensity: number;
  phase: number;
  speed: number;
  color: string; // Cyan, purple, or deep blue
}

/** Depth fog layer */
export interface FogLayer {
  y: number; // Vertical position
  opacity: number;
  phase: number;
  speed: number;
}

/**
 * Gradient animation state
 */
export interface GradientState {
  // Color breathing (very slow hue/saturation shift)
  breathingPhase: number;
  breathingSpeed: number;

  // Depth fog layers
  fogLayers: FogLayer[];

  // Distant bioluminescence
  distantGlows: DistantGlow[];

  // Vignette intensity (subtle edge darkening)
  vignetteIntensity: number;
}

export interface DeepOceanState {
  bubbles: Bubble[];
  fish: FishMarineLife[];
  jellyfish: JellyfishMarineLife[];
  particles: OceanParticle[];
  currentGradient: {
    top: string;
    bottom: string;
  };
  lightRays: LightRay[];
  caustics: CausticsState | null;
  gradientState: GradientState | null;
  pendingFishSpawns: number[]; // Spawn times
  schools: Map<number, FishMarineLife[]>; // schoolId -> fish in school
}

/** @deprecated Use fish + jellyfish arrays separately */
export type MarineLife = FishMarineLife | JellyfishMarineLife;
