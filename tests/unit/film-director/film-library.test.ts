/**
 * Every film in the workbench's registry must resolve without rejection,
 * deterministically. A film that would reject at load time should fail here,
 * not in the picker. The determinism check re-resolves each film and demands
 * an identical result: the seeded axis streams are the only randomness, so
 * two resolutions of the same input must agree bit for bit.
 */
import { readFileSync, statSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

import { describe, expect, it } from "vitest";

import { FILM_LIBRARY } from "../../../src/routes/test/film-director/_films/index";
import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";

/** What scripts/build-film-posters.mjs writes. */
const POSTER_WIDTH = 960;
const POSTER_HEIGHT = 540;
const POSTER_MAX_BYTES = 220 * 1024;

/**
 * Read a WebP's dimensions from its container header.
 *
 * Hand-parsed rather than decoded with sharp: the size is four bytes at a fixed
 * offset, and a unit test should not pull a native image codec in to read them.
 */
function readWebpSize(file: Buffer): { width: number; height: number } {
  expect(file.subarray(0, 4).toString("ascii")).toBe("RIFF");
  expect(file.subarray(8, 12).toString("ascii")).toBe("WEBP");
  const fourcc = file.subarray(12, 16).toString("ascii");
  if (fourcc === "VP8 ") {
    return {
      width: file.readUInt16LE(26) & 0x3fff,
      height: file.readUInt16LE(28) & 0x3fff,
    };
  }
  if (fourcc === "VP8X") {
    return {
      width: (file.readUIntLE(24, 3) & 0xffffff) + 1,
      height: (file.readUIntLE(27, 3) & 0xffffff) + 1,
    };
  }
  throw new Error(`Unsupported WebP chunk "${fourcc}"`);
}

describe("film library", () => {
  it("has unique keys and film ids", () => {
    const keys = FILM_LIBRARY.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
    const ids = FILM_LIBRARY.map((entry) => entry.film.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const entry of FILM_LIBRARY) {
    describe(`"${entry.label}" (${entry.key})`, () => {
      it("resolves without rejection", () => {
        const resolved = resolveFilmDirectorSpec(entry.film);
        expect(resolved.scenes.length).toBeGreaterThan(0);
        for (const scene of resolved.scenes) {
          expect(scene.performance.performers.length).toBeGreaterThan(0);
        }
      });

      it("resolves deterministically", () => {
        const first = resolveFilmDirectorSpec(entry.film);
        const second = resolveFilmDirectorSpec(entry.film);
        expect(second).toEqual(first);
      });

      it("names a poster cue that still lands inside its scene", () => {
        const resolved = resolveFilmDirectorSpec(entry.film);
        const scene = resolved.scenes.find(
          (candidate) => candidate.id === entry.poster.sceneId
        );
        expect(
          scene,
          `poster cue names scene "${entry.poster.sceneId}", which this film does not have`
        ).toBeDefined();
        expect(entry.poster.offsetSeconds).toBeGreaterThanOrEqual(0);
        expect(entry.poster.offsetSeconds).toBeLessThan(scene!.durationSeconds);
      });

      it("has a baked poster at the size the marquee reserves", () => {
        expect(entry.poster.src).toBe(`/films/posters/${entry.key}.webp`);
        const path = resolvePath("static", entry.poster.src.slice(1));
        expect(
          statSync(path, { throwIfNoEntry: false }),
          `${path} is missing. Run: node scripts/build-film-posters.mjs --only ${entry.key}`
        ).toBeDefined();
        const file = readFileSync(path);
        expect(file.byteLength).toBeLessThanOrEqual(POSTER_MAX_BYTES);
        expect(readWebpSize(file)).toEqual({
          width: POSTER_WIDTH,
          height: POSTER_HEIGHT,
        });
      });
    });
  }

  it("Nine Planes actually exercises the plane axes it advertises", () => {
    const ninePlanes = FILM_LIBRARY.find((entry) => entry.key === "planes")!;
    const resolved = resolveFilmDirectorSpec(ninePlanes.film);

    const wheelhouse = resolved.scenes.find(
      (scene) => scene.id === "wheelhouse"
    )!;
    expect(wheelhouse.location.visiblePlanes).toEqual(["wheel"]);
    for (const performer of wheelhouse.performance.performers) {
      expect(performer.leftPlane).toBe("wheel");
      expect(performer.rightPlane).toBe("wheel");
    }

    const noTwoAlike = resolved.scenes.find(
      (scene) => scene.id === "no-two-alike"
    )!;
    const leftPlanes = noTwoAlike.performance.performers.map(
      (performer) => performer.leftPlane
    );
    expect(new Set(leftPlanes).size).toBe(leftPlanes.length);
    const rightPlanes = noTwoAlike.performance.performers.map(
      (performer) => performer.rightPlane
    );
    expect(new Set(rightPlanes).size).toBe(rightPlanes.length);

    const scramble = resolved.scenes.find(
      (scene) => scene.id === "mid-phrase-scramble"
    )!;
    for (const performer of scramble.performance.performers) {
      expect(performer.stepPlanes).toHaveLength(4);
    }

    const shieldWall = resolved.scenes.find(
      (scene) => scene.id === "shield-wall"
    )!;
    expect(shieldWall.location.visiblePlanes).toEqual([
      "left-shield",
      "right-shield",
    ]);
  });

  it("Understudy Night's sameAs and distinct constraints hold after resolution", () => {
    const understudy = FILM_LIBRARY.find(
      (entry) => entry.key === "understudy"
    )!;
    const resolved = resolveFilmDirectorSpec(understudy.film);

    const leadScene = resolved.scenes.find(
      (scene) => scene.id === "lead-and-copies"
    )!;
    const lead = leadScene.performance.performers.find(
      (performer) => performer.id === "performer-1"
    )!;
    expect(lead.name).toBe("Lead");
    expect(lead.effect).toBe("fire");
    const understudies = leadScene.performance.performers.filter(
      (performer) => performer.id !== "performer-1"
    );
    for (const performer of understudies) {
      expect(performer.prop).toBe(lead.prop);
      expect(performer.effect).not.toBe("fire");
    }
    const efforts = leadScene.performance.performers.map(
      (performer) => performer.effort
    );
    expect(new Set(efforts).size).toBe(efforts.length);

    const allEight = resolved.scenes.find(
      (scene) => scene.id === "all-eight-efforts"
    )!;
    const eightEfforts = allEight.performance.performers.map(
      (performer) => performer.effort
    );
    expect(new Set(eightEfforts).size).toBe(8);

    const mirrorScene = resolved.scenes.find(
      (scene) => scene.id === "mirror-pair"
    )!;
    const original = mirrorScene.performance.performers.find(
      (performer) => performer.name === "Original"
    )!;
    const mirror = mirrorScene.performance.performers.find(
      (performer) => performer.name === "Mirror"
    )!;
    expect(mirror.prop).toBe(original.prop);
    expect(mirror.effect).toBe(original.effect);
    expect(mirror.effort).toBe(original.effort);
    expect(mirror.leftPlane).toBe(original.leftPlane);
    expect(mirror.rightPlane).toBe(original.rightPlane);
    expect(mirror.staffLengthCm).not.toBe(original.staffLengthCm);
  });

  it("Proving Grounds exercises the gaps it advertises", () => {
    const proving = FILM_LIBRARY.find((entry) => entry.key === "proving")!;
    const resolved = resolveFilmDirectorSpec(proving.film);

    const combined = resolved.scenes.find((s) => s.id === "combined-draw")!;
    const lefts = combined.performance.performers.map((p) => p.leftPlane);
    const rights = combined.performance.performers.map((p) => p.rightPlane);
    expect(new Set(lefts).size).toBe(lefts.length);
    expect(new Set(rights).size).toBe(rights.length);
    expect(lefts).not.toContain("wall");
    expect(rights).not.toContain("wall");
    // Distinctness is only guaranteed PER axis — the pinned seed additionally
    // produces zero cross-axis repeats, so the frame actually shows six
    // different planes rather than four unique ones reused across six slots.
    expect(new Set([...lefts, ...rights]).size).toBe(6);

    const onBeat = resolved.scenes.find((s) => s.id === "on-the-beat")!;
    expect(onBeat.durationSeconds).toBe(8);
    const pushStart = onBeat.camera.keyframes.find(
      (frame) => Math.abs(frame.atSeconds - 0) < 1e-6
    );
    const pushArrival = onBeat.camera.keyframes.find(
      (frame) => Math.abs(frame.atSeconds - 4) < 1e-6
    );
    expect(pushStart).toBeDefined();
    expect(pushArrival).toBeDefined();
    // A keyframe existing at 4s isn't proof the push actually moved the
    // camera — compare against the 0s keyframe to prove it did.
    expect(pushArrival!.position).not.toEqual(pushStart!.position);
    const walker = onBeat.performance.performers[1]!;
    const arrival = walker.blocking.find(
      (frame) => Math.abs(frame.atSeconds - 4) < 1e-6
    );
    expect(arrival).toBeDefined();
    expect(arrival!.position).toEqual({ x: -1.5, z: -1 });

    const edges = resolved.scenes.find((s) => s.id === "camera-edges")!;
    expect(edges.durationSeconds).toBe(12);
    expect(edges.transition).toMatchObject({ durationSeconds: 1 });
    const kf = edges.camera.keyframes;
    const at = (t: number) =>
      kf.find((frame) => Math.abs(frame.atSeconds - t) < 1e-6)!;
    // Truck (0-4s): position and target translate by the same 1m ground vector.
    const truckDelta = [0, 1, 2].map((axis) => at(4).position[axis]! - at(0).position[axis]!);
    const targetDelta = [0, 1, 2].map((axis) => at(4).target[axis]! - at(0).target[axis]!);
    // toBeCloseTo, not toEqual: position and target sit at different absolute
    // magnitudes, so adding the identical translation vector to each rounds
    // to a ~1e-16 difference on subtraction — real floating point, not a bug.
    truckDelta.forEach((value, axis) => {
      expect(value).toBeCloseTo(targetDelta[axis]!, 9);
    });
    expect(Math.hypot(...truckDelta)).toBeCloseTo(1, 4);
    expect(truckDelta[1]).toBeCloseTo(0, 6);
    // Zoom (4-8s): fov 50 -> 35 with the camera parked.
    expect(at(4).fovDeg).toBe(50);
    expect(at(8).fovDeg).toBe(35);
    expect(at(8).position).toEqual(at(4).position);
    // Roll (8-10s): explicit 0 anchor ramping to +10 (clockwise on screen).
    expect(at(8).rollDeg).toBe(0);
    expect(at(10).rollDeg).toBe(10);
    // Scenes that never roll stay sparse:
    expect(onBeat.camera.keyframes.every((frame) => !("rollDeg" in frame))).toBe(true);
  });

  it("Chance Suite's identical directives on different scenes draw from different streams", () => {
    const chance = FILM_LIBRARY.find((entry) => entry.key === "chance")!;
    const resolved = resolveFilmDirectorSpec(chance.film);

    const distinct = resolved.scenes.find(
      (scene) => scene.id === "distinct-everything"
    )!;
    const props = distinct.performance.performers.map(
      (performer) => performer.prop
    );
    expect(new Set(props).size).toBe(props.length);

    const loaded = resolved.scenes.find((scene) => scene.id === "loaded-dice")!;
    for (const performer of loaded.performance.performers) {
      expect(["fire", "led", "trails"]).toContain(performer.effect);
      const redStep = performer.stepPlanes.find(
        (entry) => entry.hand === "right"
      )!;
      expect(redStep.plane).not.toBe("wall");
    }
  });
});
