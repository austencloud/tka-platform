/**
 * Tests for buildBackJob — the main-thread JOB BUILDER that assembles a BackJob
 * (plain data + ImageBitmaps) from a SequenceData.
 *
 * Real rasterization (modern-screenshot + createImageBitmap) and the mandala
 * geometry calculator (browser-only) do NOT run in vitest/jsdom, so every
 * rasterizer dependency + the geometry calculator is injected as a fake via the
 * `deps` parameter. The fakes return sentinel objects and record their args.
 * We assert the assembled BackJob shape: dimensions, parsed gradients, proof-
 * mode decorations === null, the placed-bitmap kinds + their layout placements,
 * the conditional start-pos pictograph, and one loop-icon per active component.
 *
 * The real visual/parity check happens in the browser harness (P1.7).
 */

import { describe, it, expect, vi } from "vitest";

// The rasterizer modules (card-back-bitmaps-constant / -percard) statically
// import these Svelte components, whose real subtrees (PictographRenderer →
// arrow/prop/grid services → firebase/protobufjs) crash vitest at import time
// (`util.Long.fromNumber is not a function`). buildBackJob imports those
// rasterizer modules statically, so we stub the heavy components to light
// identity objects — exactly as the percard rasterizer test does. The builder
// never invokes the real rasterizers here (they're injected as fakes via deps),
// so the stubbed components are never actually mounted.
vi.mock("../../../components/card-back/CardBackBrand.svelte", () => ({ default: {} }));
vi.mock("../../../components/card-back/CardBackUrl.svelte", () => ({ default: {} }));
vi.mock("../../../components/card-back/CardBackLoopIcon.svelte", () => ({ default: {} }));
vi.mock("../../../components/card-back/TurnPatternGlyph.svelte", () => ({ default: {} }));
vi.mock("../../../components/card-back/ReversalPatternGlyph.svelte", () => ({ default: {} }));
vi.mock("../../../components/card-back/StartPositionPictograph.svelte", () => ({ default: {} }));
vi.mock("../../../components/card-back/CardBackStepCount.svelte", () => ({ default: {} }));

import { buildBackJob, type BuildBackJobDeps } from "../card-back-job-builder";
import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
import { computeCardBackLayout } from "../card-back-layout";
import { deriveCardBackData } from "../../../components/card-back/card-back-data";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

const WIDTH = 1644;
const HEIGHT = 2244;
const BLEED = 72;

/** A sentinel ImageBitmap-ish; enough for placement assertions. */
function fakeBitmap(tag: string): ImageBitmap {
  return { __tag: tag, close: vi.fn() } as unknown as ImageBitmap;
}

const EMPTY_PATHS: MandalaPaths = { blue: [], red: [], purple: [] };

/**
 * Build a fully-faked deps object. Each rasterizer returns a tagged sentinel so
 * we can assert WHICH bitmap landed in WHICH placement, and records its args.
 */
function makeFakeDeps(overrides: Partial<BuildBackJobDeps> = {}): {
  deps: BuildBackJobDeps;
  calls: Record<string, unknown[][]>;
} {
  const calls: Record<string, unknown[][]> = {};
  const record = (name: string, args: unknown[]) => {
    (calls[name] ??= []).push(args);
  };

  const deps: BuildBackJobDeps = {
    rasterizeBrand: vi.fn(async (...a) => {
      record("brand", a);
      return fakeBitmap("brand");
    }),
    rasterizeUrl: vi.fn(async (...a) => {
      record("url", a);
      return fakeBitmap("url");
    }),
    rasterizeDifficultyBadge: vi.fn(async (...a) => {
      record("badge", a);
      return fakeBitmap("badge");
    }),
    rasterizeLoopIcon: vi.fn(async (...a) => {
      record("loop", a);
      return fakeBitmap(`loop:${a[0]}`);
    }),
    rasterizeTurnGlyph: vi.fn(async (...a) => {
      record("turn", a);
      return fakeBitmap("turn");
    }),
    rasterizeReversalGlyph: vi.fn(async (...a) => {
      record("reversal", a);
      return fakeBitmap("reversal");
    }),
    rasterizeStepCount: vi.fn(async (...a) => {
      record("step", a);
      return fakeBitmap("step");
    }),
    rasterizeStartPosPictograph: vi.fn(async (...a) => {
      record("startpos", a);
      return fakeBitmap("startpos");
    }),
    rasterizeDecorations: vi.fn(async (...a) => {
      record("deco", a);
      return fakeBitmap("deco");
    }),
    calculatePaths: vi.fn((...a) => {
      record("calc", a);
      return EMPTY_PATHS;
    }),
    rasterizeMandala: vi.fn(async (...a) => {
      record("mandala", a);
      return fakeBitmap("mandala");
    }),
    ...overrides,
  };

  return { deps, calls };
}

/** Minimal sequence: 1 step (keeps the loop resolver on the stored-loopType
 *  path), with a stored loopType so loop components resolve deterministically. */
function makeSequence(extra: Partial<SequenceData> = {}): SequenceData {
  const step = {
    beat: 1,
    letter: "A",
    motions: {
      blue: { motionType: "pro", turns: 0, rotationDirection: "cw" },
      red: { motionType: "pro", turns: 0, rotationDirection: "ccw" },
    },
  };
  return {
    name: "TEST",
    word: "TEST",
    steps: [step],
    loopType: "mirrored_swapped",
    ...extra,
  } as unknown as SequenceData;
}

describe("buildBackJob", () => {
  it("returns a BackJob with the requested dimensions and bleed", async () => {
    const { deps } = makeFakeDeps();
    const job = await buildBackJob(
      makeSequence(),
      { width: WIDTH, height: HEIGHT, bleedPx: BLEED, theme: "cosmic" },
      deps,
    );
    expect(job.width).toBe(1644);
    expect(job.height).toBe(2244);
    expect(job.bleedPx).toBe(72);
  });

  it("parses proof-mode background + border gradients into GradientSpecs", async () => {
    const { deps } = makeFakeDeps();
    const job = await buildBackJob(
      makeSequence(),
      { width: WIDTH, height: HEIGHT, bleedPx: BLEED, theme: "cosmic" },
      deps,
    );
    // Proof-mode background is the white single-layer gradient.
    expect(job.bgGradient.type).toBe("linear");
    expect(job.bgGradient.angleDeg).toBe(180);
    expect(job.bgGradient.stops[0]).toEqual({ offset: 0, color: "#ffffff" });
    // Border is the proof-mode single linear-gradient (135deg start).
    expect(job.borderGradient.type).toBe("linear");
    expect(job.borderGradient.angleDeg).toBe(135);
    expect(job.borderGradient.stops.length).toBeGreaterThan(1);
  });

  it("sets decorations to null in proof mode (decorationOpacity 0)", async () => {
    const { deps, calls } = makeFakeDeps();
    const job = await buildBackJob(
      makeSequence(),
      { width: WIDTH, height: HEIGHT, bleedPx: BLEED, theme: "cosmic" },
      deps,
    );
    expect(job.decorations).toBeNull();
    // Proof mode hides decorations → rasterizeDecorations must NOT be called.
    expect(calls.deco).toBeUndefined();
  });

  it("rasterizes the mandala SVG and places it at its (square) layout box", async () => {
    const { deps, calls } = makeFakeDeps();
    const seq = makeSequence();
    const data = deriveCardBackData(seq);
    const layout = computeCardBackLayout(data, {
      width: WIDTH,
      height: HEIGHT,
      cqi: WIDTH / 100,
    });
    const job = await buildBackJob(
      seq,
      { width: WIDTH, height: HEIGHT, bleedPx: BLEED, theme: "cosmic" },
      deps,
    );

    // The mandala arrives as a pre-rasterized bitmap placed at the layout box.
    expect(job.mandala).not.toBeNull();
    expect((job.mandala!.bitmap as unknown as { __tag: string }).__tag).toBe("mandala");
    expect(job.mandala!.placement).toEqual(layout.mandala);

    // rasterizeMandala was called with (svg, w, h, cacheKey). The SVG is the
    // exact renderMandalaSVG output (carries glow/bloom filters), sized to the
    // square layout box in pixels.
    const args = calls.mandala![0]!;
    const svg = args[0] as string;
    expect(svg).toContain("<svg");
    expect(svg).toContain('filter="url(#glow)"'); // filters present → not the Path2D approximation
    expect(args[1]).toBe(Math.round(layout.mandala.w));
    expect(args[2]).toBe(Math.round(layout.mandala.h));
    expect(typeof args[3]).toBe("string"); // cache key
  });

  it("mirrors SequenceMandala: arc → undefined pathOptions, standard tip dx", async () => {
    const { deps, calls } = makeFakeDeps();
    await buildBackJob(
      makeSequence(),
      { width: WIDTH, height: HEIGHT, bleedPx: BLEED, theme: "cosmic" },
      deps,
    );
    const args = calls.calc![0]!;
    // (steps, bluePropType, redPropType, pathOptions, tipOverride)
    expect(args[1]).toBeUndefined();
    expect(args[2]).toBeUndefined();
    expect(args[3]).toBeUndefined();
    expect(args[4]).toEqual({ dx: 120, dy: 0 });
  });

  it("places the constant + per-card element bitmaps at their layout boxes", async () => {
    const { deps } = makeFakeDeps();
    const seq = makeSequence();
    const data = deriveCardBackData(seq);
    const layout = computeCardBackLayout(data, {
      width: WIDTH,
      height: HEIGHT,
      cqi: WIDTH / 100,
    });
    const job = await buildBackJob(
      seq,
      { width: WIDTH, height: HEIGHT, bleedPx: BLEED, theme: "cosmic" },
      deps,
    );

    const byKind = (k: string) => job.bitmaps.filter((b) => b.kind === k);

    expect(byKind("brand")).toHaveLength(1);
    expect(byKind("brand")[0]!.placement).toEqual(layout.brand);

    expect(byKind("url-ornament")[0]!.placement).toEqual(layout.url);
    expect(byKind("difficulty-badge")[0]!.placement).toEqual(layout.levelBadge);
    expect(byKind("turn-glyph")[0]!.placement).toEqual(layout.topLeftGlyph);
    expect(byKind("reversal-glyph")[0]!.placement).toEqual(layout.topRightGlyph);
    expect(byKind("step-count")[0]!.placement).toEqual(layout.stepCount);
  });

  it("includes a start-pos-pictograph only when the sequence has a startPosition", async () => {
    const { deps: depsNo } = makeFakeDeps();
    const jobNoStart = await buildBackJob(
      makeSequence(),
      { width: WIDTH, height: HEIGHT, bleedPx: BLEED, theme: "cosmic" },
      depsNo,
    );
    expect(jobNoStart.bitmaps.some((b) => b.kind === "start-pos-pictograph")).toBe(false);

    const { deps: depsYes } = makeFakeDeps();
    const seqStart = makeSequence({
      startPosition: { letter: "A", motions: {} } as never,
    });
    const data = deriveCardBackData(seqStart);
    const layout = computeCardBackLayout(data, {
      width: WIDTH,
      height: HEIGHT,
      cqi: WIDTH / 100,
    });
    const jobStart = await buildBackJob(
      seqStart,
      { width: WIDTH, height: HEIGHT, bleedPx: BLEED, theme: "cosmic" },
      depsYes,
    );
    const startBitmaps = jobStart.bitmaps.filter((b) => b.kind === "start-pos-pictograph");
    expect(startBitmaps).toHaveLength(1);
    expect(startBitmaps[0]!.placement).toEqual(layout.startPos);
  });

  it("emits one loop-icon per active component, placed at loopRow.items[i]", async () => {
    const { deps } = makeFakeDeps();
    const seq = makeSequence(); // mirrored_swapped → MIRRORED + SWAPPED
    const data = deriveCardBackData(seq);
    const layout = computeCardBackLayout(data, {
      width: WIDTH,
      height: HEIGHT,
      cqi: WIDTH / 100,
    });
    const job = await buildBackJob(
      seq,
      { width: WIDTH, height: HEIGHT, bleedPx: BLEED, theme: "cosmic" },
      deps,
    );

    const loopBitmaps = job.bitmaps.filter((b) => b.kind === "loop-icon");
    const activeCount = layout.loopRow.items.length;
    expect(activeCount).toBeGreaterThan(0);
    expect(loopBitmaps).toHaveLength(activeCount);
    loopBitmaps.forEach((b, i) => {
      expect(b.placement).toEqual(layout.loopRow.items[i]);
    });
  });

  it("forwards the proof-mode muted text color into the step-count rasterizer", async () => {
    const { deps, calls } = makeFakeDeps();
    await buildBackJob(
      makeSequence(),
      { width: WIDTH, height: HEIGHT, bleedPx: BLEED, theme: "cosmic" },
      deps,
    );
    // rasterizeStepCount(count, w?, h?, textMutedColor)
    const args = calls.step![0]!;
    expect(args[3]).toBe("rgba(0, 0, 0, 0.55)");
  });
});
