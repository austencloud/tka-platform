export interface PoissonDiscConfig {
  innerRadius: number;
  outerRadius: number;
  minDistance: number;
  count: number;
  seed: number;
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
  const { innerRadius, outerRadius, minDistance, count, seed } = config;
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
      samples.push({
        x,
        z,
        distanceNorm: (r - innerRadius) / Math.max(outerRadius - innerRadius, 0.001),
      });
    }
  }

  return samples;
}

export function seededRandom(seed: number): () => number {
  return mulberry32(seed);
}
