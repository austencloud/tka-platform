import {
  DoubleSide,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from "three";

interface GridMaterialOptions {
  opacity?: number;
  doubleSided?: boolean;
  depthWrite?: boolean;
}

const planeGeometries = new Map<number, PlaneGeometry>();
const ringGeometries = new Map<string, RingGeometry>();
const markerGeometries = new Map<string, SphereGeometry>();
const materials = new Map<string, MeshBasicMaterial>();
const orientationHelperArgs = new Map<
  number,
  readonly GridOrientationArrowArgs[]
>();

export type GridOrientationArrowArgs = [
  direction: Vector3,
  origin: Vector3,
  length: number,
  color: number,
  headLength: number,
  headWidth: number,
];

const GRID_ORIGIN = new Vector3(0, 0, 0);
const GRID_AXES = [
  { direction: new Vector3(1, 0, 0), color: 0xff4444 },
  { direction: new Vector3(0, 1, 0), color: 0x44ff44 },
  { direction: new Vector3(0, 0, 1), color: 0x4444ff },
] as const;

/**
 * Three's ArrowHelper constructor requires Vector3 instances. Plain tuples are
 * accepted without an exception but produce undefined positions and NaN
 * rotations, leaving the helper silently absent from the rendered scene.
 */
export function getGridOrientationHelperArgs(
  size: number
): readonly GridOrientationArrowArgs[] {
  let args = orientationHelperArgs.get(size);
  if (!args) {
    args = GRID_AXES.map(
      ({ direction, color }): GridOrientationArrowArgs => [
        direction,
        GRID_ORIGIN,
        size * 1.2,
        color,
        0.06,
        0.03,
      ]
    );
    orientationHelperArgs.set(size, args);
  }
  return args;
}

export function getGridPlaneGeometry(size: number): PlaneGeometry {
  let geometry = planeGeometries.get(size);
  if (!geometry) {
    geometry = new PlaneGeometry(size * 2, size * 2);
    planeGeometries.set(size, geometry);
  }
  return geometry;
}

export function getGridRingGeometry(
  radius: number,
  halfThickness: number,
  segments: number
): RingGeometry {
  const key = `${radius}:${halfThickness}:${segments}`;
  let geometry = ringGeometries.get(key);
  if (!geometry) {
    geometry = new RingGeometry(
      radius - halfThickness,
      radius + halfThickness,
      segments
    );
    ringGeometries.set(key, geometry);
  }
  return geometry;
}

export function getGridMarkerGeometry(
  radius: number,
  segments: number
): SphereGeometry {
  const key = `${radius}:${segments}`;
  let geometry = markerGeometries.get(key);
  if (!geometry) {
    geometry = new SphereGeometry(radius, segments, segments);
    markerGeometries.set(key, geometry);
  }
  return geometry;
}

export function getGridMaterial(
  color: string | number,
  options: GridMaterialOptions = {}
): MeshBasicMaterial {
  const opacity = options.opacity ?? 1;
  const doubleSided = options.doubleSided ?? false;
  const depthWrite = options.depthWrite ?? true;
  const key = `${color}:${opacity}:${doubleSided}:${depthWrite}`;
  let material = materials.get(key);
  if (!material) {
    material = new MeshBasicMaterial({
      color,
      opacity,
      transparent: opacity < 1,
      ...(doubleSided ? { side: DoubleSide } : {}),
      depthWrite,
    });
    materials.set(key, material);
  }
  return material;
}

export function getGridRenderResourceCounts(): {
  geometries: number;
  materials: number;
} {
  return {
    geometries:
      planeGeometries.size + ringGeometries.size + markerGeometries.size,
    materials: materials.size,
  };
}
