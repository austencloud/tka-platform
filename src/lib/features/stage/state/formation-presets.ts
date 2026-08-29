import type { FormationPresetId } from "../domain/stage-types";

export interface PresetPosition {
  x: number;
  z: number;
  facingAngle?: number;
}

export function generatePresetPositions(
  preset: FormationPresetId,
  performerCount: number,
  stageWidth: number,
  stageDepth: number
): PresetPosition[] {
  const normalized = PRESET_GENERATORS[preset](performerCount);
  return normalized.slice(0, performerCount).map((p) => {
    const position: PresetPosition = {
      x: p.x * stageWidth,
      z: p.z * stageDepth,
    };
    if (p.facing === "center") {
      const worldDx = (0.5 - p.x) * stageWidth;
      const worldDz = (p.z - 0.5) * stageDepth;
      position.facingAngle = Math.atan2(worldDx, worldDz);
    } else if (p.facing !== undefined) {
      position.facingAngle = p.facing;
    }
    return position;
  });
}

type NormalizedPoint = {
  x: number;
  z: number;
  facing?: number | "center";
};

const PRESET_GENERATORS: Record<
  FormationPresetId,
  (n: number) => NormalizedPoint[]
> = {
  line: (n) =>
    Array.from({ length: n }, (_, i) => ({
      x: (i + 1) / (n + 1),
      z: 0.5,
    })),

  // Intervals wide enough to read as a formation from the stage camera. At
  // 0.15 x 0.2 on a 10x8 stage the whole triangle fitted inside 1.5m x 1.6m,
  // which renders as one huddle rather than a shape with an apex.
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
          x: 0.5 + (i - (count - 1) / 2) * 0.2,
          z: 0.28 + row * 0.24,
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
      return { x: 0.5 + Math.cos(a) * 0.25, z: 0.5 + Math.sin(a) * 0.3 };
    }),

  circle: (n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return {
        x: 0.5 + Math.cos(a) * 0.3,
        z: 0.5 + Math.sin(a) * 0.3,
        facing: "center" as const,
      };
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
      };
    });
  },

  cluster: (n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const r = 0.1;
      return { x: 0.5 + Math.cos(a) * r, z: 0.5 + Math.sin(a) * r };
    }),

  "grid-2x2": (n) => {
    const cols = 2;
    const rows = Math.ceil(n / cols);
    return Array.from({ length: n }, (_, i) => ({
      x: ((i % cols) + 1) / (cols + 1),
      z: (Math.floor(i / cols) + 1) / (rows + 1),
    }));
  },

  diagonal: (n) =>
    Array.from({ length: n }, (_, i) => ({
      x: (i + 1) / (n + 1),
      z: (i + 1) / (n + 1),
    })),

  solo: () => [{ x: 0.5, z: 0.5 }],

  "tunnel-stack": (n) =>
    Array.from({ length: n }, (_, i) => ({
      x: 0.5,
      z: (i + 1) / (n + 1),
    })),

  "back-to-back": (n) => {
    if (n === 1) return [{ x: 0.5, z: 0.5 }];
    const pts: NormalizedPoint[] = [
      { x: 0.5, z: 0.4, facing: 0 },
      { x: 0.5, z: 0.6, facing: Math.PI },
    ];
    for (let i = 2; i < n; i++) {
      pts.push({ x: 0.3 + (i - 2) * 0.2, z: 0.5 });
    }
    return pts;
  },

  "facing-each-other": (n) => {
    if (n === 1) return [{ x: 0.5, z: 0.5 }];
    const pts: NormalizedPoint[] = [
      { x: 0.5, z: 0.35, facing: Math.PI },
      { x: 0.5, z: 0.65, facing: 0 },
    ];
    for (let i = 2; i < n; i++) {
      pts.push({ x: 0.3 + (i - 2) * 0.2, z: 0.5 });
    }
    return pts;
  },

  "stage-lr": (n) => {
    const half = Math.ceil(n / 2);
    return Array.from({ length: n }, (_, i) => ({
      x: i < half ? 0.25 : 0.75,
      z: ((i < half ? i : i - half) + 1) / (half + 1),
    }));
  },

  "side-by-side": (n) =>
    Array.from({ length: n }, (_, i) => ({
      x: (i + 1) / (n + 1),
      z: 0.5,
    })),

  custom: (n) =>
    Array.from({ length: n }, (_, i) => ({
      x: (i + 1) / (n + 1),
      z: 0.5,
    })),
};
