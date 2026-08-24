// tests/unit/film-director/director-viewer-adapter.test.ts
/**
 * Task 3 of docs/superpowers/plans/2026-08-24-film-director-plane-axes.md:
 * "wire resolved planes into the viewer." Task 2 (already landed) taught
 * `resolveFilmDirectorSpec` to resolve bluePlane/redPlane/stepPlanes per
 * performer and scene.visiblePlanes per shot. This file proves the adapter
 * actually carries those resolved values onto the viewer/avatar-instance
 * layer:
 *
 *  (a) `buildDirectorViewerSeed` puts the resolved planes on the seed.
 *  (b) `applyDirectorShotToViewer` clears a PREVIOUS shot's per-step plane
 *      overrides before the next shot's (possibly empty) list is applied -
 *      a stale override must never bleed into a cut that doesn't repeat it.
 *  (c) `applyDirectorShotToViewer` sets whole-sequence hand planes on a
 *      REUSED performer instance across a shot transition.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { Plane } from "@austencloud/scene-3d";

import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";
import {
  applyDirectorShotToViewer,
  buildDirectorViewerSeed,
} from "../../../src/routes/test/film-director/_lib/director-viewer-adapter";
import { createViewer3DStateForTest } from "../3d-viewer/viewer3d-test-helpers.svelte";
import { __resetWebGL2CapabilityForTests } from "$lib/shared/3d/capabilities/webgl-capabilities";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import demoSequenceJson from "$lib/shared/landing/data/demo-sequence.json";

const demoSequence = demoSequenceJson as unknown as SequenceData;

// jsdom doesn't implement canvas.getContext - stub it so the WebGL2
// capability probe sees "not supported" rather than throwing. Same pattern
// as tests/unit/3d-viewer/viewer3d-integration.test.ts.
beforeAll(() => {
  const originalCreateElement = document.createElement as unknown as (
    tag: string
  ) => unknown;
  (
    document as unknown as { createElement: (tag: string) => unknown }
  ).createElement = (tag: string) => {
    const base = originalCreateElement(tag) as Record<string, unknown>;
    if (tag === "canvas") {
      base.getContext = () => null;
    }
    return base;
  };
  __resetWebGL2CapabilityForTests();
});

function film(shot: Record<string, unknown>, extras: Record<string, unknown> = {}) {
  return {
    version: 2,
    id: "viewer-adapter-film",
    title: "Viewer Adapter Film",
    shots: [{ id: "s1", title: "S1", ...shot }],
    ...extras,
  };
}

describe("buildDirectorViewerSeed carries resolved planes", () => {
  it("seeds each performer's customBluePlane/customRedPlane from the resolved bluePlane/redPlane", () => {
    const spec = resolveFilmDirectorSpec(
      film({
        performance: {
          cast: {
            count: 2,
            performers: [
              { id: "performer-1", bluePlane: "wheel", redPlane: "floor" },
              { id: "performer-2", bluePlane: "right-shield" },
            ],
          },
        },
      })
    );
    const shot = spec.shots[0]!;
    const seed = buildDirectorViewerSeed(shot);

    expect(seed.performers).toHaveLength(2);
    shot.performance.performers.forEach((performer, index) => {
      const seededPerformer = seed.performers![index]!;
      expect(seededPerformer.customBluePlane).toBe(performer.bluePlane);
      expect(seededPerformer.customRedPlane).toBe(performer.redPlane);
    });
    expect(seed.performers![0]!.customBluePlane).toBe(Plane.WHEEL);
    expect(seed.performers![0]!.customRedPlane).toBe(Plane.FLOOR);
    expect(seed.performers![1]!.customBluePlane).toBe(Plane.RIGHT_SHIELD);
  });

  it("seeds visiblePlanes from the resolved scene.visiblePlanes", () => {
    const spec = resolveFilmDirectorSpec(
      film({
        scene: { visiblePlanes: ["wall", "wheel"] },
        performance: { cast: { count: 1 } },
      })
    );
    const shot = spec.shots[0]!;
    expect(shot.scene.visiblePlanes).toEqual([Plane.WALL, Plane.WHEEL]);

    const seed = buildDirectorViewerSeed(shot);
    expect(seed.visiblePlanes).toEqual([Plane.WALL, Plane.WHEEL]);
  });

  it("defaults to no visible planes when the shot doesn't request any", () => {
    const spec = resolveFilmDirectorSpec(
      film({ performance: { cast: { count: 1 } } })
    );
    const seed = buildDirectorViewerSeed(spec.shots[0]!);
    expect(seed.visiblePlanes).toEqual([]);
  });
});

describe("applyDirectorShotToViewer wires planes onto real avatar instances", () => {
  it("sets hand planes and step overrides on shot A, then on shot B (reused instance) clears A's stale step overrides and applies B's own hand planes", () => {
    const { state, dispose } = createViewer3DStateForTest({});
    try {
      state.performerManager.initialize();
      state.loadSequenceScoped(demoSequence);
      expect(state.currentSequenceData).toEqual(demoSequence);
      expect(state.performerManager.performers).toHaveLength(1);

      const shotA = resolveFilmDirectorSpec(
        film({
          performance: {
            cast: {
              count: 1,
              performers: [
                {
                  id: "performer-1",
                  bluePlane: "wheel",
                  redPlane: "floor",
                  stepPlanes: [
                    { step: 1, hand: "blue", plane: "floor" },
                    { step: 3, hand: "red", plane: "wheel" },
                  ],
                },
              ],
            },
          },
        })
      ).shots[0]!;

      applyDirectorShotToViewer(state, shotA, { reservedPerformerCount: 1 });

      const performer = state.performerManager.performers[0]!;
      // Reused-instance identity across the whole test: shot A and shot B
      // both target this exact AvatarInstanceState.
      expect(state.performerManager.performers).toHaveLength(1);

      expect(performer.customBluePlane).toBe(Plane.WHEEL);
      expect(performer.customRedPlane).toBe(Plane.FLOOR);
      // Un-overridden hands report the performer's effective whole-sequence
      // plane (wheel/floor here), not a hardcoded WALL.
      expect(performer.getStepPlanes(1)).toEqual({
        blue: Plane.FLOOR,
        red: Plane.FLOOR,
      });
      expect(performer.getStepPlanes(3)).toEqual({
        blue: Plane.WHEEL,
        red: Plane.WHEEL,
      });
      // A step nobody touched reports the whole-sequence hand planes.
      expect(performer.getStepPlanes(0)).toEqual({
        blue: Plane.WHEEL,
        red: Plane.FLOOR,
      });

      const shotB = resolveFilmDirectorSpec(
        film({
          performance: {
            cast: {
              count: 1,
              performers: [
                {
                  id: "performer-1",
                  bluePlane: "right-shield",
                  redPlane: "wall",
                },
              ],
            },
          },
        })
      ).shots[0]!;

      applyDirectorShotToViewer(state, shotB, { reservedPerformerCount: 1 });

      // Still the same single pooled instance - proves (c): hand planes were
      // set on a REUSED performer, not a freshly created one.
      expect(state.performerManager.performers).toHaveLength(1);
      expect(state.performerManager.performers[0]).toBe(performer);

      expect(performer.customBluePlane).toBe(Plane.RIGHT_SHIELD);
      expect(performer.customRedPlane).toBe(Plane.WALL);

      // Proves (b): shot A's per-step overrides do not survive into shot B,
      // which declares no stepPlanes of its own. Every step reports shot B's
      // whole-sequence hand planes.
      expect(performer.getStepPlanes(1)).toEqual({
        blue: Plane.RIGHT_SHIELD,
        red: Plane.WALL,
      });
      expect(performer.getStepPlanes(3)).toEqual({
        blue: Plane.RIGHT_SHIELD,
        red: Plane.WALL,
      });
    } finally {
      dispose();
    }
  });

  it("backfills loadSequence onto a pooled performer created beyond the first shot's cast, so its step-plane overrides are not silently dropped", () => {
    const { state, dispose } = createViewer3DStateForTest({});
    try {
      state.performerManager.initialize();
      state.loadSequenceScoped(demoSequence);
      expect(state.performerManager.performers).toHaveLength(1);

      const shot = resolveFilmDirectorSpec(
        film({
          performance: {
            cast: {
              count: 2,
              performers: [
                { id: "performer-1" },
                {
                  id: "performer-2",
                  bluePlane: "floor",
                  stepPlanes: [{ step: 2, hand: "blue", plane: "floor" }],
                },
              ],
            },
          },
        })
      ).shots[0]!;

      // reservedPerformerCount: 2 forces ensurePerformerCount to grow the
      // pool - the newly created 2nd performer never went through enter3D's
      // sequence load, so without the adapter's backfill its
      // setStepHandPlane call below would no-op forever.
      applyDirectorShotToViewer(state, shot, { reservedPerformerCount: 2 });

      expect(state.performerManager.performers).toHaveLength(2);
      const secondPerformer = state.performerManager.performers[1]!;
      expect(secondPerformer.hasSequence).toBe(true);
      expect(secondPerformer.customBluePlane).toBe(Plane.FLOOR);
      expect(secondPerformer.getStepPlanes(2)).toEqual({
        blue: Plane.FLOOR,
        red: Plane.WALL,
      });
    } finally {
      dispose();
    }
  });
});
