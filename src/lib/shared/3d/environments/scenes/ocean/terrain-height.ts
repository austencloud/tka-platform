/**
 * Shared seabed terrain height — used by both ProceduralSeabed (CPU geometry)
 * and OceanScene (object placement). Single source of truth = no JS/GLSL drift.
 */

const DISPLACEMENT_SCALE = 0.6;

function fract(v: number): number {
  return v - Math.floor(v);
}

function hash2d(px: number, py: number): number {
  let x = fract(px * 0.1031);
  let y = fract(py * 0.1031);
  let z = fract(px * 0.1031);
  const dot = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33);
  x = fract(x + dot);
  y = fract(y + dot);
  z = fract(z + dot);
  return fract((x + y) * z);
}

function noise2d(px: number, py: number): number {
  const ix = Math.floor(px),
    iy = Math.floor(py);
  let fx = px - ix,
    fy = py - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash2d(ix, iy),
    b = hash2d(ix + 1, iy);
  const c = hash2d(ix, iy + 1),
    d = hash2d(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function fbm2d(px: number, py: number): number {
  let v = 0,
    a = 0.5,
    x = px,
    y = py;
  for (let i = 0; i < 5; i++) {
    v += a * noise2d(x, y);
    x *= 2;
    y *= 2;
    a *= 0.5;
  }
  return v;
}

function rawHeight(wx: number, wz: number): number {
  const broad = fbm2d(wx * 0.15, wz * 0.15) * 0.7;
  const medium = fbm2d(wx * 0.4 + 5.3, wz * 0.4 + 5.3) * 0.2;
  const fine = fbm2d(wx * 1.2 + 13.7, wz * 1.2 + 13.7) * 0.1;
  return (broad + medium + fine) * DISPLACEMENT_SCALE;
}

export function terrainHeight(
  wx: number,
  wz: number,
  stageRadius: number,
  clearingRadius: number,
): number {
  const dist = Math.sqrt(wx * wx + wz * wz);
  const stageFade = Math.min(
    1,
    Math.max(0, (dist - stageRadius) / (clearingRadius - stageRadius)),
  );
  return rawHeight(wx, wz) * stageFade;
}

/**
 * Sample center + 4 neighbors, take max — guarantees objects sit on the
 * local high point so they never sink into valleys between vertices.
 */
export function terrainHeightForPlacement(
  wx: number,
  wz: number,
  stageRadius: number,
  clearingRadius: number,
): number {
  const eps = 0.4;
  const h0 = terrainHeight(wx, wz, stageRadius, clearingRadius);
  const h1 = terrainHeight(wx + eps, wz, stageRadius, clearingRadius);
  const h2 = terrainHeight(wx - eps, wz, stageRadius, clearingRadius);
  const h3 = terrainHeight(wx, wz + eps, stageRadius, clearingRadius);
  const h4 = terrainHeight(wx, wz - eps, stageRadius, clearingRadius);
  return Math.max(h0, h1, h2, h3, h4);
}
