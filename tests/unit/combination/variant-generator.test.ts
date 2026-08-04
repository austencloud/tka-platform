import { beforeAll, describe, expect, it } from "vitest";

import {
  buildRotationFaithfulTwin,
  buildVariants,
  type VariantLiberties,
} from "$lib/shared/combination/services/variant-generator";
import type { Letter } from "$lib/shared/foundation/domain/models/letter";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { WalkSource } from "$lib/shared/combination/domain/types";

import { getAllLetterVariants } from "../../helpers/real-pictograph-loader";
import { FALG, GGGG_CW, HHHH_CW } from "./fixtures";
import { loadPictographDatasetForTests } from "./pictograph-dataset";

const COLORS = [MotionColor.BLUE, MotionColor.RED] as const;

const ALL: VariantLiberties = {
  allowMirror: true,
  allowRotation: true,
  allowColorSwap: true,
  exploreRotationFaithful: true,
};

const NONE: VariantLiberties = {
  allowMirror: false,
  allowRotation: false,
  allowColorSwap: false,
  exploreRotationFaithful: false,
};

/**
 * A step's SPATIAL content — position labels, per-hand locations, rotation
 * direction, motion type. Orientations are deliberately EXCLUDED: see the
 * ground-truth test for why the twin's orientations are provisional.
 */
function spatialKey(step: StepData): string {
  return [
    step.startPosition,
    ">",
    step.endPosition,
    ...COLORS.map((color) => {
      const m = step.motions[color];
      return `${color}:${m.motionType}/${m.rotationDirection}/${m.startLocation}>${m.endLocation}`;
    }),
  ].join(" ");
}

function spatialKeys(seq: SequenceData): string[] {
  return seq.steps.map(spatialKey);
}

type CardSource = Extract<WalkSource, { kind: "cardA" | "cardB" }>;

/** Assert the generator emitted only card sources, and narrow the union. */
function cardSources(sources: readonly WalkSource[]): CardSource[] {
  expect(sources.map((s) => s.kind)).toEqual(sources.map(() => "cardB"));
  return sources.filter((s): s is CardSource => s.kind !== "ambient");
}

/**
 * The cyclic offset k for which `rotate(actual, k)` equals `expected`, or null
 * when no rotation aligns them. A twin starts at its source's LAST end
 * position, so a loop comparison has to allow for the phase shift.
 */
function cyclicOffset(actual: string[], expected: string[]): number | null {
  if (actual.length !== expected.length) return null;
  const n = actual.length;
  for (let k = 0; k < n; k++) {
    let matches = true;
    for (let i = 0; i < n; i++) {
      if (actual[(i + k) % n] !== expected[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return k;
  }
  return null;
}

describe("variant generator — liberty math", () => {
  beforeAll(async () => {
    await loadPictographDatasetForTests();
  });

  it("emits 32 variants at full liberties (4 rotations x mirror x swap x twin)", async () => {
    const variants = cardSources(await buildVariants(GGGG_CW, ALL));
    expect(variants).toHaveLength(32);
  });

  it("emits 2 variants with every liberty off except the twin", async () => {
    const variants = await buildVariants(GGGG_CW, {
      ...NONE,
      exploreRotationFaithful: true,
    });
    expect(variants).toHaveLength(2);
    expect(variants.map((v) => v.id)).toEqual(["B id", "B twin"]);
  });

  it("emits 16 variants with the twin off and everything else on", async () => {
    const variants = cardSources(
      await buildVariants(GGGG_CW, { ...ALL, exploreRotationFaithful: false })
    );
    expect(variants).toHaveLength(16);
    for (const variant of variants) {
      expect(variant.variant.rotationFaithful).toBe(false);
    }
  });

  it("emits exactly one variant with no liberties at all", async () => {
    const variants = cardSources(await buildVariants(GGGG_CW, NONE));
    expect(variants).toHaveLength(1);
    expect(variants[0]!.id).toBe("B id");
    expect(variants[0]!.variant).toEqual({
      rotation: 0,
      mirrored: false,
      colorSwapped: false,
      rotationFaithful: false,
    });
  });

  it("multiplies the enabled liberties, one toggle at a time", async () => {
    const cases: ReadonlyArray<readonly [Partial<VariantLiberties>, number]> = [
      [{ allowRotation: true }, 4],
      [{ allowMirror: true }, 2],
      [{ allowColorSwap: true }, 2],
      [{ allowRotation: true, allowColorSwap: true }, 8],
      [{ allowMirror: true, allowColorSwap: true }, 4],
      [{ allowRotation: true, allowMirror: true }, 8],
      [{ allowMirror: true, exploreRotationFaithful: true }, 4],
    ];
    for (const [overrides, expected] of cases) {
      const variants = await buildVariants(GGGG_CW, { ...NONE, ...overrides });
      expect(variants.length, JSON.stringify(overrides)).toBe(expected);
    }
  });

  it("gives every variant a unique, deterministic id", async () => {
    const variants = await buildVariants(FALG, ALL);
    const ids = variants.map((v) => v.id);
    expect(new Set(ids).size).toBe(32);
    // Sample the naming contract at both ends of the space.
    expect(ids).toContain("B id");
    expect(ids).toContain("B r2+mirror+swap+twin");

    const again = await buildVariants(FALG, ALL);
    expect(again.map((v) => v.id)).toEqual(ids);
  });

  it("preserves grid mode on every variant (even rotations only)", async () => {
    for (const card of [GGGG_CW, FALG]) {
      const variants = cardSources(await buildVariants(card, ALL));
      for (const variant of variants) {
        expect(variant.sequence.gridMode, variant.id).toBe(card.gridMode);
        expect([0, 2, 4, 6]).toContain(variant.variant.rotation);
      }
    }
  });

  it("applies the twin AFTER the spatial and colour transforms", async () => {
    const variants = cardSources(await buildVariants(FALG, ALL));
    const byId = new Map(variants.map((v) => [v.id, v]));
    const spatialOnly = byId.get("B r2+mirror+swap")!;
    const withTwin = byId.get("B r2+mirror+swap+twin")!;

    const twinOfSpatial = await buildRotationFaithfulTwin(spatialOnly.sequence);
    expect(spatialKeys(withTwin.sequence)).toEqual(spatialKeys(twinOfSpatial));
  });
});

describe("rotation-faithful twin — ground truth", () => {
  beforeAll(async () => {
    await loadPictographDatasetForTests();
  });

  it("turns GGGG_CW into the HHHH_CW fixture", async () => {
    // Austen's FLGGFLHH mutation: the prop keeps rotating clockwise while the
    // hand path reverses, and pro->anti falls out. HHHH_CW is the transcribed,
    // dataframe-verified partner of GGGG_CW, so it is the ground truth here.
    const twin = await buildRotationFaithfulTwin(GGGG_CW);

    const offset = cyclicOffset(spatialKeys(twin), spatialKeys(HHHH_CW));
    expect(
      offset === null
        ? `no rotation aligns\n  twin: ${spatialKeys(twin).join("\n        ")}\n  HHHH_CW: ${spatialKeys(HHHH_CW).join("\n        ")}`
        : offset,
      "twin(GGGG_CW) must equal HHHH_CW up to cyclic rotation"
    ).not.toBeNull();
    // GGGG_CW closes on beta1, so the twin starts where HHHH_CW starts.
    expect(offset).toBe(0);

    for (const step of twin.steps) {
      expect(step.letter).toBe("H");
      for (const color of COLORS) {
        expect(step.motions[color].rotationDirection).toBe("cw");
        expect(step.motions[color].motionType).toBe("anti");
      }
    }
    expect(twin.word).toBe("HHHH");

    // ORIENTATIONS ARE DELIBERATELY NOT COMPARED. The twin swaps each motion's
    // start/end orientation, which is a provisional value: the real chain is
    // re-derived downstream by the splice-builder (letter-true rule). HHHH_CW
    // carries the canon anti chain (in>out, out>in, ...), which a raw swap of
    // GGGG_CW's all-IN chain cannot reproduce. Asserting equality here would
    // pin the wrong layer.
    expect(twin.steps.map((s) => s.motions.blue.startOrientation)).not.toEqual(
      HHHH_CW.steps.map((s) => s.motions.blue.startOrientation)
    );
  });

  it("keeps rotation direction and reverses the traversal", async () => {
    const twin = await buildRotationFaithfulTwin(GGGG_CW);
    const source = [...GGGG_CW.steps].reverse();
    twin.steps.forEach((step, i) => {
      const origin = source[i]!;
      expect(step.stepNumber).toBe(i + 1);
      expect(step.startPosition).toBe(origin.endPosition);
      expect(step.endPosition).toBe(origin.startPosition);
      for (const color of COLORS) {
        expect(step.motions[color].startLocation).toBe(
          origin.motions[color].endLocation
        );
        expect(step.motions[color].endLocation).toBe(
          origin.motions[color].startLocation
        );
        expect(step.motions[color].rotationDirection).toBe(
          origin.motions[color].rotationDirection
        );
      }
    });
  });

  it("holds the twin's start position at its own first step", async () => {
    const twin = await buildRotationFaithfulTwin(GGGG_CW);
    const first = twin.steps[0]!;
    expect(twin.startPosition?.startPosition).toBe(first.startPosition);
    expect(twin.startPosition?.gridPosition).toBe(first.startPosition);
    for (const color of COLORS) {
      const hold = twin.startPosition!.motions[color]!;
      expect(hold.motionType).toBe("static");
      expect(hold.startLocation).toBe(first.motions[color].startLocation);
      expect(hold.endLocation).toBe(first.motions[color].startLocation);
    }
  });

  it("re-derives every letter of the asymmetric FALG card", async () => {
    const twin = await buildRotationFaithfulTwin(FALG);
    expect(twin.steps).toHaveLength(8);
    // A null letter would mean the reversed configuration is not a dataframe
    // row. Letters are BLANKED before derivation inside the builder, so nothing
    // here can be an inherited FALG letter.
    for (const step of twin.steps) {
      expect(step.letter, `step ${step.stepNumber}`).not.toBeNull();
    }
    // Empirically derived (2026-08-04) through the real diamond dataframe, then
    // pinned. Not hand-authored: every letter came out of
    // motionQueryHandler.findLetterByMotionConfiguration on the reversed
    // motions. Change it only when the twin definition itself changes.
    //
    // FALG reads G L A F G L A F backwards, and the twin maps each letter to
    // its pro<->anti partner: G->H, L->F, A->B, F->L.
    expect(twin.steps.map((s) => s.letter).join("")).toBe("HFBLHFBL");
    expect(twin.word).toBe("HFBLHFBL");
  });

  it("produces real dataframe rows, not just plausible ones", async () => {
    // The canon check: a letter lookup can only succeed on a configuration the
    // dataframe actually contains, but the POSITION labels are computed
    // separately — this asserts the whole (letter, positions, both motions) row
    // exists, the same membership test the fixtures are held to.
    const rowKey = (
      letter: string | null,
      startPosition: string | null,
      endPosition: string | null,
      blue: MotionData,
      red: MotionData
    ): string => {
      const hand = (m: MotionData) =>
        [
          m.motionType,
          m.rotationDirection,
          m.startLocation,
          m.endLocation,
        ].join("/");
      return [letter, startPosition, endPosition, hand(blue), hand(red)].join(
        " | "
      );
    };

    for (const card of [GGGG_CW, FALG]) {
      const twin = await buildRotationFaithfulTwin(card);
      for (const step of twin.steps) {
        const variants = await getAllLetterVariants(
          step.letter as Letter,
          GridMode.DIAMOND
        );
        const rows = new Set(
          variants.map((v) =>
            rowKey(
              v.letter ?? null,
              v.startPosition ?? null,
              v.endPosition ?? null,
              v.motions.blue!,
              v.motions.red!
            )
          )
        );
        const key = rowKey(
          step.letter,
          step.startPosition,
          step.endPosition,
          step.motions.blue,
          step.motions.red
        );
        expect(
          rows.has(key) ? key : `${key}\n  NOT A DIAMOND DATAFRAME ROW`,
          `twin(${card.word}) step ${step.stepNumber}`
        ).toBe(key);
      }
    }
  });

  it("is an involution on positions, locations and rotations", async () => {
    for (const card of [GGGG_CW, FALG]) {
      const roundTrip = await buildRotationFaithfulTwin(
        await buildRotationFaithfulTwin(card)
      );
      expect(spatialKeys(roundTrip), card.word).toEqual(spatialKeys(card));
      expect(roundTrip.steps.map((s) => s.stepNumber)).toEqual(
        card.steps.map((_, i) => i + 1)
      );
      expect(roundTrip.steps.map((s) => s.letter).join(""), card.word).toBe(
        card.steps.map((s) => s.letter).join("")
      );
    }
  });
});
