/**
 * cellKey grammar for the SpiroAnim → Composer bridge route.
 *
 * The key is the shared identity contract between two repositories, so the
 * round-trip is asserted against every entry of the real transcription rather
 * than a fixture. Grammar:
 *
 *   <concept>.<reference>.<ratio>.<shape>.<variant>
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatCellKey,
  parseCellKey,
} from "$lib/features/spiroanim-bridge/domain/cell-key";

// Repo-root-relative, matching spiroanim-72-validate.test.ts. An
// `import.meta.url` base is not safe in this runner: CI resolved it to a
// non-file scheme and the suite died at import with ERR_INVALID_URL_SCHEME.
const DATA = (name: string) => resolve("docs/research/spiroanim", name);

interface TranscriptionEntry {
  concept: string;
  reference: string;
  speedRatio?: string;
  isAnti?: boolean;
  shape: string;
  word: string;
  steps: unknown[];
  /** qtr only — his quarter-spacing builder's `quarters` option (1 or 2). */
  quarters?: number;
  /** 8stp only — his eight-step builder's `reversePlane` option. */
  reversePlane?: boolean;
}

const transcription: TranscriptionEntry[] = JSON.parse(
  readFileSync(DATA("tka-transcription.json"), "utf8")
);

function isCanonicalReading(entry: TranscriptionEntry): boolean {
  if (entry.quarters !== undefined && entry.quarters !== 1) return false;
  if (entry.reversePlane !== undefined && entry.reversePlane !== false)
    return false;
  return true;
}

describe("spiroanim bridge cell keys", () => {
  it("round-trips every transcription entry", () => {
    expect(transcription.length).toBe(1584);
    for (const entry of transcription) {
      const key = formatCellKey({
        concept: entry.concept as "vtg" | "qtr" | "8stp",
        reference: entry.reference,
        speedRatio: entry.speedRatio ?? "1:1",
        shape: entry.shape,
        isAnti: entry.isAnti === true,
      });
      const parsed = parseCellKey(key);
      expect(parsed, key).not.toBeNull();
      expect(parsed!.concept).toBe(entry.concept);
      expect(parsed!.reference.toLowerCase()).toBe(
        String(entry.reference).toLowerCase()
      );
      expect(parsed!.shape).toBe(entry.shape);
      expect(parsed!.isAnti).toBe(entry.isAnti === true);
      expect(parsed!.speedRatio).toBe(
        entry.concept === "8stp" ? "1:1" : (entry.speedRatio ?? "1:1")
      );
    }
  });

  /**
   * The transcription carries two axes the five-field key does not address:
   * `quarters` (qtr only, 1 or 2) and `reversePlane` (8stp only). The bridge
   * addresses the CANONICAL reading of each cell — `quarters: 1`,
   * `reversePlane: false` — which is the same reading `cell-catalogue.json`
   * records and the only one SpiroAnim's own link builder emits. This pins
   * that collapse: 1,008 addressable keys, and every collision resolves to
   * exactly one canonical entry.
   */
  it("addresses one canonical entry per key", () => {
    const byKey = new Map<string, TranscriptionEntry[]>();
    for (const entry of transcription) {
      const key = formatCellKey({
        concept: entry.concept as "vtg" | "qtr" | "8stp",
        reference: entry.reference,
        speedRatio: entry.speedRatio ?? "1:1",
        shape: entry.shape,
        isAnti: entry.isAnti === true,
      });
      byKey.set(key, [...(byKey.get(key) ?? []), entry]);
    }
    expect(byKey.size).toBe(1008);

    const notExactlyOne = [...byKey.entries()].filter(
      ([, entries]) => entries.filter(isCanonicalReading).length !== 1
    );
    expect(notExactlyOne.map(([key]) => key)).toEqual([]);
  });

  it("rejects malformed keys", () => {
    for (const bad of [
      "",
      "vtg.9-9.1x1.diamond.base",
      "vtg.1-1.2x1.diamond.base",
      "poi.1-1.1x1.diamond.base",
      "VTG.1-1.1x1.diamond.base",
      "vtg.1-1.1x1.diamond",
      "vtg.1-1.1x1.pyramid.base",
      "vtg.1-1.1x1.diamond.wild",
      "8stp.1-aa.1x3.diamond.base",
      "8stp.1-zz.1x1.diamond.base",
      "qtr.1-aa.1x1.diamond.base",
    ]) {
      expect(parseCellKey(bad), bad).toBeNull();
    }
  });

  it("ignores unknown trailing fields", () => {
    expect(parseCellKey("vtg.1-1.1x1.diamond.base.future-field")).not.toBeNull();
  });

  it("formats 8stp without a speed-ratio axis", () => {
    expect(
      formatCellKey({
        concept: "8stp",
        reference: "1-AA",
        speedRatio: "1:5",
        shape: "diamond",
        isAnti: false,
      })
    ).toBe("8stp.1-aa.1x1.diamond.base");
  });
});
