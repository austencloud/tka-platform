import { describe, expect, it } from "vitest";

import {
  beatsToSeconds,
  convertSceneBeatTimes,
  type SceneBpm,
} from "../../../src/routes/test/film-director/_lib/director-beat-times";
import type { DirectorSceneInput } from "../../../src/routes/test/film-director/_lib/film-director-schema";

const baseScene = (
  overrides: Partial<DirectorSceneInput>
): DirectorSceneInput => ({
  id: "s1",
  title: "Scene",
  ...overrides,
});

/** A director-stated bpm — every existing call site states its bpm, so
 * `stated` defaults true. Pass `false` explicitly to test the unstated
 * "default N bpm" phrasing (see the describeBeats test below). */
const bpm = (value: number, stated = true): SceneBpm => ({ value, stated });

describe("beatsToSeconds", () => {
  it("converts beats at the scene bpm", () => {
    expect(beatsToSeconds(16, 120)).toBe(8);
    expect(beatsToSeconds(8, 66)).toBeCloseTo(7.2727, 3);
  });
});

describe("convertSceneBeatTimes", () => {
  it("converts a scene durationBeats and removes the beats field", () => {
    const scene = convertSceneBeatTimes(
      baseScene({ durationBeats: 16 } as Partial<DirectorSceneInput>),
      bpm(120)
    );
    expect(scene.durationSeconds).toBe(8);
    expect("durationBeats" in scene && scene.durationBeats).toBeFalsy();
  });

  it("leaves a seconds-stated scene untouched, returning the identical reference", () => {
    const input = baseScene({ durationSeconds: 12 });
    // Not just equal content — the converter's own contract is that a scene
    // with nothing to convert is returned BY REFERENCE, never cloned. A
    // `toEqual` here could pass even if the function always cloned.
    expect(convertSceneBeatTimes(input, bpm(90))).toBe(input);
  });

  it("converts transition durationBeats at the incoming scene's bpm", () => {
    const scene = convertSceneBeatTimes(
      baseScene({
        transition: { kind: "fade-through-black", durationBeats: 2 },
      } as unknown as Partial<DirectorSceneInput>),
      bpm(60)
    );
    expect(scene.transition?.durationSeconds).toBe(2);
  });

  it("converts blocking-move, scene-blocking, and camera-move durations", () => {
    const scene = convertSceneBeatTimes(
      baseScene({
        performance: {
          bpm: 120,
          blocking: { endFormation: "line", durationBeats: 8 },
          performers: [
            {
              blocking: [
                { move: "walk", to: { x: 1, z: 0 }, durationBeats: 4 },
                { move: "stand" },
              ],
            },
          ],
        },
        camera: {
          shotSize: "medium",
          moves: [
            { move: "push-in", durationBeats: 8 },
            { move: "hold" },
          ],
        },
      } as unknown as Partial<DirectorSceneInput>),
      bpm(120)
    );
    expect(scene.performance?.blocking?.durationSeconds).toBe(4);
    expect(scene.performance?.performers?.[0]?.blocking?.[0]?.durationSeconds).toBe(2);
    expect(scene.performance?.performers?.[0]?.blocking?.[1]?.durationSeconds).toBeUndefined();
    expect(scene.camera?.moves?.[0]?.durationSeconds).toBe(4);
  });

  it("converts cast defaults and cast performer blocking too", () => {
    const scene = convertSceneBeatTimes(
      baseScene({
        performance: {
          cast: {
            count: 2,
            defaults: {
              blocking: [{ move: "walk", direction: "forward", durationBeats: 4 }],
            },
            performers: [
              { blocking: [{ move: "turn", direction: "left", durationBeats: 2 }] },
            ],
          },
        },
      } as unknown as Partial<DirectorSceneInput>),
      bpm(60)
    );
    expect(
      scene.performance?.cast?.defaults?.blocking?.[0]?.durationSeconds
    ).toBe(4);
    expect(
      scene.performance?.cast?.performers?.[0]?.blocking?.[0]?.durationSeconds
    ).toBe(2);
  });

  it("converts camera keyframe atBeats to atSeconds", () => {
    const scene = convertSceneBeatTimes(
      baseScene({
        camera: {
          keyframes: [
            { atSeconds: 0, position: [0, 1, -4] },
            { atBeats: 8, position: [0, 1, -2] },
          ],
        },
      } as unknown as Partial<DirectorSceneInput>),
      bpm(120)
    );
    expect(scene.camera?.keyframes?.[1]?.atSeconds).toBe(4);
    expect(
      scene.camera?.keyframes?.[1] &&
        "atBeats" in scene.camera.keyframes[1] &&
        scene.camera.keyframes[1].atBeats
    ).toBeFalsy();
  });

  it("rejects a beats-stated scene duration that converts outside 1-60 seconds, speaking beats", () => {
    expect(() =>
      convertSceneBeatTimes(
        baseScene({ durationBeats: 96 } as Partial<DirectorSceneInput>),
        bpm(66)
      )
      // 96 * 60 / 66 = 87.272727...s. Two-decimal formatting keeps this
      // clearly outside the 1-60s range it's being rejected against —
      // toFixed(1) rounds a boundary case like 0.993s to "1.0s", which
      // reads as legal even though the raw value it names was rejected.
    ).toThrow(/96 beats at 66 bpm is 87\.27s/);
    expect(() =>
      convertSceneBeatTimes(
        baseScene({ durationBeats: 96 } as Partial<DirectorSceneInput>),
        bpm(66)
      )
    ).toThrow(/scenes run 1-60 seconds/i);
  });

  it("rejects a beats-stated transition longer than 3 seconds, speaking beats", () => {
    expect(() =>
      convertSceneBeatTimes(
        baseScene({
          transition: { kind: "cut", durationBeats: 8 },
        } as unknown as Partial<DirectorSceneInput>),
        bpm(60)
      )
    ).toThrow(/8 beats at 60 bpm is 8s/);
  });

  it("names an unstated bpm as 'the default N bpm', not a number the director typed", () => {
    expect(() =>
      convertSceneBeatTimes(
        baseScene({ durationBeats: 96 } as Partial<DirectorSceneInput>),
        bpm(90, false)
      )
    ).toThrow(/96 beats at the default 90 bpm is/);
  });

  it("never mutates the original scene, across every beats-bearing path the converter touches", () => {
    // Exercises every path convertSceneBeatTimes reads durationBeats/atBeats
    // from: scene.durationBeats, scene.transition.durationBeats,
    // performance.blocking, performance.performers[].blocking[],
    // performance.cast.defaults.blocking[], performance.cast.performers[].blocking[],
    // camera.moves[], camera.keyframes[].atBeats. All at bpm 120 so every
    // converted value lands inside its field's valid range.
    const original = baseScene({
      durationBeats: 16, // -> 8s
      transition: { kind: "cut", durationBeats: 2 }, // -> 1s
      performance: {
        bpm: 120,
        blocking: { endFormation: "line", durationBeats: 8 }, // -> 4s
        performers: [
          {
            blocking: [
              { move: "walk", to: { x: 1, z: 0 }, durationBeats: 4 }, // -> 2s
              { move: "stand" },
            ],
          },
        ],
        cast: {
          count: 2,
          defaults: {
            blocking: [
              { move: "walk", direction: "forward", durationBeats: 4 }, // -> 2s
            ],
          },
          performers: [
            { blocking: [{ move: "turn", direction: "left", durationBeats: 2 }] }, // -> 1s
          ],
        },
      },
      camera: {
        shotSize: "medium",
        moves: [
          { move: "push-in", durationBeats: 8 }, // -> 4s
          { move: "hold" },
        ],
        keyframes: [
          { atSeconds: 0, position: [0, 1, -4] },
          { atBeats: 8, position: [0, 1, -2] }, // -> 4s
        ],
      },
    } as unknown as Partial<DirectorSceneInput>);
    const originalClone = structuredClone(original);

    const converted = convertSceneBeatTimes(original, bpm(120));

    expect(original).toEqual(originalClone);
    // Sanity: the converter actually did something, so a no-op converter
    // couldn't pass this test by doing nothing.
    expect(converted).not.toBe(original);
    expect(converted.durationSeconds).toBe(8);
  });
});
