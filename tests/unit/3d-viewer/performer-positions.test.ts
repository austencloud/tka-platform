import { describe, it, expect } from "vitest";
import {
  getDefaultPositions,
  PERFORMER_GRID_SPACING,
} from "@austencloud/scene-3d";

describe("getDefaultPositions", () => {
  it("returns an empty array for count 0 or negative", () => {
    expect(getDefaultPositions(0)).toEqual([]);
    expect(getDefaultPositions(-3)).toEqual([]);
  });

  it("centers a single performer at origin", () => {
    const slots = getDefaultPositions(1);
    expect(slots).toEqual([{ x: 0, z: 0 }]);
  });

  it("produces exactly `count` slots for counts 1..8", () => {
    for (let n = 1; n <= 8; n++) {
      expect(getDefaultPositions(n).length).toBe(n);
    }
  });

  it("clamps counts beyond 8 down to 8", () => {
    expect(getDefaultPositions(9).length).toBe(8);
    expect(getDefaultPositions(100).length).toBe(8);
  });

  it("places pairs symmetrically around x=0 in even-count rows", () => {
    for (const n of [2, 4, 6, 8]) {
      const slots = getDefaultPositions(n);
      const sumX = slots.reduce((s, p) => s + p.x, 0);
      expect(sumX).toBeCloseTo(0, 6);
    }
  });

  it("centers the lone performer at x=0 in odd-count last rows", () => {
    for (const n of [3, 5, 7]) {
      const slots = getDefaultPositions(n);
      const last = slots[slots.length - 1]!;
      expect(last.x).toBeCloseTo(0, 6);
    }
  });

  it("centers formation at z=0", () => {
    for (let n = 1; n <= 8; n++) {
      const slots = getDefaultPositions(n);
      const minZ = Math.min(...slots.map((p) => p.z));
      const maxZ = Math.max(...slots.map((p) => p.z));
      const centerZ = (minZ + maxZ) / 2;
      expect(centerZ).toBeCloseTo(0, 6);
    }
  });

  it("never stacks two performers at the same position", () => {
    for (let n = 2; n <= 8; n++) {
      const slots = getDefaultPositions(n);
      const seen = new Set<string>();
      for (const p of slots) {
        const key = `${p.x.toFixed(3)},${p.z.toFixed(3)}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });

  it("uses correct spacing between rows", () => {
    const S = PERFORMER_GRID_SPACING;
    const slots = getDefaultPositions(4);
    const frontZ = slots[0]!.z;
    const backZ = slots[2]!.z;
    expect(frontZ - backZ).toBeCloseTo(S, 6);
  });
});
