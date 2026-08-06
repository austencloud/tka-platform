import {
  FIRST_FIRE_SHRINE_ORDER,
  type FirstFireShrineId,
} from "./first-fire-procession-plan";

export type FirstFireProcessionPhase =
  | "approach"
  | "dj-active"
  | "dj-complete"
  | "ek-active"
  | "ek-complete"
  | "fl-active"
  | "fire-extinguished"
  | "growth-complete";

export interface FirstFireProcessionState {
  phase: FirstFireProcessionPhase;
  /** Highest reached overlapping orbit zone, expressed as a count from 0–4. */
  orbitProgress: Record<FirstFireShrineId, number>;
}

const ACTIVE_PHASE: Record<FirstFireShrineId, FirstFireProcessionPhase> = {
  dj: "dj-active",
  ek: "ek-active",
  fl: "fl-active",
};

const COMPLETE_PHASE: Record<FirstFireShrineId, FirstFireProcessionPhase> = {
  dj: "dj-complete",
  ek: "ek-complete",
  fl: "fire-extinguished",
};

export function createFirstFireProcessionState(): FirstFireProcessionState {
  return {
    phase: "approach",
    orbitProgress: { dj: 0, ek: 0, fl: 0 },
  };
}

function canEnterShrine(
  state: FirstFireProcessionState,
  shrine: FirstFireShrineId
): boolean {
  if (shrine === "dj") return state.phase === "approach";
  if (shrine === "ek") return state.phase === "dj-complete";
  return state.phase === "ek-complete";
}

export function enterFirstFireShrine(
  state: FirstFireProcessionState,
  shrine: FirstFireShrineId
): FirstFireProcessionState {
  if (!canEnterShrine(state, shrine)) return state;
  return { ...state, phase: ACTIVE_PHASE[shrine] };
}

export function reachFirstFireOrbitZone(
  state: FirstFireProcessionState,
  shrine: FirstFireShrineId,
  zoneIndex: number
): FirstFireProcessionState {
  if (state.phase !== ACTIVE_PHASE[shrine]) return state;
  const clampedIndex = Math.max(0, Math.min(3, Math.floor(zoneIndex)));
  // Reaching a later overlapping zone implies the visitor crossed the earlier
  // ones. Advancing by maximum progress prevents one missed boundary event from
  // stranding the room.
  const reached = Math.max(state.orbitProgress[shrine], clampedIndex + 1);
  if (reached === state.orbitProgress[shrine]) return state;
  const orbitProgress = { ...state.orbitProgress, [shrine]: reached };
  return {
    phase: reached === 4 ? COMPLETE_PHASE[shrine] : state.phase,
    orbitProgress,
  };
}

export function completeFirstFireGrowth(
  state: FirstFireProcessionState
): FirstFireProcessionState {
  if (state.phase !== "fire-extinguished") return state;
  return { ...state, phase: "growth-complete" };
}

export function isFirstFireShrineComplete(
  state: FirstFireProcessionState,
  shrine: FirstFireShrineId
): boolean {
  return state.orbitProgress[shrine] === 4;
}

export function completedFirstFireShrines(
  state: FirstFireProcessionState
): FirstFireShrineId[] {
  return FIRST_FIRE_SHRINE_ORDER.filter((shrine) =>
    isFirstFireShrineComplete(state, shrine)
  );
}
