import type { WorkerEnvironmentKey } from "./worker-renderer-protocol";

export type WorkerRendererSlotId = "a" | "b";

export interface WorkerRendererSlotState {
  id: WorkerRendererSlotId;
  requestId: number;
  environment: WorkerEnvironmentKey;
  status: "booting" | "ready" | "active" | "failed";
}

export interface WorkerRendererHandoffState {
  latestRequestId: number;
  active: WorkerRendererSlotState | null;
  staging: WorkerRendererSlotState | null;
}

export type WorkerRendererHandoffDecision =
  | { type: "ignored"; state: WorkerRendererHandoffState }
  | {
      type: "cancel";
      state: WorkerRendererHandoffState;
      dispose: WorkerRendererSlotState;
    }
  | {
      type: "stage";
      state: WorkerRendererHandoffState;
      slot: WorkerRendererSlotState;
      dispose: WorkerRendererSlotState | null;
    }
  | {
      type: "swap";
      state: WorkerRendererHandoffState;
      incoming: WorkerRendererSlotState;
      outgoing: WorkerRendererSlotState | null;
    }
  | {
      type: "failed";
      state: WorkerRendererHandoffState;
      failed: WorkerRendererSlotState;
      role: "active" | "staging";
    };

type WorkerRendererRequestDecision = Extract<
  WorkerRendererHandoffDecision,
  { type: "ignored" | "cancel" | "stage" }
>;

type WorkerRendererFirstFrameDecision = Extract<
  WorkerRendererHandoffDecision,
  { type: "ignored" | "swap" }
>;

type WorkerRendererFailureDecision = Extract<
  WorkerRendererHandoffDecision,
  { type: "ignored" | "failed" }
>;

export function createWorkerRendererHandoffState(): WorkerRendererHandoffState {
  return { latestRequestId: 0, active: null, staging: null };
}

function nextSlotId(
  active: WorkerRendererSlotState | null
): WorkerRendererSlotId {
  return active?.id === "a" ? "b" : "a";
}

export function requestWorkerEnvironment(
  state: WorkerRendererHandoffState,
  environment: WorkerEnvironmentKey
): WorkerRendererRequestDecision {
  if (state.staging?.environment === environment) {
    return { type: "ignored", state };
  }

  if (state.active?.environment === environment) {
    if (!state.staging) return { type: "ignored", state };
    return {
      type: "cancel",
      dispose: state.staging,
      state: {
        ...state,
        latestRequestId: state.latestRequestId + 1,
        staging: null,
      },
    };
  }

  const requestId = state.latestRequestId + 1;
  const slot: WorkerRendererSlotState = {
    id: nextSlotId(state.active),
    requestId,
    environment,
    status: "booting",
  };
  const next: WorkerRendererHandoffState = {
    latestRequestId: requestId,
    active: state.active,
    staging: slot,
  };
  return { type: "stage", state: next, slot, dispose: state.staging };
}

export function acceptWorkerFirstFrame(
  state: WorkerRendererHandoffState,
  requestId: number
): WorkerRendererFirstFrameDecision {
  if (
    requestId !== state.latestRequestId ||
    state.staging?.requestId !== requestId
  ) {
    return { type: "ignored", state };
  }

  const incoming: WorkerRendererSlotState = {
    ...state.staging,
    status: "active",
  };
  const next: WorkerRendererHandoffState = {
    ...state,
    active: incoming,
    staging: null,
  };
  return {
    type: "swap",
    state: next,
    incoming,
    outgoing: state.active,
  };
}

export function rejectWorkerEnvironment(
  state: WorkerRendererHandoffState,
  requestId: number
): WorkerRendererFailureDecision {
  if (state.staging?.requestId === requestId) {
    const failed: WorkerRendererSlotState = {
      ...state.staging,
      status: "failed",
    };
    return {
      type: "failed",
      failed,
      role: "staging",
      state: { ...state, staging: null },
    };
  }

  if (state.active?.requestId === requestId) {
    const failed: WorkerRendererSlotState = {
      ...state.active,
      status: "failed",
    };
    return {
      type: "failed",
      failed,
      role: "active",
      state: { ...state, active: null },
    };
  }

  return { type: "ignored", state };
}
