/**
 * The campaign's anti-regression gate: every capability demo resolves to a
 * frozen spec. A later grammar phase that changes any snapshot must show that
 * diff and justify it in its commit message — silent drift in what the
 * director can do is the failure this file exists to catch.
 *
 * Numbers are rounded to 1e-6 before snapshotting so an FP-identical refactor
 * does not churn the snapshot while any real change does.
 */
import { describe, expect, it } from "vitest";

import { CAPABILITY_LIBRARY } from "../../../src/routes/test/film-director/_capabilities/index";
import { resolveFilmDirectorSpec } from "../../../src/routes/test/film-director/_lib/resolve-film-director-spec";

function stableJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, val) => {
      if (typeof val !== "number") return val;
      // JSON has no NaN/Infinity literal, so JSON.stringify would otherwise
      // silently turn a non-finite value into `null` — indistinguishable
      // from a field that was legitimately null. A sentinel string makes a
      // NaN/Infinity bug visible IN the snapshot diff instead of hiding it.
      if (!Number.isFinite(val)) return `__nonfinite:${val}__`;
      return Math.round(val * 1e6) / 1e6;
    },
    2
  );
}

describe("capability resolution snapshots", () => {
  it("keeps its exact set of demos — removing one must fail here, not orphan its snapshot block", () => {
    expect(CAPABILITY_LIBRARY.map((entry) => entry.id)).toMatchSnapshot();
  });

  for (const entry of CAPABILITY_LIBRARY) {
    it(`"${entry.label}" (${entry.id}) resolves to its frozen spec`, () => {
      expect(stableJson(resolveFilmDirectorSpec(entry.film))).toMatchSnapshot();
    });
  }
});
