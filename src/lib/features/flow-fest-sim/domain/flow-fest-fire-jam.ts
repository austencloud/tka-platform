export const FLOW_FEST_FIRE_JAM_CONTRACT = {
  performanceFloorRadiusMeters: 8.4,
  joinRadiusMeters: 9.6,
  wheelParkingRadiusMeters: 12.5,
  responseRadiusMeters: 52,
} as const;

export interface FlowFestFireJamLayout {
  fireCenter: { x: number; z: number };
  ledCircleCenter: { x: number; z: number };
}

export type FlowFestFireJamState = "not-started" | "active" | "completed";

export interface FlowFestFireJamObservation {
  distanceMeters: number;
  proximity: number;
  wheelMustPark: boolean;
  canJoin: boolean;
  responseIntensity: number;
}

export interface FlowFestFireJamAudioMix {
  fire: number;
  led: number;
  crowd: number;
  master: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function observeFlowFestFireJam(
  layout: FlowFestFireJamLayout,
  player: { x: number; z: number },
  mounted: boolean,
  state: FlowFestFireJamState
): FlowFestFireJamObservation {
  const distanceMeters = Math.hypot(
    player.x - layout.fireCenter.x,
    player.z - layout.fireCenter.z
  );
  const proximity =
    1 -
    smoothstep(
      FLOW_FEST_FIRE_JAM_CONTRACT.joinRadiusMeters,
      FLOW_FEST_FIRE_JAM_CONTRACT.responseRadiusMeters,
      distanceMeters
    );
  const insideJoinRadius =
    distanceMeters <= FLOW_FEST_FIRE_JAM_CONTRACT.joinRadiusMeters;
  const performanceBoost =
    state === "active" ? 0.68 : state === "completed" ? 0.34 : 0;

  return {
    distanceMeters,
    proximity,
    wheelMustPark:
      mounted &&
      distanceMeters <= FLOW_FEST_FIRE_JAM_CONTRACT.wheelParkingRadiusMeters,
    canJoin: state === "not-started" && insideJoinRadius && !mounted,
    responseIntensity: clamp01(proximity * 0.32 + performanceBoost),
  };
}

export function computeFlowFestFireJamAudioMix(
  layout: FlowFestFireJamLayout,
  player: { x: number; z: number },
  state: FlowFestFireJamState,
  masterVolume: number
): FlowFestFireJamAudioMix {
  const fireDistance = Math.hypot(
    player.x - layout.fireCenter.x,
    player.z - layout.fireCenter.z
  );
  const ledDistance = Math.hypot(
    player.x - layout.ledCircleCenter.x,
    player.z - layout.ledCircleCenter.z
  );
  const fire =
    1 -
    smoothstep(
      FLOW_FEST_FIRE_JAM_CONTRACT.joinRadiusMeters,
      FLOW_FEST_FIRE_JAM_CONTRACT.responseRadiusMeters,
      fireDistance
    );
  const led =
    1 -
    smoothstep(
      8,
      FLOW_FEST_FIRE_JAM_CONTRACT.responseRadiusMeters,
      ledDistance
    );
  const stateGain = state === "active" ? 1 : state === "completed" ? 0.72 : 0.5;

  return {
    fire: clamp01(fire * stateGain),
    led: clamp01(led * (state === "active" ? 0.82 : 0.5)),
    crowd: clamp01(Math.max(fire, led) * (state === "active" ? 0.64 : 0.28)),
    master: clamp01(masterVolume),
  };
}
