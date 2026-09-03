/**
 * The three laws of the layer stack, over randomized stacks rather than one
 * hand-picked example.
 *
 * Decisions D2 and D3 make three claims that either hold for every stack or
 * are not worth stating:
 *
 *   1. The topmost layer that owns a channel owns it WHOLE. What sits beneath
 *      that layer cannot be read through it, so perturbing the lower layer
 *      cannot move the sampled value by so much as an ulp.
 *   2. Corrections are ADDITIVE and live above the layers. They shift the
 *      composed frame by their stated offsets and leave the channels
 *      themselves alone, which is what lets an editor draw the curve the
 *      director authored while the viewer shows the shot the operator took.
 *   3. Promoting a channel is REVERSIBLE. Seeding from what composed
 *      underneath and then changing nothing is a no-op the sampler cannot see.
 *
 * Every assertion is exact equality. `toBeCloseTo` would hide precisely the
 * class of bug these laws exist to catch: a lower layer bleeding a fraction of
 * a millimetre through the layer above it.
 */
import { describe, expect, it } from "vitest";

import {
  buildCameraChannels,
  sampleCameraFrame,
  sampleStoreChannel,
  seedManualChannel,
  CAMERA_FRAME_CHANNEL_IDS,
  type CameraChannelId,
  type CameraCorrection,
  type CameraCorrectionDelta,
  type DirectorCameraFrame,
  type ManualCameraChannel,
} from "../../../src/routes/test/film-director/_lib/director-camera-channels";
import {
  DIRECTOR_EASINGS,
  DIRECTOR_INTERPOLATIONS,
  type ResolvedDirectorCameraKeyframe,
} from "../../../src/routes/test/film-director/_lib/film-director-schema";

/** Deterministic, so a failure reproduces from its case number alone. */
function rngFor(seed: number) {
  let state = (seed + 0x6d2b79f5) >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    float: (min: number, max: number) => min + next() * (max - min),
    int: (maxExclusive: number) => Math.floor(next() * maxExclusive),
    pick: <T>(items: readonly T[]): T =>
      items[Math.floor(next() * items.length)]!,
  };
}

type Rng = ReturnType<typeof rngFor>;

const SCENE_SECONDS = 8;

/** Both ends, the keyframe neighbourhood, and points between. */
const SAMPLE_TIMES = [
  0,
  0.37,
  1,
  2.5,
  3.999,
  4,
  4.001,
  5.5,
  7.25,
  SCENE_SECONDS,
];

/**
 * A random camera track. Never states `aimSpace`, so these stacks aim by point;
 * the angle-aimed path has its own named tests in `camera-aim-channels`.
 */
function randomKeyframes(rng: Rng): ResolvedDirectorCameraKeyframe[] {
  const count = 2 + rng.int(4);
  return Array.from({ length: count }, (_, index) => ({
    atSeconds: Number(((index / (count - 1)) * SCENE_SECONDS).toFixed(3)),
    position: [rng.float(-8, 8), rng.float(0.5, 4), rng.float(-8, 8)] as [
      number,
      number,
      number,
    ],
    target: [rng.float(-3, 3), rng.float(0.5, 2), rng.float(-3, 3)] as [
      number,
      number,
      number,
    ],
    fovDeg: rng.float(20, 70),
    rollDeg: rng.float(-15, 15),
    interpolation: rng.pick(DIRECTOR_INTERPOLATIONS),
    easing: rng.pick(DIRECTOR_EASINGS),
  }));
}

/** A random hand-keyed layer over a random subset of the frame channels. */
function randomManual(rng: Rng): ManualCameraChannel[] {
  return CAMERA_FRAME_CHANNEL_IDS.filter(() => rng.next() < 0.45).map((id) => {
    const count = 1 + rng.int(3);
    return {
      id,
      keys: Array.from({ length: count }, (_, index) => ({
        atSeconds: Number(
          ((index / Math.max(1, count - 1)) * SCENE_SECONDS).toFixed(3)
        ),
        value: rng.float(-10, 10),
        interpolation: rng.pick(DIRECTOR_INTERPOLATIONS),
        easing: rng.pick(DIRECTOR_EASINGS),
      })),
    };
  });
}

/** An offset that does not read the frame, so the additive law stays exact. */
function constantCorrection(
  id: string,
  delta: CameraCorrectionDelta
): CameraCorrection {
  return { id, evaluate: () => delta };
}

function randomDelta(rng: Rng): CameraCorrectionDelta {
  const delta: CameraCorrectionDelta = {};
  for (const id of CAMERA_FRAME_CHANNEL_IDS) {
    if (rng.next() < 0.5) delta[id] = rng.float(-2, 2);
  }
  return delta;
}

/** The eight scalars a frame carries, in `CAMERA_FRAME_CHANNEL_IDS` order. */
function frameValues(frame: DirectorCameraFrame): number[] {
  return [...frame.position, ...frame.target, frame.fovDeg, frame.rollDeg];
}

const CASES = Array.from({ length: 60 }, (_, index) => index + 1);

describe("the topmost owner takes the whole channel", () => {
  it.each(CASES)(
    "case %i: a manual channel ignores the track beneath it",
    (seed) => {
      const rng = rngFor(seed);
      const manual = randomManual(rng);
      if (manual.length === 0) return;
      const owned = manual.map((channel) => channel.id);

      const one = buildCameraChannels({ base: randomKeyframes(rng), manual });
      const other = buildCameraChannels({ base: randomKeyframes(rng), manual });

      for (const at of SAMPLE_TIMES) {
        for (const id of owned) {
          expect(sampleStoreChannel(one, id, at, 0)).toBe(
            sampleStoreChannel(other, id, at, 0)
          );
        }
      }
    }
  );

  it.each(CASES)(
    "case %i: a directive track hides the base entirely",
    (seed) => {
      const rng = rngFor(seed);
      const directive = randomKeyframes(rng);
      const layered = buildCameraChannels({
        base: randomKeyframes(rng),
        directive,
      });
      const alone = buildCameraChannels({ base: directive });

      for (const at of SAMPLE_TIMES) {
        expect(frameValues(sampleCameraFrame(layered, at))).toEqual(
          frameValues(sampleCameraFrame(alone, at))
        );
      }
    }
  );
});

describe("corrections add on top of what the layers composed", () => {
  it.each(CASES)("case %i: two offsets land as their sum, in order", (seed) => {
    const rng = rngFor(seed);
    const sources = { base: randomKeyframes(rng), manual: randomManual(rng) };
    const first = randomDelta(rng);
    const second = randomDelta(rng);

    const plain = buildCameraChannels(sources);
    const corrected = buildCameraChannels({
      ...sources,
      corrections: [
        constantCorrection("first", first),
        constantCorrection("second", second),
      ],
    });

    for (const at of SAMPLE_TIMES) {
      const composed = frameValues(sampleCameraFrame(plain, at));
      const expected = CAMERA_FRAME_CHANNEL_IDS.map(
        (id, index) => composed[index]! + (first[id] ?? 0) + (second[id] ?? 0)
      );
      expect(frameValues(sampleCameraFrame(corrected, at))).toEqual(expected);
    }
  });

  it.each(CASES)(
    "case %i: a correction never moves the curve underneath",
    (seed) => {
      const rng = rngFor(seed);
      const sources = { base: randomKeyframes(rng), manual: randomManual(rng) };
      const plain = buildCameraChannels(sources);
      const corrected = buildCameraChannels({
        ...sources,
        corrections: [constantCorrection("shake", randomDelta(rng))],
      });

      for (const at of SAMPLE_TIMES) {
        for (const id of CAMERA_FRAME_CHANNEL_IDS) {
          expect(sampleStoreChannel(corrected, id, at, 0)).toBe(
            sampleStoreChannel(plain, id, at, 0)
          );
        }
      }
    }
  );
});

describe("promoting a channel is exactly reversible", () => {
  /**
   * Every frame channel is promotable without changing the picture. The aim
   * DIRECTION channels are excluded on purpose: a manual yaw stamps
   * `aimSpace: "angles"`, which switches the segment from aiming at a point to
   * deriving one, so promoting it is a deliberate change of representation
   * rather than a no-op. That trap has its own test in `camera-channel-layers`.
   */
  it.each(CASES)("case %i: seed it, change nothing, see nothing", (seed) => {
    const rng = rngFor(seed);
    const sources = { base: randomKeyframes(rng), manual: randomManual(rng) };
    const before = buildCameraChannels(sources);
    const promoted: CameraChannelId = rng.pick(CAMERA_FRAME_CHANNEL_IDS);
    const after = buildCameraChannels({
      ...sources,
      manual: [
        ...sources.manual.filter((channel) => channel.id !== promoted),
        seedManualChannel(before, promoted),
      ],
    });

    for (const at of SAMPLE_TIMES) {
      expect(frameValues(sampleCameraFrame(after, at))).toEqual(
        frameValues(sampleCameraFrame(before, at))
      );
    }
  });
});
