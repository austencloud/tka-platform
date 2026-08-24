// tests/unit/film-director/resolve-directive-spec.test.ts
import { describe, expect, it } from "vitest";

import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";

function film(performance: Record<string, unknown>, extras: Record<string, unknown> = {}) {
  return {
    version: 2,
    id: "directive-film",
    title: "Directive Film",
    shots: [{ id: "s1", title: "S1", performance }],
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
    const performers = spec.shots[0]!.performance.performers;
    expect(performers).toHaveLength(8);
    expect(new Set(performers.map((p) => p.prop)).size).toBe(8);
    expect(performers[2]!.effect).toBe("led");
    expect(performers.filter((p) => p.effect === "fire")).toHaveLength(7);
  });

  it("is deterministic across runs and stable under an unrelated axis reroll", () => {
    const doc = film({ cast: { count: 4, defaults: { prop: { pick: "distinct" } } } });
    const first = resolveFilmDirectorSpec(doc);
    const second = resolveFilmDirectorSpec(doc);
    expect(first.shots[0]!.performance.performers).toEqual(
      second.shots[0]!.performance.performers
    );

    const rerolled = resolveFilmDirectorSpec({
      ...doc,
      seed: { axes: { effect: 5 } },
    });
    expect(rerolled.shots[0]!.performance.performers.map((p) => p.prop)).toEqual(
      first.shots[0]!.performance.performers.map((p) => p.prop)
    );
  });

  it("rerolling the prop axis changes props but not avatars", () => {
    const doc = film({
      cast: {
        count: 6,
        defaults: { prop: { pick: "distinct" }, avatarId: { pick: "distinct" } },
      },
    });
    const base = resolveFilmDirectorSpec(doc);
    const rerolled = resolveFilmDirectorSpec({ ...doc, seed: { axes: { prop: 1 } } });
    expect(rerolled.shots[0]!.performance.performers.map((p) => p.avatarId)).toEqual(
      base.shots[0]!.performance.performers.map((p) => p.avatarId)
    );
    expect(rerolled.shots[0]!.performance.performers.map((p) => p.prop)).not.toEqual(
      base.shots[0]!.performance.performers.map((p) => p.prop)
    );
  });

  it("resolves an open environment pick and respects formation valid counts", () => {
    const spec = resolveFilmDirectorSpec({
      version: 2,
      id: "env-film",
      title: "Env",
      shots: [
        {
          id: "s1",
          title: "S1",
          scene: { environmentId: { oneOf: ["ocean", "forest"] } },
          performance: { formation: { pick: "any" }, cast: { count: 3 } },
        },
      ],
    });
    expect(["ocean", "forest"]).toContain(spec.shots[0]!.scene.environmentId);
    expect(spec.shots[0]!.performance.formation).not.toBe("custom");
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

  it("v1 documents resolve exactly as before", () => {
    const spec = resolveFilmDirectorSpec({
      version: 1,
      id: "v1",
      title: "V1",
      shots: [{ id: "s1", title: "S1" }],
    });
    expect(spec.shots[0]!.performance.performers[0]!.prop).toBe("staff");
  });
});
