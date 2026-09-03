/**
 * The FRAME gate: what the viewer actually receives.
 *
 * Two snapshots already stand behind the camera. `film-resolution-snapshot`
 * freezes the keyframes resolution produces; `camera-sampling-snapshot`
 * freezes the curve between them. Neither sees `handheld` or `tracking`,
 * because both of those were applied downstream of the sampler, in
 * `sampleFilmDirector`, and neither snapshot goes through that function.
 *
 * That gap is the whole subject of phase 2 of the channel architecture, which
 * turns those two modifiers into corrections composed inside the channel
 * store. So this file was written and recorded BEFORE that refactor, against
 * the code it replaces, for the same reason `camera-sampling-snapshot` was
 * written before phase 1: a refactor that claims to preserve behaviour needs a
 * gate that can see the behaviour it claims to preserve.
 *
 * It samples the camera the viewer receives — composition plus corrections —
 * at scene-local times converted to film time, so a shaking scene and a
 * tracking scene are both covered.
 *
 * Design: `docs/superpowers/specs/active/2026-09-02-film-director-channel-architecture-design.md`
 */
import { describe, expect, it } from "vitest";

import { FILM_LIBRARY } from "../../../src/routes/test/film-director/_films/index";
import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";
import { sampleFilmDirector } from "../../../src/routes/test/film-director/_lib/sample-film-director";
import type { ResolvedDirectorScene } from "../../../src/routes/test/film-director/_lib/film-director-schema";

/** Uniform samples across each scene. */
const GRID_SAMPLES = 17;

/** How far either side of a keyframe to probe for cut and hold behaviour. */
const KEYFRAME_EPSILON = 1e-3;

function round(value: number): number | string {
  if (!Number.isFinite(value)) return `__nonfinite:${value}__`;
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Scene-local times worth sampling: a uniform grid plus tight probes around
 * every camera keyframe. Everything is held strictly inside the scene's own
 * window, because a time at or past `durationSeconds` belongs to the next
 * scene and would sample a different camera entirely.
 */
function sceneTimes(scene: ResolvedDirectorScene): number[] {
  const last = Math.max(0, scene.durationSeconds - KEYFRAME_EPSILON);
  const times = new Set<number>();
  for (let index = 0; index < GRID_SAMPLES; index += 1) {
    const progress = index / (GRID_SAMPLES - 1);
    times.add(Math.min(last, scene.durationSeconds * progress));
  }
  for (const frame of scene.camera.keyframes) {
    for (const offset of [-KEYFRAME_EPSILON, 0, KEYFRAME_EPSILON]) {
      times.add(Math.max(0, Math.min(last, frame.atSeconds + offset)));
    }
  }
  return [...times]
    .map((time) => Math.round(time * 1e6) / 1e6)
    .sort((left, right) => left - right);
}

describe("film frame snapshots", () => {
  for (const entry of FILM_LIBRARY) {
    it(`"${entry.label}" (${entry.key}) delivers its frozen frames`, () => {
      const spec = resolveFilmDirectorSpec(entry.film);
      const perScene = spec.scenes.map((scene, index) => ({
        scene: index,
        id: scene.id,
        samples: JSON.stringify(
          sceneTimes(scene).map((atSeconds) => {
            const frame = sampleFilmDirector(
              spec,
              scene.startSeconds + atSeconds
            );
            return {
              t: round(atSeconds),
              position: frame.camera.position.map(round),
              target: frame.camera.target.map(round),
              fovDeg: round(frame.camera.fovDeg),
              rollDeg: round(frame.camera.rollDeg),
            };
          }),
          null,
          2
        ),
      }));
      expect(JSON.stringify(perScene, null, 2)).toMatchSnapshot();
    });
  }
});
