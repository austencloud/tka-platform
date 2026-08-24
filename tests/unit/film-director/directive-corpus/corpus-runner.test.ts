import { describe, expect, it } from "vitest";

import { resolveFilmDirectorSpec } from "../../../../src/routes/test/film-director/_lib/resolve-film-director-spec";
import { entries as distribution } from "./distribution";
import { entries as pinExclusion } from "./pin-exclusion";
import { entries as unsatisfiable } from "./unsatisfiable";
import { entries as nonexistent } from "./nonexistent";
import { entries as camera } from "./camera";
import { entries as boundary } from "./boundary";
import { entries as unknownAxis } from "./unknown-axis";
import type { CorpusEntry } from "./_types";

const CATEGORIES: Record<string, CorpusEntry[]> = {
  distribution,
  "pin-exclusion": pinExclusion,
  unsatisfiable,
  nonexistent,
  camera,
  boundary,
  "unknown-axis": unknownAxis,
};

describe("adversarial directive corpus", () => {
  it("meets the coverage bar", () => {
    const all = Object.values(CATEGORIES).flat();
    expect(all.length).toBeGreaterThanOrEqual(200);
    for (const [name, entries] of Object.entries(CATEGORIES)) {
      expect(entries.length, name).toBeGreaterThanOrEqual(25);
    }
    const rejections = all.filter((entry) => entry.expect.outcome === "rejects");
    expect(rejections.length / all.length).toBeGreaterThanOrEqual(0.3);
    expect(new Set(all.map((entry) => entry.id)).size).toBe(all.length);
  });

  for (const [category, entries] of Object.entries(CATEGORIES)) {
    describe(category, () => {
      for (const entry of entries) {
        it(`${entry.id}: ${entry.utterance.slice(0, 80)}`, () => {
          if (entry.expect.outcome === "rejects") {
            const expected = entry.expect.messageIncludes;
            expect(() => resolveFilmDirectorSpec(entry.film)).toThrow();
            try {
              resolveFilmDirectorSpec(entry.film);
            } catch (error) {
              expect(String(error)).toContain(expected);
            }
            return;
          }
          const spec = resolveFilmDirectorSpec(entry.film);
          entry.expect.assert?.(spec);
        });
      }
    });
  }
});
