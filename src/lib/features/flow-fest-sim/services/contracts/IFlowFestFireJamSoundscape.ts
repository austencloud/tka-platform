import type { FlowFestSiteAudioMix } from "../../domain/flow-fest-site-audio";

export interface FlowFestFireJamSoundscapeSnapshot {
  supported: boolean;
  unlocked: boolean;
  playing: boolean;
  graphBuildCount: number;
  sourceStartCount: number;
  mix: FlowFestSiteAudioMix;
  spatialFrameCount: number;
  spatializedSources: number;
}

export interface FlowFestFireJamSpatialFrame {
  listener: { x: number; y: number; z: number; yawRadians: number };
  fire: { x: number; y: number; z: number };
  led: { x: number; y: number; z: number };
  crowd: { x: number; y: number; z: number };
}

export interface IFlowFestFireJamSoundscape {
  unlock(): Promise<void>;
  setMix(mix: FlowFestSiteAudioMix): void;
  setSpatialFrame(frame: FlowFestFireJamSpatialFrame): void;
  triggerJoinCue(): void;
  snapshot(): FlowFestFireJamSoundscapeSnapshot;
  dispose(): void;
}
