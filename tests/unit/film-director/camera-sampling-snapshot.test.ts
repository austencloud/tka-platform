/**
 * The sampler's anti-regression gate.
 *
 * `film-resolution-snapshot.test.ts` freezes what RESOLUTION produces: the
 * keyframe list. It says nothing about the curve BETWEEN those keyframes,
 * which is where `sampleDirectorCameraTrack` lives. That gap matters the
 * moment the sampler is refactored, because a Catmull-Rom pass that picks its
 * neighbours differently produces identical keyframes and a different film.
 *
 * This file freezes the sampled frames themselves. It samples every scene of
 * every capability demo at two kinds of time:
 *
 *   - a uniform grid across the track, which catches curve-shape changes; and
 *   - the moments either side of every keyframe, which catches cut, hold and
 *     neighbour-selection changes that a coarse grid would step over.
 *
 * A refactor that claims to preserve behaviour must leave this snapshot
 * untouched. A change that intends to alter the curve must show the diff and
 * justify it in its commit message, exactly as the resolution snapshot demands.
 */
import { describe, expect, it } from "vitest";

import { CAPABILITY_LIBRARY } from "../../../src/routes/test/film-director/_capabilities/index";
import { sampleDirectorCameraTrack } from "../../../src/routes/test/film-director/_lib/director-camera-track";
import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";
import type { ResolvedDirectorCameraKeyframe } from "../../../src/routes/test/film-director/_lib/film-director-schema";

/** Uniform samples taken across each track, endpoints included. */
const GRID_SAMPLES = 21;

/** How far either side of a keyframe to probe for cut and hold behaviour. */
const KEYFRAME_EPSILON = 1e-3;

function round(value: number): number | string {
  if (!Number.isFinite(value)) return `__nonfinite:${value}__`;
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Times worth sampling for one track: a uniform grid plus tight probes around
 * every authored keyframe, deduped and sorted. Times outside the track are
 * included deliberately — clamping at both ends is behaviour too.
 */
function sampleTimes(
  keyframes: readonly ResolvedDirectorCameraKeyframe[]
): number[] {
  if (keyframes.length === 0) return [0];
  const first = keyframes[0]!.atSeconds;
  const last = keyframes.at(-1)!.atSeconds;
  const span = Math.max(last - first, 0);
  const times = new Set<number>([first - 0.5, last + 0.5]);

  for (let index = 0; index < GRID_SAMPLES; index += 1) {
    const progress = GRID_SAMPLES === 1 ? 0 : index / (GRID_SAMPLES - 1);
    times.add(first + span * progress);
  }
  for (const frame of keyframes) {
    times.add(frame.atSeconds - KEYFRAME_EPSILON);
    times.add(frame.atSeconds);
    times.add(frame.atSeconds + KEYFRAME_EPSILON);
  }

  return [...times]
    .map((time) => Math.round(time * 1e6) / 1e6)
    .sort((left, right) => left - right);
}

function sampleTrack(
  keyframes: readonly ResolvedDirectorCameraKeyframe[]
): string {
  const rows = sampleTimes(keyframes).map((atSeconds) => {
    const frame = sampleDirectorCameraTrack(keyframes, atSeconds);
    return {
      t: round(atSeconds),
      position: frame.position.map(round),
      target: frame.target.map(round),
      fovDeg: round(frame.fovDeg),
      rollDeg: round(frame.rollDeg),
    };
  });
  return JSON.stringify(rows, null, 2);
}

describe("camera sampling snapshots", () => {
  for (const entry of CAPABILITY_LIBRARY) {
    it(`"${entry.label}" (${entry.id}) samples to its frozen curve`, () => {
      const spec = resolveFilmDirectorSpec(entry.film);
      const perScene = spec.scenes.map((scene, index) => ({
        scene: index,
        keyframeCount: scene.camera.keyframes.length,
        samples: sampleTrack(scene.camera.keyframes),
      }));
      expect(JSON.stringify(perScene, null, 2)).toMatchSnapshot();
    });
  }
});
