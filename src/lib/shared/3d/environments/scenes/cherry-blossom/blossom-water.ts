import plan from "./blossom-plan.json";

type PlanPoint = [number, number];

// Both water tiers share the builder's closed pond footprint.
const worldOutline: PlanPoint[] = plan.water.outline.map(([x, y]) => [
  -x!,
  -y!,
]);
const minX = Math.min(...worldOutline.map(([x]) => x));
const maxX = Math.max(...worldOutline.map(([x]) => x));
const minY = Math.min(...worldOutline.map(([, y]) => y));
const maxY = Math.max(...worldOutline.map(([, y]) => y));
const centerX = (minX + maxX) / 2;
const centerY = (minY + maxY) / 2;
const localOutline: PlanPoint[] = worldOutline.map(([x, y]) => [
  x - centerX,
  y - centerY,
]);

export function getBlossomRiverSurfaceElevation(): number {
  return plan.water.surfaceElevation;
}
export function getBlossomRiverBedDepth(): number {
  return plan.water.bedDepth;
}
export function getBlossomRiverShoreFade(): number {
  return plan.water.shoreFadeMetres;
}
export function getBlossomRiverCenterline(): PlanPoint[] {
  return plan.water.centerline.map(([x, y]) => [-x!, -y!]);
}
export function getBlossomRiverOutline(): PlanPoint[] {
  return localOutline.map(([x, y]) => [x, y]);
}
export function getBlossomRiverShoreline(): PlanPoint[] {
  // The shader carries 32 segments; preserve both ends of each curved bank.
  const half = Math.floor(localOutline.length / 2);
  return Array.from({ length: 32 }, (_, index) => {
    const station =
      index < 16
        ? Math.round((index * half) / 15)
        : half + Math.round(((index - 15) * (localOutline.length - half)) / 17);
    const [x, y] = localOutline[Math.min(station, localOutline.length - 1)]!;
    return [x, y];
  });
}
export function getBlossomRiverBounds(): {
  width: number;
  depth: number;
  centerX: number;
  centerZ: number;
} {
  return { width: maxX - minX, depth: maxY - minY, centerX, centerZ: -centerY };
}
