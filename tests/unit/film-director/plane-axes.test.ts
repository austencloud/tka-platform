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

describe("per-step changes: stepEffects, stepEfforts, holds", () => {
  it("defaults every performer to three empty lists", () => {
    const spec = resolveFilmDirectorSpec(
      film({ performance: { cast: { count: 2 } } })
    );
    for (const performer of spec.scenes[0]!.performance.performers) {
      expect(performer.stepEffects).toEqual([]);
      expect(performer.stepEfforts).toEqual([]);
      expect(performer.holds).toEqual([]);
    }
  });

  it("resolves literal step effects and step efforts in the order written", () => {
    const spec = resolveFilmDirectorSpec(
      film({
        performance: {
          cast: {
            count: 1,
            performers: [
              {
                id: "performer-1",
                stepEffects: [
                  { step: 0, effect: "none" },
                  { step: 4, effect: "trails" },
                ],
                stepEfforts: [{ step: 8, effort: "punch" }],
              },
            ],
          },
        },
      })
    );
    const performer = spec.scenes[0]!.performance.performers[0]!;
    expect(performer.stepEffects).toEqual([
      { step: 0, effect: "none" },
      { step: 4, effect: "trails" },
    ]);
    expect(performer.stepEfforts).toEqual([{ step: 8, effort: "punch" }]);
  });

  it("resolves a pick on a step entry from the catalog and stays deterministic", () => {
    const doc = film({
      performance: {
        cast: {
          count: 1,
          performers: [
            {
              id: "performer-1",
              stepEffects: [{ step: 2, effect: { pick: "any", not: ["fire"] } }],
            },
          ],
        },
      },
    });
    const first = resolveFilmDirectorSpec(doc).scenes[0]!.performance
      .performers[0]!.stepEffects[0]!;
    const second = resolveFilmDirectorSpec(doc).scenes[0]!.performance
      .performers[0]!.stepEffects[0]!;
    expect(first.effect).not.toBe("fire");
    expect(second).toEqual(first);
  });

  it("gives each step entry its own draw rather than one draw reused", () => {
    const spec = resolveFilmDirectorSpec(
      film({
        performance: {
          cast: {
            count: 1,
            performers: [
              {
                id: "performer-1",
                stepEffects: [
                  { step: 0, effect: { pick: "any" } },
                  { step: 1, effect: { pick: "any" } },
                  { step: 2, effect: { pick: "any" } },
                  { step: 3, effect: { pick: "any" } },
                  { step: 4, effect: { pick: "any" } },
                  { step: 5, effect: { pick: "any" } },
                ],
              },
            ],
          },
        },
      })
    );
    const drawn = spec.scenes[0]!.performance.performers[0]!.stepEffects.map(
      (entry) => entry.effect
    );
    // Independent streams, not one value copied six times. Six draws from a
    // 17-value catalog landing on one value would be a collapsed stream.
    expect(new Set(drawn).size).toBeGreaterThan(1);
  });

  it("rejects distinct and sameAs on a step entry", () => {
    for (const value of [{ pick: "distinct" }, { sameAs: "performer-2" }]) {
      expect(() =>
        resolveFilmDirectorSpec(
          film({
            performance: {
              cast: {
                count: 2,
                performers: [
                  {
                    id: "performer-1",
                    stepEffects: [{ step: 0, effect: value }],
                  },
                ],
              },
            },
          })
        )
      ).toThrow(
        /"stepEffect" supports literals, pick:any, oneOf, and not — distinct\/sameAs are performer-scoped\./
      );
    }
  });

  it("rejects two step entries naming the same step", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        film({
          performance: {
            cast: {
              count: 1,
              performers: [
                {
                  id: "performer-1",
                  stepEffects: [
                    { step: 4, effect: "fire" },
                    { step: 4, effect: "trails" },
                  ],
                },
              ],
            },
          },
        })
      )
    ).toThrow(
      /Scene "s1": performer "performer-1" stepEffects names step 4 twice\./
    );
    expect(() =>
      resolveFilmDirectorSpec(
        film({
          performance: {
            cast: {
              count: 1,
              performers: [
                {
                  id: "performer-1",
                  stepEfforts: [
                    { step: 0, effort: "dab" },
                    { step: 0, effort: "punch" },
                  ],
                },
              ],
            },
          },
        })
      )
    ).toThrow(
      /Scene "s1": performer "performer-1" stepEfforts names step 0 twice\./
    );
  });

  it("rejects overlapping holds and names both", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        film({
          performance: {
            cast: {
              count: 1,
              performers: [
                {
                  id: "performer-1",
                  holds: [
                    { fromStep: 6, steps: 2 },
                    { fromStep: 4, steps: 4 },
                  ],
                },
              ],
            },
          },
        })
      )
    ).toThrow(
      /Scene "s1": performer "performer-1" holds overlap: step 4 for 4 steps and step 6 for 2 steps\./
    );
  });

  it("accepts holds that touch without overlapping, sorted by where they start", () => {
    const spec = resolveFilmDirectorSpec(
      film({
        performance: {
          cast: {
            count: 1,
            performers: [
              {
                id: "performer-1",
                holds: [
                  { fromStep: 8, steps: 2 },
                  { fromStep: 4, steps: 4 },
                ],
              },
            ],
          },
        },
      })
    );
    expect(spec.scenes[0]!.performance.performers[0]!.holds).toEqual([
      { fromStep: 4, steps: 4 },
      { fromStep: 8, steps: 2 },
    ]);
  });

  it("replaces cast defaults rather than merging with them", () => {
    const spec = resolveFilmDirectorSpec(
      film({
        performance: {
          cast: {
            count: 2,
            defaults: {
              stepEffects: [{ step: 0, effect: "goo" }],
              stepEfforts: [{ step: 0, effort: "glide" }],
              holds: [{ fromStep: 0, steps: 2 }],
            },
            performers: [
              {
                id: "performer-1",
                stepEffects: [{ step: 6, effect: "ink" }],
                stepEfforts: [{ step: 6, effort: "punch" }],
                holds: [{ fromStep: 6, steps: 1 }],
              },
            ],
          },
        },
      })
    );
    const [first, second] = spec.scenes[0]!.performance.performers;
    expect(first!.stepEffects).toEqual([{ step: 6, effect: "ink" }]);
    expect(first!.stepEfforts).toEqual([{ step: 6, effort: "punch" }]);
    expect(first!.holds).toEqual([{ fromStep: 6, steps: 1 }]);
    expect(second!.stepEffects).toEqual([{ step: 0, effect: "goo" }]);
    expect(second!.stepEfforts).toEqual([{ step: 0, effort: "glide" }]);
    expect(second!.holds).toEqual([{ fromStep: 0, steps: 2 }]);
  });
});
