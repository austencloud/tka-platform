// tests/unit/film-director/performer-sequences.test.ts
import { describe, expect, it } from "vitest";

import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";

function film(scene: Record<string, unknown>) {
  return {
    version: 2,
    id: "sequence-film",
    title: "Sequence Film",
    scenes: [{ id: "s1", title: "S1", ...scene }],
  };
}

/** A scene cast by naming its performers outright, so ids can be spoken names. */
function named(performers: Record<string, unknown>[]) {
  return film({ performance: { performers } });
}

describe("per-performer sequence axis", () => {
  it("defaults every performer to the film's shared sequence", () => {
    const spec = resolveFilmDirectorSpec(
      film({ performance: { cast: { count: 3 } } })
    );
    for (const performer of spec.scenes[0]!.performance.performers) {
      expect(performer.sequence).toEqual({ source: "demo" });
    }
  });

  it("carries a spelled word through to the resolved performer", () => {
    const spec = resolveFilmDirectorSpec(
      named([{ id: "lead", sequence: { word: "DEFDEF" } }, { id: "second" }])
    );
    const performers = spec.scenes[0]!.performance.performers;
    expect(performers[0]!.sequence).toEqual({ word: "DEFDEF" });
    expect(performers[1]!.sequence).toEqual({ source: "demo" });
  });

  it("applies a cast default to performers that do not name their own", () => {
    const spec = resolveFilmDirectorSpec(
      film({
        performance: {
          cast: {
            count: 3,
            defaults: { sequence: { word: "SAILOR" } },
            performers: [{ id: "performer-2", sequence: { word: "ORBITS" } }],
          },
        },
      })
    );
    expect(
      spec.scenes[0]!.performance.performers.map(
        (performer) => performer.sequence
      )
    ).toEqual([{ word: "SAILOR" }, { word: "ORBITS" }, { word: "SAILOR" }]);
  });

  it("resolves a mirror that names another performer in the same scene", () => {
    const spec = resolveFilmDirectorSpec(
      named([
        { id: "fan-left", sequence: { word: "SAILOR" } },
        { id: "fan-right", sequence: { mirrorOf: "fan-left" } },
      ])
    );
    expect(spec.scenes[0]!.performance.performers[1]!.sequence).toEqual({
      mirrorOf: "fan-left",
    });
  });

  it("rejects a performer mirroring themselves", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        named([{ id: "solo", sequence: { mirrorOf: "solo" } }])
      )
    ).toThrow(/cannot mirror themselves/);
  });

  it("rejects a mirror of a performer who is not in the scene", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        named([{ id: "solo", sequence: { mirrorOf: "ghost" } }])
      )
    ).toThrow(/not in this scene/);
  });

  it("rejects a mirror of a mirror, which has no original to reflect", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        named([
          { id: "a", sequence: { word: "SAILOR" } },
          { id: "b", sequence: { mirrorOf: "a" } },
          { id: "c", sequence: { mirrorOf: "b" } },
        ])
      )
    ).toThrow(/already a mirror/);
  });

  it("rejects a sequence that names more than one source", () => {
    expect(() =>
      resolveFilmDirectorSpec(
        named([{ id: "solo", sequence: { word: "SAILOR", mirrorOf: "solo" } }])
      )
    ).toThrow();
  });
});
