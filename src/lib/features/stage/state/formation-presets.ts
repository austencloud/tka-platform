import type {
  FormationPresetId,
  PerformerPose,
} from "../domain/stage-types";

export function generateFormation(
  preset: FormationPresetId,
  performerCount: number,
  stageWidth: number,
  stageDepth: number,
  performerIds: string[]
): PerformerPose[] {
  const normalized = PRESET_GENERATORS[preset](performerCount);
  return normalized.slice(0, performerCount).map((p, i) => ({
    performerId: performerIds[i],
    x: p.x * stageWidth,
    z: p.z * stageDepth,
    facing: p.facing,
  }));
}

type NormalizedPoint = { x: number; z: number; facing: number };

const PRESET_GENERATORS: Record<
  FormationPresetId,
  (n: number) => NormalizedPoint[]
> = {
  line: (n) =>
    Array.from({ length: n }, (_, i) => ({
      x: (i + 1) / (n + 1),
      z: 0.5,
      facing: 0,
    })),

  triangle: (n) => {
    if (n <= 2) return PRESET_GENERATORS.line(n);
    const pts: NormalizedPoint[] = [];
    let remaining = n;
    let row = 0;
    let perRow = 1;
    while (remaining > 0) {
      const count = Math.min(perRow, remaining);
      for (let i = 0; i < count; i++) {
        pts.push({
          x: 0.5 + (i - (count - 1) / 2) * 0.15,
          z: 0.3 + row * 0.2,
          facing: 0,
        });
      }
      remaining -= count;
      row++;
      perRow++;
    }
    return pts;
  },

  diamond: (n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return { x: 0.5 + Math.cos(a) * 0.25, z: 0.5 + Math.sin(a) * 0.3, facing: 0 };
    }),

  circle: (n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return { x: 0.5 + Math.cos(a) * 0.3, z: 0.5 + Math.sin(a) * 0.3, facing: 0 };
    }),

  "v-shape": (n) => {
    const pts: NormalizedPoint[] = [];
    const half = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const side = i < half ? -1 : 1;
      const idx = i < half ? i : i - half;
      pts.push({
        x: 0.5 + side * (idx + 1) * 0.12,
        z: 0.3 + idx * 0.15,
        facing: 0,
      });
    }
    return pts;
  },

  grid: (n) => {
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    return Array.from({ length: n }, (_, i) => ({
      x: ((i % cols) + 1) / (cols + 1),
      z: (Math.floor(i / cols) + 1) / (rows + 1),
      facing: 0,
    }));
  },

  stagger: (n) => {
    const perRow = Math.ceil(n / 2);
    return Array.from({ length: n }, (_, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const offset = row % 2 === 1 ? 0.06 : 0;
      return {
        x: (col + 1) / (perRow + 1) + offset,
        z: 0.35 + row * 0.3,
        facing: 0,
      };
    });
  },

  cluster: (n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const r = 0.1;
      return { x: 0.5 + Math.cos(a) * r, z: 0.5 + Math.sin(a) * r, facing: 0 };
    }),
};
