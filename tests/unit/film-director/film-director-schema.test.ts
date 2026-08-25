import { describe, expect, it } from "vitest";

import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";
import { sampleFilmDirector } from "../../../src/routes/test/film-director/_lib/sample-film-director";
import {
  FILM_DIRECTOR_DIRECTIVE_AXES,
  FILM_DIRECTOR_SCHEMA_VERSION_3,
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
        id: "bad-avatar",
        title: "Bad avatar",
        scenes: [
          {
            id: "scene",
            title: "Scene",
            performance: { performers: [{ avatarId: "astronaut" }] },
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
