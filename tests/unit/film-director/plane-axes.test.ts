import { describe, expect, it } from "vitest";
import { Plane } from "@austencloud/scene-3d";

import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";

const PLANE_VALUES = Object.values(Plane) as Plane[];

function film(
  scene: Record<string, unknown>,
  extras: Record<string, unknown> = {}
) {
  return {
    version: 2,
    id: "plane-film",
    title: "Plane Film",
    scenes: [{ id: "s1", title: "S1", ...scene }],
    ...extras,
  };
}

describe("plane axes: leftPlane, rightPlane, stepPlanes, visiblePlanes", () => {
  it("defaults every performer to wall/wall, empty stepPlanes, and scene.visiblePlanes to []", () => {
    const spec = resolveFilmDirectorSpec(
      film({ performance: { cast: { count: 3 } } })
    );
    const scene = spec.scenes[0]!;
    for (const performer of scene.performance.performers) {
      expect(performer.leftPlane).toBe(Plane.WALL);
      expect(performer.rightPlane).toBe(Plane.WALL);
      expect(performer.stepPlanes).toEqual([]);
    }
    expect(scene.location.visiblePlanes).toEqual([]);
  });

  it("resolves distinct leftPlane across 8 performers deterministically", () => {
    const doc = film({
      performance: {
        cast: { count: 8, defaults: { leftPlane: { pick: "distinct" } } },
      },
    });
    const first = resolveFilmDirectorSpec(doc);
    const second = resolveFilmDirectorSpec(doc);
    const firstPlanes = first.scenes[0]!.performance.performers.map(
      (performer) => performer.leftPlane
    );
    expect(firstPlanes).toHaveLength(8);
    expect(new Set(firstPlanes).size).toBe(8);
    expect(
      second.scenes[0]!.performance.performers.map(
        (performer) => performer.leftPlane
      )
    ).toEqual(firstPlanes);
  });

  it("resolves sameAs on rightPlane by copying the same axis from the named performer", () => {
    const spec = resolveFilmDirectorSpec(
      film({
        performance: {
          cast: {
            count: 2,
            performers: [
              { id: "performer-1", rightPlane: "wheel" },
              { id: "performer-2", rightPlane: { sameAs: "performer-1" } },
            ],
          },
        },
      })
    );
    const performers = spec.scenes[0]!.performance.performers;
    expect(performers[0]!.rightPlane).toBe("wheel");
    expect(performers[1]!.rightPlane).toBe("wheel");
    // sameAs only ever copies the SAME axis — leftPlane stays at its own
    // (unstated, default) resolution and is not pulled from performer-1's
    // rightPlane.
    expect(performers[1]!.leftPlane).toBe(Plane.WALL);
  });

  it("never resolves leftPlane to wall under a not:wall directive", () => {
    const spec = resolveFilmDirectorSpec(
      film({
        performance: {
          cast: { count: 5, defaults: { leftPlane: { not: "wall" } } },
        },
      })
    );
    for (const performer of spec.scenes[0]!.performance.performers) {
      expect(performer.leftPlane).not.toBe("wall");
    }
  });

  it("rejects an unknown plane literal, naming it in the schema error", () => {
    let caught: unknown;
    try {
      resolveFilmDirectorSpec(
        film({
          performance: {
            cast: { count: 1, performers: [{ leftPlane: "chainsaw" }] },
          },
        })
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    // Schema-level rejections come back as a ZodError, whose `.message` is
    // the JSON-stringified issue list — so the refine's own embedded quotes
    // come through backslash-escaped in `String(error)`. Same reasoning as
    // tests/unit/film-director/directive-corpus/nonexistent.ts.
    expect(String(caught)).toContain('Unknown plane \\"chainsaw\\"');
    expect(String(caught)).toContain("Planes: wall, wheel, floor");
  });

  it("rejects distinct over a narrowed pool with the pool-too-small message", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        film({
          performance: {
            cast: {
              count: 3,
              defaults: {
                leftPlane: { pick: "distinct", from: ["wall", "wheel"] },
              },
            },
          },
        })
      )
    ).toThrow(
      /distinct values were requested for 3 performers but the allowed pool has only 2 \(wall, wheel\)\./
    );
  });

  it("resolves a pick:any stepPlanes entry to a catalog member", () => {
    const spec = resolveFilmDirectorSpec(
      film({
        performance: {
          cast: {
            count: 1,
            performers: [
              {
                id: "performer-1",
                stepPlanes: [
                  { step: 2, hand: "right", plane: { pick: "any" } },
                ],
              },
            ],
          },
        },
      })
    );
    const entry = spec.scenes[0]!.performance.performers[0]!.stepPlanes[0]!;
    expect(entry).toMatchObject({ step: 2, hand: "right" });
    expect(PLANE_VALUES).toContain(entry.plane);
  });

  it("rerolls only stepPlane results when seed.axes.stepPlane bumps, leaving leftPlane/rightPlane untouched", () => {
    const doc = film({
      performance: {
        cast: {
          count: 3,
          defaults: {
            leftPlane: { pick: "distinct" },
            rightPlane: { pick: "distinct" },
          },
          performers: [
            {
              id: "performer-1",
              stepPlanes: [0, 1, 2, 3, 4, 5].map((step) => ({
                step,
                hand: "left" as const,
                plane: { pick: "any" as const },
              })),
            },
          ],
        },
      },
    });

    const base = resolveFilmDirectorSpec(doc);
    const again = resolveFilmDirectorSpec(doc);
    expect(again.scenes[0]!.performance.performers).toEqual(
      base.scenes[0]!.performance.performers
    );

    const rerolled = resolveFilmDirectorSpec({
      ...doc,
      seed: { axes: { stepPlane: 9 } },
    });

    const basePlanes =
      base.scenes[0]!.performance.performers[0]!.stepPlanes.map(
        (entry) => entry.plane
      );
    const rerolledPlanes =
      rerolled.scenes[0]!.performance.performers[0]!.stepPlanes.map(
        (entry) => entry.plane
      );
    expect(rerolledPlanes).not.toEqual(basePlanes);

    expect(
      rerolled.scenes[0]!.performance.performers.map(
        (performer) => performer.leftPlane
      )
    ).toEqual(
      base.scenes[0]!.performance.performers.map(
        (performer) => performer.leftPlane
      )
    );
    expect(
      rerolled.scenes[0]!.performance.performers.map(
        (performer) => performer.rightPlane
      )
    ).toEqual(
      base.scenes[0]!.performance.performers.map(
        (performer) => performer.rightPlane
      )
    );
  });

  it("rejects duplicate values in scene.visiblePlanes, naming the duplicate", () => {
    let caught: unknown;
    try {
      resolveFilmDirectorSpec(
        film({
          location: { visiblePlanes: ["wall", "wheel", "wall"] },
          performance: { cast: { count: 1 } },
        })
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    expect(String(caught)).toContain(
      'scene.visiblePlanes lists \\"wall\\" twice.'
    );
  });

  it("rejects distinct at stepPlane scope with the scene-scope rejection message", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        film({
          performance: {
            cast: {
              count: 1,
              performers: [
                {
                  id: "performer-1",
                  stepPlanes: [
                    { step: 0, hand: "left", plane: { pick: "distinct" } },
                  ],
                },
              ],
            },
          },
        })
      )
    ).toThrow(
      /"stepPlane" supports literals, pick:any, oneOf, and not — distinct\/sameAs are performer-scoped\./
    );
  });

  it("rejects sameAs at stepPlane scope with the scene-scope rejection message", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        film({
          performance: {
            cast: {
              count: 1,
              performers: [
                {
                  id: "performer-1",
                  stepPlanes: [
                    { step: 0, hand: "left", plane: { sameAs: "performer-1" } },
                  ],
                },
              ],
            },
          },
        })
      )
    ).toThrow(
      /"stepPlane" supports literals, pick:any, oneOf, and not — distinct\/sameAs are performer-scoped\./
    );
  });

  it("a performer's stepPlanes replaces cast defaults rather than merging with them", () => {
    const spec = resolveFilmDirectorSpec(
      film({
        performance: {
          cast: {
            count: 2,
            defaults: {
              stepPlanes: [{ step: 0, hand: "left", plane: "wheel" }],
            },
            performers: [
              {
                id: "performer-1",
                stepPlanes: [{ step: 5, hand: "right", plane: "floor" }],
              },
            ],
          },
        },
      })
    );
    const performers = spec.scenes[0]!.performance.performers;
    // performer-1 stated its own list — it REPLACES the cast default list,
    // it does not gain the default's step-0 entry too.
    expect(performers[0]!.stepPlanes).toEqual([
      { step: 5, hand: "right", plane: "floor" },
    ]);
    // performer-2 didn't state anything, so it falls through to the cast
    // default list untouched.
    expect(performers[1]!.stepPlanes).toEqual([
      { step: 0, hand: "left", plane: "wheel" },
    ]);
  });
});
