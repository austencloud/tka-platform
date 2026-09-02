import { describe, expect, it } from "vitest";

import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";
import { sampleFilmDirector } from "../../../src/routes/test/film-director/_lib/sample-film-director";
import {
  FILM_DIRECTOR_DIRECTIVE_AXES,
  FILM_DIRECTOR_SCHEMA_VERSION_3,
  FILM_DIRECTOR_SCHEMA_VERSION_4,
  FILM_DIRECTOR_SCHEMA_VERSION_5,
  FilmDirectorInputSchema,
} from "../../../src/routes/test/film-director/_lib/film-director-schema";

describe("film director scene language", () => {
  it("fills contextual defaults into a deterministic, complete scene", () => {
    const film = resolveFilmDirectorSpec({
      version: 1,
      id: "default-proof",
      title: "Default proof",
      scenes: [
        {
          id: "bubbles",
          title: "Bubbles",
          performance: {
            performers: [{ effect: "bubbles" }, { effect: "bubbles" }],
          },
          effectOverrides: { bubbles: { size: 0.35 } },
        },
      ],
    });

    const scene = film.scenes[0]!;
    expect(film.format).toEqual({ width: 1920, height: 1080, fps: 30 });
    expect(scene.location.environmentId).toBe("ocean");
    expect(scene.performance.formation).toBe("grid-2x2");
    expect(scene.performance.performers).toHaveLength(2);
    expect(scene.performance.performers[0]).toMatchObject({
      id: "performer-1",
      prop: "staff",
      effort: "linear",
      beatOffset: 0,
    });
    expect(scene.camera.keyframes[0]!.atSeconds).toBe(0);
    expect(scene.effectOverrides).toEqual({ bubbles: { size: 0.35 } });
    expect(film.durationSeconds).toBe(8);
  });

  it("rejects a cast member that is not deployed", () => {
    expect(() =>
      resolveFilmDirectorSpec({
        version: 1,
        id: "bad-character",
        title: "Bad character",
        scenes: [
          {
            id: "scene",
            title: "Scene",
            performance: { performers: [{ characterId: "astronaut" }] },
          },
        ],
      })
    ).toThrow(/not in the deployed 3D catalog/);
  });

  it("rejects a named effect preset that does not exist", () => {
    expect(() =>
      resolveFilmDirectorSpec({
        version: 1,
        id: "bad-preset",
        title: "Bad preset",
        scenes: [
          {
            id: "scene",
            title: "Scene",
            effectPresets: { fire: "fire-imaginary" },
          },
        ],
      })
    ).toThrow(/has no preset/);
  });

  it("samples one-count performer offsets from the active scene", () => {
    const film = resolveFilmDirectorSpec({
      version: 1,
      id: "canon",
      title: "Canon",
      playback: { loop: false, autoplay: false },
      scenes: [
        {
          id: "tunnel",
          title: "Tunnel",
          durationSeconds: 10,
          performance: {
            bpm: 60,
            formation: "tunnel-stack",
            performers: [
              { id: "a", beatOffset: 0 },
              { id: "b", beatOffset: -1 },
              { id: "c", beatOffset: -2 },
            ],
          },
        },
      ],
    });

    const frame = sampleFilmDirector(film, 3.5);
    expect(frame.sequenceStep).toBeCloseTo(3.5);
    expect(frame.performerStepOffsets).toEqual([0, -1, -2]);
  });

  it("accepts version 2 with seed, cast defaults, and directives", () => {
    const parsed = FilmDirectorInputSchema.parse({
      version: 2,
      id: "v2-film",
      title: "V2",
      seed: { base: 7, axes: { prop: 1 } },
      scenes: [
        {
          id: "s1",
          title: "S1",
          performance: {
            cast: {
              count: 8,
              defaults: { prop: { pick: "distinct" }, effect: "fire" },
              performers: [{ id: "performer-3", effect: "led" }],
            },
          },
        },
      ],
    });
    expect(parsed.version).toBe(2);
  });

  it("accepts schema version 3", () => {
    const parsed = FilmDirectorInputSchema.parse({
      version: FILM_DIRECTOR_SCHEMA_VERSION_3,
      id: "v3-film",
      title: "V3",
      scenes: [{ id: "s1", title: "S1" }],
    });
    expect(parsed.version).toBe(3);
  });

  it("uses characterId in schema version 4", () => {
    const parsed = FilmDirectorInputSchema.parse({
      version: FILM_DIRECTOR_SCHEMA_VERSION_4,
      id: "v4-film",
      title: "V4",
      scenes: [
        {
          id: "s1",
          title: "S1",
          performance: { performers: [{ characterId: "ch01" }] },
        },
      ],
    });
    expect(parsed.scenes[0]?.performance?.performers?.[0]).toMatchObject({
      characterId: "ch01",
    });
  });

  it("normalizes version-4 hand fields without changing seeded plane picks", () => {
    const legacy = FilmDirectorInputSchema.parse({
      version: FILM_DIRECTOR_SCHEMA_VERSION_4,
      id: "hand-migration",
      title: "Hand migration",
      seed: { axes: { bluePlane: 7, redPlane: 11 } },
      scenes: [
        {
          id: "s1",
          title: "S1",
          performance: {
            cast: {
              count: 3,
              defaults: {
                bluePlane: { pick: "distinct" },
                redPlane: { pick: "distinct" },
              },
              performers: [
                {
                  id: "performer-1",
                  stepPlanes: [
                    { step: 2, hand: "blue", plane: { pick: "any" } },
                  ],
                },
              ],
            },
          },
        },
      ],
    });
    const canonical = FilmDirectorInputSchema.parse({
      version: FILM_DIRECTOR_SCHEMA_VERSION_5,
      id: "hand-migration",
      title: "Hand migration",
      seed: { axes: { leftPlane: 7, rightPlane: 11 } },
      scenes: [
        {
          id: "s1",
          title: "S1",
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
                  stepPlanes: [
                    { step: 2, hand: "left", plane: { pick: "any" } },
                  ],
                },
              ],
            },
          },
        },
      ],
    });

    const legacyResolved = resolveFilmDirectorSpec(legacy);
    const canonicalResolved = resolveFilmDirectorSpec(canonical);
    expect(legacyResolved.scenes[0]!.performance.performers).toEqual(
      canonicalResolved.scenes[0]!.performance.performers
    );
  });

  it("migrates avatarId only for legacy film versions", () => {
    const legacy = FilmDirectorInputSchema.parse({
      version: FILM_DIRECTOR_SCHEMA_VERSION_3,
      id: "legacy-character-field",
      title: "Legacy character field",
      scenes: [
        {
          id: "s1",
          title: "S1",
          performance: { performers: [{ avatarId: "ch01" }] },
        },
      ],
    });
    expect(legacy.scenes[0]?.performance?.performers?.[0]).toMatchObject({
      characterId: "ch01",
    });

    expect(() =>
      FilmDirectorInputSchema.parse({
        version: FILM_DIRECTOR_SCHEMA_VERSION_4,
        id: "v4-legacy-field",
        title: "V4 legacy field",
        scenes: [
          {
            id: "s1",
            title: "S1",
            performance: { performers: [{ avatarId: "ch01" }] },
          },
        ],
      })
    ).toThrow(/avatarId/);
  });

  it("upgrades legacy scene units and location fields before validation", () => {
    const parsed = FilmDirectorInputSchema.parse({
      version: 1,
      id: "v1-film",
      title: "V1",
      shots: [
        {
          id: "s1",
          title: "S1",
          scene: { environmentId: "forest", showStage: true },
        },
      ],
    });
    expect(parsed.version).toBe(1);
    expect(parsed).not.toHaveProperty("shots");
    expect(parsed.scenes[0]!.location).toEqual({
      environmentId: "forest",
      showStage: true,
    });
  });

  it("rejects documents containing both scenes and shots", () => {
    expect(() =>
      FilmDirectorInputSchema.parse({
        version: 2,
        id: "ambiguous-units",
        title: "Ambiguous units",
        shots: [{ id: "legacy", title: "Legacy" }],
        scenes: [{ id: "current", title: "Current" }],
      })
    ).toThrow(/both "shots" and "scenes"/);
  });

  it("rejects a unit containing both scene and location", () => {
    expect(() =>
      FilmDirectorInputSchema.parse({
        version: 2,
        id: "ambiguous-location",
        title: "Ambiguous location",
        scenes: [
          {
            id: "s1",
            title: "S1",
            scene: { environmentId: "forest" },
            location: { environmentId: "ocean" },
          },
        ],
      })
    ).toThrow(/both "scene" and "location"/);
  });

  it("rejects both a cast block and a bare performers array", () => {
    expect(() =>
      FilmDirectorInputSchema.parse({
        version: 2,
        id: "x",
        title: "X",
        scenes: [
          {
            id: "s1",
            title: "S1",
            performance: {
              cast: { count: 2 },
              performers: [{}, {}],
            },
          },
        ],
      })
    ).toThrow(/cast/i);
  });

  it("rejects unknown directive keys and exports the axis list", () => {
    expect(() =>
      FilmDirectorInputSchema.parse({
        version: 2,
        id: "x",
        title: "X",
        scenes: [
          {
            id: "s1",
            title: "S1",
            performance: {
              cast: { count: 1, defaults: { prop: { grab: "any" } } },
            },
          },
        ],
      })
    ).toThrow();
    expect(FILM_DIRECTOR_DIRECTIVE_AXES).toContain("prop");
    expect(FILM_DIRECTOR_DIRECTIVE_AXES).toContain("environmentId");
  });
});

describe("beats as a time unit", () => {
  const beatsFilm = (scene: Record<string, unknown>) => ({
    version: FILM_DIRECTOR_SCHEMA_VERSION_4,
    id: "beats-film",
    title: "Beats",
    scenes: [{ id: "s1", title: "S1", ...scene }],
  });

  it("accepts version 4", () => {
    const parsed = FilmDirectorInputSchema.parse(beatsFilm({}));
    expect(parsed.version).toBe(4);
  });

  it("accepts durationBeats on a scene and rejects both units at once", () => {
    const parsed = FilmDirectorInputSchema.parse(
      beatsFilm({ durationBeats: 16 })
    );
    expect(parsed.scenes[0]!.durationBeats).toBe(16);
    expect(() =>
      FilmDirectorInputSchema.parse(
        beatsFilm({ durationSeconds: 8, durationBeats: 16 })
      )
    ).toThrow(/exactly one of/i);
  });

  it("accepts durationBeats on transitions, blocking moves, scene blocking, and camera moves", () => {
    const parsed = FilmDirectorInputSchema.parse(
      beatsFilm({
        durationBeats: 16,
        transition: { kind: "cut", durationBeats: 2 },
        performance: {
          bpm: 120,
          blocking: { endFormation: "line", durationBeats: 8 },
          cast: {
            count: 2,
            performers: [
              {
                id: "performer-2",
                blocking: [
                  { move: "walk", to: { x: 1, z: 0 }, durationBeats: 4 },
                  { move: "stand" },
                ],
              },
            ],
          },
        },
        camera: {
          shotSize: "medium",
          moves: [
            { move: "push-in", durationBeats: 8 },
            { move: "hold", durationBeats: 8 },
          ],
        },
      })
    );
    expect(parsed.scenes[0]!.transition?.durationBeats).toBe(2);
    expect(parsed.scenes[0]!.performance?.blocking?.durationBeats).toBe(8);
    expect(
      parsed.scenes[0]!.performance?.cast?.performers?.[0]?.blocking?.[0]
        ?.durationBeats
    ).toBe(4);
    expect(parsed.scenes[0]!.camera?.moves?.[0]?.durationBeats).toBe(8);
  });

  it("rejects stating both units on a transition, a blocking move, a scene blocking, or a camera move", () => {
    expect(() =>
      FilmDirectorInputSchema.parse(
        beatsFilm({
          transition: { kind: "cut", durationSeconds: 1, durationBeats: 2 },
        })
      )
    ).toThrow(/exactly one of/i);
    expect(() =>
      FilmDirectorInputSchema.parse(
        beatsFilm({
          performance: {
            performers: [
              {
                blocking: [
                  {
                    move: "walk",
                    to: { x: 1, z: 0 },
                    durationSeconds: 2,
                    durationBeats: 4,
                  },
                ],
              },
            ],
          },
        })
      )
    ).toThrow(/exactly one of/i);
    expect(() =>
      FilmDirectorInputSchema.parse(
        beatsFilm({
          performance: {
            cast: { count: 2 },
            blocking: {
              endFormation: "line",
              durationSeconds: 4,
              durationBeats: 8,
            },
          },
        })
      )
    ).toThrow(/exactly one of/i);
    expect(() =>
      FilmDirectorInputSchema.parse(
        beatsFilm({
          camera: {
            shotSize: "medium",
            moves: [{ move: "push-in", durationSeconds: 4, durationBeats: 8 }],
          },
        })
      )
    ).toThrow(/exactly one of/i);
  });

  it("accepts atBeats on a camera keyframe and demands exactly one time unit", () => {
    const parsed = FilmDirectorInputSchema.parse(
      beatsFilm({
        camera: {
          keyframes: [
            { atSeconds: 0, position: [0, 1, -4] },
            { atBeats: 8, position: [0, 1, -2] },
          ],
        },
      })
    );
    expect(parsed.scenes[0]!.camera?.keyframes?.[1]?.atBeats).toBe(8);
    expect(() =>
      FilmDirectorInputSchema.parse(
        beatsFilm({
          camera: {
            keyframes: [{ atSeconds: 1, atBeats: 8, position: [0, 1, -4] }],
          },
        })
      )
    ).toThrow(/exactly one of/i);
    expect(() =>
      FilmDirectorInputSchema.parse(
        beatsFilm({ camera: { keyframes: [{ position: [0, 1, -4] }] } })
      )
    ).toThrow(/exactly one of/i);
  });
});

describe("camera tracking grammar", () => {
  const trackingFilm = (camera: Record<string, unknown>) => ({
    version: FILM_DIRECTOR_SCHEMA_VERSION_5,
    id: "tracking-film",
    title: "Tracking",
    scenes: [{ id: "s1", title: "S1", camera }],
  });

  it("accepts track on a framing subject", () => {
    const parsed = FilmDirectorInputSchema.parse(
      trackingFilm({
        subject: {
          kind: "performer",
          performerId: "performer-1",
          track: "follow",
        },
        shotSize: "medium",
      })
    );
    expect(parsed.scenes[0]!.camera?.subject).toMatchObject({
      track: "follow",
    });
  });

  it("accepts the aim spelling but no other string", () => {
    expect(
      FilmDirectorInputSchema.parse(
        trackingFilm({
          subject: { kind: "performer", performerId: "performer-1", track: true },
          shotSize: "medium",
        })
      ).scenes[0]!.camera?.subject
    ).toMatchObject({ track: true });

    expect(() =>
      FilmDirectorInputSchema.parse(
        trackingFilm({
          subject: {
            kind: "performer",
            performerId: "performer-1",
            track: "aim",
          },
          shotSize: "medium",
        })
      )
    ).toThrow();
  });

  it("rejects track on a preset's target", () => {
    expect(() =>
      FilmDirectorInputSchema.parse(
        trackingFilm({
          preset: "group-orbit",
          target: {
            kind: "performer",
            performerId: "performer-1",
            track: true,
          },
        })
      )
    ).toThrow(/spoken on \\"subject\\"/);
  });

  it("rejects track on a raw keyframe target", () => {
    expect(() =>
      FilmDirectorInputSchema.parse(
        trackingFilm({
          keyframes: [
            {
              atSeconds: 0,
              position: [0, 1, -4],
              target: {
                kind: "performer",
                performerId: "performer-1",
                track: "follow",
              },
            },
          ],
        })
      )
    ).toThrow(/spoken on \\"subject\\"/);
  });
});
