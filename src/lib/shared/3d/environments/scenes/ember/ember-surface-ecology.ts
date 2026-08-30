import volcanicWorldR7 from "../../domain/models/scene-configs/ember-volcanic-world-r7.json";

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

const LAVA_CORRIDOR = volcanicWorldR7.lavaRiver.pointsRuntimeXZHeight.map(
  ([x, z]) => [x, z] as [number, number]
);

const TALUS_CLUSTERS = [
  { x: -18, z: -20, spread: 5.5 },
  { x: 26, z: -18, spread: 6.2 },
  { x: -26, z: 10, spread: 5.8 },
  { x: 28, z: 20, spread: 6.5 },
  { x: -18, z: 30, spread: 5.4 },
  { x: 20, z: -36, spread: 6.8 },
  { x: -30, z: -38, spread: 6.6 },
  { x: 34, z: 38, spread: 7.2 },
] as const;

function clusteredPosition(random: () => number): [number, number] {
  const cluster = TALUS_CLUSTERS[Math.floor(random() * TALUS_CLUSTERS.length)]!;
  const angle = random() * Math.PI * 2;
  const radius = Math.sqrt(random()) * cluster.spread;
  return [
    cluster.x + Math.cos(angle) * radius,
    cluster.z + Math.sin(angle) * radius,
  ];
}

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

  for (let attempt = 0; attempt < 1_000 && rubble.length < 150; attempt += 1) {
    const [x, z] = clusteredPosition(random);
    if (Math.hypot(x, z) < stageClearance) continue;
    if (distanceToEmberLavaCorridor(x, z) < 4.3) continue;
    const size = 0.055 + Math.pow(random(), 2.2) * 0.34;
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

  for (let attempt = 0; attempt < 500 && plates.length < 32; attempt += 1) {
    const [x, z] = clusteredPosition(random);
    if (Math.hypot(x, z) < stageClearance + 0.8) continue;
    if (distanceToEmberLavaCorridor(x, z) < 5.1) continue;
    const span = 0.34 + random() * 0.72;
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
