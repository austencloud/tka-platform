import {
  IcosahedronGeometry,
  Vector2,
  Vector3,
  Color,
  MeshStandardMaterial,
  DoubleSide,
  TextureLoader,
  RepeatWrapping,
  SRGBColorSpace,
  type BufferGeometry,
  type Texture,
  Float32BufferAttribute,
} from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ── Seeded RNG ────────────────────────────────────────────────────────

function seededRng(seed: number): () => number {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

// ── 3D Perlin noise (deterministic, no dependencies) ──────────────────

function hash3(x: number, y: number, z: number): number {
  let h = x * 374761393 + y * 668265263 + z * 1274126177;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function noise3D(x: number, y: number, z: number): number {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z);
  const xf = fade(x - xi),
    yf = fade(y - yi),
    zf = fade(z - zi);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c000 = hash3(xi, yi, zi);
  const c100 = hash3(xi + 1, yi, zi);
  const c010 = hash3(xi, yi + 1, zi);
  const c110 = hash3(xi + 1, yi + 1, zi);
  const c001 = hash3(xi, yi, zi + 1);
  const c101 = hash3(xi + 1, yi, zi + 1);
  const c011 = hash3(xi, yi + 1, zi + 1);
  const c111 = hash3(xi + 1, yi + 1, zi + 1);

  return lerp(
    lerp(lerp(c000, c100, xf), lerp(c010, c110, xf), yf),
    lerp(lerp(c001, c101, xf), lerp(c011, c111, xf), yf),
    zf,
  );
}

// ── Adjacency table from indexed geometry ─────────────────────────────

function buildAdjacency(
  posCount: number,
  index: Uint16Array | Uint32Array,
): number[][] {
  const adj: Set<number>[] = Array.from({ length: posCount }, () => new Set());
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i]!, b = index[i + 1]!, c = index[i + 2]!;
    adj[a]!.add(b); adj[a]!.add(c);
    adj[b]!.add(a); adj[b]!.add(c);
    adj[c]!.add(a); adj[c]!.add(b);
  }
  return adj.map((s) => [...s]);
}

// ── Smooth radial scrape — gap-free by construction ──────────────────
// Inspired by gl-rock (Arneback, MIT), but uses smooth radial displacement
// instead of plane projection. Plane projection creates hard boundaries
// that produce mesh cracks; radial displacement with cosine falloff is
// mathematically continuous — same principle as the terrain heightmap
// generator that produces seamless rolling hills.

function scrape(
  centerIdx: number,
  positions: Float32Array,
  _normals: Float32Array,
  _adjacency: number[][],
  strength: number,
  radius: number,
): void {
  const cx = positions[centerIdx * 3]!;
  const cy = positions[centerIdx * 3 + 1]!;
  const cz = positions[centerIdx * 3 + 2]!;

  const vertCount = positions.length / 3;

  for (let i = 0; i < vertCount; i++) {
    const px = positions[i * 3]!;
    const py = positions[i * 3 + 1]!;
    const pz = positions[i * 3 + 2]!;

    // Distance from this vertex to the scrape center (on the surface)
    const dx = px - cx;
    const dy = py - cy;
    const dz = pz - cz;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist >= radius) continue;

    // Smooth cosine falloff — 1.0 at center, 0.0 at radius edge, no discontinuity
    const t = dist / radius;
    const weight = 0.5 * (1.0 + Math.cos(Math.PI * t));

    // Push vertex inward (toward origin) along its own radial direction
    const len = Math.sqrt(px * px + py * py + pz * pz);
    if (len < 1e-8) continue;
    const invLen = 1.0 / len;
    const displacement = strength * weight;

    positions[i * 3] = px - px * invLen * displacement;
    positions[i * 3 + 1] = py - py * invLen * displacement;
    positions[i * 3 + 2] = pz - pz * invLen * displacement;
  }
}

// ── Compute vertex normals from face normals ──────────────────────────

function recomputeNormals(
  positions: Float32Array,
  index: Uint16Array | Uint32Array,
  normals: Float32Array,
): void {
  normals.fill(0);
  const v0 = new Vector3(), v1 = new Vector3(), v2 = new Vector3();
  const e1 = new Vector3(), e2 = new Vector3(), fn = new Vector3();

  for (let i = 0; i < index.length; i += 3) {
    const a = index[i]!, b = index[i + 1]!, c = index[i + 2]!;
    v0.set(positions[a * 3]!, positions[a * 3 + 1]!, positions[a * 3 + 2]!);
    v1.set(positions[b * 3]!, positions[b * 3 + 1]!, positions[b * 3 + 2]!);
    v2.set(positions[c * 3]!, positions[c * 3 + 1]!, positions[c * 3 + 2]!);

    e1.subVectors(v1, v0);
    e2.subVectors(v2, v0);
    fn.crossVectors(e1, e2);

    normals[a * 3] = (normals[a * 3] ?? 0) + fn.x; normals[a * 3 + 1] = (normals[a * 3 + 1] ?? 0) + fn.y; normals[a * 3 + 2] = (normals[a * 3 + 2] ?? 0) + fn.z;
    normals[b * 3] = (normals[b * 3] ?? 0) + fn.x; normals[b * 3 + 1] = (normals[b * 3 + 1] ?? 0) + fn.y; normals[b * 3 + 2] = (normals[b * 3 + 2] ?? 0) + fn.z;
    normals[c * 3] = (normals[c * 3] ?? 0) + fn.x; normals[c * 3 + 1] = (normals[c * 3 + 1] ?? 0) + fn.y; normals[c * 3 + 2] = (normals[c * 3 + 2] ?? 0) + fn.z;
  }

  for (let i = 0; i < normals.length; i += 3) {
    const x = normals[i]!, y = normals[i + 1]!, z = normals[i + 2]!;
    const len = Math.sqrt(x * x + y * y + z * z);
    if (len > 1e-8) {
      normals[i] = x / len;
      normals[i + 1] = y / len;
      normals[i + 2] = z / len;
    }
  }
}

// ── Box-projected UVs for PBR texturing ───────────────────────────────

function generateTriplanarUVs(
  positions: Float32Array,
  normals: Float32Array,
): Float32Array {
  const uvs = new Float32Array((positions.length / 3) * 2);
  for (let i = 0; i < positions.length / 3; i++) {
    const px = positions[i * 3]!;
    const py = positions[i * 3 + 1]!;
    const pz = positions[i * 3 + 2]!;
    const nx = Math.abs(normals[i * 3]!);
    const ny = Math.abs(normals[i * 3 + 1]!);
    const nz = Math.abs(normals[i * 3 + 2]!);

    // Pick dominant axis for UV projection
    if (nx >= ny && nx >= nz) {
      uvs[i * 2] = pz;
      uvs[i * 2 + 1] = py;
    } else if (ny >= nx && ny >= nz) {
      uvs[i * 2] = px;
      uvs[i * 2 + 1] = pz;
    } else {
      uvs[i * 2] = px;
      uvs[i * 2 + 1] = py;
    }
  }
  return uvs;
}

// ── Rock generation (gl-rock scraping algorithm) ──────────────────────

export interface RockParams {
  seed: number;
  detail: number;
  scrapeCount: number;
  scrapeMinDist: number;
  scrapeStrength: number;
  scrapeRadius: number;
  noiseScale: number;
  noiseStrength: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

const UNDERWATER_DEFAULTS: RockParams = {
  seed: 0,
  detail: 4,
  scrapeCount: 7,
  scrapeMinDist: 0.5,
  scrapeStrength: 0.2,
  scrapeRadius: 0.6,
  noiseScale: 2.0,
  noiseStrength: 0.04,
  scaleX: 1.0,
  scaleY: 0.7,
  scaleZ: 1.0,
};

export function generateUnderwaterRock(
  params: Partial<RockParams> = {},
): BufferGeometry {
  const p = { ...UNDERWATER_DEFAULTS, ...params };
  const rng = seededRng(p.seed);

  // Start with icosahedron, merge vertices so adjacency flood-fill works
  const rawGeo = new IcosahedronGeometry(1, p.detail);
  const geo = mergeVertices(rawGeo);
  rawGeo.dispose();
  const positions = (geo.attributes.position as any).array as Float32Array;
  const index = geo.index!.array as Uint16Array | Uint32Array;

  // Compute initial normals from positions (unit sphere → normal = position)
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!, y = positions[i + 1]!, z = positions[i + 2]!;
    const len = Math.sqrt(x * x + y * y + z * z);
    normals[i] = x / len;
    normals[i + 1] = y / len;
    normals[i + 2] = z / len;
  }

  // Build adjacency table
  const adjacency = buildAdjacency(positions.length / 3, index);

  // Pick scrape centers with minimum distance constraint
  const scrapeIndices: number[] = [];
  const vertCount = positions.length / 3;

  for (let i = 0; i < p.scrapeCount; i++) {
    let attempts = 0;
    while (attempts < 200) {
      const randIdx = Math.floor(rng() * vertCount);
      const rx = positions[randIdx * 3]!;
      const ry = positions[randIdx * 3 + 1]!;
      const rz = positions[randIdx * 3 + 2]!;

      let tooClose = false;
      for (const existing of scrapeIndices) {
        const dx = rx - positions[existing * 3]!;
        const dy = ry - positions[existing * 3 + 1]!;
        const dz = rz - positions[existing * 3 + 2]!;
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < p.scrapeMinDist) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        scrapeIndices.push(randIdx);
        break;
      }
      attempts++;
    }
  }

  // Execute scrapes
  for (const idx of scrapeIndices) {
    const strength = p.scrapeStrength * (0.7 + rng() * 0.6);
    const radius = p.scrapeRadius * (0.7 + rng() * 0.6);
    scrape(idx, positions, normals, adjacency, strength, radius);
  }

  // Apply Perlin noise for micro-detail (along current normal direction)
  const seedOffset = p.seed * 73.7;
  for (let i = 0; i < vertCount; i++) {
    const px = positions[i * 3]!;
    const py = positions[i * 3 + 1]!;
    const pz = positions[i * 3 + 2]!;

    const n = noise3D(
      px * p.noiseScale + seedOffset,
      py * p.noiseScale + seedOffset + 100,
      pz * p.noiseScale + seedOffset + 200,
    ) * 2 - 1;

    const displacement = n * p.noiseStrength;
    positions[i * 3] = (px + displacement) * p.scaleX;
    positions[i * 3 + 1] = (py + displacement) * p.scaleY;
    positions[i * 3 + 2] = (pz + displacement) * p.scaleZ;
  }

  // Recompute normals after all modifications
  recomputeNormals(positions, index, normals);
  geo.setAttribute("normal", new Float32BufferAttribute(normals, 3));

  // Generate box-projected UVs for PBR texturing
  const uvs = generateTriplanarUVs(positions, normals);
  geo.setAttribute("uv", new Float32BufferAttribute(uvs, 2));

  geo.attributes.position!.needsUpdate = true;
  geo.computeBoundingSphere();
  return geo;
}

// ── Variant presets — wide shape diversity ─────────────────────────────

export interface RockVariant {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  bottomOffset: number;
  xzRadius: number;
}

const VARIANT_PRESETS: Partial<RockParams>[] = [
  // Flat slab — heavily squashed, many shallow scrapes
  { scrapeCount: 10, scrapeStrength: 0.15, scrapeRadius: 0.7, scaleY: 0.35, scaleX: 1.2, scaleZ: 1.1, noiseStrength: 0.03 },
  // Tall column — stretched vertically, few deep scrapes
  { scrapeCount: 4, scrapeStrength: 0.3, scrapeRadius: 0.5, scaleY: 1.4, scaleX: 0.7, scaleZ: 0.7, noiseStrength: 0.05 },
  // Chunky angular — moderate scrapes, asymmetric
  { scrapeCount: 7, scrapeStrength: 0.25, scrapeRadius: 0.6, scaleY: 0.8, scaleX: 1.0, scaleZ: 0.85, noiseStrength: 0.04 },
  // Rounded boulder — few gentle scrapes, near-uniform scale
  { scrapeCount: 3, scrapeStrength: 0.12, scrapeRadius: 0.8, scaleY: 0.75, scaleX: 0.95, scaleZ: 1.05, noiseStrength: 0.06 },
  // Wedge — heavily scraped one side, elongated
  { scrapeCount: 12, scrapeStrength: 0.2, scrapeRadius: 0.45, scaleY: 0.55, scaleX: 1.3, scaleZ: 0.8, noiseStrength: 0.035 },
  // Craggy peak — many small scrapes, tall and spiky
  { scrapeCount: 15, scrapeStrength: 0.18, scrapeRadius: 0.35, scaleY: 1.1, scaleX: 0.85, scaleZ: 0.9, noiseStrength: 0.05 },
];

// ── Shared texture loader (singleton) ─────────────────────────────────

let textureCache: { diffuse: Texture; normal: Texture; roughness: Texture; ao: Texture } | null = null;

function loadRockTextures(): { diffuse: Texture; normal: Texture; roughness: Texture; ao: Texture } {
  if (textureCache) return textureCache;
  const loader = new TextureLoader();
  const load = (path: string, srgb = false): Texture => {
    const tex = loader.load(path);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(1.5, 1.5);
    if (srgb) tex.colorSpace = SRGBColorSpace;
    return tex;
  };
  textureCache = {
    diffuse: load("/textures/terrain/rock/diffuse.jpg", true),
    normal: load("/textures/terrain/rock/normal.jpg"),
    roughness: load("/textures/terrain/rock/roughness.jpg"),
    ao: load("/textures/terrain/rock/ao.jpg"),
  };
  return textureCache;
}

// ── Batch generation ──────────────────────────────────────────────────

export function generateRockVariants(
  count: number = 6,
  tintColor: string = "#708898",
  tintBlend: number = 0.15,
): RockVariant[] {
  const variants: RockVariant[] = [];

  for (let i = 0; i < count; i++) {
    const preset = VARIANT_PRESETS[i % VARIANT_PRESETS.length]!;
    const geometry = generateUnderwaterRock({ ...preset, seed: i * 137 + 42 });

    const rng = seededRng(i * 73 + 11);
    const roughness = 0.65 + rng() * 0.25;
    const lightness = 0.35 + rng() * 0.15;
    const hue = 0.55 + (rng() - 0.5) * 0.06;
    const saturation = 0.15 + rng() * 0.12;

    const material = new MeshStandardMaterial({
      roughness,
      metalness: 0.02,
      side: DoubleSide,
    });

    material.color.setHSL(hue, saturation, lightness);

    if (tintBlend > 0) {
      material.color.lerp(new Color(tintColor), tintBlend);
    }

    const pos = geometry.attributes.position!.array as Float32Array;
    let minY = Infinity, maxXZ = 0;
    for (let v = 0; v < pos.length; v += 3) {
      if (pos[v + 1]! < minY) minY = pos[v + 1]!;
      const xz = Math.sqrt(pos[v]! * pos[v]! + pos[v + 2]! * pos[v + 2]!);
      if (xz > maxXZ) maxXZ = xz;
    }
    variants.push({ geometry, material, bottomOffset: -minY, xzRadius: maxXZ });
  }

  return variants;
}
