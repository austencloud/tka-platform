import { describe, it, expect } from "vitest";
import {
  entryToStrip,
  loopLabel,
  flaggedEntries,
  rawSlots,
  mirroredPool,
  rotatedPool,
  swappedPool,
} from "../../src/routes/(public)/guide/level-1/_data/example-pools/pool-adapter";
import { Letter } from "$lib/shared/foundation/domain/models/letter";
import {
  GridLocation,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  getGridPositionFromLocations,
  getGridLocationsFromPosition,
} from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

// The adapter turns curated MCP step JSON into pictograph strips via the SAME
// canonical primitives the hand-authored content uses. These are silent-bug
// checks: a wrong position inverse or a mis-mapped letter renders a subtly wrong
// pictograph that no test-less eye reliably catches.

describe("position inverse (the canon the adapter relies on)", () => {
  it("is unique per position and round-trips through the forward deriver", () => {
    // Enumerate every GridLocation pair through the canonical forward deriver;
    // assert no two pairs collapse onto one position (uniqueness), and the
    // canonical inverse of every produced position forward-derives back to it.
    const producedBy = new Map<string, string>();
    for (const blue of Object.values(GridLocation)) {
      for (const red of Object.values(GridLocation)) {
        let pos: string;
        try {
          pos = getGridPositionFromLocations(blue, red);
        } catch {
          continue;
        }
        const key = `${blue},${red}`;
        const prior = producedBy.get(pos);
        expect(prior === undefined || prior === key).toBe(true);
        producedBy.set(pos, key);
      }
    }
    for (const [pos, key] of producedBy) {
      const [b, r] = getGridLocationsFromPosition(pos as GridPosition);
      expect(getGridPositionFromLocations(b, r)).toBe(pos);
      expect(`${b},${r}`).toBe(key);
    }
  });
});

describe("entryToStrip — GΘSZ spot check (field-by-field)", () => {
  const gtsz = rawSlots.mirrored.candidates.find((c) => c.word === "GΘSZ");
  it("the pilot slate still contains GΘSZ", () => {
    expect(gtsz).toBeDefined();
  });

  const strip = entryToStrip(gtsz!) as unknown as StepData[];

  it("builds a start box + 8 steps (items.length === steps.length)", () => {
    expect(strip.length).toBe(gtsz!.steps.length);
    expect(strip.length).toBe(9);
  });

  it("maps the start box: β start letter, stepNumber 0, beta7", () => {
    const start = strip[0]!;
    expect(start.letter).toBe(Letter.BETA);
    expect(start.stepNumber).toBe(0);
    // beta7 = (WEST, WEST) per the canonical deriver.
    expect(start.startPosition).toBe(GridPosition.BETA7);
    expect(start.motions.blue.startLocation).toBe(GridLocation.WEST);
    expect(start.motions.red.startLocation).toBe(GridLocation.WEST);
  });

  it("maps step 1 (G, beta7→beta1): letter enum, inverted locations, motion fields", () => {
    const s1 = strip[1]!;
    expect(s1.letter).toBe(Letter.G);
    expect(s1.stepNumber).toBe(1);
    expect(s1.startPosition).toBe(GridPosition.BETA7); // (w,w)
    expect(s1.endPosition).toBe(GridPosition.BETA1); // (n,n)
    // Locations come from inverting the JSON positions, per hand.
    expect(s1.motions.blue.startLocation).toBe(GridLocation.WEST);
    expect(s1.motions.blue.endLocation).toBe(GridLocation.NORTH);
    expect(s1.motions.red.startLocation).toBe(GridLocation.WEST);
    expect(s1.motions.red.endLocation).toBe(GridLocation.NORTH);
    // Motion type / direction taken straight from the JSON (pro cw / pro cw).
    expect(s1.motions.blue.motionType).toBe(MotionType.PRO);
    expect(s1.motions.blue.rotationDirection).toBe(RotationDirection.CLOCKWISE);
    expect(s1.motions.red.motionType).toBe(MotionType.PRO);
    expect(s1.motions.red.rotationDirection).toBe(RotationDirection.CLOCKWISE);
  });

  it("maps a Greek letter (step 2 Θ) and a static hand", () => {
    const s2 = strip[2]!;
    expect(s2.letter).toBe(Letter.THETA);
    // JSON: blue static on Θ, red pro cw.
    expect(s2.motions.blue.motionType).toBe(MotionType.STATIC);
    expect(s2.motions.red.motionType).toBe(MotionType.PRO);
  });

  it("ran bakeReversals — the cw→ccw seam flip produced a reversal mark", () => {
    // The mirrored second half inverts every rotation direction; bakeReversals
    // derives the dot from the motions themselves. Its presence proves baking ran.
    const anyReversal = strip.some((s) => s.blueReversal || s.redReversal);
    expect(anyReversal).toBe(true);
  });
});

describe("every pilot candidate adapts", () => {
  const all = [
    ...rawSlots.mirrored.candidates.map((c) => ({ slot: "mirrored", c })),
    ...rawSlots.rotated.candidates.map((c) => ({ slot: "rotated", c })),
    ...rawSlots.swapped.candidates.map((c) => ({ slot: "swapped", c })),
  ];

  it("has 12 pilot candidates (4 per slot)", () => {
    expect(rawSlots.mirrored.candidates.length).toBe(4);
    expect(rawSlots.rotated.candidates.length).toBe(4);
    expect(rawSlots.swapped.candidates.length).toBe(4);
    expect(all.length).toBe(12);
  });

  for (const { slot, c } of [
    ...rawSlots.mirrored.candidates.map((c) => ({ slot: "mirrored", c })),
    ...rawSlots.rotated.candidates.map((c) => ({ slot: "rotated", c })),
    ...rawSlots.swapped.candidates.map((c) => ({ slot: "swapped", c })),
  ]) {
    it(`${slot}/${c.word} adapts with items.length === steps.length`, () => {
      const strip = entryToStrip(c);
      expect(strip.length).toBe(c.steps.length);
    });
  }

  it("no entry was flagged/excluded", () => {
    expect(flaggedEntries).toEqual([]);
  });

  it("all three slot pools built with the expected counts", () => {
    expect(mirroredPool.length).toBe(4);
    expect(rotatedPool.length).toBe(4);
    expect(swappedPool.length).toBe(4);
  });
});

describe("loopLabel", () => {
  it("names the rotation slice for rotated entries, plain label otherwise", () => {
    expect(loopLabel({ word: "x", loopType: "mirrored", prose: "", steps: [] })).toBe("Mirrored");
    expect(loopLabel({ word: "x", loopType: "swapped", prose: "", steps: [] })).toBe("Swapped");
    expect(
      loopLabel({ word: "x", loopType: "rotated", period: "halved", prose: "", steps: [] }),
    ).toBe("Rotated 180°");
    expect(
      loopLabel({ word: "x", loopType: "rotated", period: "quartered", prose: "", steps: [] }),
    ).toBe("Rotated 90°");
  });
});
