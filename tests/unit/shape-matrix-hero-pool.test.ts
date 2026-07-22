/**
 * Shape-matrix hero pool — construction invariants + public draw.
 *
 * The hero pool constructs realizations at runtime from the 22 baked base words.
 * Two invariants the whole feature rests on (both silent if broken):
 *   1. Every uniform-turn realization loop-CLOSES (no visible snap on the hero).
 *   2. The TnD element must be RE-DERIVED from final geometry — it is not
 *      rotation-invariant for opposite-direction cells (diamond quarter-opp
 *      rotates to box tog-opp). Carrying the nominal mode would mislabel box.
 *
 * These test the construction contract directly against the baked data + CSV
 * (no fetch/window plumbing), then a smoke test exercises the pool's public API.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { hydrateSequence } from "$lib/features/choreo-card/services/sequence-render-hydrator";
import { parseCsvEdges } from "$lib/features/choreo-card/services/pictograph-letter-lookup";
import { buildBaseIndex, resolveBase } from "$lib/shared/shape-matrix/services/tnd-base-index";
import { applyVariationDescriptor } from "$lib/features/choreo-card/services/deck-variation";
import { deriveTnDFromPictograph } from "$lib/shared/pictograph/shared/domain/utils/tnd-deriver";
import { buildFlowerAxis } from "$lib/shared/shape-matrix/domain/flower-signature";
import { applyFilter } from "$lib/shared/shape-matrix/domain/filter-flower-axis";
import { MODE_ORDER } from "$lib/shared/shape-matrix/services/shape-matrix-realizations";
import { TURN_VALUES } from "$lib/features/choreo-card/domain/turn-pattern-parser";
import { Orientation, TnDMode } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { TND_BY_FAMILY } from "$lib/features/choreo-card/domain/tnd-element";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { CardVariation } from "$lib/features/choreo-card/domain/models/DeckRelease";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORDS_PATH = path.join(repoRoot, "static/data/hero/tnd-base-words.json");
const CSV_PATH = path.join(repoRoot, "static/data/pictographs/DiamondPictographDataframe.csv");

const rawWords = JSON.parse(readFileSync(WORDS_PATH, "utf8")) as Record<string, unknown>[];
const edges = parseCsvEdges(readFileSync(CSV_PATH, "utf8"));
const idx = buildBaseIndex(rawWords.map((w) => hydrateSequence(w)));

const TND_MODE_TO_FAMILY: Record<TnDMode, string> = {
  [TnDMode.SPLIT_SAME]: "split-same",
  [TnDMode.TOG_SAME]: "tog-same",
  [TnDMode.QUARTER_SAME]: "quarter-same",
  [TnDMode.SPLIT_OPP]: "split-opp",
  [TnDMode.TOG_OPP]: "tog-opp",
  [TnDMode.QUARTER_OPP]: "quarter-opp",
};
const ALL_FAMILIES = new Set(Object.values(TND_MODE_TO_FAMILY));

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
function build(mode: string, blueStyle: string, redStyle: string, grid: "diamond" | "box", bt: number, rt: number, blueOri: "in" | "out" = "in", redOri: "in" | "out" = "in"): SequenceData | null {
  const base = resolveBase(idx, mode as never, blueStyle, redStyle);
  if (!base) return null;
  const d: CardVariation = {
    turnPattern: `${fmt(bt)}|${fmt(rt)}`,
    gridMode: grid,
    startOriPair: {
      blue: blueOri === "in" ? Orientation.IN : Orientation.OUT,
      red: redOri === "in" ? Orientation.IN : Orientation.OUT,
    },
  };
  return applyVariationDescriptor(base, d, edges).sequence;
}
function familyOf(seq: SequenceData): string | null {
  const step = seq.steps.find((s) => !s.isBlank) ?? seq.steps[0];
  if (!step) return null;
  const { tndMode } = deriveTnDFromPictograph(step as never);
  return tndMode ? TND_MODE_TO_FAMILY[tndMode] : null;
}

describe("hero pool — baked data", () => {
  it("has the 22 base words", () => {
    expect(rawWords).toHaveLength(22);
  });
});

describe("hero pool — closure invariant", () => {
  // The pool's actual cell space, both grids, all turns.
  const axis = buildFlowerAxis();
  const diamond = applyFilter(axis, { style: "all", turns: new Set(TURN_VALUES), ori: "all", grid: "diamond" }, true);
  const box = applyFilter(axis, { style: "all", turns: new Set(TURN_VALUES), ori: "all", grid: "box" }, true);

  it("every resolvable cell-mode loop-closes (no snap)", () => {
    let attempts = 0;
    let closed = 0;
    const run = (blueAxis: typeof diamond, redAxis: typeof diamond, grid: "diamond" | "box") => {
      for (const blue of blueAxis)
        for (const red of redAxis)
          for (const mode of MODE_ORDER) {
            const base = resolveBase(idx, mode, blue.style, red.style);
            if (!base) continue;
            attempts++;
            const d: CardVariation = {
              turnPattern: `${fmt(blue.turns)}|${fmt(red.turns)}`,
              gridMode: grid,
              startOriPair: {
                blue: blue.ori === "in" ? Orientation.IN : Orientation.OUT,
                red: red.ori === "in" ? Orientation.IN : Orientation.OUT,
              },
            };
            if (applyVariationDescriptor(base, d, edges).turnLoopClosed) closed++;
          }
    };
    run(diamond, diamond, "diamond");
    run(box, box, "box");
    expect(attempts).toBeGreaterThan(4000);
    expect(closed).toBe(attempts); // 100% — the pool never ships a snapping loop
  });
});

describe("hero pool — element re-derivation", () => {
  it("same-direction element is grid-invariant (water stays water)", () => {
    expect(familyOf(build("SS", "pro", "pro", "diamond", 1, 1)!)).toBe("split-same");
    expect(familyOf(build("SS", "pro", "pro", "box", 1, 1)!)).toBe("split-same");
  });

  it("opposite-direction element PERMUTES in box (the reason we re-derive)", () => {
    const qoDiamond = familyOf(build("QO", "pro", "pro", "diamond", 1, 1)!);
    const qoBox = familyOf(build("QO", "pro", "pro", "box", 1, 1)!);
    expect(qoDiamond).toBe("quarter-opp");
    expect(qoBox).not.toBe(qoDiamond); // box quarter-opp derives to a different family
    expect(ALL_FAMILIES.has(qoBox!)).toBe(true);
  });

  it("every derived family maps to a real TnD element (icon + accent)", () => {
    const el = TND_BY_FAMILY[familyOf(build("SO", "anti", "pro", "diamond", 2, 2)!)!];
    expect(el).toBeTruthy();
    expect(el!.iconPath).toMatch(/\.png$/);
    expect(el!.accentColor).toMatch(/^#/);
  });
});

describe("hero pool — drawMatrixRealization (public API)", () => {
  let restore: (() => void)[] = [];
  beforeAll(() => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("tnd-base-words")) {
        return { ok: true, json: async () => rawWords } as Response;
      }
      if (url.includes("DiamondPictographDataframe")) {
        return { ok: true, text: async () => readFileSync(CSV_PATH, "utf8") } as Response;
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    restore.push(() => vi.unstubAllGlobals());
  });
  afterAll(() => restore.forEach((r) => r()));

  it("returns a valid sequence + element for a draw", async () => {
    const { drawMatrixRealization } = await import(
      "$lib/shared/landing/data/shape-matrix-hero-pool"
    );
    // Deterministic RNG: fixed value picks the first cell/mode consistently.
    const draw = await drawMatrixRealization({ random: () => 0.01 });
    expect(draw).not.toBeNull();
    expect(draw!.sequence.steps.length).toBeGreaterThan(0);
    expect(ALL_FAMILIES.has(draw!.element.familyId)).toBe(true);
    expect(draw!.element.iconPath).toMatch(/\.png$/);
  });
});
