import { describe, expect, it } from "vitest";

import {
  beatsToSeconds,
  convertSceneBeatTimes,
} from "../../../src/routes/test/film-director/_lib/director-beat-times";
import type { DirectorSceneInput } from "../../../src/routes/test/film-director/_lib/film-director-schema";

const baseScene = (
  overrides: Partial<DirectorSceneInput>
): DirectorSceneInput => ({
  id: "s1",
  title: "Scene",
  ...overrides,
});

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
      120
    );
    expect(scene.durationSeconds).toBe(8);
    expect("durationBeats" in scene && scene.durationBeats).toBeFalsy();
  });

  it("leaves a seconds-stated scene untouched", () => {
    const input = baseScene({ durationSeconds: 12 });
    expect(convertSceneBeatTimes(input, 90)).toEqual(input);
  });

  it("converts transition durationBeats at the incoming scene's bpm", () => {
    const scene = convertSceneBeatTimes(
      baseScene({
        transition: { kind: "fade-through-black", durationBeats: 2 },
      } as unknown as Partial<DirectorSceneInput>),
      60
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
      120
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
      60
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
      120
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
        66
      )
    ).toThrow(/96 beats at 66 bpm is 87\.3s/);
    expect(() =>
      convertSceneBeatTimes(
        baseScene({ durationBeats: 96 } as Partial<DirectorSceneInput>),
        66
      )
    ).toThrow(/scenes run 1-60 seconds/i);
  });

  it("rejects a beats-stated transition longer than 3 seconds, speaking beats", () => {
    expect(() =>
      convertSceneBeatTimes(
        baseScene({
          transition: { kind: "cut", durationBeats: 8 },
        } as unknown as Partial<DirectorSceneInput>),
        60
      )
    ).toThrow(/8 beats at 60 bpm is 8(\.0)?s/);
  });
});
