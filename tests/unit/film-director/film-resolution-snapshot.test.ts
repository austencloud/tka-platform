/**
 * The campaign's anti-regression gate: every film in the registry resolves to
 * a frozen spec. A later grammar phase that changes any snapshot must show
 * that diff and justify it in its commit message — silent drift in shipped
 * films is the failure this file exists to catch.
 *
 * Numbers are rounded to 1e-6 before snapshotting so an FP-identical refactor
 * does not churn the snapshot while any real change does.
 */
import { describe, expect, it } from "vitest";

import { FILM_LIBRARY } from "../../../src/routes/test/film-director/_films/index";
import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";

function stableJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, val) =>
      typeof val === "number" ? Math.round(val * 1e6) / 1e6 : val,
    2
  );
}

describe("film resolution snapshots", () => {
  for (const entry of FILM_LIBRARY) {
    it(`"${entry.label}" (${entry.key}) resolves to its frozen spec`, () => {
      expect(stableJson(resolveFilmDirectorSpec(entry.film))).toMatchSnapshot();
    });
  }
});
