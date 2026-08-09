import type { FirstFireBlenderContract } from "$lib/features/museum/data/first-fire-blender-contract";
import type { FirstFireShrineId } from "$lib/features/museum/data/first-fire-procession-plan";
import {
  completeFirstFireGrowth,
  createFirstFireProcessionState,
  enterFirstFireShrine,
  reachFirstFireOrbitZone,
  type FirstFireProcessionPhase,
  type FirstFireProcessionState,
} from "$lib/features/museum/data/first-fire-procession-state";

export const FIRST_FIRE_NEUTRAL_BLACKOUT_MS = 2200;
const ENTRY_PROXIMITY_METRES = 1.65;
/**
 * Zone gates as a fraction of a full lap, scaled to each court's authored
 * viewing sweep (240 degrees for the horseshoe). Scaling rather than fixing
 * the gates keeps a shorter arc completable.
 */
const ORBIT_ZONE_LAP_FRACTIONS = [25 / 360, 110 / 360, 195 / 360, 280 / 360] as const;

export function firstFireOrbitZoneThresholds(
  orbitSweepDegrees: number
): number[] {
  const sweep = Math.min(360, Math.abs(orbitSweepDegrees));
  return ORBIT_ZONE_LAP_FRACTIONS.map((fraction) => fraction * sweep);
}

export interface FirstFireRuntimePosition {
  x: number;
  z: number;
}

export interface FirstFireGrayboxReviewState {
  procession: FirstFireProcessionState;
  orbitTravelDegrees: Record<FirstFireShrineId, number>;
  lastOrbitAngle: Record<FirstFireShrineId, number | null>;
  blackoutElapsedMs: number;
}

export type FirstFireFlameGroup = "field" | FirstFireShrineId;

export function createFirstFireGrayboxReviewState(): FirstFireGrayboxReviewState {
  return {
    procession: createFirstFireProcessionState(),
    orbitTravelDegrees: { dj: 0, ek: 0, fl: 0 },
    lastOrbitAngle: { dj: null, ek: null, fl: null },
    blackoutElapsedMs: 0,
  };
}

export function activeFirstFireShrine(
  phase: FirstFireProcessionPhase
): FirstFireShrineId | null {
  if (phase === "dj-active") return "dj";
  if (phase === "ek-active") return "ek";
  if (phase === "fl-active") return "fl";
  return null;
}

export function displayedFirstFireShrine(
  phase: FirstFireProcessionPhase
): FirstFireShrineId | null {
  const active = activeFirstFireShrine(phase);
  if (active) return active;
  if (phase === "dj-complete") return "dj";
  if (phase === "ek-complete") return "ek";
  if (phase === "fire-extinguished") return "fl";
  return null;
}

export function visibleFirstFireFlameGroups(
  phase: FirstFireProcessionPhase
): ReadonlySet<FirstFireFlameGroup> {
  if (phase === "fire-extinguished" || phase === "growth-complete") {
    return new Set();
  }
  if (phase === "approach" || phase === "dj-active") {
    return new Set(["field", "dj"]);
  }
  if (phase === "dj-complete" || phase === "ek-active") {
    return new Set(["field", "ek"]);
  }
  return new Set(["field", "fl"]);
}

export function firstFirePhaseLabel(
  state: FirstFireGrayboxReviewState
): string {
  const phase = state.procession.phase;
  if (phase === "approach") return "Ember bridge crossed";
  if (phase === "dj-active")
    return `DJ orbit ${state.procession.orbitProgress.dj}/4`;
  if (phase === "dj-complete") return "DJ lane cooling to coals";
  if (phase === "ek-active")
    return `EK orbit ${state.procession.orbitProgress.ek}/4`;
  if (phase === "ek-complete") return "EK lane cooling to coals";
  if (phase === "fl-active")
    return `FL orbit ${state.procession.orbitProgress.fl}/4`;
  if (phase === "fire-extinguished") {
    const remaining = Math.max(
      0,
      FIRST_FIRE_NEUTRAL_BLACKOUT_MS - state.blackoutElapsedMs
    );
    return `Neutral blackout ${(remaining / 1000).toFixed(1)}s`;
  }
  return "Earth growth revealed";
}

function distanceToRuntimePoint(
  position: FirstFireRuntimePosition,
  point: { x: number; y: number }
): number {
  return Math.hypot(position.x - point.x, position.z + point.y);
}

function signedSmallestDegrees(from: number, to: number): number {
  let delta = to - from;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

function updateActiveOrbit(
  state: FirstFireGrayboxReviewState,
  contract: FirstFireBlenderContract,
  position: FirstFireRuntimePosition,
  shrineId: FirstFireShrineId
): FirstFireGrayboxReviewState {
  const shrine = contract.shrines.find(
    (candidate) => candidate.id === shrineId
  );
  if (!shrine) return state;
  const centre = {
    x: shrine.blenderCentre.x,
    z: -shrine.blenderCentre.y,
  };
  const dx = position.x - centre.x;
  const dz = position.z - centre.z;
  const radius = Math.hypot(dx, dz);
  const halfWidth = shrine.orbitWidth / 2 + 0.35;
  if (Math.abs(radius - shrine.orbitRadius) > halfWidth) return state;

  const angle = (Math.atan2(dz, dx) * 180) / Math.PI;
  const previousAngle = state.lastOrbitAngle[shrineId];
  if (previousAngle === null) {
    return {
      ...state,
      lastOrbitAngle: { ...state.lastOrbitAngle, [shrineId]: angle },
    };
  }

  const direction = Math.sign(shrine.orbitSweepDegrees);
  const thresholds = firstFireOrbitZoneThresholds(shrine.orbitSweepDegrees);
  const travelled = Math.max(
    0,
    Math.min(
      Math.min(360, Math.abs(shrine.orbitSweepDegrees)),
      state.orbitTravelDegrees[shrineId] +
        signedSmallestDegrees(previousAngle, angle) * direction
    )
  );
  let procession = state.procession;
  for (let zoneIndex = 0; zoneIndex < thresholds.length; zoneIndex += 1) {
    if (travelled >= thresholds[zoneIndex]!) {
      procession = reachFirstFireOrbitZone(procession, shrineId, zoneIndex);
    }
  }
  return {
    ...state,
    procession,
    orbitTravelDegrees: {
      ...state.orbitTravelDegrees,
      [shrineId]: travelled,
    },
    lastOrbitAngle: { ...state.lastOrbitAngle, [shrineId]: angle },
  };
}

function enterNearbyShrine(
  state: FirstFireGrayboxReviewState,
  contract: FirstFireBlenderContract,
  position: FirstFireRuntimePosition,
  shrineId: FirstFireShrineId
): FirstFireGrayboxReviewState {
  const shrine = contract.shrines.find(
    (candidate) => candidate.id === shrineId
  );
  if (
    !shrine ||
    distanceToRuntimePoint(position, shrine.blenderEntry) >
      ENTRY_PROXIMITY_METRES
  ) {
    return state;
  }
  const procession = enterFirstFireShrine(state.procession, shrineId);
  return procession === state.procession ? state : { ...state, procession };
}

/**
 * Advances the canonical procession from first-person position. Local review
 * state only supplies the physical facts the canonical owner does not track:
 * accumulated orbit travel and blackout time.
 */
export function updateFirstFireGrayboxReview(
  state: FirstFireGrayboxReviewState,
  contract: FirstFireBlenderContract,
  position: FirstFireRuntimePosition,
  deltaMs: number
): FirstFireGrayboxReviewState {
  const phase = state.procession.phase;
  if (phase === "fire-extinguished") {
    const blackoutElapsedMs = Math.min(
      FIRST_FIRE_NEUTRAL_BLACKOUT_MS,
      state.blackoutElapsedMs + Math.max(0, deltaMs)
    );
    return {
      ...state,
      blackoutElapsedMs,
      procession:
        blackoutElapsedMs >= FIRST_FIRE_NEUTRAL_BLACKOUT_MS
          ? completeFirstFireGrowth(state.procession)
          : state.procession,
    };
  }
  if (phase === "growth-complete") return state;

  const active = activeFirstFireShrine(phase);
  if (active) return updateActiveOrbit(state, contract, position, active);

  if (phase === "approach") {
    return enterNearbyShrine(state, contract, position, "dj");
  }

  // No hub gate is needed: the carved S makes the next court physically
  // unreachable without walking out of the completed one, and the canonical
  // procession owner rejects out-of-order entry.
  if (phase === "dj-complete") return enterNearbyShrine(state, contract, position, "ek");
  if (phase === "ek-complete") return enterNearbyShrine(state, contract, position, "fl");

  return state;
}

function completeActiveShrineForProof(
  state: FirstFireGrayboxReviewState,
  shrineId: FirstFireShrineId
): FirstFireGrayboxReviewState {
  let procession = state.procession;
  for (let zoneIndex = 0; zoneIndex < 4; zoneIndex += 1) {
    procession = reachFirstFireOrbitZone(procession, shrineId, zoneIndex);
  }
  return {
    ...state,
    procession,
    orbitTravelDegrees: { ...state.orbitTravelDegrees, [shrineId]: 240 },
  };
}

/** A deterministic review shortcut; every transition still calls the canonical owner. */
export function advanceFirstFireGrayboxProof(
  state: FirstFireGrayboxReviewState
): FirstFireGrayboxReviewState {
  const phase = state.procession.phase;
  if (phase === "approach") {
    return {
      ...state,
      procession: enterFirstFireShrine(state.procession, "dj"),
    };
  }
  if (phase === "dj-active") return completeActiveShrineForProof(state, "dj");
  if (phase === "dj-complete") {
    return { ...state, procession: enterFirstFireShrine(state.procession, "ek") };
  }
  if (phase === "ek-active") return completeActiveShrineForProof(state, "ek");
  if (phase === "ek-complete") {
    return { ...state, procession: enterFirstFireShrine(state.procession, "fl") };
  }
  if (phase === "fl-active") return completeActiveShrineForProof(state, "fl");
  if (phase === "fire-extinguished") {
    return {
      ...state,
      blackoutElapsedMs: FIRST_FIRE_NEUTRAL_BLACKOUT_MS,
      procession: completeFirstFireGrowth(state.procession),
    };
  }
  return createFirstFireGrayboxReviewState();
}
