import {
  createFlowFestElectricUnicycleDynamics,
  wrapFlowFestEucAngle,
  type FlowFestElectricUnicycleDynamics,
  type FlowFestElectricUnicycleInput,
} from "../domain/flow-fest-electric-unicycle";

export const FLOW_FEST_MOBILITY_SESSION_KEY =
  "flow-fest-sim:electric-unicycle:v1";
export const FLOW_FEST_MOBILITY_SNAPSHOT_VERSION = 1 as const;

export interface FlowFestMobilityPoint {
  x: number;
  z: number;
}

export interface FlowFestMobilitySnapshot {
  version: typeof FLOW_FEST_MOBILITY_SNAPSHOT_VERSION;
  contractFingerprint: string;
  mounted: boolean;
  player: FlowFestMobilityPoint;
  wheel: FlowFestMobilityPoint;
  headingRadians: number;
  batteryPercent: number;
  odometerMeters: number;
}

/**
 * How the player is travelling on their own legs.
 *
 * The mounted half of this state has always reported a mode - Cruise or
 * Performance - and the on-foot half reported nothing, so the HUD said
 * "Walking" while the body was sprinting. `sprinting` is the player's own
 * request, matching how the wheel's modes are also input rather than measured
 * physics; `speedMetersPerSecond` is the body's real travel, which is what
 * separates a held Shift from an actual run.
 */
export interface FlowFestOnFootMotion {
  speedMetersPerSecond: number;
  sprinting: boolean;
}

export interface FlowFestMobilityRuntimeUpdate {
  mounted: boolean;
  player: FlowFestMobilityPoint;
  wheel: FlowFestMobilityPoint;
  dynamics: FlowFestElectricUnicycleDynamics;
  input: FlowFestElectricUnicycleInput;
  parkedColliderActive: boolean;
  distanceToWheelMeters: number;
  canMount: boolean;
  canDismount: boolean;
  interactionMessage: string;
  gamepadConnected: boolean;
  collisionLimited: boolean;
  onFoot: FlowFestOnFootMotion;
}

const EMPTY_INPUT: FlowFestElectricUnicycleInput = {
  throttle: 0,
  brake: 0,
  steer: 0,
  performanceMode: false,
  source: "none",
};

export function createFreshFlowFestMobilitySnapshot(
  contractFingerprint: string,
  spawn: FlowFestMobilityPoint,
  headingRadians: number
): FlowFestMobilitySnapshot {
  return {
    version: FLOW_FEST_MOBILITY_SNAPSHOT_VERSION,
    contractFingerprint,
    mounted: true,
    player: { ...spawn },
    wheel: { ...spawn },
    headingRadians: wrapFlowFestEucAngle(headingRadians),
    batteryPercent: 100,
    odometerMeters: 0,
  };
}

function isFinitePoint(value: unknown): value is FlowFestMobilityPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.x === "number" &&
    Number.isFinite(point.x) &&
    Math.abs(point.x) <= 512 &&
    typeof point.z === "number" &&
    Number.isFinite(point.z) &&
    Math.abs(point.z) <= 512
  );
}

export function restoreFlowFestMobilitySnapshot(
  raw: unknown,
  expectedFingerprint: string
): FlowFestMobilitySnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  if (
    candidate.version !== FLOW_FEST_MOBILITY_SNAPSHOT_VERSION ||
    candidate.contractFingerprint !== expectedFingerprint ||
    typeof candidate.mounted !== "boolean" ||
    !isFinitePoint(candidate.player) ||
    !isFinitePoint(candidate.wheel) ||
    typeof candidate.headingRadians !== "number" ||
    !Number.isFinite(candidate.headingRadians) ||
    Math.abs(candidate.headingRadians) > Math.PI * 8 ||
    typeof candidate.batteryPercent !== "number" ||
    !Number.isFinite(candidate.batteryPercent) ||
    candidate.batteryPercent < 0 ||
    candidate.batteryPercent > 100 ||
    typeof candidate.odometerMeters !== "number" ||
    !Number.isFinite(candidate.odometerMeters) ||
    candidate.odometerMeters < 0 ||
    candidate.odometerMeters > 10_000_000
  ) {
    return null;
  }

  return {
    version: FLOW_FEST_MOBILITY_SNAPSHOT_VERSION,
    contractFingerprint: expectedFingerprint,
    mounted: candidate.mounted,
    player: { ...candidate.player },
    wheel: { ...candidate.wheel },
    headingRadians: wrapFlowFestEucAngle(candidate.headingRadians),
    batteryPercent: candidate.batteryPercent,
    odometerMeters: candidate.odometerMeters,
  };
}

export function mobilityDynamicsFromSnapshot(
  snapshot: FlowFestMobilitySnapshot
): FlowFestElectricUnicycleDynamics {
  return createFlowFestElectricUnicycleDynamics({
    headingRadians: snapshot.headingRadians,
    batteryPercent: snapshot.batteryPercent,
    odometerMeters: snapshot.odometerMeters,
  });
}

export function createFlowFestMobilityState() {
  let snapshot = $state<FlowFestMobilitySnapshot | null>(null);
  let revision = $state(0);
  let hydrated = $state(false);
  let runtime = $state<FlowFestMobilityRuntimeUpdate>({
    mounted: true,
    player: { x: 340, z: -20 },
    wheel: { x: 340, z: -20 },
    dynamics: createFlowFestElectricUnicycleDynamics(),
    input: EMPTY_INPUT,
    parkedColliderActive: false,
    distanceToWheelMeters: 0,
    canMount: false,
    canDismount: true,
    interactionMessage: "Park wheel",
    gamepadConnected: false,
    collisionLimited: false,
    onFoot: { speedMetersPerSecond: 0, sprinting: false },
  });
  let persistenceTimer: ReturnType<typeof setTimeout> | null = null;
  let pageHideAttached = false;
  let persistenceKey = FLOW_FEST_MOBILITY_SESSION_KEY;
  let hydrationTarget: FlowFestMobilityPoint | null = null;

  function persistNow(): void {
    if (!snapshot || typeof localStorage === "undefined") return;
    if (persistenceTimer) clearTimeout(persistenceTimer);
    persistenceTimer = null;
    localStorage.setItem(
      persistenceKey,
      JSON.stringify($state.snapshot(snapshot))
    );
  }

  function handlePageHide(): void {
    persistNow();
  }

  function persistSoon(): void {
    if (!snapshot || typeof localStorage === "undefined") return;
    if (persistenceTimer) clearTimeout(persistenceTimer);
    persistenceTimer = setTimeout(() => {
      persistNow();
    }, 250);
  }

  function hydrate(
    contractFingerprint: string,
    spawn: FlowFestMobilityPoint,
    headingRadians: number,
    storageKey = FLOW_FEST_MOBILITY_SESSION_KEY
  ): void {
    persistenceKey = storageKey;
    let restored: FlowFestMobilitySnapshot | null = null;
    if (typeof localStorage !== "undefined") {
      const serialized = localStorage.getItem(persistenceKey);
      if (serialized) {
        try {
          restored = restoreFlowFestMobilitySnapshot(
            JSON.parse(serialized),
            contractFingerprint
          );
        } catch {
          restored = null;
        }
      }
      if (!restored) localStorage.removeItem(persistenceKey);
    }
    snapshot =
      restored ??
      createFreshFlowFestMobilitySnapshot(
        contractFingerprint,
        spawn,
        headingRadians
      );
    hydrationTarget = { ...snapshot.player };
    hydrated = true;
    if (!pageHideAttached && typeof window !== "undefined") {
      window.addEventListener("pagehide", handlePageHide);
      pageHideAttached = true;
    }
    revision += 1;
    persistSoon();
  }

  function reset(
    contractFingerprint: string,
    spawn: FlowFestMobilityPoint,
    headingRadians: number
  ): void {
    snapshot = createFreshFlowFestMobilitySnapshot(
      contractFingerprint,
      spawn,
      headingRadians
    );
    hydrationTarget = { ...snapshot.player };
    revision += 1;
    persistSoon();
  }

  function applyRuntime(update: FlowFestMobilityRuntimeUpdate): void {
    runtime = update;
    if (!snapshot) return;
    if (hydrationTarget) {
      const hydrationError = Math.hypot(
        update.player.x - hydrationTarget.x,
        update.player.z - hydrationTarget.z
      );
      if (hydrationError > 0.35) return;
      hydrationTarget = null;
    }
    snapshot = {
      ...snapshot,
      mounted: update.mounted,
      player: { ...update.player },
      wheel: { ...update.wheel },
      headingRadians: update.dynamics.headingRadians,
      batteryPercent: update.dynamics.batteryPercent,
      odometerMeters: update.dynamics.odometerMeters,
    };
    persistSoon();
  }

  function destroy(): void {
    persistNow();
    if (pageHideAttached && typeof window !== "undefined") {
      window.removeEventListener("pagehide", handlePageHide);
    }
    pageHideAttached = false;
  }

  return {
    get snapshot() {
      return snapshot;
    },
    get revision() {
      return revision;
    },
    get hydrated() {
      return hydrated;
    },
    get runtime() {
      return runtime;
    },
    get hydrating() {
      return hydrationTarget !== null;
    },
    hydrate,
    reset,
    applyRuntime,
    destroy,
  };
}

export type FlowFestMobilityState = ReturnType<
  typeof createFlowFestMobilityState
>;
