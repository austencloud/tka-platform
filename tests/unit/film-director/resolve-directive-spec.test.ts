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
