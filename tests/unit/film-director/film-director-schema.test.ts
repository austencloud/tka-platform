import { describe, expect, it } from "vitest";

import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";
import { sampleFilmDirector } from "../../../src/routes/test/film-director/_lib/sample-film-director";

describe("film director scene language", () => {
  it("fills contextual defaults into a deterministic, complete shot", () => {
    const film = resolveFilmDirectorSpec({
      version: 1,
      id: "default-proof",
      title: "Default proof",
      shots: [
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

    const shot = film.shots[0]!;
    expect(film.format).toEqual({ width: 1920, height: 1080, fps: 30 });
    expect(shot.scene.environmentId).toBe("ocean");
    expect(shot.performance.formation).toBe("grid-2x2");
    expect(shot.performance.performers).toHaveLength(2);
    expect(shot.performance.performers[0]).toMatchObject({
      id: "performer-1",
      prop: "staff",
      effort: "linear",
      beatOffset: 0,
    });
    expect(shot.camera.keyframes[0]!.atSeconds).toBe(0);
    expect(shot.effectOverrides).toEqual({ bubbles: { size: 0.35 } });
    expect(film.durationSeconds).toBe(8);
  });

  it("rejects a cast member that is not deployed", () => {
    expect(() =>
      resolveFilmDirectorSpec({
        version: 1,
        id: "bad-avatar",
        title: "Bad avatar",
        shots: [
          {
            id: "shot",
            title: "Shot",
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
        shots: [
          {
            id: "shot",
            title: "Shot",
            effectPresets: { fire: "fire-imaginary" },
          },
        ],
      })
    ).toThrow(/has no preset/);
  });

  it("samples one-count performer offsets from the active shot", () => {
    const film = resolveFilmDirectorSpec({
      version: 1,
      id: "canon",
      title: "Canon",
      playback: { loop: false, autoplay: false },
      shots: [
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
});
