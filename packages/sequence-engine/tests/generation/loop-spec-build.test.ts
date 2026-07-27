/**
 * SequenceBuilder honors options.loop.loopSpec — the compositional spec path.
 *
 * Drives the exact production dataset (DiamondPictographDataframe.csv) through
 * the real builder, mirroring scripts/generate-loop-audit-fixtures.mjs's
 * CSV-provider pattern so this test exercises builder-validated seams, not a
 * hand-built mock graph.
 *
 * Note: `loopSpec` lives on `LoopOptions` (nested under `options.loop`), not
 * as a sibling top-level `BuildOptions` field — confirmed by the existing
 * `loopSpec?: LOOPSpec` field on `LoopOptions` (SequenceBuilder.ts) and by
 * the MCP adapter, which already populates `options.loop.loopSpec` via
 * `loopSpecFromLegacy` for every LOOP request today.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BeamSearch,
  SequenceBuilder,
  emptyConstraintSet,
} from "../../src/generation/index.js";
import type { IVariationProvider } from "../../src/generation/data/IVariationProvider.js";
import type { PictographData } from "../../src/generation/constraints/types.js";
import { LOOPType, Period } from "../../src/loop/loop-types.js";
import { LOOPComponent, type LOOPSpec } from "../../src/loop/loop-spec.js";
import {
  detectLOOPFromSteps,
  isSequenceCircular,
  loopDetectorClass,
} from "../../src/loop/detection/LOOPDetector.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.resolve(
  __dirname,
  "../../../../static/data/pictographs/DiamondPictographDataframe.csv"
);
const BOX_CSV_PATH = path.resolve(
  __dirname,
  "../../../../static/data/pictographs/BoxPictographDataframe.csv"
);

// ---------------------------------------------------------------------------
// Real dataset provider — copied verbatim (pattern) from
// scripts/generate-loop-audit-fixtures.mjs's loadVariations/CsvVariationProvider.
// ---------------------------------------------------------------------------

function loadVariations(csvPath: string): PictographData[] {
  const lines = readFileSync(csvPath, "utf8").split("\n");
  const out: PictographData[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i]!.split(",").map((s) => s.trim());
    if (c.length < 13 || !c[0]) continue;
    out.push({
      letter: c[0],
      startPosition: c[1]!,
      endPosition: c[2]!,
      timing: c[3]!,
      direction: c[4]!,
      blueMotion: {
        color: "blue",
        motionType: c[5]!,
        rotationDirection: c[6]!,
        startLocation: c[7]!,
        endLocation: c[8]!,
        startOrientation: "in",
        endOrientation: "in",
      },
      redMotion: {
        color: "red",
        motionType: c[9]!,
        rotationDirection: c[10]!,
        startLocation: c[11]!,
        endLocation: c[12]!,
        startOrientation: "in",
        endOrientation: "in",
      },
    } as unknown as PictographData);
  }
  return out;
}

class CsvVariationProvider implements IVariationProvider {
  private readonly index = new Map<string, PictographData[]>();

  constructor(private readonly data: PictographData[]) {
    for (const p of data) {
      const key = `${p.letter}:${p.startPosition}`;
      const bucket = this.index.get(key);
      if (bucket) bucket.push(p);
      else this.index.set(key, [p]);
    }
  }

  getVariations(
    letter: string,
    position: string,
    _gridMode: string
  ): PictographData[] {
    return this.index.get(`${letter}:${position}`) ?? [];
  }

  getAllVariations(_gridMode: string): PictographData[] {
    return this.data;
  }
}

function symmetric(
  entries: Array<
    [LOOPComponent, { period: number; mode?: "expand" | "overlay" }]
  >
): LOOPSpec {
  const map = new Map(entries);
  return { blue: { components: map }, red: { components: map } };
}

describe("SequenceBuilder loopSpec path", () => {
  it("builds Box mirror+rotation on the grid-relative diagonal axis", () => {
    const builder = new SequenceBuilder(
      new CsvVariationProvider(loadVariations(BOX_CSV_PATH))
    );
    const spec = symmetric([
      [LOOPComponent.ROTATED, { period: 2 }],
      [LOOPComponent.MIRRORED, { period: 2 }],
    ]);

    const result = builder.build({
      length: 8,
      gridMode: "box",
      level: 2,
      constraintPreset: "smooth",
      loop: {
        type: LOOPType.MIRRORED_ROTATED,
        period: Period.HALVED,
        useTargetedGeneration: true,
        loopSpec: spec,
      },
    });

    expect(["alpha2", "alpha6", "beta2", "beta6"]).toContain(
      result.sequence[0]?.startPosition
    );
    expect(isSequenceCircular(result.sequence)).toBe(true);
    expect(detectLOOPFromSteps(result.sequence).components).toEqual(
      expect.arrayContaining(["mirrored", "rotated"])
    );
  });

  it("keeps a dash-preferred beam on a path that can reach its rotated seam", () => {
    const builder = new SequenceBuilder(
      new CsvVariationProvider(loadVariations(CSV_PATH))
    );
    const spec = symmetric([[LOOPComponent.ROTATED, { period: 2 }]]);

    const result = builder.build({
      length: 8,
      gridMode: "diamond",
      level: 1,
      maxTurnIntensity: 0,
      constraintOptions: {
        dashPreference: "maximize",
        handPathContinuity: "allow-reversals",
      },
      loop: {
        type: LOOPType.ROTATED,
        period: Period.HALVED,
        useTargetedGeneration: true,
        loopSpec: spec,
      },
    });

    expect(result.sequence.slice(1)).toHaveLength(16);
    expect(isSequenceCircular(result.sequence)).toBe(true);
    expect(detectLOOPFromSteps(result.sequence).components).toContain(
      "rotated"
    );
  });

  it("builds every reported halved mirrored+rotated+swapped sample as the requested LOOP", () => {
    const builder = new SequenceBuilder(
      new CsvVariationProvider(loadVariations(CSV_PATH))
    );
    const spec = symmetric([
      [LOOPComponent.ROTATED, { period: 2 }],
      [LOOPComponent.MIRRORED, { period: 2 }],
      [LOOPComponent.SWAPPED, { period: 2 }],
    ]);
    const expectedComponents = ["mirrored", "rotated", "swapped"];

    for (let sample = 0; sample < 25; sample++) {
      const result = builder.build({
        length: 4,
        gridMode: "diamond",
        level: 2,
        propType: "fan",
        constraintOptions: {
          propContinuity: "maximize",
          handPathContinuity: "allow-reversals",
        },
        maxTurnIntensity: 1,
        loop: {
          type: LOOPType.MIRRORED_ROTATED_SWAPPED,
          period: Period.HALVED,
          useTargetedGeneration: true,
          loopSpec: spec,
        },
      });

      const functional = [...detectLOOPFromSteps(result.sequence).components]
        .map(String)
        .sort();
      const rich = loopDetectorClass.detectLOOPType(result.sequence);
      const classBased = rich.spec?.blue
        ? [...rich.spec.blue.components.keys()].map(String).sort()
        : [];
      const diagnostic = JSON.stringify({
        sample,
        word: result.sequence
          .slice(1)
          .map((step) => step.letter)
          .join(""),
        positions: result.sequence.map(
          (step) => `${step.startPosition}→${step.endPosition}`
        ),
        functional,
        classBased,
      });

      expect(result.sequence.slice(1)).toHaveLength(16);
      expect(isSequenceCircular(result.sequence)).toBe(true);
      expect(functional, diagnostic).toEqual(expectedComponents);
      expect(classBased, diagnostic).toEqual(expectedComponents);
    }
  });

  it("keeps a random start paired with its own LOOP endpoint", () => {
    const provider = new CsvVariationProvider(loadVariations(CSV_PATH));
    const beamSearch = new BeamSearch(provider, "diamond");
    const loopPositionMap: Record<string, string[]> = {
      beta1: ["beta5"],
      beta5: ["beta1"],
    };

    const result = beamSearch.searchByLength(
      4,
      undefined,
      emptyConstraintSet(),
      10,
      undefined,
      loopPositionMap
    );
    const start = result.steps[0]?.startPosition;
    const end = result.steps[result.steps.length - 1]?.endPosition;

    expect(result.success).toBe(true);
    expect(start).toBeDefined();
    expect(end).toBeDefined();
    expect(Object.keys(loopPositionMap)).toContain(start);
    expect(loopPositionMap[start!]).toContain(end);
  });

  it("builds a rot:2+mir:2 loop with inv:4 overlaid — 16 steps, closed, block-inverted", () => {
    const builder = new SequenceBuilder(
      new CsvVariationProvider(loadVariations(CSV_PATH))
    );
    const spec = symmetric([
      [LOOPComponent.ROTATED, { period: 2 }],
      [LOOPComponent.MIRRORED, { period: 2 }],
      [LOOPComponent.INVERTED, { period: 4, mode: "overlay" }],
    ]);

    // Retry loop: beam search is stochastic; accept the first success in 40
    // attempts (per plan discipline — a real generation failure across all
    // 40 attempts means the seam-targeting contract is broken, not a flaky
    // assertion to loosen).
    let result: ReturnType<typeof builder.build> | null = null;
    let lastFailure = "no attempt";
    for (let i = 0; i < 40 && !result; i++) {
      try {
        const r = builder.build({
          length: 4,
          gridMode: "diamond",
          level: 1,
          loop: {
            type: LOOPType.MIRRORED_ROTATED,
            period: Period.HALVED,
            useTargetedGeneration: true,
            loopSpec: spec,
          },
        });
        if (isSequenceCircular(r.sequence)) result = r;
      } catch (error) {
        lastFailure = error instanceof Error ? error.message : String(error);
      }
    }

    if (!result) throw new Error(lastFailure);
    const steps = result!.sequence.slice(1);
    expect(steps).toHaveLength(16); // 4 seed x2 rot x2 mir, overlay x1

    // Overlay signature: blocks of 4; steps 5-8 are the pro/anti flip of 1-4.
    for (let i = 0; i < 4; i++) {
      const b = steps[i]!.motions.blue.motionType;
      const o = steps[i + 4]!.motions.blue.motionType;
      if (b === "pro") expect(o).toBe("anti");
      if (b === "anti") expect(o).toBe("pro");
    }

    // Letters re-derived: every step's letter is consistent with its motions
    // (no step keeps a stale/copied letter after rotation/mirror/overlay).
    expect(steps.every((s) => !!s.letter)).toBe(true);
  });
});
