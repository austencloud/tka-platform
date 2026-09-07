import {
  createFlowFestElectricUnicycleDynamics,
  wrapFlowFestEucAngle,
  type FlowFestElectricUnicycleDynamics,
  type FlowFestElectricUnicycleInput,
} from "../domain/flow-fest-electric-unicycle";
import {
  createFlowFestCarDynamics,
  type FlowFestCarDynamics,
} from "../domain/flow-fest-car";
import type { FlowFestGroundVehicleInput } from "../domain/flow-fest-ground-vehicle";
import {
  flowFestParkedCarPaintCount,
  FLOW_FEST_PARKED_CAR_MODELS,
} from "../../../../routes/test/flow-fest-sim/flow-fest-parked-car-catalog";

export const FLOW_FEST_MOBILITY_SESSION_KEY =
  "flow-fest-sim:electric-unicycle:v1";
/**
 * Version 2 adds the car. A version-1 snapshot has no car to put the player
 * in, so it is discarded and the session starts fresh from its spawn.
 */
export const FLOW_FEST_MOBILITY_SNAPSHOT_VERSION = 2 as const;

export interface FlowFestMobilityPoint {
  x: number;
  z: number;
}

/**
 * The car the player arrived in. While `driving`, `player` and `wheel` ride
 * with it; once parked it stays where it was left.
 */
export interface FlowFestMobilityCarSnapshot {
  modelId: string;
  paintIndex: number;
  x: number;
  z: number;
  headingRadians: number;
  driving: boolean;
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
  car: FlowFestMobilityCarSnapshot | null;
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

export interface FlowFestMobilityCarRuntime {
  modelId: string;
  paintIndex: number;
  driving: boolean;
  position: FlowFestMobilityPoint;
  dynamics: FlowFestCarDynamics;
  input: FlowFestGroundVehicleInput;
  distanceToDoorMeters: number;
  canBoard: boolean;
  canExit: boolean;
  collisionLimited: boolean;
  /** Set while the drive refuses to leave the surveyed square. */
  edgeMessage: string | null;
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
  /** Omitted means unchanged; null means there is no car in this session. */
  car?: FlowFestMobilityCarRuntime | null;
}

export interface FlowFestMobilityFreshOptions {
  car?: { modelId: string; paintIndex: number } | null;
  /** Start in the driver's seat rather than beside the car. */
  driving?: boolean;
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
  headingRadians: number,
  options: FlowFestMobilityFreshOptions = {}
): FlowFestMobilitySnapshot {
  const heading = wrapFlowFestEucAngle(headingRadians);
  return {
    version: FLOW_FEST_MOBILITY_SNAPSHOT_VERSION,
    contractFingerprint,
    // Without a car the session begins on the wheel, as it always has. With
    // one, the wheel is cargo until the player gets out.
    mounted: !options.car,
    player: { ...spawn },
    wheel: { ...spawn },
    headingRadians: heading,
    batteryPercent: 100,
    odometerMeters: 0,
    car: options.car
      ? {
          modelId: options.car.modelId,
          paintIndex: options.car.paintIndex,
          x: spawn.x,
          z: spawn.z,
          headingRadians: heading,
          driving: Boolean(options.driving),
        }
      : null,
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

function isFiniteHeading(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= Math.PI * 8
  );
}

/** Undefined marks a malformed car; null is the honest "no car" value. */
function restoreCarSnapshot(
  value: unknown
): FlowFestMobilityCarSnapshot | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== "object") return undefined;
  const car = value as Record<string, unknown>;
  const model = FLOW_FEST_PARKED_CAR_MODELS.find(
    (entry) => entry.id === car.modelId
  );
  if (
    !model ||
    typeof car.paintIndex !== "number" ||
    !Number.isInteger(car.paintIndex) ||
    car.paintIndex < 0 ||
    car.paintIndex >= flowFestParkedCarPaintCount(model) ||
    !isFinitePoint({ x: car.x, z: car.z }) ||
    !isFiniteHeading(car.headingRadians) ||
    typeof car.driving !== "boolean"
  ) {
    return undefined;
  }
  return {
    modelId: model.id,
    paintIndex: car.paintIndex,
    x: car.x as number,
    z: car.z as number,
    headingRadians: wrapFlowFestEucAngle(car.headingRadians),
    driving: car.driving,
  };
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
    !isFiniteHeading(candidate.headingRadians) ||
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
  const car = restoreCarSnapshot(candidate.car);
  if (car === undefined) return null;
  // Nobody rides the wheel from the driver's seat.
  if (car?.driving && candidate.mounted) return null;

  return {
    version: FLOW_FEST_MOBILITY_SNAPSHOT_VERSION,
    contractFingerprint: expectedFingerprint,
    mounted: candidate.mounted,
    player: { ...candidate.player },
    wheel: { ...candidate.wheel },
    headingRadians: wrapFlowFestEucAngle(candidate.headingRadians),
    batteryPercent: candidate.batteryPercent,
    odometerMeters: candidate.odometerMeters,
    car,
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

/** A restored car is always stationary; only its pose survives a reload. */
export function mobilityCarDynamicsFromSnapshot(
  car: FlowFestMobilityCarSnapshot
): FlowFestCarDynamics {
  return createFlowFestCarDynamics({ headingRadians: car.headingRadians });
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
    car: null,
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
    storageKey = FLOW_FEST_MOBILITY_SESSION_KEY,
    options: FlowFestMobilityFreshOptions = {}
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
        headingRadians,
        options
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
    headingRadians: number,
    options: FlowFestMobilityFreshOptions = {}
  ): void {
    snapshot = createFreshFlowFestMobilitySnapshot(
      contractFingerprint,
      spawn,
      headingRadians,
      options
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
    const car =
      update.car === undefined
        ? snapshot.car
        : update.car === null
          ? null
          : {
              modelId: update.car.modelId,
              paintIndex: update.car.paintIndex,
              x: update.car.position.x,
              z: update.car.position.z,
              headingRadians: update.car.dynamics.headingRadians,
              driving: update.car.driving,
            };
    snapshot = {
      ...snapshot,
      mounted: update.mounted,
      player: { ...update.player },
      wheel: { ...update.wheel },
      headingRadians: update.dynamics.headingRadians,
      batteryPercent: update.dynamics.batteryPercent,
      odometerMeters: update.dynamics.odometerMeters,
      car,
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
