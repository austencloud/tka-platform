import { BufferGeometry, Float32BufferAttribute } from "three";

interface PlatePoint {
  x: number;
  z: number;
  top: number;
  bottom: number;
}

const RIM: PlatePoint[] = [
  { x: 0.96, z: 0.04, top: 0.34, bottom: -0.42 },
  { x: 0.78, z: 0.56, top: 0.48, bottom: -0.46 },
  { x: 0.34, z: 0.83, top: 0.41, bottom: -0.5 },
  { x: -0.16, z: 0.92, top: 0.28, bottom: -0.44 },
  { x: -0.61, z: 0.67, top: 0.44, bottom: -0.49 },
  { x: -0.9, z: 0.26, top: 0.36, bottom: -0.41 },
  { x: -0.82, z: -0.24, top: 0.5, bottom: -0.48 },
  { x: -0.52, z: -0.72, top: 0.31, bottom: -0.45 },
  { x: -0.04, z: -0.91, top: 0.46, bottom: -0.51 },
  { x: 0.39, z: -0.76, top: 0.35, bottom: -0.43 },
  { x: 0.76, z: -0.47, top: 0.47, bottom: -0.49 },
];

function pushTriangle(
  positions: number[],
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  c: readonly [number, number, number]
): void {
  positions.push(...a, ...b, ...c);
}

/** One shared fractured plate replaces the flat boxes previously scattered across Ember. */
export function createEmberSurfacePlateGeometry(): BufferGeometry {
  const positions: number[] = [];
  const topCenter = [0.03, 0.42, -0.04] as const;
  const bottomCenter = [-0.02, -0.47, 0.02] as const;

  for (let index = 0; index < RIM.length; index += 1) {
    const current = RIM[index]!;
    const next = RIM[(index + 1) % RIM.length]!;
    const topCurrent = [current.x, current.top, current.z] as const;
    const topNext = [next.x, next.top, next.z] as const;
    const bottomCurrent = [
      current.x * 0.88,
      current.bottom,
      current.z * 0.88,
    ] as const;
    const bottomNext = [next.x * 0.88, next.bottom, next.z * 0.88] as const;

    pushTriangle(positions, topCenter, topNext, topCurrent);
    pushTriangle(positions, bottomCenter, bottomCurrent, bottomNext);
    pushTriangle(positions, topCurrent, topNext, bottomCurrent);
    pushTriangle(positions, topNext, bottomNext, bottomCurrent);
  }

  const geometry = new BufferGeometry();
  geometry.name = "Ember_Jagged_Surface_Plate";
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
