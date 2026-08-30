/**
 * Crowd walla. A steady crowd gain is the one thing that always sounds like a
 * loop, so the crowd is instead a stream of short synthesized grains — murmur
 * bursts, claps, whoops near the fire, distant drum hits — fired at randomized
 * intervals. Everything is derived from a seeded PRNG keyed on the clock
 * window, so any window replays identically and the same window is never
 * scheduled twice with different content.
 */

export type FlowFestWallaGrainKind =
  | "murmur"
  | "clap"
  | "whoop"
  | "distant-drum";

export const FLOW_FEST_WALLA_CONTRACT = {
  /** Onsets per second at full occupancy and full night energy. */
  baseOnsetsPerSecond: 2.6,
  /** Density floor so a sparse afternoon crowd still breathes. */
  dayEnergyFloor: 0.28,
  windowSeconds: 2,
  /** Hard ceiling on transient nodes per window, whatever the density says. */
  maxGrainsPerWindow: 24,
  /** People inside the response radius that counts as a full crowd. */
  referenceOccupancy: 26,
} as const;

export interface FlowFestWallaGrain {
  kind: FlowFestWallaGrainKind;
  /** Seconds after the window start. */
  offsetSeconds: number;
  durationSeconds: number;
  gain: number;
  pitchRatio: number;
  /** Lateral spread within the crowd, -1 to 1, applied around the source. */
  pan: number;
  centerHz: number;
}

export interface FlowFestWallaWindow {
  seed: number;
  windowIndex: number;
  startSeconds: number;
  durationSeconds: number;
  occupancy: number;
  nightEnergy: number;
  nearFire: number;
  onsetsPerSecond: number;
  grains: FlowFestWallaGrain[];
}

export interface FlowFestWallaScheduleOptions {
  seed: number;
  windowIndex: number;
  /** 0 to 1. Derived from how many people are actually inside the radius. */
  occupancy: number;
  /** 0 to 1. Day is quiet; the field wakes up at dusk. */
  nightEnergy: number;
  /** 0 to 1. Closeness to the fire, which shifts murmur toward claps and whoops. */
  nearFire?: number;
  windowSeconds?: number;
  maxGrains?: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Deterministic 32-bit mix so a seed and window index give one stable stream. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function windowSeed(seed: number, windowIndex: number): number {
  let hash = (seed >>> 0) ^ 0x9e3779b9;
  hash = Math.imul(hash ^ (windowIndex >>> 0), 0x85ebca6b) >>> 0;
  hash = (hash ^ (hash >>> 13)) >>> 0;
  return Math.imul(hash, 0xc2b2ae35) >>> 0;
}

/** People inside the fire-jam response radius, normalized against a full crowd. */
export function flowFestWallaOccupancy(
  peopleWithinRadius: number,
  referenceOccupancy = FLOW_FEST_WALLA_CONTRACT.referenceOccupancy
): number {
  if (referenceOccupancy <= 0) return 0;
  return clamp01(Math.max(0, peopleWithinRadius) / referenceOccupancy);
}

export function flowFestWallaOnsetsPerSecond(
  occupancy: number,
  nightEnergy: number
): number {
  const energy =
    FLOW_FEST_WALLA_CONTRACT.dayEnergyFloor +
    (1 - FLOW_FEST_WALLA_CONTRACT.dayEnergyFloor) * clamp01(nightEnergy);
  return FLOW_FEST_WALLA_CONTRACT.baseOnsetsPerSecond * clamp01(occupancy) * energy;
}

interface GrainProfile {
  durationSeconds: [number, number];
  gain: [number, number];
  pitchRatio: [number, number];
  centerHz: [number, number];
}

const GRAIN_PROFILES: Readonly<Record<FlowFestWallaGrainKind, GrainProfile>> =
  Object.freeze({
    murmur: {
      durationSeconds: [0.34, 0.92],
      gain: [0.1, 0.34],
      pitchRatio: [0.82, 1.24],
      centerHz: [340, 900],
    },
    clap: {
      durationSeconds: [0.05, 0.12],
      gain: [0.22, 0.62],
      pitchRatio: [0.9, 1.35],
      centerHz: [1400, 3200],
    },
    whoop: {
      durationSeconds: [0.22, 0.55],
      gain: [0.18, 0.48],
      pitchRatio: [1.05, 1.9],
      centerHz: [700, 1600],
    },
    "distant-drum": {
      durationSeconds: [0.14, 0.3],
      gain: [0.16, 0.44],
      pitchRatio: [0.55, 0.86],
      centerHz: [95, 230],
    },
  });

function pickKind(roll: number, nearFire: number): FlowFestWallaGrainKind {
  // Near the fire the crowd is reacting, not chatting.
  const clapWeight = 0.1 + 0.16 * nearFire;
  const whoopWeight = 0.05 + 0.13 * nearFire;
  const drumWeight = 0.14 + 0.06 * nearFire;
  const murmurWeight = Math.max(
    0.05,
    1 - clapWeight - whoopWeight - drumWeight
  );
  const total = murmurWeight + clapWeight + whoopWeight + drumWeight;
  const scaled = roll * total;
  if (scaled < murmurWeight) return "murmur";
  if (scaled < murmurWeight + clapWeight) return "clap";
  if (scaled < murmurWeight + clapWeight + whoopWeight) return "whoop";
  return "distant-drum";
}

function between(random: () => number, range: [number, number]): number {
  return range[0] + (range[1] - range[0]) * random();
}

export function scheduleFlowFestWallaWindow(
  options: FlowFestWallaScheduleOptions
): FlowFestWallaWindow {
  const windowSeconds =
    options.windowSeconds ?? FLOW_FEST_WALLA_CONTRACT.windowSeconds;
  const maxGrains = Math.max(
    0,
    Math.round(options.maxGrains ?? FLOW_FEST_WALLA_CONTRACT.maxGrainsPerWindow)
  );
  const occupancy = clamp01(options.occupancy);
  const nightEnergy = clamp01(options.nightEnergy);
  const nearFire = clamp01(options.nearFire ?? 0);
  const onsetsPerSecond = flowFestWallaOnsetsPerSecond(occupancy, nightEnergy);
  const random = mulberry32(windowSeed(options.seed, options.windowIndex));

  const expected = onsetsPerSecond * windowSeconds;
  // Fractional expectation is resolved by one deterministic roll, so a density
  // of 0.4 grains per window still produces grains at the right long-run rate.
  const whole = Math.floor(expected);
  const grainCount = Math.min(
    maxGrains,
    whole + (random() < expected - whole ? 1 : 0)
  );

  const grains: FlowFestWallaGrain[] = [];
  for (let index = 0; index < grainCount; index += 1) {
    const kind = pickKind(random(), nearFire);
    const profile = GRAIN_PROFILES[kind];
    grains.push({
      kind,
      offsetSeconds: random() * windowSeconds,
      durationSeconds: between(random, profile.durationSeconds),
      gain: between(random, profile.gain),
      pitchRatio: between(random, profile.pitchRatio),
      pan: random() * 2 - 1,
      centerHz: between(random, profile.centerHz),
    });
  }
  grains.sort((first, second) => first.offsetSeconds - second.offsetSeconds);

  return {
    seed: options.seed,
    windowIndex: options.windowIndex,
    startSeconds: options.windowIndex * windowSeconds,
    durationSeconds: windowSeconds,
    occupancy,
    nightEnergy,
    nearFire,
    onsetsPerSecond,
    grains,
  };
}

export function flowFestWallaWindowIndexAt(
  seconds: number,
  windowSeconds = FLOW_FEST_WALLA_CONTRACT.windowSeconds
): number {
  return Math.floor(Math.max(0, seconds) / windowSeconds);
}
