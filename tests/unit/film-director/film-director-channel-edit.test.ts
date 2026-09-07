/**
 * The write path for hand-keyed channels.
 *
 * `applyChannelEdit` is the only way the manual layer reaches the document, so
 * it carries the same contract the performer and scene edits do: the caller's
 * input is never mutated, the result is schema-validated, and a rejected write
 * changes nothing at all. The extra obligation here is absence: a film that
 * hand-keys nothing must resolve without a `channels` block, because that is
 * what keeps every film written before channels existed resolving unchanged.
 */
import { describe, expect, it } from "vitest";

import {
  applyChannelEdit,
  ChannelEditError,
} from "../../../src/routes/test/film-director/_lib/film-director-edit";
import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";
import { sampleDirectorCameraTrack } from "../../../src/routes/test/film-director/_lib/director-camera-track";
import type {
  FilmDirectorInput,
  ResolvedDirectorCameraChannel,
} from "../../../src/routes/test/film-director/_lib/film-director-schema";

function film(): FilmDirectorInput {
  return {
    version: 2,
    id: "channel-film",
    title: "Channel Film",
    scenes: [
      {
        id: "s1",
        title: "S1",
        durationSeconds: 4,
        camera: {
          preset: "custom",
          keyframes: [
            {
              atSeconds: 0,
              position: [0, 1.5, -6],
              target: { kind: "point", position: [0, 1.5, 0] },
              fovDeg: 40,
            },
            {
              atSeconds: 4,
              position: [4, 1.5, -6],
              target: { kind: "point", position: [0, 1.5, 0] },
              fovDeg: 60,
            },
          ],
        },
        performance: { performers: [{ id: "a" }] },
      },
    ],
  } as unknown as FilmDirectorInput;
}

function channel(
  id: ResolvedDirectorCameraChannel["id"],
  keys: readonly { atSeconds: number; value: number }[]
): ResolvedDirectorCameraChannel {
  return {
    id,
    keys: keys.map((key) => ({
      ...key,
      interpolation: "smooth" as const,
      easing: "ease-in-out" as const,
    })),
  };
}

function cameraOf(input: FilmDirectorInput) {
  return resolveFilmDirectorSpec(input).scenes[0]!.camera;
}

describe("applyChannelEdit", () => {
  it("writes the channel into the document", () => {
    const next = applyChannelEdit(film(), {
      sceneId: "s1",
      set: [channel("camera.position.y", [{ atSeconds: 0, value: 9 }])],
    });
    expect(cameraOf(next).channels).toEqual([
      channel("camera.position.y", [{ atSeconds: 0, value: 9 }]),
    ]);
  });

  it("reaches the sampled frame", () => {
    const camera = cameraOf(
      applyChannelEdit(film(), {
        sceneId: "s1",
        set: [channel("camera.position.y", [{ atSeconds: 0, value: 9 }])],
      })
    );
    const frame = sampleDirectorCameraTrack(
      camera.keyframes,
      2,
      camera.channels
    );
    expect(frame.position[1]).toBeCloseTo(9, 9);
  });

  it("leaves the caller's document untouched", () => {
    const input = film();
    const before = structuredClone(input);
    applyChannelEdit(input, {
      sceneId: "s1",
      set: [channel("camera.lens.fov", [{ atSeconds: 1, value: 80 }])],
    });
    expect(input).toEqual(before);
  });

  it("adds a second channel without disturbing the first", () => {
    const once = applyChannelEdit(film(), {
      sceneId: "s1",
      set: [channel("camera.position.y", [{ atSeconds: 0, value: 9 }])],
    });
    const twice = applyChannelEdit(once, {
      sceneId: "s1",
      set: [channel("camera.lens.fov", [{ atSeconds: 0, value: 80 }])],
    });
    expect(cameraOf(twice).channels?.map((entry) => entry.id).sort()).toEqual([
      "camera.lens.fov",
      "camera.position.y",
    ]);
  });

  it("replaces a channel whole rather than merging its keys", () => {
    const once = applyChannelEdit(film(), {
      sceneId: "s1",
      set: [
        channel("camera.lens.fov", [
          { atSeconds: 0, value: 30 },
          { atSeconds: 2, value: 90 },
        ]),
      ],
    });
    const twice = applyChannelEdit(once, {
      sceneId: "s1",
      set: [channel("camera.lens.fov", [{ atSeconds: 0, value: 45 }])],
    });
    expect(cameraOf(twice).channels?.[0]!.keys).toHaveLength(1);
  });

  it("hands a channel back to the layer below when it is cleared", () => {
    const owned = applyChannelEdit(film(), {
      sceneId: "s1",
      set: [channel("camera.position.y", [{ atSeconds: 0, value: 9 }])],
    });
    const reverted = applyChannelEdit(owned, {
      sceneId: "s1",
      clear: ["camera.position.y"],
    });
    expect(cameraOf(reverted).channels).toBeUndefined();
    expect(reverted).toEqual(film());
  });

  it("keeps the block when only one of several channels is cleared", () => {
    const owned = applyChannelEdit(film(), {
      sceneId: "s1",
      set: [
        channel("camera.position.y", [{ atSeconds: 0, value: 9 }]),
        channel("camera.lens.fov", [{ atSeconds: 0, value: 80 }]),
      ],
    });
    const partly = applyChannelEdit(owned, {
      sceneId: "s1",
      clear: ["camera.position.y"],
    });
    expect(partly).not.toEqual(film());
    expect(cameraOf(partly).channels?.map((entry) => entry.id)).toEqual([
      "camera.lens.fov",
    ]);
  });

  it("writes nothing at all for a film that hand-keys nothing", () => {
    expect(cameraOf(film()).channels).toBeUndefined();
    expect(JSON.stringify(film())).not.toContain("channels");
  });

  it("leaves the defaults unwritten, so a channel reads as what it states", () => {
    const next = applyChannelEdit(film(), {
      sceneId: "s1",
      set: [channel("camera.roll", [{ atSeconds: 0, value: 4 }])],
    }) as unknown as {
      scenes: { camera: { channels: Record<string, unknown> } }[];
    };
    expect(next.scenes[0]!.camera.channels["camera.roll"]).toEqual({
      keys: [{ atSeconds: 0, value: 4 }],
    });
  });

  it("writes a non-default interpolation and easing down", () => {
    const next = applyChannelEdit(film(), {
      sceneId: "s1",
      set: [
        {
          id: "camera.roll",
          keys: [
            { atSeconds: 0, value: 4, interpolation: "step", easing: "linear" },
          ],
        },
      ],
    }) as unknown as {
      scenes: { camera: { channels: Record<string, unknown> } }[];
    };
    expect(next.scenes[0]!.camera.channels["camera.roll"]).toEqual({
      keys: [
        { atSeconds: 0, value: 4, interpolation: "step", easing: "linear" },
      ],
    });
  });
});

describe("a rejected write changes nothing", () => {
  it("refuses a scene that is not in this film", () => {
    expect(() =>
      applyChannelEdit(film(), {
        sceneId: "nope",
        set: [channel("camera.roll", [{ atSeconds: 0, value: 1 }])],
      })
    ).toThrow(ChannelEditError);
  });

  it("refuses a channel with no keys, which owns nothing", () => {
    expect(() =>
      applyChannelEdit(film(), { sceneId: "s1", set: [channel("camera.roll", [])] })
    ).toThrow(/Clear "camera.roll" instead/);
  });

  it("refuses a key before the scene starts", () => {
    expect(() =>
      applyChannelEdit(film(), {
        sceneId: "s1",
        set: [channel("camera.roll", [{ atSeconds: -1, value: 0 }])],
      })
    ).toThrow(ChannelEditError);
  });

  it("refuses two keys at the same instant, at resolution", () => {
    const written = applyChannelEdit(film(), {
      sceneId: "s1",
      set: [
        channel("camera.roll", [
          { atSeconds: 1, value: 0 },
          { atSeconds: 1, value: 5 },
        ]),
      ],
    });
    expect(() => resolveFilmDirectorSpec(written)).toThrow(
      /share the same time/
    );
  });

  it("refuses a key past the end of the scene, at resolution", () => {
    const written = applyChannelEdit(film(), {
      sceneId: "s1",
      set: [channel("camera.roll", [{ atSeconds: 99, value: 0 }])],
    });
    expect(() => resolveFilmDirectorSpec(written)).toThrow(
      /after the scene has ended/
    );
  });
});
