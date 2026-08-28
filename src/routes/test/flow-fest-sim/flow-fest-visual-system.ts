import type { FlowFestMoment } from "$lib/features/flow-fest-sim/state/flow-fest-progress";
import type { FlowFestBranchId } from "../flow-fest-graybox/flow-fest-runtime-contract";

export type FlowFestGate3MomentId = "day" | "dusk" | "night";

export interface FlowFestVisualProfile {
  id: FlowFestMoment;
  label: string;
  clockLabel: string;
  sky: {
    top: string;
    mid: string;
    bottom: string;
  };
  sun: {
    enabled: boolean;
    direction: [number, number, number];
    color: string;
    intensity: number;
    angularDiameterDegrees: number;
    glowScale: number;
    glowOpacity: number;
  };
  fill: {
    color: string;
    intensity: number;
  };
  hemisphere: {
    sky: string;
    ground: string;
    intensity: number;
  };
  ambient: {
    color: string;
    intensity: number;
  };
  fog: {
    color: string;
    density: number;
  };
  grade: {
    terrainTint: string;
    foliageTint: string;
    barkTint: string;
    exposure: number;
  };
}

export interface FlowFestGate3ReviewRequest {
  enabled: boolean;
  cameraId: string | null;
  momentId: FlowFestGate3MomentId | null;
  moment: FlowFestMoment | null;
  branch: FlowFestBranchId;
}

export const FLOW_FEST_GATE3_CAMERA_IDS = [
  "lower-gate",
  "lower-level",
  "upper-parking",
  "middle-earth",
  "night-composition",
] as const;

export const FLOW_FEST_GATE3_MOMENTS = ["day", "dusk", "night"] as const;

export const FLOW_FEST_GATE3_VISUAL_HIERARCHY = [
  "Measured landform and tier edges",
  "Registered roads and traced connectors",
  "Temporary camps and parking",
  "People, tasks, and route light",
  "The fictional fire-jam perimeter and separate LED circle",
] as const;

const PROFILES: Record<FlowFestMoment, FlowFestVisualProfile> = {
  afternoon: {
    id: "afternoon",
    label: "Thursday afternoon",
    clockLabel: "THU · 4:37 PM",
    sky: { top: "#4f83a3", mid: "#8eabb2", bottom: "#dcc89d" },
    sun: {
      enabled: true,
      direction: [-0.58, 0.82, -0.42],
      color: "#fff0c6",
      intensity: 2.7,
      angularDiameterDegrees: 0.82,
      glowScale: 7.5,
      glowOpacity: 0.16,
    },
    fill: { color: "#8fb0a1", intensity: 0.34 },
    hemisphere: { sky: "#c9e2e8", ground: "#334b35", intensity: 0.78 },
    ambient: { color: "#b9c9b7", intensity: 0.08 },
    fog: { color: "#789486", density: 0.00072 },
    grade: {
      terrainTint: "#a8bf8a",
      foliageTint: "#a6c78a",
      barkTint: "#d0a477",
      exposure: 1.02,
    },
  },
  "golden-hour": {
    id: "golden-hour",
    label: "Thursday dusk",
    clockLabel: "THU · 7:48 PM",
    sky: { top: "#27496c", mid: "#786f82", bottom: "#dc8f61" },
    sun: {
      enabled: true,
      direction: [-0.76, 0.22, -0.61],
      color: "#ffc177",
      intensity: 2.15,
      angularDiameterDegrees: 0.9,
      glowScale: 9.5,
      glowOpacity: 0.22,
    },
    fill: { color: "#718c91", intensity: 0.31 },
    hemisphere: { sky: "#a8b4ba", ground: "#3c412f", intensity: 0.62 },
    ambient: { color: "#aa9c84", intensity: 0.08 },
    fog: { color: "#765d52", density: 0.00094 },
    grade: {
      terrainTint: "#d1c39a",
      foliageTint: "#d1c998",
      barkTint: "#d9ad83",
      exposure: 1.05,
    },
  },
  night: {
    id: "night",
    label: "First night",
    clockLabel: "FRI · 2:13 AM",
    sky: { top: "#0b1b38", mid: "#32486c", bottom: "#6a4863" },
    sun: {
      enabled: false,
      direction: [0.42, 0.72, 0.36],
      color: "#9cb8e2",
      intensity: 0.52,
      angularDiameterDegrees: 0.7,
      glowScale: 8,
      glowOpacity: 0,
    },
    fill: { color: "#405f79", intensity: 0.22 },
    hemisphere: { sky: "#61789c", ground: "#10191b", intensity: 0.34 },
    ambient: { color: "#26394b", intensity: 0.06 },
    fog: { color: "#111d2c", density: 0.00124 },
    grade: {
      terrainTint: "#8d93a4",
      foliageTint: "#9bac9f",
      barkTint: "#a18a80",
      exposure: 1.08,
    },
  },
  dawn: {
    id: "dawn",
    label: "Friday dawn",
    clockLabel: "FRI · 8:06 AM",
    sky: { top: "#63839e", mid: "#c8958d", bottom: "#efd0a4" },
    sun: {
      enabled: true,
      direction: [0.62, 0.34, -0.7],
      color: "#ffd4a0",
      intensity: 1.45,
      angularDiameterDegrees: 0.82,
      glowScale: 8.5,
      glowOpacity: 0.18,
    },
    fill: { color: "#8ea7b2", intensity: 0.28 },
    hemisphere: { sky: "#c6c8c7", ground: "#3c493d", intensity: 0.54 },
    ambient: { color: "#b6afa2", intensity: 0.08 },
    fog: { color: "#9a8d88", density: 0.0009 },
    grade: {
      terrainTint: "#d1ccb2",
      foliageTint: "#c5d1a8",
      barkTint: "#d4c0a9",
      exposure: 1.03,
    },
  },
};

const REVIEW_MOMENT_TO_SIMULATION: Record<
  FlowFestGate3MomentId,
  FlowFestMoment
> = {
  day: "afternoon",
  dusk: "golden-hour",
  night: "night",
};

export function getFlowFestVisualProfile(
  moment: FlowFestMoment
): FlowFestVisualProfile {
  return PROFILES[moment];
}

export function parseFlowFestGate3ReviewRequest(
  query: URLSearchParams
): FlowFestGate3ReviewRequest {
  const enabled = query.get("gate3") === "1";
  const requestedMoment = query.get("moment");
  const momentId = FLOW_FEST_GATE3_MOMENTS.includes(
    requestedMoment as FlowFestGate3MomentId
  )
    ? (requestedMoment as FlowFestGate3MomentId)
    : null;
  const branchValue = query.get("branch");
  const branch: FlowFestBranchId =
    branchValue === "upper-tent" || branchValue === "car-camp"
      ? branchValue
      : "lower-tent";

  return {
    enabled,
    cameraId: enabled ? query.get("camera") : null,
    momentId: enabled ? momentId : null,
    moment: enabled && momentId ? REVIEW_MOMENT_TO_SIMULATION[momentId] : null,
    branch,
  };
}
