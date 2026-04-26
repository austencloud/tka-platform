/**
 * Payload types for non-particle, non-fire, non-LED effect passes.
 *
 * Grouped here because each is relatively small. If any grows complex
 * enough to need its own file, extract it then.
 */

// ── Echo (phantom trail) ────────────────────────────────────────────

export interface EchoPhantom {
  /** Positions of staff endpoints at capture time, in NDC. */
  bluePos: [number, number];
  redPos: [number, number];
  /** Age in beats since capture. Drives fade. */
  age: number;
}

export interface EchoPassPayload {
  phantoms: EchoPhantom[];
  /** "staff" = line between tips, "tips" = dots, "both" = line + dots. */
  shape: "staff" | "tips" | "both";
  /** RGBA color 0..1. */
  color: [number, number, number, number];
  /** Stroke/dot thickness in NDC. */
  thickness: number;
  /** Max phantom age in beats before removal. */
  maxAge: number;
}

// ── Bloom (per-tip halo) ────────────────────────────────────────────

export interface BloomSource {
  /** Position in NDC. */
  position: [number, number];
  /** RGBA color 0..1. */
  color: [number, number, number, number];
  /** Halo radius in NDC. */
  radius: number;
  /** Current pulse multiplier 0..1 (1 = no pulse modulation). */
  pulseFactor: number;
}

export type BloomFalloff = "smooth" | "sharp" | "ring";

export interface BloomPassPayload {
  sources: BloomSource[];
  /** Gaussian / sharp / ring falloff profile. */
  falloff: BloomFalloff;
  /** Overall intensity multiplier. */
  intensity: number;
}

// ── Zap (arc / crackle) ─────────────────────────────────────────────

export interface ZapArc {
  /** Start position in NDC. */
  from: [number, number];
  /** End position in NDC. */
  to: [number, number];
  /** RGBA color 0..1. */
  color: [number, number, number, number];
  /** Core thickness in NDC. */
  thickness: number;
  /** 0..1 branch probability per segment. */
  branching: number;
  /** Random seed for deterministic arc shape within a frame. */
  seed: number;
}

export interface ZapPassPayload {
  arcs: ZapArc[];
  /** "arc" = tip-to-tip, "crackle" = radiate from each tip. */
  mode: "arc" | "crackle";
  /** Overall intensity 0..1. */
  intensity: number;
  /** Glow radius in NDC for the bloom pass on arcs. */
  glowRadius: number;
}

// ── Pulse (radial rings) ────────────────────────────────────────────

export interface PulseRing {
  /** Center position in NDC. */
  center: [number, number];
  /** Current radius in NDC (expands over lifetime). */
  radius: number;
  /** 0..1 age fraction. 0 = just born, 1 = about to die. */
  age: number;
  /** RGBA color 0..1. */
  color: [number, number, number, number];
}

export interface PulsePassPayload {
  rings: PulseRing[];
  /** "stroke" = thin outlines, "glow" = gradient-filled halos. */
  style: "stroke" | "glow";
  /** Ring stroke/band thickness in NDC. */
  thickness: number;
  /** Overall intensity 0..1. */
  intensity: number;
}

// ── Ink (ribbon + splatter) ─────────────────────────────────────────

export interface InkStroke {
  tipId: string;
  /** Current ribbon path in NDC, oldest first. */
  path: Array<[number, number]>;
  /** RGBA color 0..1. */
  color: [number, number, number, number];
  /** Width in NDC. Velocity modulates this. */
  width: number;
  /** Per-point velocity magnitude - drives width modulation + splatter. */
  velocities: number[];
}

export interface InkPassPayload {
  strokes: InkStroke[];
  /** 0..1. How easily strands break into droplets. */
  viscosity: number;
  /** 0..1. Splatter burst intensity on velocity spikes. */
  splatterIntensity: number;
  /** Per-frame decay for the accumulator FBO. */
  decayPerSecond: number;
}

// ── Frost (crystal growth) ──────────────────────────────────────────

export interface FrostSeed {
  /** Crystal center in NDC. */
  position: [number, number];
  /** Current growth radius in NDC. */
  radius: number;
  /** 0..1 angular complexity. Higher = more dendritic branching. */
  crystallinity: number;
  /** RGBA color 0..1. */
  color: [number, number, number, number];
}

export interface FrostPassPayload {
  seeds: FrostSeed[];
  /** 0..1. Growth speed per frame. */
  spreadRate: number;
  /** Overall intensity 0..1. */
  intensity: number;
  /** Per-frame decay for melting old frost. */
  decayPerSecond: number;
}

// ── Silk (ribbon flutter) ───────────────────────────────────────────

export interface SilkRibbon {
  tipId: string;
  /** Current ribbon path in NDC, oldest first. */
  path: Array<[number, number]>;
  /** RGBA color 0..1. */
  color: [number, number, number, number];
  /** Base half-width in NDC. */
  width: number;
  /** Per-point velocity magnitude - drives width narrowing (tautness). */
  velocities: number[];
  /** Sine-wave flutter displacement per point. */
  flutterOffsets: number[];
}

export interface SilkPassPayload {
  ribbons: SilkRibbon[];
  /** Per-frame decay for the accumulator FBO. */
  decayPerSecond: number;
  /** Overall opacity 0..1. */
  intensity: number;
}
