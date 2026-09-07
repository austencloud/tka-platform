import { describe, expect, it } from "vitest";

import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";

function film(performance: Record<string, unknown>, extras: Record<string, unknown> = {}) {
  return {
    version: 2,
    id: "directive-film",
    title: "Directive Film",
    scenes: [{ id: "s1", title: "S1", performance }],
    ...extras,
  };
}

describe("resolveFilmDirectorSpec with directives", () => {
  it("resolves Austen's canonical example: 8 distinct props, fire everywhere, LED pinned on performer 3", () => {
    const spec = resolveFilmDirectorSpec(
      film({
        formation: "circle",
        cast: {
          count: 8,
          defaults: { prop: { pick: "distinct" }, effect: "fire" },
          performers: [{ id: "performer-3", effect: "led" }],
        },
      })
    );
    const performers = spec.scenes[0]!.performance.performers;
    expect(performers).toHaveLength(8);
    expect(new Set(performers.map((p) => p.prop)).size).toBe(8);
    expect(performers[2]!.effect).toBe("led");
    expect(performers.filter((p) => p.effect === "fire")).toHaveLength(7);
  });

  it("is deterministic across runs and stable under an unrelated axis reroll", () => {
    const doc = film({ cast: { count: 4, defaults: { prop: { pick: "distinct" } } } });
    const first = resolveFilmDirectorSpec(doc);
    const second = resolveFilmDirectorSpec(doc);
    expect(first.scenes[0]!.performance.performers).toEqual(
      second.scenes[0]!.performance.performers
    );

    const rerolled = resolveFilmDirectorSpec({
      ...doc,
      seed: { axes: { effect: 5 } },
    });
    expect(rerolled.scenes[0]!.performance.performers.map((p) => p.prop)).toEqual(
      first.scenes[0]!.performance.performers.map((p) => p.prop)
    );
  });

  it("rerolling the prop axis changes props but not characters", () => {
    const doc = film({
      cast: {
        count: 6,
        defaults: { prop: { pick: "distinct" }, characterId: { pick: "distinct" } },
      },
    });
    const base = resolveFilmDirectorSpec(doc);
    const rerolled = resolveFilmDirectorSpec({ ...doc, seed: { axes: { prop: 1 } } });
    expect(rerolled.scenes[0]!.performance.performers.map((p) => p.characterId)).toEqual(
      base.scenes[0]!.performance.performers.map((p) => p.characterId)
    );
    expect(rerolled.scenes[0]!.performance.performers.map((p) => p.prop)).not.toEqual(
      base.scenes[0]!.performance.performers.map((p) => p.prop)
    );
  });

  it("preserves seeded character choices across the v3 avatarId migration", () => {
    const shared = {
      id: "character-seed-migration",
      title: "Character seed migration",
      scenes: [
        {
          id: "s1",
          title: "S1",
          performance: {
            cast: { count: 5 },
          },
        },
      ],
    };
    const legacy = resolveFilmDirectorSpec({
      ...shared,
      version: 3,
      seed: { base: 20260830, axes: { avatarId: 4 } },
      scenes: [
        {
          ...shared.scenes[0],
          performance: {
            cast: {
              count: 5,
              defaults: { avatarId: { pick: "distinct" } },
            },
          },
        },
      ],
    });
    const current = resolveFilmDirectorSpec({
      ...shared,
      version: 4,
      seed: { base: 20260830, axes: { characterId: 4 } },
      scenes: [
        {
          ...shared.scenes[0],
          performance: {
            cast: {
              count: 5,
              defaults: { characterId: { pick: "distinct" } },
            },
          },
        },
      ],
    });

    expect(
      current.scenes[0]!.performance.performers.map(
        (performer) => performer.characterId
      )
    ).toEqual(
      legacy.scenes[0]!.performance.performers.map(
        (performer) => performer.characterId
      )
    );
  });

  it("resolves an open environment pick and respects formation valid counts", () => {
    const spec = resolveFilmDirectorSpec({
      version: 2,
      id: "env-film",
      title: "Env",
      scenes: [
        {
          id: "s1",
          title: "S1",
          location: { environmentId: { oneOf: ["ocean", "forest"] } },
          performance: { formation: { pick: "any" }, cast: { count: 3 } },
        },
      ],
    });
    expect(["ocean", "forest"]).toContain(spec.scenes[0]!.location.environmentId);
    expect(spec.scenes[0]!.performance.formation).not.toBe("custom");
  });

  it("rejects an unsatisfiable distinct demand with the pool in the message", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        film({
          cast: {
            count: 8,
            defaults: { prop: { pick: "distinct", from: ["staff", "fan", "club", "sword", "torch"] } },
          },
        })
      )
    ).toThrow(/8 performers.*5/s);
  });

  it("rejects staff sameAs to a performer with no staff length", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        film({
          cast: {
            count: 2,
            performers: [
              { id: "performer-1", staffLengthCm: { sameAs: "performer-2" } },
            ],
          },
        })
      )
    ).toThrow(/has no staff length to copy/);
  });

  it("resolves staff sameAs to a performer that states a staff length", () => {
    const spec = resolveFilmDirectorSpec(
      film({
        cast: {
          count: 2,
          performers: [
            { id: "performer-1", staffLengthCm: 120 },
            { id: "performer-2", staffLengthCm: { sameAs: "performer-1" } },
          ],
        },
      })
    );
    const performers = spec.scenes[0]!.performance.performers;
    expect(performers[0]!.staffLengthCm).toBe(120);
    expect(performers[1]!.staffLengthCm).toBe(120);
  });

  it("rejects staff sameAs to a genuinely unknown performer id", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        film({
          cast: {
            count: 2,
            performers: [
              { id: "performer-1", staffLengthCm: { sameAs: "performer-9" } },
            ],
          },
        })
      )
    ).toThrow(/not in this cast/);
  });

  it("scene-scoped environmentId accepts {pick:'any', not} and never draws the excluded environment", () => {
    const spec = resolveFilmDirectorSpec({
      version: 2,
      id: "env-not-film",
      title: "Env Not",
      scenes: [
        {
          id: "s1",
          title: "S1",
          location: { environmentId: { pick: "any", not: "forest" } },
          performance: { cast: { count: 2 } },
        },
      ],
    });
    expect(spec.scenes[0]!.location.environmentId).not.toBe("forest");
  });

  it("scene-scoped formation still rejects pick distinct, with or without not", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        film({ formation: { pick: "distinct" }, cast: { count: 2 } })
      )
    ).toThrow(/distinct\/sameAs are performer-scoped/);
    expect(() =>
      resolveFilmDirectorSpec(
        film({
          formation: { pick: "distinct", not: "line" },
          cast: { count: 2 },
        })
      )
    ).toThrow(/distinct\/sameAs are performer-scoped/);
  });

  it("v1 documents resolve exactly as before", () => {
    const spec = resolveFilmDirectorSpec({
      version: 1,
      id: "v1",
      title: "V1",
      scenes: [{ id: "s1", title: "S1" }],
    });
    expect(spec.scenes[0]!.performance.performers[0]!.prop).toBe("staff");
  });
});

describe("beats resolve through the scene bpm", () => {
  const beatsFilm = (scene: Record<string, unknown>) => ({
    version: 4,
    id: "beats-resolution-film",
    title: "Beats Resolution",
    scenes: [{ id: "s1", title: "S1", ...scene }],
  });

  // Several of these scenarios convert to 8 seconds, which is also the
  // unstated-duration default — so each one carries a second fixture whose
  // converted value cannot be reached by any default. Without it the test
  // would pass on a build that ignored beats entirely.
  it("a 16-beat scene at 120 bpm resolves to 8 seconds", () => {
    const spec = resolveFilmDirectorSpec(
      beatsFilm({ durationBeats: 16, performance: { bpm: 120 } })
    );
    expect(spec.scenes[0]!.durationSeconds).toBe(8);
    expect(spec.durationSeconds).toBe(8);

    const longer = resolveFilmDirectorSpec(
      beatsFilm({ durationBeats: 24, performance: { bpm: 120 } })
    );
    expect(longer.scenes[0]!.durationSeconds).toBe(12);
    expect(longer.durationSeconds).toBe(12);
  });

  it("beats-stated camera moves land their keyframes on the beat", () => {
    const spec = resolveFilmDirectorSpec(
      beatsFilm({
        durationBeats: 16,
        performance: { bpm: 120 },
        camera: {
          shotSize: "medium",
          moves: [
            { move: "push-in", durationBeats: 8 },
            { move: "hold" },
          ],
        },
      })
    );
    const keyframes = spec.scenes[0]!.camera.keyframes;
    expect(
      keyframes.some((frame) => Math.abs(frame.atSeconds - 4) < 1e-6)
    ).toBe(true);
    expect(keyframes.at(-1)!.atSeconds).toBeCloseTo(8, 6);

    // A 4-beat push-in at 120 bpm arrives at 2s, where an ignored-beats build
    // would split the 8s scene evenly and arrive at 4s.
    const quick = resolveFilmDirectorSpec(
      beatsFilm({
        durationBeats: 16,
        performance: { bpm: 120 },
        camera: {
          shotSize: "medium",
          moves: [
            { move: "push-in", durationBeats: 4 },
            { move: "hold" },
          ],
        },
      })
    );
    expect(
      quick.scenes[0]!.camera.keyframes.some(
        (frame) => Math.abs(frame.atSeconds - 2) < 1e-6
      )
    ).toBe(true);
  });

  it("beats-stated blocking arrives on the beat", () => {
    const spec = resolveFilmDirectorSpec(
      beatsFilm({
        durationBeats: 16,
        performance: {
          bpm: 120,
          performers: [
            {
              blocking: [
                { move: "walk", to: { x: 1.5, z: 0 }, durationBeats: 8 },
                { move: "stand" },
              ],
            },
          ],
        },
      })
    );
    const arrival = spec.scenes[0]!.performance.performers[0]!.blocking.find(
      (frame) => Math.abs(frame.atSeconds - 4) < 1e-6
    );
    expect(arrival).toBeDefined();
    expect(arrival!.position).toEqual({ x: 1.5, z: 0 });

    // A 4-beat walk at 120 bpm arrives at 2s, not the evenly-split 4s.
    const quick = resolveFilmDirectorSpec(
      beatsFilm({
        durationBeats: 16,
        performance: {
          bpm: 120,
          performers: [
            {
              blocking: [
                { move: "walk", to: { x: 1.5, z: 0 }, durationBeats: 4 },
                { move: "stand" },
              ],
            },
          ],
        },
      })
    );
    const quickArrival = quick.scenes[0]!.performance.performers[0]!.blocking.find(
      (frame) => Math.abs(frame.atSeconds - 2) < 1e-6
    );
    expect(quickArrival).toBeDefined();
    expect(quickArrival!.position).toEqual({ x: 1.5, z: 0 });
  });

  it("a beats-stated scene with no bpm converts at the default 90", () => {
    const spec = resolveFilmDirectorSpec(beatsFilm({ durationBeats: 12 }));
    expect(spec.scenes[0]!.durationSeconds).toBe(8);

    // 18 beats at the default 90 bpm is 12 seconds — a number no default
    // produces, so this proves the default bpm actually drove the conversion.
    const longer = resolveFilmDirectorSpec(beatsFilm({ durationBeats: 18 }));
    expect(longer.scenes[0]!.durationSeconds).toBe(12);
  });

  it("a beat-count that converts past the scene ceiling rejects speaking beats", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        beatsFilm({ durationBeats: 96, performance: { bpm: 66 } })
      )
    ).toThrow(/96 beats at 66 bpm/);
  });
});

describe("scene transition defaults", () => {
  const twoScenes = (transition?: Record<string, unknown>) => ({
    version: 2,
    id: "transition-film",
    title: "Transition Film",
    scenes: [
      { id: "s1", title: "S1" },
      { id: "s2", title: "S2", ...(transition ? { transition } : {}) },
    ],
  });

  it("gives a cut no window at all", () => {
    const spec = resolveFilmDirectorSpec(twoScenes({ kind: "cut" }));
    expect(spec.scenes[1]!.transition).toEqual({
      kind: "cut",
      durationSeconds: 0,
    });
  });

  it("still dissolves for 0.8s when the scene says nothing", () => {
    const spec = resolveFilmDirectorSpec(twoScenes());
    expect(spec.scenes[1]!.transition).toEqual({
      kind: "environment-dissolve",
      durationSeconds: 0.8,
    });
  });

  it("keeps a duration a director stated on a cut", () => {
    const spec = resolveFilmDirectorSpec(
      twoScenes({ kind: "cut", durationSeconds: 0.5 })
    );
    expect(spec.scenes[1]!.transition.durationSeconds).toBe(0.5);
  });
});

/** Two or more scenes in one film, for the round-2 inheritance rules. */
function scenesFilm(scenes: unknown[], extras: Record<string, unknown> = {}) {
  return {
    version: 5,
    id: "inheritance-film",
    title: "Inheritance Film",
    scenes,
    ...extras,
  };
}

/**
 * Gap 13. A variation on an earlier scene, stated as the variation rather
 * than as a whole second copy of the scene.
 */
describe("scene extends", () => {
  const parent = {
    id: "opening",
    title: "Opening",
    durationSeconds: 6,
    location: { environmentId: "forest", showStage: true },
    performance: { formation: "line", cast: { count: 3 } },
    camera: { subject: { kind: "group" }, shotSize: "wide", position: "front" },
  };

  it("copies everything the child does not restate, and keeps the child's id", () => {
    const spec = resolveFilmDirectorSpec(
      scenesFilm([
        parent,
        { id: "again", extends: "opening", camera: { position: "behind" } },
      ])
    );
    const [first, second] = spec.scenes;
    expect(second!.id).toBe("again");
    // Title is optional on a child: the parent's carries over.
    expect(second!.title).toBe("Opening");
    expect(second!.extends).toBe("opening");
    expect(second!.durationSeconds).toBe(6);
    expect(second!.location).toEqual(first!.location);
    expect(second!.performance.performers).toHaveLength(3);
  });

  it("merges nested objects key by key instead of replacing them", () => {
    const spec = resolveFilmDirectorSpec(
      scenesFilm([
        parent,
        { id: "again", extends: "opening", location: { showStage: false } },
      ])
    );
    // The child said one word about the location and kept the rest of it.
    expect(spec.scenes[1]!.location.environmentId).toBe("forest");
    expect(spec.scenes[1]!.location.showStage).toBe(false);
  });

  it("replaces arrays wholesale", () => {
    const spec = resolveFilmDirectorSpec(
      scenesFilm([
        {
          ...parent,
          location: {
            environmentId: "forest",
            visiblePlanes: ["wall", "wheel", "floor"],
          },
        },
        { id: "again", extends: "opening", location: { visiblePlanes: ["floor"] } },
      ])
    );
    expect(spec.scenes[1]!.location.visiblePlanes).toEqual(["floor"]);
  });

  it("deletes an inherited key when the child states null", () => {
    const spec = resolveFilmDirectorSpec(
      scenesFilm([
        { ...parent, intent: "the establishing shot" },
        { id: "again", extends: "opening", intent: null },
      ])
    );
    expect(spec.scenes[0]!.intent).toBe("the establishing shot");
    expect(spec.scenes[1]!.intent).toBeNull();
  });

  it("flattens a chain, so a grandchild sees what its parent inherited", () => {
    const spec = resolveFilmDirectorSpec(
      scenesFilm([
        parent,
        { id: "middle", extends: "opening", durationSeconds: 4 },
        { id: "last", extends: "middle", camera: { position: "left" } },
      ])
    );
    expect(spec.scenes[2]!.durationSeconds).toBe(4);
    expect(spec.scenes[2]!.location.environmentId).toBe("forest");
    expect(spec.scenes[2]!.extends).toBe("middle");
  });

  it("carries neither key on a scene that inherits nothing", () => {
    const spec = resolveFilmDirectorSpec(scenesFilm([parent]));
    expect("extends" in spec.scenes[0]!).toBe(false);
    expect("seedSource" in spec.scenes[0]!).toBe(false);
  });

  it("rejects a forward reference, an unknown scene, and itself, naming both scenes", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        scenesFilm([{ id: "first", title: "First", extends: "later" }, parent, { id: "later", title: "Later" }])
      )
    ).toThrow(/"first" extends "later", which comes later/);
    expect(() =>
      resolveFilmDirectorSpec(scenesFilm([parent, { id: "again", extends: "nowhere" }]))
    ).toThrow(/"again" extends "nowhere", which is not a scene in this film/);
    expect(() =>
      resolveFilmDirectorSpec(scenesFilm([parent, { id: "again", extends: "again" }]))
    ).toThrow(/"again" extends itself/);
  });
});

/**
 * Gap 14. Draw a scene's seeded directives under an earlier scene's name, so
 * a callback comes back to the same moment rather than a new one.
 */
describe("scene seedAs", () => {
  const drawing = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    title: id,
    performance: {
      formation: "line",
      cast: { count: 3, defaults: { prop: { pick: "distinct" } } },
    },
    ...extra,
  });

  it("makes two scenes with the same cast draw identical picks", () => {
    const spec = resolveFilmDirectorSpec(
      scenesFilm([drawing("first"), drawing("second", { seedAs: "first" })])
    );
    const props = (index: number) =>
      spec.scenes[index]!.performance.performers.map(
        (performer) => performer.prop
      );
    expect(props(1)).toEqual(props(0));
    expect(spec.scenes[1]!.seedSource).toBe("first");
  });

  it("draws differently without it, which is what makes it worth saying", () => {
    const spec = resolveFilmDirectorSpec(
      scenesFilm([drawing("first"), drawing("second")])
    );
    const props = (index: number) =>
      spec.scenes[index]!.performance.performers.map(
        (performer) => performer.prop
      );
    expect(props(1)).not.toEqual(props(0));
  });

  it("is not implied by extends", () => {
    const spec = resolveFilmDirectorSpec(
      scenesFilm([drawing("first"), { id: "second", extends: "first" }])
    );
    expect("seedSource" in spec.scenes[1]!).toBe(false);
    expect(
      spec.scenes[1]!.performance.performers.map((performer) => performer.prop)
    ).not.toEqual(
      spec.scenes[0]!.performance.performers.map((performer) => performer.prop)
    );
  });

  it("rejects a scene that seeds as one that has not happened yet", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        scenesFilm([drawing("first", { seedAs: "second" }), drawing("second")])
      )
    ).toThrow(/"first" seeds as "second", which comes later/);
  });
});

/** Gap 21. An empty stage is a shot, not a mistake. */
describe("a cast of zero", () => {
  const emptyScene = {
    id: "empty",
    title: "Empty",
    durationSeconds: 3,
    location: { environmentId: "forest" },
    performance: { cast: { count: 0 } },
    camera: { subject: { kind: "group" }, shotSize: "wide" },
  };

  it("resolves with no performers and a finite camera on the origin", () => {
    const scene = resolveFilmDirectorSpec(scenesFilm([emptyScene])).scenes[0]!;
    expect(scene.performance.performers).toEqual([]);
    expect(scene.performance.stageExtent).toEqual([{ x: 0, z: 0 }]);
    for (const frame of scene.camera.keyframes) {
      expect(frame.position.every(Number.isFinite)).toBe(true);
      expect(frame.target[0]).toBeCloseTo(0, 6);
      expect(frame.target[2]).toBeCloseTo(0, 6);
    }
  });

  it("reads an explicit empty performers array the same way", () => {
    const scene = resolveFilmDirectorSpec(
      scenesFilm([
        { ...emptyScene, performance: { performers: [] } },
      ])
    ).scenes[0]!;
    expect(scene.performance.performers).toEqual([]);
  });

  it("still gives one performer to a scene that says nothing about its cast", () => {
    const scene = resolveFilmDirectorSpec(
      scenesFilm([{ id: "quiet", title: "Quiet" }])
    ).scenes[0]!;
    expect(scene.performance.performers).toHaveLength(1);
  });
});
