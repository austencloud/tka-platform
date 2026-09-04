import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";

export const THIRD_ORDER_COMPOSITION_VERSION = 1 as const;

export type ThirdOrderCarrierLane = "left" | "right";

export type ThirdOrderOrientationMode =
  | "world"
  | "radial"
  | "tangent"
  | "carrier";

export type ThirdOrderTimingMode = "phrase" | "beats" | "independent";

export type ThirdOrderSourceTarget = "carrier" | "grid-blue" | "grid-red";

export interface ThirdOrderChildDraft {
  id: "grid-blue" | "grid-red";
  label: string;
  lane: ThirdOrderCarrierLane;
  sequence: SequenceData;
  orientationMode: ThirdOrderOrientationMode;
  timingMode: ThirdOrderTimingMode;
  rate: number;
  visible: boolean;
}

export interface ThirdOrderCompositionDraft {
  version: typeof THIRD_ORDER_COMPOSITION_VERSION;
  carrier: SequenceData;
  children: ThirdOrderChildDraft[];
  bpm: number;
}

export interface ThirdOrderGridPose {
  centerX: number;
  centerY: number;
  rotation: number;
  scale: number;
}

export interface ThirdOrderSampledChild extends ThirdOrderChildDraft {
  props: {
    left: PropState;
    right: PropState;
  };
  step: number;
  totalSteps: number;
  pose: ThirdOrderGridPose;
}

export interface ThirdOrderCompositionFrame {
  masterBeat: number;
  totalBeats: number;
  carrierProps: {
    left: PropState;
    right: PropState;
  };
  children: ThirdOrderSampledChild[];
}
