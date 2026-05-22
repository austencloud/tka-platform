/**
 * Shared seabed terrain height — used by both ProceduralSeabed (CPU geometry)
 * and OceanScene (object placement). Single source of truth = no JS/GLSL drift.
 *
 * Height budget (all values in world units, applied AFTER stageFade):
 *   Dunes (broad):   ~1.4  (0.05 freq, 5-octave FBM × 2.0)
 *   Ridges (medium): ~0.6  (0.25 freq, 4-octave FBM × 0.8)
 *   Ripples (fine):  ~0.15 (1.0 freq, 3-octave FBM × 0.2)
 *   Channels:       −0.4   (carved valleys via abs-noise)
 *   Total range:     ≈ 0 – 2.2 units (before mounding)
 */

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

function fbm(px: number, py: number, octaves: number): number {
  let v = 0,
    a = 0.5,
    x = px,
    y = py;
  for (let i = 0; i < octaves; i++) {
    v += a * noise2d(x, y);
    x *= 2;
    y *= 2;
    a *= 0.5;
  }
  return v;
}

function rawHeight(wx: number, wz: number): number {
  // Layer 1: broad dunes — long rolling features (freq 0.05, 5 octaves)
  const dunes = fbm(wx * 0.05, wz * 0.05, 5) * 2.0;

  // Layer 2: medium ridges — rocky substrate texture (freq 0.25, 4 octaves, offset seed)
  const ridges = fbm(wx * 0.25 + 5.3, wz * 0.25 + 5.3, 4) * 0.8;

  // Layer 3: fine sand ripples (freq 1.0, 3 octaves, high-freq detail)
  const ripples = fbm(wx * 1.0 + 13.7, wz * 1.0 + 13.7, 3) * 0.2;

  // Layer 4: carved channels — abs-noise creates valley-like depressions
  // Subtractive: produces narrow grooves between dune crests
  const channelNoise = noise2d(wx * 0.12 + 7.1, wz * 0.12 + 7.1);
  const channels = (1.0 - Math.abs(channelNoise * 2.0 - 1.0)) * 0.4;

  return dunes + ridges + ripples - channels;
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

// ── Sediment Mounding ─────────────────────────────────────────────────
// Objects placed on the base terrain. Geometry then raised around them
// via mounding — breaks the "placed on top" look, simulates sediment
// accumulation at object bases.

export interface MoundSource {
  x: number;
  z: number;
  radius: number;
  height: number;
}

let activeMounds: MoundSource[] = [];

export function setMoundSources(mounds: MoundSource[]): void {
  activeMounds = mounds;
}

export function terrainHeightWithMounds(
  wx: number,
  wz: number,
  stageRadius: number,
  clearingRadius: number,
): number {
  let h = terrainHeight(wx, wz, stageRadius, clearingRadius);

  for (let i = 0; i < activeMounds.length; i++) {
    const m = activeMounds[i]!;
    const dx = wx - m.x;
    const dz = wz - m.z;
    const distSq = dx * dx + dz * dz;
    const rSq = m.radius * m.radius;
    if (distSq >= rSq) continue;
    // Cosine falloff — smooth, no hard edges
    const t = Math.sqrt(distSq) / m.radius;
    const weight = 0.5 * (1.0 + Math.cos(Math.PI * t));
    h += m.height * weight;
  }

  return h;
}
