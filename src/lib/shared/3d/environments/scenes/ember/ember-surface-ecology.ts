export interface EmberSurfacePlacement {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  family: "cold" | "iron" | "glass";
}

export interface EmberSurfaceEcology {
  rubble: EmberSurfacePlacement[];
  plates: EmberSurfacePlacement[];
}

const LAVA_CORRIDOR: [number, number][] = [
  [14, 2],
  [12, 11],
  [10, 19],
  [11, 29],
  [8, 40],
  [-4, 52],
];

function createRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}

function distanceToSegment(
  x: number,
  z: number,
  [ax, az]: [number, number],
  [bx, bz]: [number, number]
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const denominator = dx * dx + dz * dz;
  const t =
    denominator === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / denominator));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

export function distanceToEmberLavaCorridor(x: number, z: number): number {
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < LAVA_CORRIDOR.length - 1; index += 1) {
    distance = Math.min(
      distance,
      distanceToSegment(x, z, LAVA_CORRIDOR[index]!, LAVA_CORRIDOR[index + 1]!)
    );
  }
  return distance;
}

export function createEmberSurfaceEcology(
  stageRadius: number,
  seed = 9413
): EmberSurfaceEcology {
  const random = createRandom(seed);
  const stageClearance = Math.max(7.4, stageRadius + 2.2);
  const rubble: EmberSurfacePlacement[] = [];
  const plates: EmberSurfacePlacement[] = [];

  for (let attempt = 0; attempt < 900 && rubble.length < 220; attempt += 1) {
    const angle = random() * Math.PI * 2;
    const radius =
      stageClearance + Math.pow(random(), 0.72) * (38 - stageClearance);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (distanceToEmberLavaCorridor(x, z) < 3.7) continue;
    const size = 0.075 + Math.pow(random(), 2.1) * 0.44;
    const familyRoll = random();
    rubble.push({
      position: [x, 0.025 + random() * 0.035, z],
      rotation: [random() * 0.7, random() * Math.PI * 2, random() * 0.7],
      scale: [
        size * (0.72 + random() * 0.75),
        size * (0.48 + random() * 0.5),
        size * (0.72 + random() * 0.75),
      ],
      family: familyRoll > 0.84 ? "iron" : familyRoll > 0.62 ? "glass" : "cold",
    });
  }

  for (let attempt = 0; attempt < 420 && plates.length < 54; attempt += 1) {
    const angle = random() * Math.PI * 2;
    const radius =
      stageClearance + 0.8 + Math.pow(random(), 0.8) * (31 - stageClearance);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (distanceToEmberLavaCorridor(x, z) < 4.5) continue;
    const span = 0.42 + random() * 0.95;
    plates.push({
      position: [x, 0.045 + random() * 0.025, z],
      rotation: [
        (random() - 0.5) * 0.16,
        random() * Math.PI * 2,
        (random() - 0.5) * 0.16,
      ],
      scale: [span * (0.65 + random() * 0.8), 0.08 + random() * 0.09, span],
      family: random() > 0.72 ? "iron" : "glass",
    });
  }

  return { rubble, plates };
}
