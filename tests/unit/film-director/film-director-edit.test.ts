import { describe, expect, it } from "vitest";

import {
  applyPerformerEdit,
  PerformerEditError,
} from "../../../src/routes/test/film-director/_lib/film-director-edit";
import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";
import type { FilmDirectorInput } from "../../../src/routes/test/film-director/_lib/film-director-schema";

function film(
  performance: Record<string, unknown>,
  sceneId = "s1"
): FilmDirectorInput {
  return {
    version: 2,
    id: "edit-film",
    title: "Edit Film",
    scenes: [{ id: sceneId, title: "S1", performance }],
  } as unknown as FilmDirectorInput;
}

function edit(
  input: FilmDirectorInput,
  patch: Parameters<typeof applyPerformerEdit>[2]
) {
  return applyPerformerEdit(input, resolveFilmDirectorSpec(input), patch);
}

function castOf(input: FilmDirectorInput) {
  return resolveFilmDirectorSpec(input).scenes[0]!.performance.performers;
}

describe("applyPerformerEdit", () => {
  it("writes the value onto the named performer's slot", () => {
    const input = film({
      performers: [{ id: "a", prop: "staff" }, { id: "b", prop: "staff" }],
    });
    const next = edit(input, {
      sceneId: "s1",
      performerIds: ["b"],
      field: "prop",
      value: "fan",
    });
    const cast = castOf(next);
    expect(cast[0]!.prop).toBe("staff");
    expect(cast[1]!.prop).toBe("fan");
  });

  it("leaves the caller's document untouched", () => {
    const input = film({ performers: [{ id: "a", prop: "staff" }] });
    const before = structuredClone(input);
    edit(input, {
      sceneId: "s1",
      performerIds: ["a"],
      field: "prop",
      value: "fan",
    });
    expect(input).toEqual(before);
  });

  it("applies an All-Performers edit to the whole cast in one patch", () => {
    const input = film({ cast: { count: 4, defaults: { effort: "linear" } } });
    const ids = castOf(input).map((performer) => performer.id);
    const next = edit(input, {
      sceneId: "s1",
      performerIds: ids,
      field: "effort",
      value: "punch",
    });
    for (const performer of castOf(next)) {
      expect(performer.effort).toBe("punch");
    }
  });

  it("materializes a cast block's implicit performers without renaming them", () => {
    const input = film({ cast: { count: 3 } });
    const before = castOf(input).map((performer) => performer.id);
    const next = edit(input, {
      sceneId: "s1",
      performerIds: ["performer-2"],
      field: "prop",
      value: "fan",
    });
    expect(castOf(next).map((performer) => performer.id)).toEqual(before);
    expect(castOf(next)[1]!.prop).toBe("fan");
  });

  it("keeps an id-less cast override on the slot it already filled", () => {
    const input = film({
      cast: { count: 3, performers: [{ effect: "led" }] },
    });
    const before = castOf(input).map((performer) => performer.effect);
    const next = edit(input, {
      sceneId: "s1",
      performerIds: ["performer-3"],
      field: "prop",
      value: "fan",
    });
    expect(castOf(next).map((performer) => performer.effect)).toEqual(before);
  });
});

describe("seeded-draw freezing", () => {
  it("holds every other drawn value on the edited axis", () => {
    const input = film({
      cast: { count: 6, defaults: { prop: { pick: "distinct" } } },
    });
    const before = castOf(input).map((performer) => performer.prop);
    const next = edit(input, {
      sceneId: "s1",
      performerIds: ["performer-1"],
      field: "prop",
      value: "fan",
    });
    const after = castOf(next).map((performer) => performer.prop);
    expect(after.slice(1)).toEqual(before.slice(1));
    expect(after[0]).toBe("fan");
  });

  it("leaves other axes drawing from the stream", () => {
    const input = film({
      cast: {
        count: 5,
        defaults: { prop: { pick: "distinct" }, effect: { pick: "any" } },
      },
    });
    const before = castOf(input).map((performer) => performer.effect);
    const next = edit(input, {
      sceneId: "s1",
      performerIds: ["performer-1"],
      field: "prop",
      value: "fan",
    });
    expect(castOf(next).map((performer) => performer.effect)).toEqual(before);
    expect(
      (next.scenes[0]!.performance as { cast: { defaults: { effect: unknown } } })
        .cast.defaults.effect
    ).toEqual({ pick: "any" });
  });

  it("keeps a sameAs performer following after a freeze", () => {
    const input = film({
      cast: {
        count: 4,
        defaults: { prop: { pick: "distinct" } },
        performers: [{ id: "performer-4", prop: { sameAs: "performer-2" } }],
      },
    });
    const next = edit(input, {
      sceneId: "s1",
      performerIds: ["performer-1"],
      field: "prop",
      value: "fan",
    });
    const cast = castOf(next);
    expect(cast[3]!.prop).toBe(cast[1]!.prop);
    expect(
      (
        next.scenes[0]!.performance as {
          cast: { performers: { prop?: unknown }[] };
        }
      ).cast.performers[3]!.prop
    ).toEqual({ sameAs: "performer-2" });
  });

  it("does not touch the document when no value on that axis was drawn", () => {
    const input = film({
      cast: { count: 3, defaults: { prop: "staff", effort: "linear" } },
    });
    const next = edit(input, {
      sceneId: "s1",
      performerIds: ["performer-1"],
      field: "prop",
      value: "fan",
    });
    const defaults = (
      next.scenes[0]!.performance as { cast: { defaults: Record<string, unknown> } }
    ).cast.defaults;
    expect(defaults.prop).toBe("staff");
    expect(defaults.effort).toBe("linear");
  });
});

describe("rejected edits", () => {
  it("rejects an unknown scene", () => {
    const input = film({ performers: [{ id: "a" }] });
    expect(() =>
      edit(input, {
        sceneId: "nope",
        performerIds: ["a"],
        field: "prop",
        value: "fan",
      })
    ).toThrow(PerformerEditError);
  });

  it("rejects an unknown performer", () => {
    const input = film({ performers: [{ id: "a" }] });
    expect(() =>
      edit(input, {
        sceneId: "s1",
        performerIds: ["b"],
        field: "prop",
        value: "fan",
      })
    ).toThrow(PerformerEditError);
  });

  it("rejects a value the schema does not allow", () => {
    const input = film({ performers: [{ id: "a", staffLengthCm: 90 }] });
    expect(() =>
      edit(input, {
        sceneId: "s1",
        performerIds: ["a"],
        field: "staffLengthCm",
        value: 5000,
      })
    ).toThrow(PerformerEditError);
  });

  it("rejects an edit that names no performer", () => {
    const input = film({ performers: [{ id: "a" }] });
    expect(() =>
      edit(input, {
        sceneId: "s1",
        performerIds: [],
        field: "prop",
        value: "fan",
      })
    ).toThrow(PerformerEditError);
  });
});
