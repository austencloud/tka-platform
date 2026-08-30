import { FLOW_FEST_FIRE_JAM_CONTRACT } from "./flow-fest-fire-jam";

/**
 * The positional audio field. One kilometre of ground cannot afford an HRTF
 * convolution per sound source, so every source is ranked each tick and routed
 * to one of three tiers: a small HRTF pool for what the listener is actually
 * near, a cheap equalpower panner for the audible middle, and a non-panned bed
 * bus for everything that has become distant murmur. This module owns the
 * ranking, the outdoor rolloff, the terrain occlusion pass, and the derivation
 * of the sources themselves from registered plan features.
 */

export type FlowFestAudioSourceClass =
  | "fire-jam"
  | "led-circle"
  | "drum-circle"
  | "camp-system"
  | "generator"
  | "crowd-walla";

export type FlowFestAudioSourceCharacter =
  | "fire-bed"
  | "led-drone"
  | "hand-drum"
  | "deep-pulse"
  | "bright-rhythm"
  | "dub-swell"
  | "generator-hum"
  | "walla";

export type FlowFestAudioPhase = "day" | "dusk" | "night";

export type FlowFestAudioTier = "hero" | "mid" | "bed";

export const FLOW_FEST_AUDIO_FIELD_CONTRACT = {
  /** HRTF is convolution-heavy. Eight concurrent is the affordable ceiling. */
  heroLimit: 8,
  /** An incumbent hero keeps its slot until a rival beats it by this margin. */
  heroHysteresis: 0.28,
  /** Below this gain a source stops being spatialized and folds into the bed. */
  audibleFloor: 0.004,
  /** Promotion and demotion ramp length, so tier switches never pop. */
  crossfadeSeconds: 0.35,
  /** Open-air brightness before distance or relief takes anything away. */
  openLowpassHz: 18000,
  /** Distance at which roughly 1/e of the open brightness survives. */
  airAbsorptionScaleMeters: 58,
  /** However far away a source is, it never closes past this. */
  distantLowpassFloorHz: 320,
} as const;

export interface FlowFestAudioPoint2D {
  x: number;
  z: number;
}

export interface FlowFestAudioPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface FlowFestAudioListener extends FlowFestAudioPoint3D {
  yawRadians: number;
}

export interface FlowFestAudioSourceProvenance {
  /** The plan feature, zone, or registered layout value this position came from. */
  featureId: string;
  featureKind: "zone" | "landmark" | "festival-community" | "derived";
  evidence: string;
  note: string;
}

export interface FlowFestAudioSource {
  id: string;
  label: string;
  sourceClass: FlowFestAudioSourceClass;
  character: FlowFestAudioSourceCharacter;
  position: FlowFestAudioPoint3D;
  /** Narrative importance, independent of distance. Breaks ranking ties. */
  priority: number;
  refDistanceMeters: number;
  maxDistanceMeters: number;
  rolloffFactor: number;
  phaseGain: Record<FlowFestAudioPhase, number>;
  provenance: FlowFestAudioSourceProvenance;
}

interface FlowFestAudioSourceClassProfile {
  priority: number;
  refDistanceMeters: number;
  maxDistanceMeters: number;
  rolloffFactor: number;
  heightAboveGroundMeters: number;
  phaseGain: Record<FlowFestAudioPhase, number>;
}

/**
 * Outdoor rolloff per source class. A camp PA carries much further than a
 * generator, so ref/max distances are per class rather than global.
 */
export const FLOW_FEST_AUDIO_SOURCE_CLASS_PROFILE: Readonly<
  Record<FlowFestAudioSourceClass, FlowFestAudioSourceClassProfile>
> = Object.freeze({
  "fire-jam": {
    priority: 1,
    refDistanceMeters: 6,
    maxDistanceMeters: 96,
    rolloffFactor: 0.85,
    heightAboveGroundMeters: 1.2,
    phaseGain: { day: 0.06, dusk: 0.44, night: 1 },
  },
  "led-circle": {
    priority: 0.92,
    refDistanceMeters: 6,
    maxDistanceMeters: 84,
    rolloffFactor: 0.95,
    heightAboveGroundMeters: 1.5,
    phaseGain: { day: 0, dusk: 0.34, night: 1 },
  },
  "drum-circle": {
    priority: 0.86,
    refDistanceMeters: 5,
    maxDistanceMeters: 74,
    rolloffFactor: 0.9,
    heightAboveGroundMeters: 0.9,
    phaseGain: { day: 0.12, dusk: 0.6, night: 1 },
  },
  "camp-system": {
    priority: 0.7,
    refDistanceMeters: 8,
    maxDistanceMeters: 132,
    rolloffFactor: 0.72,
    heightAboveGroundMeters: 1.1,
    phaseGain: { day: 0.24, dusk: 0.7, night: 1 },
  },
  generator: {
    priority: 0.34,
    refDistanceMeters: 4,
    maxDistanceMeters: 46,
    rolloffFactor: 1.15,
    heightAboveGroundMeters: 0.6,
    phaseGain: { day: 0.62, dusk: 0.82, night: 0.9 },
  },
  "crowd-walla": {
    priority: 0.62,
    refDistanceMeters: 8,
    maxDistanceMeters: 88,
    rolloffFactor: 0.88,
    heightAboveGroundMeters: 1.55,
    phaseGain: { day: 0.14, dusk: 0.54, night: 1 },
  },
});

/**
 * Camp zones that may host a sound system, in the order they are offered one.
 * The player's own camp is never given one — a stage you are standing inside
 * is not "music bleeding across a field".
 */
export const FLOW_FEST_AUDIO_CAMP_SYSTEM_ZONE_IDS = Object.freeze([
  "car-camp-zone",
  "lower-tent-zone",
  "upper-tent-zone",
]);

const CAMP_SYSTEM_CHARACTERS: readonly FlowFestAudioSourceCharacter[] =
  Object.freeze(["deep-pulse", "bright-rhythm", "dub-swell"]);

const CAMP_SYSTEM_LABELS: readonly string[] = Object.freeze([
  "Camp sound system: slow deep pulse",
  "Camp sound system: brighter rhythm",
  "Camp sound system: dub swell",
]);

export const FLOW_FEST_AUDIO_GENERATOR_LANDMARK_ID = "camp-buildings";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function flowFestAudioPhaseForMoment(moment: string): FlowFestAudioPhase {
  if (moment === "night") return "night";
  if (moment === "golden-hour" || moment === "dusk" || moment === "dawn")
    return "dusk";
  return "day";
}

/** Inverse-distance rolloff with clamped ref/max and a clean fade at the edge. */
export function flowFestAudioRolloffGain(
  distanceMeters: number,
  refDistanceMeters: number,
  maxDistanceMeters: number,
  rolloffFactor: number
): number {
  if (distanceMeters >= maxDistanceMeters) return 0;
  const clamped = Math.max(distanceMeters, refDistanceMeters);
  const inverse =
    refDistanceMeters /
    (refDistanceMeters + rolloffFactor * (clamped - refDistanceMeters));
  const edge =
    1 - smoothstep(maxDistanceMeters * 0.78, maxDistanceMeters, distanceMeters);
  return clamp01(inverse * edge);
}

/**
 * Air absorption. A stage across a field reads as bass-heavy murmur because
 * distance eats the top end long before it eats the level.
 */
export function flowFestAudioDistanceLowpassHz(distanceMeters: number): number {
  const open = FLOW_FEST_AUDIO_FIELD_CONTRACT.openLowpassHz;
  const floor = FLOW_FEST_AUDIO_FIELD_CONTRACT.distantLowpassFloorHz;
  const decay = Math.exp(
    -Math.max(0, distanceMeters) /
      FLOW_FEST_AUDIO_FIELD_CONTRACT.airAbsorptionScaleMeters
  );
  return Math.max(floor, open * decay);
}

export interface FlowFestAudioOcclusionOptions {
  /** Interior samples taken along the listener-to-source segment. */
  samples?: number;
  /** Spans shorter than this are never treated as occluded. */
  minSpanMeters?: number;
  /** Relief above the sightline that counts as fully blocked. */
  fullyBlockedMeters?: number;
  /** Relief below this is measurement noise, not a hill. */
  blockedThresholdMeters?: number;
  blockedLowpassHz?: number;
  blockedGainScale?: number;
}

export interface FlowFestAudioOcclusion {
  blocked: boolean;
  obstructionMeters: number;
  blockedFraction: number;
  lowpassHz: number;
  gainScale: number;
}

const OPEN_OCCLUSION: FlowFestAudioOcclusion = Object.freeze({
  blocked: false,
  obstructionMeters: 0,
  blockedFraction: 0,
  lowpassHz: FLOW_FEST_AUDIO_FIELD_CONTRACT.openLowpassHz,
  gainScale: 1,
});

export function flowFestOpenAudioOcclusion(): FlowFestAudioOcclusion {
  return { ...OPEN_OCCLUSION };
}

/**
 * Cheap terrain line-of-sight. Sample the measured ground between the listener
 * and the source; anything standing above the straight sightline closes a
 * lowpass and dips the gain. This is relief only — it does not model tents,
 * trees, or buildings, and it never claims to.
 */
export function computeFlowFestAudioOcclusion(
  listener: FlowFestAudioPoint3D,
  source: FlowFestAudioPoint3D,
  sampleGroundY: (x: number, z: number) => number,
  options: FlowFestAudioOcclusionOptions = {}
): FlowFestAudioOcclusion {
  const samples = Math.max(1, Math.round(options.samples ?? 12));
  const minSpanMeters = options.minSpanMeters ?? 4;
  const fullyBlockedMeters = Math.max(
    0.001,
    options.fullyBlockedMeters ?? 6
  );
  const blockedThresholdMeters = options.blockedThresholdMeters ?? 0.35;
  const blockedLowpassHz = options.blockedLowpassHz ?? 520;
  const blockedGainScale = options.blockedGainScale ?? 0.45;

  const spanMeters = Math.hypot(source.x - listener.x, source.z - listener.z);
  if (spanMeters < minSpanMeters) return flowFestOpenAudioOcclusion();

  let obstructionMeters = 0;
  for (let index = 1; index <= samples; index += 1) {
    const t = index / (samples + 1);
    const x = listener.x + (source.x - listener.x) * t;
    const z = listener.z + (source.z - listener.z) * t;
    const sightlineY = listener.y + (source.y - listener.y) * t;
    const groundY = sampleGroundY(x, z);
    if (!Number.isFinite(groundY)) continue;
    const rise = groundY - sightlineY;
    if (rise > obstructionMeters) obstructionMeters = rise;
  }

  if (obstructionMeters <= blockedThresholdMeters) {
    return flowFestOpenAudioOcclusion();
  }

  const blockedFraction = clamp01(obstructionMeters / fullyBlockedMeters);
  const open = FLOW_FEST_AUDIO_FIELD_CONTRACT.openLowpassHz;
  return {
    blocked: true,
    obstructionMeters,
    blockedFraction,
    // Interpolate in log space so the closing sounds even rather than
    // collapsing over the first half metre of relief.
    lowpassHz: open * Math.pow(blockedLowpassHz / open, blockedFraction),
    gainScale: 1 - (1 - blockedGainScale) * blockedFraction,
  };
}

export interface FlowFestAudioPlanZoneFeature {
  id: string;
  label: string;
  evidence: string;
  center: FlowFestAudioPoint2D;
}

export interface FlowFestAudioPlanLandmarkFeature {
  id: string;
  label: string;
  evidence: string;
  kind: string;
  position: FlowFestAudioPoint2D;
}

export interface FlowFestAudioPlanFeatures {
  zones: readonly FlowFestAudioPlanZoneFeature[];
  landmarks: readonly FlowFestAudioPlanLandmarkFeature[];
  selectedCampZoneId: string;
}

export interface FlowFestAudioFestivalFeatures {
  fireCenter: FlowFestAudioPoint3D;
  ledCircleCenter: FlowFestAudioPoint3D;
  ingressBearingRadians: number;
  spectatorCount: number;
  performerCount: number;
}

export interface FlowFestAudioSourceBuildOptions {
  plan: FlowFestAudioPlanFeatures;
  festival: FlowFestAudioFestivalFeatures;
  /** Measured ground sampler. Without it, plan-derived sources sit at y = 0. */
  sampleGroundY?: (x: number, z: number) => number;
  /** Cap on camp sound systems, so a plan with more camp zones stays restrained. */
  campSystemLimit?: number;
}

function sourcePosition(
  point: FlowFestAudioPoint2D,
  sourceClass: FlowFestAudioSourceClass,
  sampleGroundY?: (x: number, z: number) => number
): FlowFestAudioPoint3D {
  const groundY = sampleGroundY ? sampleGroundY(point.x, point.z) : 0;
  return {
    x: point.x,
    y:
      (Number.isFinite(groundY) ? groundY : 0) +
      FLOW_FEST_AUDIO_SOURCE_CLASS_PROFILE[sourceClass].heightAboveGroundMeters,
    z: point.z,
  };
}

function makeSource(
  id: string,
  label: string,
  sourceClass: FlowFestAudioSourceClass,
  character: FlowFestAudioSourceCharacter,
  position: FlowFestAudioPoint3D,
  provenance: FlowFestAudioSourceProvenance
): FlowFestAudioSource {
  const profile = FLOW_FEST_AUDIO_SOURCE_CLASS_PROFILE[sourceClass];
  return {
    id,
    label,
    sourceClass,
    character,
    position,
    priority: profile.priority,
    refDistanceMeters: profile.refDistanceMeters,
    maxDistanceMeters: profile.maxDistanceMeters,
    rolloffFactor: profile.rolloffFactor,
    phaseGain: { ...profile.phaseGain },
    provenance,
  };
}

/**
 * Every source position is derived from a registered plan feature or from the
 * festival community layout. Nothing here is a hand-placed coordinate: the
 * drum circle rides the fire-jam performance-floor radius, and the crowd rides
 * the community's own ingress bearing.
 */
export function buildFlowFestAudioFieldSources(
  options: FlowFestAudioSourceBuildOptions
): FlowFestAudioSource[] {
  const { plan, festival, sampleGroundY } = options;
  const campSystemLimit = options.campSystemLimit ?? 3;
  const sources: FlowFestAudioSource[] = [];

  sources.push(
    makeSource(
      "fire-jam",
      "Fire jam",
      "fire-jam",
      "fire-bed",
      { ...festival.fireCenter },
      {
        featureId: "festivalCommunity.fireCenter",
        featureKind: "festival-community",
        evidence: "festival-placement",
        note: "The registered fire-circle centre the Gate 4 jam already owns.",
      }
    )
  );

  sources.push(
    makeSource(
      "led-circle",
      "LED circle",
      "led-circle",
      "led-drone",
      { ...festival.ledCircleCenter },
      {
        featureId: "festivalCommunity.ledCircleCenter",
        featureKind: "festival-community",
        evidence: "festival-placement",
        note: "The registered LED-circle centre the Gate 4 jam already owns.",
      }
    )
  );

  // The drum circle sits on the performance floor, on the far side from the
  // LED circle, so the two authored sources never stack on one bearing.
  const towardLed = Math.atan2(
    festival.ledCircleCenter.x - festival.fireCenter.x,
    festival.ledCircleCenter.z - festival.fireCenter.z
  );
  const drumBearing = towardLed + Math.PI;
  const drumRadius = FLOW_FEST_FIRE_JAM_CONTRACT.performanceFloorRadiusMeters;
  sources.push(
    makeSource(
      "drum-circle",
      "Drum circle",
      "drum-circle",
      "hand-drum",
      sourcePosition(
        {
          x: festival.fireCenter.x + Math.sin(drumBearing) * drumRadius,
          z: festival.fireCenter.z + Math.cos(drumBearing) * drumRadius,
        },
        "drum-circle",
        sampleGroundY
      ),
      {
        featureId: "festivalCommunity.fireCenter",
        featureKind: "derived",
        evidence: "festival-placement",
        note: "Placed on the fire-jam performance-floor radius, opposite the LED circle bearing.",
      }
    )
  );

  // The crowd gathers on the community's own ingress side of the fire.
  const crowdRadius =
    FLOW_FEST_FIRE_JAM_CONTRACT.wheelParkingRadiusMeters * 0.75;
  sources.push(
    makeSource(
      "festival-crowd",
      "Festival crowd",
      "crowd-walla",
      "walla",
      sourcePosition(
        {
          x:
            festival.fireCenter.x +
            Math.sin(festival.ingressBearingRadians) * crowdRadius,
          z:
            festival.fireCenter.z +
            Math.cos(festival.ingressBearingRadians) * crowdRadius,
        },
        "crowd-walla",
        sampleGroundY
      ),
      {
        featureId: "festivalCommunity.ingressBearingRadians",
        featureKind: "derived",
        evidence: "festival-placement",
        note: "Placed on the community ingress bearing at three quarters of the wheel-parking radius.",
      }
    )
  );

  const campZones = FLOW_FEST_AUDIO_CAMP_SYSTEM_ZONE_IDS.map((zoneId) =>
    plan.zones.find((zone) => zone.id === zoneId)
  )
    .filter(
      (zone): zone is FlowFestAudioPlanZoneFeature =>
        Boolean(zone) && zone!.id !== plan.selectedCampZoneId
    )
    .slice(0, campSystemLimit);

  for (const [index, zone] of campZones.entries()) {
    sources.push(
      makeSource(
        `camp-system-${zone.id}`,
        CAMP_SYSTEM_LABELS[index] ?? `Camp sound system ${index + 1}`,
        "camp-system",
        CAMP_SYSTEM_CHARACTERS[index] ?? "deep-pulse",
        sourcePosition(zone.center, "camp-system", sampleGroundY),
        {
          featureId: zone.id,
          featureKind: "zone",
          evidence: zone.evidence,
          note: `Camp sound system placed at the registered centre of ${zone.label}.`,
        }
      )
    );
  }

  const buildings = plan.landmarks.find(
    (landmark) => landmark.id === FLOW_FEST_AUDIO_GENERATOR_LANDMARK_ID
  );
  if (buildings) {
    sources.push(
      makeSource(
        "buildings-generator",
        "Generator by the camp buildings",
        "generator",
        "generator-hum",
        sourcePosition(buildings.position, "generator", sampleGroundY),
        {
          featureId: buildings.id,
          featureKind: "landmark",
          evidence: buildings.evidence,
          note: "Site power placed at the orthophoto-visible building cluster.",
        }
      )
    );
  }

  return sources;
}

export interface FlowFestAudioSourceState {
  id: string;
  label: string;
  sourceClass: FlowFestAudioSourceClass;
  character: FlowFestAudioSourceCharacter;
  tier: FlowFestAudioTier;
  previousTier: FlowFestAudioTier | null;
  panningModel: "HRTF" | "equalpower" | "none";
  distanceMeters: number;
  rolloffGain: number;
  phaseGain: number;
  occlusionGainScale: number;
  gain: number;
  score: number;
  lowpassHz: number;
  occluded: boolean;
  occlusionMeters: number;
  occlusionFraction: number;
  audible: boolean;
  x: number;
  y: number;
  z: number;
  provenance: FlowFestAudioSourceProvenance;
}

export interface FlowFestAudioFieldSolution {
  phase: FlowFestAudioPhase;
  heroLimit: number;
  heroCount: number;
  midCount: number;
  bedCount: number;
  audibleCount: number;
  crossfadeSeconds: number;
  promotions: string[];
  demotions: string[];
  sources: FlowFestAudioSourceState[];
}

export interface FlowFestAudioFieldSolveOptions {
  phase: FlowFestAudioPhase;
  /** Scales every source. The fire-jam state already drives the bed mix. */
  stateGain?: number;
  heroLimit?: number;
  hysteresis?: number;
  audibleFloor?: number;
  crossfadeSeconds?: number;
  sampleGroundY?: ((x: number, z: number) => number) | null;
  occlusion?: FlowFestAudioOcclusionOptions;
  /** Tier each source held on the previous solve, for promotion hysteresis. */
  previousTiers?: ReadonlyMap<string, FlowFestAudioTier> | null;
}

function emptySourceState(): FlowFestAudioSourceState {
  return {
    id: "",
    label: "",
    sourceClass: "fire-jam",
    character: "fire-bed",
    tier: "bed",
    previousTier: null,
    panningModel: "none",
    distanceMeters: 0,
    rolloffGain: 0,
    phaseGain: 0,
    occlusionGainScale: 1,
    gain: 0,
    score: 0,
    lowpassHz: FLOW_FEST_AUDIO_FIELD_CONTRACT.openLowpassHz,
    occluded: false,
    occlusionMeters: 0,
    occlusionFraction: 0,
    audible: false,
    x: 0,
    y: 0,
    z: 0,
    provenance: {
      featureId: "",
      featureKind: "derived",
      evidence: "",
      note: "",
    },
  };
}

export function createFlowFestAudioFieldSolution(): FlowFestAudioFieldSolution {
  return {
    phase: "day",
    heroLimit: FLOW_FEST_AUDIO_FIELD_CONTRACT.heroLimit,
    heroCount: 0,
    midCount: 0,
    bedCount: 0,
    audibleCount: 0,
    crossfadeSeconds: FLOW_FEST_AUDIO_FIELD_CONTRACT.crossfadeSeconds,
    promotions: [],
    demotions: [],
    sources: [],
  };
}

/**
 * The per-tick solve. `into` is an optional scratch solution that gets mutated
 * in place — the audio tick runs many times a second and must not allocate a
 * fresh object graph each time.
 */
export function solveFlowFestAudioField(
  sources: readonly FlowFestAudioSource[],
  listener: FlowFestAudioListener,
  options: FlowFestAudioFieldSolveOptions,
  into?: FlowFestAudioFieldSolution
): FlowFestAudioFieldSolution {
  const solution = into ?? createFlowFestAudioFieldSolution();
  const heroLimit = Math.max(
    0,
    options.heroLimit ?? FLOW_FEST_AUDIO_FIELD_CONTRACT.heroLimit
  );
  const hysteresis =
    options.hysteresis ?? FLOW_FEST_AUDIO_FIELD_CONTRACT.heroHysteresis;
  const audibleFloor =
    options.audibleFloor ?? FLOW_FEST_AUDIO_FIELD_CONTRACT.audibleFloor;
  const stateGain = options.stateGain ?? 1;
  const sampleGroundY = options.sampleGroundY ?? null;

  while (solution.sources.length < sources.length) {
    solution.sources.push(emptySourceState());
  }
  solution.sources.length = sources.length;
  solution.phase = options.phase;
  solution.heroLimit = heroLimit;
  solution.crossfadeSeconds =
    options.crossfadeSeconds ??
    FLOW_FEST_AUDIO_FIELD_CONTRACT.crossfadeSeconds;
  solution.promotions.length = 0;
  solution.demotions.length = 0;

  for (const [index, source] of sources.entries()) {
    const state = solution.sources[index] ?? emptySourceState();
    solution.sources[index] = state;
    const distanceMeters = Math.hypot(
      listener.x - source.position.x,
      listener.z - source.position.z
    );
    const rolloffGain = flowFestAudioRolloffGain(
      distanceMeters,
      source.refDistanceMeters,
      source.maxDistanceMeters,
      source.rolloffFactor
    );
    const phaseGain = source.phaseGain[options.phase];
    const occlusion =
      sampleGroundY && rolloffGain > 0
        ? computeFlowFestAudioOcclusion(
            listener,
            source.position,
            sampleGroundY,
            options.occlusion
          )
        : OPEN_OCCLUSION;
    const gain = clamp01(
      rolloffGain * phaseGain * stateGain * occlusion.gainScale
    );

    state.id = source.id;
    state.label = source.label;
    state.sourceClass = source.sourceClass;
    state.character = source.character;
    state.previousTier = options.previousTiers?.get(source.id) ?? null;
    state.distanceMeters = distanceMeters;
    state.rolloffGain = rolloffGain;
    state.phaseGain = phaseGain;
    state.occlusionGainScale = occlusion.gainScale;
    state.gain = gain;
    state.score = gain * source.priority;
    state.lowpassHz = Math.min(
      flowFestAudioDistanceLowpassHz(distanceMeters),
      occlusion.lowpassHz
    );
    state.occluded = occlusion.blocked;
    state.occlusionMeters = occlusion.obstructionMeters;
    state.occlusionFraction = occlusion.blockedFraction;
    state.audible = gain >= audibleFloor;
    state.x = source.position.x;
    state.y = source.position.y;
    state.z = source.position.z;
    state.provenance = source.provenance;
    state.tier = "bed";
    state.panningModel = "none";
  }

  const ranked = solution.sources
    .filter((state) => state.audible)
    .sort((first, second) => {
      const firstScore =
        first.score * (first.previousTier === "hero" ? 1 + hysteresis : 1);
      const secondScore =
        second.score * (second.previousTier === "hero" ? 1 + hysteresis : 1);
      if (secondScore !== firstScore) return secondScore - firstScore;
      return first.id < second.id ? -1 : first.id > second.id ? 1 : 0;
    });

  let heroCount = 0;
  let midCount = 0;
  for (const [index, state] of ranked.entries()) {
    if (index < heroLimit) {
      state.tier = "hero";
      state.panningModel = "HRTF";
      heroCount += 1;
    } else {
      state.tier = "mid";
      state.panningModel = "equalpower";
      midCount += 1;
    }
  }

  let bedCount = 0;
  for (const state of solution.sources) {
    if (state.tier === "bed") bedCount += 1;
    if (state.tier === "hero" && state.previousTier !== "hero") {
      solution.promotions.push(state.id);
    } else if (state.previousTier === "hero" && state.tier !== "hero") {
      solution.demotions.push(state.id);
    }
  }

  solution.heroCount = heroCount;
  solution.midCount = midCount;
  solution.bedCount = bedCount;
  solution.audibleCount = heroCount + midCount;
  return solution;
}

export function readFlowFestAudioFieldTiers(
  solution: FlowFestAudioFieldSolution,
  into?: Map<string, FlowFestAudioTier>
): Map<string, FlowFestAudioTier> {
  const tiers = into ?? new Map<string, FlowFestAudioTier>();
  tiers.clear();
  for (const state of solution.sources) tiers.set(state.id, state.tier);
  return tiers;
}
