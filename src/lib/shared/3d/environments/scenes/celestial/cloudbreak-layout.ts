import type { SkySunConfig } from "../../domain/models/environment-models";

import layoutSource from "../../../../../../../scripts/seraphic-vault-cloudbreak-layout.json";

interface CloudbreakLayout {
  revision: string;
  approach: {
    surfaceY: number;
    wornBandWidth: number;
  };
  rearThreshold: {
    centerXZ: [number, number];
    outerWidth: number;
    outerHeight: number;
    openingWidth: number;
    openingHeight: number;
    depth: number;
  };
  lagoon: {
    surfaceY: number;
    outlineXZ: Array<[number, number]>;
    overflowXZ: [number, number];
  };
  sun: {
    position: [number, number, number];
    lightPosition: [number, number, number];
    angularDiameterDegrees: number;
  };
  cameraPresets: {
    reverse: {
      position: [number, number, number];
      target: [number, number, number];
    };
    plan: {
      position: [number, number, number];
      target: [number, number, number];
      fovDegrees: number;
    };
  };
}

export type CloudbreakAssemblyView =
  | "runtime"
  | "front"
  | "rear"
  | "plan"
  | "trees"
  | "stone";

export const CLOUDBREAK_LAYOUT = layoutSource as unknown as CloudbreakLayout;

function normalizeDirection(
  position: [number, number, number]
): [number, number, number] {
  const length = Math.hypot(...position);
  return position.map((coordinate) => coordinate / length) as [
    number,
    number,
    number,
  ];
}

export const CLOUDBREAK_SKY_SUN: SkySunConfig = {
  enabled: true,
  direction: normalizeDirection(CLOUDBREAK_LAYOUT.sun.position),
  angularDiameterDegrees: CLOUDBREAK_LAYOUT.sun.angularDiameterDegrees,
  color: "#fff4d2",
  opacity: 0.98,
  glowScale: 18,
  glowOpacity: 0.32,
};

const lagoonOutline = CLOUDBREAK_LAYOUT.lagoon.outlineXZ;
const lagoonMinX = Math.min(...lagoonOutline.map(([x]) => x));
const lagoonMaxX = Math.max(...lagoonOutline.map(([x]) => x));
const lagoonMinZ = Math.min(...lagoonOutline.map(([, z]) => z));
const lagoonMaxZ = Math.max(...lagoonOutline.map(([, z]) => z));

export const CLOUDBREAK_LAGOON = {
  outline: lagoonOutline,
  center: [(lagoonMinX + lagoonMaxX) / 2, (lagoonMinZ + lagoonMaxZ) / 2] as [
    number,
    number,
  ],
  size: [lagoonMaxX - lagoonMinX, lagoonMaxZ - lagoonMinZ] as [number, number],
};

export const CLOUDBREAK_LAGOON_LOCAL_OUTLINE = lagoonOutline.map(
  ([x, z]) =>
    [x - CLOUDBREAK_LAGOON.center[0], -(z - CLOUDBREAK_LAGOON.center[1])] as [
      number,
      number,
    ]
);
