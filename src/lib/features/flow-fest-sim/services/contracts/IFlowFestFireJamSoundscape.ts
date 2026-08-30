import type {
  FlowFestAudioListener,
  FlowFestAudioPhase,
  FlowFestAudioSource,
  FlowFestAudioSourceCharacter,
  FlowFestAudioSourceClass,
  FlowFestAudioSourceProvenance,
  FlowFestAudioTier,
} from "../../domain/flow-fest-audio-field";
import type { FlowFestSiteAudioMix } from "../../domain/flow-fest-site-audio";
import type { FlowFestFireJamState } from "../../domain/flow-fest-fire-jam";
import type { FlowFestSiteAudioLayout } from "../../domain/flow-fest-site-audio";

/**
 * Audio cannot be heard from a headless run, so the soundscape publishes the
 * shape of what it is doing: which tier each source landed in, what the ranker
 * decided, how far the walla scheduler has got, and whether the graph is still
 * waiting for a user gesture.
 */
export interface FlowFestAudioFieldSourceProof {
  id: string;
  label: string;
  sourceClass: FlowFestAudioSourceClass;
  character: FlowFestAudioSourceCharacter;
  tier: FlowFestAudioTier;
  panningModel: "HRTF" | "equalpower" | "none";
  distanceMeters: number;
  gain: number;
  lowpassHz: number;
  occluded: boolean;
  occlusionMeters: number;
  provenance: FlowFestAudioSourceProvenance;
}

export interface FlowFestAudioFieldWallaProof {
  seed: number;
  onsetsPerSecond: number;
  occupancy: number;
  nightEnergy: number;
  windowsScheduled: number;
  grainsScheduled: number;
  lastWindowIndex: number;
  lastWindowGrains: number;
}

export interface FlowFestAudioFieldProof {
  configured: boolean;
  phase: FlowFestAudioPhase;
  heroLimit: number;
  heroCount: number;
  midCount: number;
  bedCount: number;
  /** HRTF panner nodes that exist in the graph. Never exceeds heroLimit. */
  hrtfPannerCount: number;
  equalpowerPannerCount: number;
  /** Promotions that ranked into the hero tier but are waiting for a free slot. */
  pendingHeroPromotions: number;
  promotions: string[];
  demotions: string[];
  crossfadeSeconds: number;
  occlusionEnabled: boolean;
  occludedSourceCount: number;
  updateTicks: number;
  coalescedTicks: number;
  bedFilterHz: {
    arrival: number;
    woodland: number;
    camp: number;
    fire: number;
    led: number;
    crowd: number;
  };
  sources: FlowFestAudioFieldSourceProof[];
  walla: FlowFestAudioFieldWallaProof;
}

export type FlowFestSoundscapeUnlockState =
  | "unsupported"
  | "idle"
  | "awaiting-gesture"
  | "running";

export interface FlowFestFireJamSoundscapeSnapshot {
  supported: boolean;
  unlocked: boolean;
  playing: boolean;
  unlockState: FlowFestSoundscapeUnlockState;
  unlockAttemptCount: number;
  unlockFailureCount: number;
  lastUnlockError: string | null;
  graphBuildCount: number;
  sourceStartCount: number;
  longLivedSourceCount: number;
  mix: FlowFestSiteAudioMix;
  spatialFrameCount: number;
  spatializedSources: number;
  field: FlowFestAudioFieldProof;
}

export interface FlowFestFireJamSpatialFrame {
  listener: { x: number; y: number; z: number; yawRadians: number };
  fire: { x: number; y: number; z: number };
  led: { x: number; y: number; z: number };
  crowd: { x: number; y: number; z: number };
}

export interface FlowFestAudioFieldConfig {
  layout: FlowFestSiteAudioLayout;
  sources: readonly FlowFestAudioSource[];
  /** Measured ground sampler used by the terrain occlusion pass. */
  sampleGroundY?: ((x: number, z: number) => number) | null;
  wallaSeed?: number;
}

export interface FlowFestAudioFieldFrame {
  listener: FlowFestAudioListener;
  fireJamState: FlowFestFireJamState;
  moment: string;
  masterVolume: number;
  /** People inside the festival response radius, for walla density. */
  crowdOccupancy: number;
  /** 0 to 1 closeness of the listener to the fire, shifting walla character. */
  nearFire: number;
}

export interface IFlowFestFireJamSoundscape {
  /**
   * Resolves true when the context is running. A browser that refuses the
   * gesture leaves the soundscape re-armable rather than rejecting.
   */
  unlock(): Promise<boolean>;
  configure(config: FlowFestAudioFieldConfig): void;
  /** Throttled audio tick. Safe to call more often than it needs. */
  update(frame: FlowFestAudioFieldFrame): void;
  setMix(mix: FlowFestSiteAudioMix): void;
  setSpatialFrame(frame: FlowFestFireJamSpatialFrame): void;
  triggerJoinCue(): void;
  /** Bumps only on discrete change, so hosts can avoid publishing every tick. */
  proofRevision(): number;
  snapshot(): FlowFestFireJamSoundscapeSnapshot;
  dispose(): void;
}
