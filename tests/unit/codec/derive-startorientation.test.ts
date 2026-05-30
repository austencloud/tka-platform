import { describe, it, expect } from "vitest";
import {
  encodeSequence,
  decodeSequence,
} from "$lib/shared/navigation/services/sequence-encoder";
import {
  MotionType,
  RotationDirection,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

function motion(over: Record<string, unknown> = {}) {
  return {
    motionType: MotionType.PRO,
    rotationDirection: RotationDirection.CLOCKWISE,
    startLocation: GridLocation.NORTH,
    endLocation: GridLocation.EAST,
    turns: 0,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    propType: PropType.STAFF,
    ...over,
  } as never;
}

function step(stepNumber: number, blue: unknown, red: unknown) {
  return {
    stepNumber, duration: 1, blueReversal: false, redReversal: false, isBlank: false,
    motions: { blue, red },
    id: `s${stepNumber}`, letter: null, startPosition: null, endPosition: null,
  };
}

function sequence(steps: unknown[]) {
  return {
    id: "x", name: "", word: "", steps,
    thumbnails: [], isFavorite: false, isCircular: false, tags: [], metadata: {}, sequenceLength: steps.length - 1,
  } as never;
}

describe("startOrientation chains from the seed, not stored per-motion", () => {
  // A 2-step sequence with a physically consistent chain (each startOri == the
  // previous endOri, per hand). In the canonical format neither start nor end
  // orientation is stored per motion — the decoder chains startOri from the
  // start-position seed and derives every endOri. Round-tripping must reproduce
  // every orientation.
  function buildConsistent() {
    // start position: both hands static, in/in (the seed)
    const spBlue = motion({ motionType: MotionType.STATIC, startLocation: GridLocation.NORTH, endLocation: GridLocation.NORTH, rotationDirection: RotationDirection.NO_ROTATION, startOrientation: Orientation.IN, endOrientation: Orientation.IN });
    const spRed = motion({ motionType: MotionType.STATIC, startLocation: GridLocation.SOUTH, endLocation: GridLocation.SOUTH, rotationDirection: RotationDirection.NO_ROTATION, startOrientation: Orientation.IN, endOrientation: Orientation.IN });

    // step 1: blue pro 0 (in->in; n->e cw orbit, cw rot), red anti 0 (in->out; s->w cw orbit, ccw rot)
    const s1Blue = motion({ rotationDirection: RotationDirection.CLOCKWISE, startLocation: GridLocation.NORTH, endLocation: GridLocation.EAST, startOrientation: Orientation.IN, endOrientation: Orientation.IN });
    const s1Red = motion({ rotationDirection: RotationDirection.COUNTER_CLOCKWISE, startLocation: GridLocation.SOUTH, endLocation: GridLocation.WEST, startOrientation: Orientation.IN, endOrientation: Orientation.OUT });

    // step 2: blue pro 0 (in->in; e->s cw orbit, cw rot), red anti 0 (out->in; w->n cw orbit, ccw rot)
    const s2Blue = motion({ rotationDirection: RotationDirection.CLOCKWISE, startLocation: GridLocation.EAST, endLocation: GridLocation.SOUTH, startOrientation: Orientation.IN, endOrientation: Orientation.IN });
    const s2Red = motion({ rotationDirection: RotationDirection.COUNTER_CLOCKWISE, startLocation: GridLocation.WEST, endLocation: GridLocation.NORTH, startOrientation: Orientation.OUT, endOrientation: Orientation.IN });

    return sequence([
      step(0, spBlue, spRed),
      step(1, s1Blue, s1Red),
      step(2, s2Blue, s2Red),
    ]);
  }

  it("round-trip reproduces every startOrientation and endOrientation", () => {
    const original = buildConsistent();
    const encoded = encodeSequence(original);
    expect(encoded).not.toMatch(/^v[123]\|/);

    const derived = decodeSequence(encoded);

    // start position (stepNumber 0) -> startPosition, not in steps[]
    for (const c of ["blue", "red"] as const) {
      const o = (original as never as { steps: { motions: Record<string, { startOrientation: Orientation; endOrientation: Orientation }> }[] }).steps[0].motions[c];
      const d = derived.startPosition!.motions[c];
      expect(d!.startOrientation, `startPos ${c} startOri`).toBe(o.startOrientation);
      expect(d!.endOrientation, `startPos ${c} endOri`).toBe(o.endOrientation);
    }

    // real steps land at derived.steps[0..] (stepNumber 1+)
    const origSteps = (original as never as { steps: { motions: Record<string, { startOrientation: Orientation; endOrientation: Orientation }> }[] }).steps;
    expect(derived.steps.length).toBe(origSteps.length - 1);
    for (let i = 0; i < derived.steps.length; i++) {
      for (const c of ["blue", "red"] as const) {
        const o = origSteps[i + 1].motions[c];
        const d = derived.steps[i]!.motions[c];
        expect(d!.startOrientation, `step ${i} ${c} startOri`).toBe(o.startOrientation);
        expect(d!.endOrientation, `step ${i} ${c} endOri`).toBe(o.endOrientation);
      }
    }
  });

  it("seed carries a non-default (nonradial) start orientation through the chain", () => {
    // blue starts counter (nonradial); chain must preserve it as step-1 startOri.
    const spBlue = motion({ motionType: MotionType.STATIC, startLocation: GridLocation.NORTH, endLocation: GridLocation.NORTH, rotationDirection: RotationDirection.NO_ROTATION, startOrientation: Orientation.COUNTER, endOrientation: Orientation.COUNTER });
    const spRed = motion({ motionType: MotionType.STATIC, startLocation: GridLocation.SOUTH, endLocation: GridLocation.SOUTH, rotationDirection: RotationDirection.NO_ROTATION, startOrientation: Orientation.IN, endOrientation: Orientation.IN });
    const s1Blue = motion({ motionType: MotionType.PRO, rotationDirection: RotationDirection.CLOCKWISE, startLocation: GridLocation.NORTH, endLocation: GridLocation.EAST, startOrientation: Orientation.COUNTER, endOrientation: Orientation.COUNTER });
    const s1Red = motion({ motionType: MotionType.PRO, rotationDirection: RotationDirection.CLOCKWISE, startLocation: GridLocation.SOUTH, endLocation: GridLocation.WEST, startOrientation: Orientation.IN, endOrientation: Orientation.IN });

    const original = sequence([
      step(0, spBlue, spRed),
      step(1, s1Blue, s1Red),
    ]);
    const derived = decodeSequence(encodeSequence(original));

    expect(derived.startPosition!.motions.blue!.startOrientation).toBe(Orientation.COUNTER);
    expect(derived.steps[0]!.motions.blue!.startOrientation).toBe(Orientation.COUNTER);
    expect(derived.steps[0]!.motions.red!.startOrientation).toBe(Orientation.IN);
  });
});
