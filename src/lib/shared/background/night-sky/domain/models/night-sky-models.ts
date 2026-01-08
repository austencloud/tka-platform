// Night Sky Background Models

export interface ParallaxLayer {
  stars: Star[];
  driftX: number;
  driftY: number;
}

export interface Star {
  x: number;
  y: number;
  radius: number;
  baseOpacity: number;
  currentOpacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
  isTwinkling: boolean;
  color: string;
  isSparkle: boolean; // True for 5-pointed star shape with glow, false for circular
}

export interface MoonIllumination {
  /** Fraction of moon illuminated (0-1) */
  fraction: number;
  /** Position in lunar cycle (0 = new moon, 0.5 = full moon, 1 = new moon) */
  phaseValue: number;
  /** Angle of the bright limb */
  angle: number;
  /** Parallactic angle - rotation based on observer's latitude */
  parallacticAngle: number;
  /** Whether moon is waxing (true) or waning (false) */
  isWaxing: boolean;
  /** Earthshine intensity (0-1) - visible during crescent phases */
  earthshineIntensity: number;
}

export interface Moon {
  x: number;
  y: number;
  radius: number;
  color: string;
  driftX?: number;
  driftY?: number;
  illumination?: MoonIllumination;
  /** User's latitude for orientation calculation */
  observerLatitude?: number;
}

export interface Spaceship {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  active: boolean;
  direction: number;
  opacity: number;
  image?: HTMLImageElement;
  imageLoaded?: boolean;
}

export interface EasterEggState<T> {
  element: T | null;
  timer: number;
  interval: number;
}

export interface ParallaxConfig {
  far: {
    density: number;
    drift: number;
    sizeMultiplier: number;
    opacityMultiplier: number;
    sparkleChance: number;
  };
  mid: {
    density: number;
    drift: number;
    sizeMultiplier: number;
    opacityMultiplier: number;
    sparkleChance: number;
  };
  near: {
    density: number;
    drift: number;
    sizeMultiplier: number;
    opacityMultiplier: number;
    sparkleChance: number;
  };
}

// Night Sky Configuration Models

export interface StarConfig {
  minSize: number;
  maxSize: number;
  colors: string[];
  baseOpacityMin: number;
  baseOpacityMax: number;
  minTwinkleSpeed: number;
  maxTwinkleSpeed: number;
  twinkleChance: number;
}

// ============================================================================
// MILKY WAY MODELS
// ============================================================================

/** A dust lane that creates dark regions in the Milky Way band */
export interface DustLane {
  /** Parametric position along band (0-1) */
  startT: number;
  /** Length along band (0-1) */
  length: number;
  /** Width as fraction of band width */
  width: number;
  /** Opacity of the dark region (0-1) */
  opacity: number;
  /** Animation phase offset */
  phaseOffset: number;
  /** Seed values for organic edge variation */
  edgeSeeds: number[];
}

/** A bright star cluster within the Milky Way */
export interface StarCloud {
  /** Parametric position along band (0-1) */
  t: number;
  /** Offset from center line (-1 to 1) */
  offset: number;
  /** Size as fraction of band width */
  size: number;
  /** Base brightness (0-1) */
  brightness: number;
  /** Animation phase for pulsing */
  pulsePhase: number;
  /** Color tint */
  color: string;
}

/** Complete Milky Way band state */
export interface MilkyWayBand {
  /** Control points defining the band path across the sky */
  pathPoints: { x: number; y: number }[];
  /** Width of the band at each control point */
  widths: number[];
  /** Dust lanes within the band */
  dustLanes: DustLane[];
  /** Star clusters within the band */
  starClouds: StarCloud[];
  /** Overall glow phase for subtle pulsing */
  glowPhase: number;
  /** Traveling shimmer phase (0-1) */
  shimmerPhase: number;
  /** Seeds for organic edge variation */
  edgeSeeds: number[];
}

/** Milky Way configuration */
export interface MilkyWayConfig {
  /** Band width as fraction of screen diagonal */
  bandWidthPercent: number;
  /** Number of control points for the path */
  pathPoints: number;
  /** Number of dust lanes */
  dustLaneCount: number;
  /** Number of star clusters */
  starCloudCount: number;
  /** Base opacity of the band glow */
  baseOpacity: number;
  /** Shimmer wave speed */
  shimmerSpeed: number;
  /** Glow pulse speed */
  glowPulseSpeed: number;
  /** Quality levels where enabled */
  enabledOnQuality: ("high" | "medium" | "low" | "minimal")[];
}
