// src/lib/features/lab/pronunciation-recorder/domain/session-abort.ts
export type ReadOutcome = "ok" | "fail";
export type AbortReason = "early-failures" | "consecutive-failures";

export const ABORT_EARLY_WINDOW = 8;
export const ABORT_EARLY_FAILURES = 3;
export const ABORT_CONSECUTIVE_FAILURES = 4;

export interface AbortMonitor {
  readonly reason: AbortReason | null;
  record(outcome: ReadOutcome): void;
}

/**
 * Tells random failure apart from systematic failure.
 *
 * Re-queueing is the right answer to a fumbled read and the wrong answer to a
 * muted microphone: without this the session would spend forty minutes
 * discovering that every word fails. A bad opening or a run of failures means
 * the rig is wrong, and only a human can fix that.
 */
export function createAbortMonitor(): AbortMonitor {
  let seen = 0;
  let earlyFailures = 0;
  let consecutive = 0;
  let reason: AbortReason | null = null;

  return {
    get reason() {
      return reason;
    },

    record(outcome) {
      seen++;
      if (outcome === "fail") {
        consecutive++;
        if (seen <= ABORT_EARLY_WINDOW) earlyFailures++;
      } else {
        consecutive = 0;
      }

      if (reason !== null) return;
      if (seen <= ABORT_EARLY_WINDOW && earlyFailures >= ABORT_EARLY_FAILURES) {
        reason = "early-failures";
      } else if (consecutive >= ABORT_CONSECUTIVE_FAILURES) {
        reason = "consecutive-failures";
      }
    },
  };
}
