// Deep Ocean Background Models

export interface Bubble {
  x: number;
  y: number;
  radius: number;
  speed: number;
  sway: number;
  opacity: number;
  swayOffset: number;
  startY: number;
}

export type MarineLifeType = "fish" | "jellyfish";

export interface FishSprite {
  name: string;
  path: string;
}

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
export type FishBehavior = "cruising" | "turning" | "darting" | "schooling";

export interface FishMarineLife extends MarineLifeBase {
  type: "fish";
  sprite: FishSprite;
  /** Pre-rendered canvas with color variant baked in (no runtime filters) */
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  /** @deprecated Use canvas instead - kept for fallback only */
  image?: HTMLImageElement;
  width: number;
  height: number;
  direction: 1 | -1;
  speed: number;
  baseSpeed: number; // Original speed for behavior resets
  verticalDrift: number;
  bobAmplitude: number;
  bobSpeed: number;
  depthBand: { min: number; max: number };
  baseY: number;

  // Depth/parallax properties
  depthLayer: DepthLayer;
  depthScale: number; // 0.5-1.0, affects size and speed

  // Behavior properties
  behavior: FishBehavior;
  behaviorTimer: number; // Time until behavior change
  targetDirection?: 1 | -1; // For turning behavior
  dartSpeed?: number; // For darting behavior

  // Schooling properties
  schoolId?: number; // Fish in same school follow each other
  leaderOffset?: { x: number; y: number }; // Offset from school leader

  // Visual enhancements
  rotation: number; // Slight tilt based on vertical movement
  tailPhase: number; // For tail wiggle animation
  hueRotate: number; // Color variant (degrees) - now baked into canvas
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

/** Light ray from surface */
export interface LightRay {
  x: number;
  opacity: number;
  width: number;
  angle: number;
  phase: number;
  speed: number;
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
  pendingFishSpawns: number[]; // Spawn times
  schools: Map<number, FishMarineLife[]>; // schoolId -> fish in school
}

/** @deprecated Use fish + jellyfish arrays separately */
export type MarineLife = FishMarineLife | JellyfishMarineLife;
