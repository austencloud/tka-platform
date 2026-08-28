import type {
  FlowFestFireJamLayout,
  FlowFestFireJamState,
} from "./flow-fest-fire-jam";

export type FlowFestSiteAudioLayer =
  | "arrival-field"
  | "woodland"
  | "camp"
  | "fire-circle"
  | "led-circle";

export interface FlowFestSiteAudioLayout extends FlowFestFireJamLayout {
  gateCenter: { x: number; z: number };
  campCenter: { x: number; z: number };
}

export interface FlowFestSiteAudioMix {
  arrival: number;
  woodland: number;
  camp: number;
  fire: number;
  led: number;
  crowd: number;
  master: number;
  dominantLayer: FlowFestSiteAudioLayer;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function proximity(
  player: { x: number; z: number },
  target: { x: number; z: number },
  innerMeters: number,
  outerMeters: number
): number {
  const distance = Math.hypot(player.x - target.x, player.z - target.z);
  return 1 - smoothstep(innerMeters, outerMeters, distance);
}

export function computeFlowFestSiteAudioMix(
  layout: FlowFestSiteAudioLayout,
  player: { x: number; z: number },
  state: FlowFestFireJamState,
  masterVolume: number
): FlowFestSiteAudioMix {
  const arrival = proximity(player, layout.gateCenter, 8, 72);
  const camp = proximity(player, layout.campCenter, 9, 54);
  const fireProximity = proximity(player, layout.fireCenter, 9.6, 56);
  const ledProximity = proximity(player, layout.ledCircleCenter, 8, 52);
  const festivalProximity = Math.max(fireProximity, ledProximity);
  const stateGain = state === "active" ? 1 : state === "completed" ? 0.72 : 0.5;
  const woodland = clamp01(
    0.78 - Math.max(arrival * 0.46, camp * 0.38, festivalProximity * 0.62)
  );
  const channels = {
    arrival: clamp01(arrival * (1 - festivalProximity * 0.7)),
    woodland,
    camp: clamp01(camp * (1 - festivalProximity * 0.58)),
    fire: clamp01(fireProximity * stateGain),
    led: clamp01(ledProximity * (state === "active" ? 0.82 : 0.5)),
    crowd: clamp01(
      Math.max(fireProximity, ledProximity) * (state === "active" ? 0.64 : 0.28)
    ),
  };
  const dominantLayer = (
    [
      ["arrival-field", channels.arrival],
      ["woodland", channels.woodland],
      ["camp", channels.camp],
      ["fire-circle", channels.fire],
      ["led-circle", channels.led],
    ] as const
  ).reduce((winner, candidate) =>
    candidate[1] > winner[1] ? candidate : winner
  )[0];

  return {
    ...channels,
    master: clamp01(masterVolume),
    dominantLayer,
  };
}
