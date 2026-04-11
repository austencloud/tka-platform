import { describe, it, expect } from "vitest";
import {
  getDefaultPositions,
  PERFORMER_GRID_SPACING,
  WALL_OFFSET,
} from "$lib/shared/3d/domain/constants/performer-positions";

describe("getDefaultPositions", () => {
  it("returns an empty array for count 0 or negative", () => {
    expect(getDefaultPositions(0)).toEqual([]);
    expect(getDefaultPositions(-3)).toEqual([]);
  });

  it("centers a single performer at x=0, z=WALL_OFFSET", () => {
    const slots = getDefaultPositions(1);
    expect(slots).toEqual([{ x: 0, z: WALL_OFFSET }]);
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
    // For counts 2, 4, 6, 8 every row is full → total sum of x = 0.
    for (const n of [2, 4, 6, 8]) {
      const slots = getDefaultPositions(n);
      const sumX = slots.reduce((s, p) => s + p.x, 0);
      expect(sumX).toBeCloseTo(0, 6);
    }
  });

  it("centers the lone performer at x=0 in odd-count last rows", () => {
    // For counts 3, 5, 7 the last performer is alone at the rear center.
    for (const n of [3, 5, 7]) {
      const slots = getDefaultPositions(n);
      const last = slots[slots.length - 1]!;
      expect(last.x).toBeCloseTo(0, 6);
    }
  });

  it("stacks rows along -z, WALL_OFFSET per row", () => {
    // 8 performers → 4 rows at z = WALL_OFFSET, WALL_OFFSET - S, -2S, -3S
    const slots = getDefaultPositions(8);
    for (let i = 0; i < slots.length; i++) {
      const expectedRow = Math.floor(i / 2);
      const expectedZ = -expectedRow * PERFORMER_GRID_SPACING + WALL_OFFSET;
      expect(slots[i]!.z).toBeCloseTo(expectedZ, 6);
    }
  });

  it("never stacks two performers at the same position", () => {
    // Silent-bug guard: the 5-8 bug we're fixing caused every spawn beyond
    // 4 to collapse to (0, 0). A dup-position check catches any future
    // regression where indices share a slot.
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

  it("preserves the historical 1-4 layouts exactly", () => {
    const S = PERFORMER_GRID_SPACING;

    // count 2: side by side on front row
    expect(getDefaultPositions(2)).toEqual([
      { x: -S / 2, z: WALL_OFFSET },
      { x: S / 2, z: WALL_OFFSET },
    ]);

    // count 3: pair front, lone back
    expect(getDefaultPositions(3)).toEqual([
      { x: -S / 2, z: WALL_OFFSET },
      { x: S / 2, z: WALL_OFFSET },
      { x: 0, z: -S + WALL_OFFSET },
    ]);

    // count 4: full 2x2 grid
    expect(getDefaultPositions(4)).toEqual([
      { x: -S / 2, z: WALL_OFFSET },
      { x: S / 2, z: WALL_OFFSET },
      { x: -S / 2, z: -S + WALL_OFFSET },
      { x: S / 2, z: -S + WALL_OFFSET },
    ]);
  });
});
