/**
 * Gap 3, at the sampling layer. The keyframe compiler frames a tracked
 * performer at their opening mark; these tests prove the sampler carries that
 * framing along as the performer walks, and leaves every other scene alone.
 */
import { describe, expect, it } from "vitest";

import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";
import {
  applyCameraTracking,
  sampleFilmDirector,
} from "../../../src/routes/test/film-director/_lib/sample-film-director";

/** Where the walker ends up. The distance is measured against their resolved
 * opening mark rather than assumed, so a formation tweak cannot quietly turn
 * these into assertions about the wrong number. */
const WALK_TO_X = -1.1;

/**
 * Two performers side by side; performer-2 walks in -x over the first four of
 * the scene's eight seconds, then stands.
 */
function walkingFilm(track?: true | "follow") {
  return resolveFilmDirectorSpec({
    version: 5,
    id: "tracking-proof",
    title: "Tracking proof",
    scenes: [
      {
        id: "crossing",
        title: "Crossing",
        durationSeconds: 8,
        location: { environmentId: "forest" },
        performance: {
          bpm: 120,
          formation: "side-by-side",
          cast: {
            count: 2,
            performers: [
              {
                id: "performer-2",
                blocking: [
                  {
                    move: "walk",
                    to: { x: WALK_TO_X, z: 0 },
                    durationSeconds: 4,
                  },
                  { move: "stand" },
                ],
              },
            ],
          },
        },
        camera: {
          subject: {
            kind: "performer",
            performerId: "performer-2",
            ...(track ? { track } : {}),
          },
          shotSize: "medium",
          angle: "eye",
          position: "front",
          moves: [{ move: "hold" }],
        },
      },
    ],
  });
}

/** The walker's ground displacement over the crossing, from resolved data. */
function walkerDx(film: ReturnType<typeof walkingFilm>): number {
  const walker = film.scenes[0]!.performance.performers.find(
    (performer) => performer.id === "performer-2"
  )!;
  return WALK_TO_X - walker.position.x;
}

describe("camera tracking sampling", () => {
  it("turns the camera to keep an aimed walker in frame", () => {
    const film = walkingFilm(true);
    const start = sampleFilmDirector(film, 0).camera;
    const end = sampleFilmDirector(film, 4).camera;

    expect(walkerDx(film)).toBeCloseTo(-2, 6);
    expect(end.target[0] - start.target[0]).toBeCloseTo(walkerDx(film), 6);
    expect(end.target[1]).toBeCloseTo(start.target[1], 6);
    expect(end.target[2] - start.target[2]).toBeCloseTo(0, 6);
    expect(end.position).toEqual(start.position);
  });

  it("travels the whole rig with a followed walker", () => {
    const film = walkingFilm("follow");
    const start = sampleFilmDirector(film, 0).camera;
    const end = sampleFilmDirector(film, 4).camera;

    expect(end.target[0] - start.target[0]).toBeCloseTo(walkerDx(film), 6);
    expect(end.position[0] - start.position[0]).toBeCloseTo(walkerDx(film), 6);
    expect(end.position[1]).toBeCloseTo(start.position[1], 6);
  });

  it("leaves an untracked scene's framing exactly where the compiler put it", () => {
    const film = walkingFilm();
    expect(sampleFilmDirector(film, 4).camera.target).toEqual(
      sampleFilmDirector(film, 0).camera.target
    );
  });

  it("returns the camera untouched when the tracked id matches no performer", () => {
    const film = walkingFilm("follow");
    const scene = film.scenes[0]!;
    const frame = sampleFilmDirector(film, 4);
    const ghost = {
      ...scene,
      camera: {
        ...scene.camera,
        tracking: { performerId: "nobody", mode: "follow" as const },
      },
    };
    const untracked = sampleFilmDirector(walkingFilm(), 4).camera;

    expect(applyCameraTracking(untracked, ghost, frame.performerMotion)).toBe(
      untracked
    );
  });
});

/**
 * Gap 11. Handheld is a sampled-frame modifier, so these read whole frames out
 * of a resolved film rather than inspecting keyframes.
 */
describe("handheld", () => {
  function handheldFilm(handheld?: unknown, camera: Record<string, unknown> = {}) {
    return resolveFilmDirectorSpec({
      version: 5,
      id: "handheld-proof",
      title: "Handheld proof",
      scenes: [
        {
          id: "operator",
          title: "Operator",
          durationSeconds: 8,
          location: { environmentId: "forest" },
          performance: { bpm: 120, cast: { count: 2 } },
          camera: { shotSize: "medium", ...camera, ...(handheld ? { handheld } : {}) },
        },
      ],
    });
  }

  const frames = (film: ReturnType<typeof resolveFilmDirectorSpec>) =>
    Array.from({ length: 33 }, (_, index) => sampleFilmDirector(film, index / 4));

  it("leaves a scene that never asked for it byte identical", () => {
    const plain = frames(handheldFilm());
    const again = frames(handheldFilm());
    expect(plain.map((frame) => frame.camera)).toEqual(
      again.map((frame) => frame.camera)
    );
    expect(handheldFilm().scenes[0]!.camera.handheld).toBeUndefined();
  });

  it("moves the rig, and repeats exactly on a second pass", () => {
    const shaken = frames(handheldFilm("rough"));
    const steady = frames(handheldFilm());
    const moved = shaken.some(
      (frame, index) =>
        frame.camera.position[0] !== steady[index]!.camera.position[0]
    );
    expect(moved).toBe(true);
    expect(shaken.map((frame) => frame.camera)).toEqual(
      frames(handheldFilm("rough")).map((frame) => frame.camera)
    );
  });

  it("stays inside the envelope it was given", () => {
    const film = handheldFilm({ meters: 0.05, degrees: 1 });
    const steady = frames(handheldFilm());
    for (const [index, frame] of frames(film).entries()) {
      for (const axis of [0, 1, 2]) {
        const drift = Math.abs(
          frame.camera.position[axis]! - steady[index]!.camera.position[axis]!
        );
        expect(drift).toBeLessThanOrEqual(0.05 + 1e-9);
      }
    }
  });

  it("shakes a scene that cuts between shots too", () => {
    const film = handheldFilm("subtle", {
      shots: [{ shotSize: "wide" }, { shotSize: "close-up" }],
      shotSize: undefined,
    });
    const steady = frames(
      handheldFilm(undefined, { shots: [{ shotSize: "wide" }, { shotSize: "close-up" }], shotSize: undefined })
    );
    const moved = frames(film).some(
      (frame, index) =>
        frame.camera.position[0] !== steady[index]!.camera.position[0]
    );
    expect(moved).toBe(true);
  });
});
