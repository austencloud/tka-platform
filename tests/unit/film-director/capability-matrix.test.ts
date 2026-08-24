import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { FILM_DIRECTOR_DIRECTIVE_AXES } from "../../../src/routes/test/film-director/_lib/film-director-schema";

describe("capability matrix lockstep", () => {
  it("the matrix doc lists exactly the schema's directive-capable axes", () => {
    const doc = readFileSync(
      resolve(__dirname, "../../../docs/reference/film-director-capability-matrix.md"),
      "utf8"
    );
    const match = doc.match(/<!-- directive-axes: ([^>]+) -->/);
    expect(match).not.toBeNull();
    const documented = match![1]!.split(",").map((axis) => axis.trim()).sort();
    expect(documented).toEqual([...FILM_DIRECTOR_DIRECTIVE_AXES].sort());
  });
});
