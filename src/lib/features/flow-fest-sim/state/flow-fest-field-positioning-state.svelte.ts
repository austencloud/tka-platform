import {
  evaluateFlowFestGnssFix,
  type FlowFestFieldReference,
  type FlowFestGnssEvaluation,
  type FlowFestGnssFix,
  type FlowFestGnssReplaySample,
} from "../domain/flow-fest-field-positioning";
import type {
  FlowFestFieldPositioningError,
  IFlowFestFieldPositioning,
} from "../services/contracts/IFlowFestFieldPositioning";

export type FlowFestFieldMode = "off" | "live" | "replay" | "diagnostic";

export interface FlowFestFieldPositioningSnapshot {
  mode: FlowFestFieldMode;
  status: "idle" | "acquiring" | "tracking" | "degraded" | "complete" | "error";
  message: string;
  fix: FlowFestGnssFix | null;
  evaluation: FlowFestGnssEvaluation | null;
  acceptedRevision: number;
  replayOrdinal: number;
  replaySamples: number;
}

export function createFlowFestFieldPositioningState(
  positioning: IFlowFestFieldPositioning
) {
  let reference = $state<FlowFestFieldReference | null>(null);
  let replayTrack = $state<FlowFestGnssReplaySample[]>([]);
  let snapshot = $state<FlowFestFieldPositioningSnapshot>({
    mode: "off",
    status: "idle",
    message: "Field positioning is off",
    fix: null,
    evaluation: null,
    acceptedRevision: 0,
    replayOrdinal: 0,
    replaySamples: 0,
  });
  let stopActive: (() => void) | null = null;

  function configure(
    nextReference: FlowFestFieldReference,
    nextReplayTrack: FlowFestGnssReplaySample[]
  ): void {
    reference = nextReference;
    replayTrack = nextReplayTrack;
    snapshot = { ...snapshot, replaySamples: nextReplayTrack.length };
  }

  function startLive(): void {
    stop();
    if (!reference) {
      snapshot = {
        ...snapshot,
        mode: "live",
        status: "error",
        message: "The checked site coordinate frame is not ready",
      };
      return;
    }
    snapshot = {
      ...snapshot,
      mode: "live",
      status: "acquiring",
      message: "Waiting for a high-accuracy device fix",
    };
    stopActive = positioning.watchLive(
      (fix) => applyFix(fix, "live"),
      (error) => applyError(error)
    );
  }

  function startReplay(): void {
    stop();
    if (!reference || replayTrack.length < 2) {
      snapshot = {
        ...snapshot,
        mode: "replay",
        status: "error",
        message: "The registered route replay is not ready",
      };
      return;
    }
    snapshot = {
      ...snapshot,
      mode: "replay",
      status: "tracking",
      message: `Replaying ${replayTrack.length} checked route fixes`,
      replayOrdinal: 0,
      replaySamples: replayTrack.length,
    };
    stopActive = positioning.replay(
      replayTrack,
      (fix, ordinal) => {
        applyFix(fix, "replay");
        snapshot = { ...snapshot, replayOrdinal: ordinal + 1 };
      },
      () => {
        stopActive = null;
        snapshot = {
          ...snapshot,
          status: "complete",
          message: "Registered route replay complete",
        };
      }
    );
  }

  function demonstrateLowAccuracy(): void {
    const sample = replayTrack.at(Math.floor(replayTrack.length / 2));
    if (!sample) return;
    stop();
    applyFix(
      {
        ...sample,
        accuracyMeters: 45,
        timestampMilliseconds: Date.now(),
      },
      "diagnostic"
    );
  }

  function demonstrateStaleFix(): void {
    const sample = replayTrack.at(Math.floor(replayTrack.length / 2));
    if (!sample) return;
    stop();
    applyFix(
      {
        ...sample,
        timestampMilliseconds: Date.now() - 30_000,
      },
      "diagnostic"
    );
  }

  function stop(): void {
    stopActive?.();
    stopActive = null;
    snapshot = {
      ...snapshot,
      mode: "off",
      status: "idle",
      message: "Field positioning is off",
      fix: null,
      evaluation: null,
      replayOrdinal: 0,
    };
  }

  function destroy(): void {
    stopActive?.();
    stopActive = null;
  }

  function applyFix(
    fix: FlowFestGnssFix,
    mode: Exclude<FlowFestFieldMode, "off">
  ): void {
    if (!reference) return;
    const evaluation = evaluateFlowFestGnssFix(reference, fix, Date.now());
    snapshot = {
      ...snapshot,
      mode,
      status: evaluation.accepted ? "tracking" : "degraded",
      message: evaluation.reason,
      fix,
      evaluation,
      acceptedRevision: evaluation.accepted
        ? snapshot.acceptedRevision + 1
        : snapshot.acceptedRevision,
    };
  }

  function applyError(error: FlowFestFieldPositioningError): void {
    const message: Record<FlowFestFieldPositioningError, string> = {
      denied:
        "Location permission was denied; simulation controls remain active",
      unavailable: "This device cannot supply a position fix",
      timeout:
        "The location request timed out; simulation controls remain active",
      unknown: "Field positioning stopped unexpectedly",
    };
    snapshot = {
      ...snapshot,
      status: "error",
      message: message[error],
    };
  }

  return {
    get snapshot() {
      return snapshot;
    },
    configure,
    startLive,
    startReplay,
    demonstrateLowAccuracy,
    demonstrateStaleFix,
    stop,
    destroy,
  };
}

export type FlowFestFieldPositioningState = ReturnType<
  typeof createFlowFestFieldPositioningState
>;
