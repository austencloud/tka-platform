import type {
  FlowFestGnssFix,
  FlowFestGnssReplaySample,
} from "../../domain/flow-fest-field-positioning";

export type FlowFestFieldPositioningError =
  | "denied"
  | "unavailable"
  | "timeout"
  | "unknown";

export interface IFlowFestFieldPositioning {
  watchLive(
    onFix: (fix: FlowFestGnssFix) => void,
    onError: (error: FlowFestFieldPositioningError) => void
  ): () => void;
  replay(
    samples: FlowFestGnssReplaySample[],
    onFix: (fix: FlowFestGnssFix, ordinal: number) => void,
    onComplete: () => void
  ): () => void;
}
