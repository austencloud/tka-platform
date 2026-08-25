// tests/unit/film-director/film-library.test.ts
/**
 * Every film in the workbench's registry must resolve without rejection,
 * deterministically. A film that would reject at load time should fail here,
 * not in the picker. The determinism check re-resolves each film and demands
 * an identical result: the seeded axis streams are the only randomness, so
 * two resolutions of the same input must agree bit for bit.
 */
import { describe, expect, it } from "vitest";

import { FILM_LIBRARY } from "../../../src/routes/test/film-director/_films/index";
import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";

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
    });
  }

  it("Nine Planes actually exercises the plane axes it advertises", () => {
    const ninePlanes = FILM_LIBRARY.find((entry) => entry.key === "planes")!;
    const resolved = resolveFilmDirectorSpec(ninePlanes.film);

    const wheelhouse = resolved.scenes.find((scene) => scene.id === "wheelhouse")!;
    expect(wheelhouse.location.visiblePlanes).toEqual(["wheel"]);
    for (const performer of wheelhouse.performance.performers) {
      expect(performer.bluePlane).toBe("wheel");
      expect(performer.redPlane).toBe("wheel");
    }

    const noTwoAlike = resolved.scenes.find(
      (scene) => scene.id === "no-two-alike"
    )!;
    const bluePlanes = noTwoAlike.performance.performers.map(
      (performer) => performer.bluePlane
    );
    expect(new Set(bluePlanes).size).toBe(bluePlanes.length);
    const redPlanes = noTwoAlike.performance.performers.map(
      (performer) => performer.redPlane
    );
    expect(new Set(redPlanes).size).toBe(redPlanes.length);

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
    expect(mirror.bluePlane).toBe(original.bluePlane);
    expect(mirror.redPlane).toBe(original.redPlane);
    expect(mirror.staffLengthCm).not.toBe(original.staffLengthCm);
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
        (entry) => entry.hand === "red"
      )!;
      expect(redStep.plane).not.toBe("wall");
    }
  });
});
