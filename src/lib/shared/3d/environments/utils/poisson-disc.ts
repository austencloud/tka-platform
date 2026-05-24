export interface PoissonDiscConfig {
  innerRadius: number;
  outerRadius: number;
  minDistance: number;
  count: number;
  seed: number;
  densityBias?: (x: number, z: number, distanceNorm: number) => number;
}

export interface PoissonSample {
  x: number;
  z: number;
  distanceNorm: number;
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function poissonDiscSample(config: PoissonDiscConfig): PoissonSample[] {
  const { innerRadius, outerRadius, minDistance, count, seed, densityBias } = config;
  const rng = mulberry32(seed);
  const samples: PoissonSample[] = [];
  const maxAttempts = count * 40;

  for (let attempt = 0; attempt < maxAttempts && samples.length < count; attempt++) {
    const angle = rng() * Math.PI * 2;
    const r = innerRadius + rng() * (outerRadius - innerRadius);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    let tooClose = false;
    for (const existing of samples) {
      const dx = x - existing.x;
      const dz = z - existing.z;
      if (dx * dx + dz * dz < minDistance * minDistance) {
        tooClose = true;
        break;
      }
    }

    if (!tooClose) {
      const distanceNorm = (r - innerRadius) / Math.max(outerRadius - innerRadius, 0.001);
      if (densityBias && rng() > densityBias(x, z, distanceNorm)) {
        continue;
      }
      samples.push({ x, z, distanceNorm });
    }
  }

  return samples;
}

export function seededRandom(seed: number): () => number {
  return mulberry32(seed);
}

export class PlacementGrid {
  private cells = new Map<string, { x: number; z: number; r: number }[]>();
  private cellSize: number;

  constructor(cellSize: number = 2.0) {
    this.cellSize = cellSize;
  }

  private key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  register(x: number, z: number, radius: number): void {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    const k = this.key(cx, cz);
    if (!this.cells.has(k)) this.cells.set(k, []);
    this.cells.get(k)!.push({ x, z, r: radius });
  }

  isClear(x: number, z: number, radius: number): boolean {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const entries = this.cells.get(this.key(cx + dx, cz + dz));
        if (!entries) continue;
        for (const e of entries) {
          const ddx = x - e.x, ddz = z - e.z;
          const minDist = radius + e.r;
          if (ddx * ddx + ddz * ddz < minDist * minDist) return false;
        }
      }
    }
    return true;
  }
}
