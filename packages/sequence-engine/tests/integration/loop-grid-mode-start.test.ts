/**
 * Regression lock: LOOP seed start selection must respect the grid mode.
 *
 * Bug (2026-07-14): `SequenceBuilder.constrainStartForLoopType` pinned a random
 * start from all 8 beta indices for rotated_swapped[_inverted] LOOPs, ignoring
 * the grid mode. But the two grid modes occupy disjoint grid points — diamond
 * uses the cardinal (odd-index) positions (beta1/3/5/7…), box uses the
 * intercardinal (even-index) ones (beta2/4/6/8…). When the pin landed on a
 * parity absent from the active grid, the beam search had zero variations there
 * and the backward reachability pass threw
 *   "No valid N-beat path exists: beat 1 has no reachable positions …"
 * ~50% of the time in BOTH modes (reported in box). Mirror+swap combos pinned
 * beta1/beta5 (cardinal only) → 100% failure in box.
 *
 * Drives the REAL builder over the canonical Box/Diamond CSV datasets — same
 * pipeline as MCP `generate_sequence loopType=…` and the app's circular
 * generator (see scripts/generate-loop-audit-fixtures.mjs).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SequenceBuilder } from "../../src/generation/builder/SequenceBuilder.js";
import type { IVariationProvider } from "../../src/generation/data/IVariationProvider.js";
import type { PictographData } from "../../src/generation/constraints/types.js";
import { LOOPType, Period } from "../../src/loop/loop-types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = (name: string) =>
  path.resolve(__dirname, "../../../../static/data/pictographs", name);

function loadCsv(name: string): PictographData[] {
  const lines = readFileSync(csvPath(name), "utf8").trim().split(/\r?\n/);
  return lines
    .slice(1)
    .map((l) => l.split(","))
    .filter((c) => c.length >= 13 && c[5]) // drop blank/short lines
    .map((c) => ({
      letter: c[0],
      startPosition: c[1],
      endPosition: c[2],
      timing: "together",
      direction: "together",
      blueMotion: {
        color: "blue", motionType: c[5], rotationDirection: c[6],
        startLocation: c[7], endLocation: c[8],
        startOrientation: "in", endOrientation: "in", turns: 0,
      },
      redMotion: {
        color: "red", motionType: c[9], rotationDirection: c[10],
        startLocation: c[11], endLocation: c[12],
        startOrientation: "in", endOrientation: "in", turns: 0,
      },
    }));
}

class CsvVariationProvider implements IVariationProvider {
  private readonly index = new Map<string, PictographData[]>();
  constructor(private readonly all: PictographData[]) {
    for (const p of all) {
      const k = `${p.letter}:${p.startPosition}`;
      const bucket = this.index.get(k);
      if (bucket) bucket.push(p);
      else this.index.set(k, [p]);
    }
  }
  getVariations(letter: string, position: string): PictographData[] {
    return this.index.get(`${letter}:${position}`) ?? [];
  }
  getAllVariations(): PictographData[] {
    return this.all;
  }
}

const boxBuilder = new SequenceBuilder(new CsvVariationProvider(loadCsv("BoxPictographDataframe.csv")));
const diamondBuilder = new SequenceBuilder(new CsvVariationProvider(loadCsv("DiamondPictographDataframe.csv")));

const REACHABILITY_ERROR = /no reachable positions/;

function buildLoop(builder: SequenceBuilder, gridMode: string, type: LOOPType, startPosition?: string) {
  return builder.build({
    length: 8, // seed for a halved length-16 loop
    gridMode,
    level: 2,
    constraintPreset: "smooth",
    maxTurnIntensity: 1,
    startPosition,
    loop: { type, period: Period.HALVED, useTargetedGeneration: true },
  });
}

function parityOf(position: string | undefined): "even" | "odd" | "none" {
  const n = Number(position?.match(/\d+$/)?.[0]);
  if (!Number.isFinite(n)) return "none";
  return n % 2 === 0 ? "even" : "odd";
}

const TRIALS = 25;

describe("LOOP seed start respects grid mode", () => {
  it("box rotated_swapped_inverted never hits the reachability wall; starts stay intercardinal (even)", () => {
    for (let i = 0; i < TRIALS; i++) {
      const r = buildLoop(boxBuilder, "box", LOOPType.ROTATED_SWAPPED_INVERTED);
      const start = r.sequence[0]?.startPosition;
      expect(parityOf(start)).toBe("even"); // box has only beta2/4/6/8, gamma even, …
    }
  });

  it("box rotated_swapped never hits the reachability wall; starts stay intercardinal (even)", () => {
    for (let i = 0; i < TRIALS; i++) {
      const r = buildLoop(boxBuilder, "box", LOOPType.ROTATED_SWAPPED);
      expect(parityOf(r.sequence[0]?.startPosition)).toBe("even");
    }
  });

  it("diamond rotated_swapped_inverted starts stay cardinal (odd)", () => {
    for (let i = 0; i < TRIALS; i++) {
      const r = buildLoop(diamondBuilder, "diamond", LOOPType.ROTATED_SWAPPED_INVERTED);
      expect(parityOf(r.sequence[0]?.startPosition)).toBe("odd");
    }
  });

  it("forcing a cardinal start (beta1) in box reproduces the reachability wall", () => {
    // Documents the exact reported failure: a diamond position has zero box
    // variations, so the backward reachability pass empties out at beat 1.
    expect(() =>
      buildLoop(boxBuilder, "box", LOOPType.ROTATED_SWAPPED_INVERTED, "beta1"),
    ).toThrow(REACHABILITY_ERROR);
  });

  it("mirror+swap combos fail with a clear grid-mode message in box (not a cryptic crash)", () => {
    expect(() =>
      buildLoop(boxBuilder, "box", LOOPType.MIRRORED_SWAPPED_INVERTED),
    ).toThrow(/vertical-axis start|box mode/i);
    // And they must NOT surface as the low-level reachability wall.
    try {
      buildLoop(boxBuilder, "box", LOOPType.MIRRORED_SWAPPED_INVERTED);
    } catch (e) {
      expect((e as Error).message).not.toMatch(REACHABILITY_ERROR);
    }
  });
});
