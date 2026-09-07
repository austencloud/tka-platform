/**
 * The capability catalog: what the director's chair offers, and the guarantee
 * that it offers exactly what the language accepts.
 *
 * The value of these assertions is the drift they prevent. A catalog that
 * restated its value lists would go stale the first time an effect was retired
 * or a camera move was added, and the panel would then be advertising something
 * a film rejects. Each test below pins the catalog to the source the resolver
 * and the schema themselves read.
 */
import { describe, expect, it } from "vitest";

import { Plane } from "@austencloud/scene-3d";

import { EFFECTS } from "../../../src/lib/shared/animation-engine/components/effects-panel/effect-registry";
import { CHARACTER_DEFINITIONS } from "../../../src/lib/shared/3d/domain/character-model";

import {
  buildDirectorCapabilityGroups,
  findCapabilityUsage,
} from "../../../src/routes/test/film-director/_lib/director-capability-catalog";
import { CAMERA_MOVE_RULES } from "../../../src/routes/test/film-director/_lib/camera-language";
import {
  applySceneEdit,
  type SceneEdit,
} from "../../../src/routes/test/film-director/_lib/film-director-edit";
import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";
import {
  ENVIRONMENT_CATALOG,
  FORMATION_CATALOG,
  PROP_CATALOG,
} from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";
import type { FilmDirectorInput } from "../../../src/routes/test/film-director/_lib/film-director-schema";

const groups = buildDirectorCapabilityGroups();

function group(id: string) {
  const found = groups.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No capability group "${id}"`);
  return found;
}

function tokens(id: string): string[] {
  return group(id).capabilities.map(
    (capability) => capability.token ?? capability.label
  );
}

describe("buildDirectorCapabilityGroups", () => {
  it("gives every capability a unique id", () => {
    const ids = groups.flatMap((entry) =>
      entry.capabilities.map((capability) => capability.id)
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("offers every prop, environment, and formation the resolver accepts", () => {
    expect(tokens("props")).toEqual([...PROP_CATALOG]);
    expect(tokens("environments")).toEqual([...ENVIRONMENT_CATALOG]);
    expect(tokens("formations")).toEqual([...FORMATION_CATALOG]);
  });

  it("offers every effect, character, and plane the registries hold", () => {
    expect(tokens("effects")).toEqual(EFFECTS.map((effect) => effect.id));
    expect(tokens("characters")).toEqual(
      CHARACTER_DEFINITIONS.map((character) => character.id)
    );
    expect(tokens("planes")).toEqual(Object.values(Plane).map(String));
  });

  it("counts a camera move once per direction it accepts", () => {
    const expected = Object.values(CAMERA_MOVE_RULES).reduce(
      (total, rule) => total + (rule.directions?.length ?? 1),
      0
    );
    expect(group("camera-moves").capabilities).toHaveLength(expected);
  });

  it("only offers camera moves the language would accept", () => {
    // Not a shape check: each offered move is written into a real film and put
    // through the schema, so an offer that could not be spelled fails here.
    const base: FilmDirectorInput = {
      version: 5,
      id: "catalog-film",
      title: "Catalog Film",
      scenes: [
        {
          id: "s1",
          title: "S1",
          performance: {
            bpm: 120,
            formation: "side-by-side",
            cast: { count: 2 },
          },
        },
      ],
    } as unknown as FilmDirectorInput;

    for (const capability of group("camera-moves").capabilities) {
      const action = capability.action;
      expect(action.kind).toBe("camera-move");
      if (action.kind !== "camera-move") continue;
      const edit: SceneEdit = {
        sceneId: "s1",
        kind: "append-camera-move",
        move: action.move,
      };
      expect(() =>
        resolveFilmDirectorSpec(applySceneEdit(base, edit))
      ).not.toThrow();
    }
  });

  it("only offers scene values the schema would accept", () => {
    const base: FilmDirectorInput = {
      version: 5,
      id: "catalog-film",
      title: "Catalog Film",
      scenes: [
        {
          id: "s1",
          title: "S1",
          performance: { bpm: 120, formation: "line", cast: { count: 4 } },
        },
      ],
    } as unknown as FilmDirectorInput;

    for (const groupId of ["environments", "formations"]) {
      for (const capability of group(groupId).capabilities) {
        const action = capability.action;
        expect(action.kind).toBe("scene");
        if (action.kind !== "scene") continue;
        expect(() =>
          applySceneEdit(base, {
            sceneId: "s1",
            kind: action.field,
            value: action.value,
          })
        ).not.toThrow();
      }
    }
  });

  it("labels every capability", () => {
    for (const entry of groups) {
      expect(entry.capabilities.length).toBeGreaterThan(0);
      for (const capability of entry.capabilities) {
        expect(capability.label.trim()).not.toBe("");
      }
    }
  });
});

describe("findCapabilityUsage", () => {
  const input: FilmDirectorInput = {
    version: 5,
    id: "usage-film",
    title: "Usage Film",
    scenes: [
      {
        id: "orbiting",
        title: "Orbiting",
        location: { environmentId: "ocean" },
        performance: {
          bpm: 120,
          formation: "circle",
          cast: { count: 3, defaults: { prop: "fan", effect: "fire" } },
        },
        camera: {
          shotSize: "wide",
          moves: [
            { move: "orbit", direction: "cw", with: [{ move: "push-in" }] },
          ],
        },
      },
      {
        id: "still",
        title: "Still",
        transition: { kind: "fade-through-black" },
        performance: {
          bpm: 120,
          formation: "line",
          cast: { count: 2 },
        },
      },
    ],
  } as unknown as FilmDirectorInput;

  const usage = findCapabilityUsage(input, resolveFilmDirectorSpec(input));

  it("credits the scene that spells a move, including a nested one", () => {
    expect(usage.get("camera-move:orbit:cw")).toEqual(["orbiting"]);
    expect(usage.get("camera-move:push-in")).toEqual(["orbiting"]);
  });

  it("credits framing written on the document", () => {
    expect(usage.get("shot-size:wide")).toEqual(["orbiting"]);
  });

  it("credits resolved scene and performer values", () => {
    expect(usage.get("environment:ocean")).toEqual(["orbiting"]);
    expect(usage.get("formation:circle")).toEqual(["orbiting"]);
    expect(usage.get("formation:line")).toEqual(["still"]);
    expect(usage.get("prop:fan")).toEqual(["orbiting"]);
    expect(usage.get("effect:fire")).toEqual(["orbiting"]);
    expect(usage.get("transition:fade-through-black")).toEqual(["still"]);
  });

  it("claims nothing for a capability the film never uses", () => {
    expect(usage.get("camera-move:roll:ccw")).toBeUndefined();
    expect(usage.get("environment:void")).toBeUndefined();
  });
});
