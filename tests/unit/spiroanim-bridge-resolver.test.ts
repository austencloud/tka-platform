/**
 * The SpiroAnim bridge resolver: cellKey → hydrated SequenceData.
 *
 * This is the heavyweight proof for the bridge. Every addressable cell in the
 * transcription is resolved through the real pipeline — real pictograph
 * dataframes, the real turn/orientation algebra, the real sequence hydrator —
 * and three independent invariants are checked per cell:
 *
 *   1. the hydrator's DERIVED word equals the word SpiroAnim transcribed
 *      (the letters were recovered from motions, not copied over);
 *   2. the step count survives;
 *   3. the per-hand orientation chain is continuous and each step's end
 *      orientation is what `calculateEndOrientation` says it is.
 *
 * Invariant 1 is the load-bearing one: it can only pass if the resolver picked
 * the right dataframe row for all 8,640 steps.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  formatCellKey,
  type BridgeConcept,
} from "$lib/features/spiroanim-bridge/domain/cell-key";
import {
  resolveCell,
  type TranscriptionEntry,
} from "$lib/features/spiroanim-bridge/services/resolve-cell";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { calculateEndOrientation } from "$lib/shared/pictograph/prop/services/orientation-calculator";

// Repo-root-relative, matching spiroanim-72-validate.test.ts. An
// `import.meta.url` base is not safe in this runner: CI resolved it to a
// non-file scheme and the suite died at import with ERR_INVALID_URL_SCHEME.
const DATA = (name: string) => resolve("docs/research/spiroanim", name);

const transcription: TranscriptionEntry[] = JSON.parse(
  readFileSync(DATA("tka-transcription.json"), "utf8")
);

/**
 * The pictograph dataframes are fetched at runtime, never bundled. jsdom has no
 * server to fetch from, so the loader's `window.csvData` pre-injection path
 * feeds it the real files — same idiom as fused-word-derivation.test.ts. A stub
 * would defeat the point of this suite.
 */
function injectRealCsvData(): void {
  const read = (file: string) =>
    readFileSync(resolve("static/data/pictographs", file), "utf8");
  Object.assign(window, {
    csvData: {
      diamondData: read("DiamondPictographDataframe.csv"),
      boxData: read("BoxPictographDataframe.csv"),
      skewedData: read("SkewedPictographDataframe.csv"),
    },
  });
}

function keyOf(entry: TranscriptionEntry): string {
  return formatCellKey({
    concept: entry.concept as BridgeConcept,
    reference: entry.reference,
    speedRatio: entry.speedRatio ?? "1:1",
    shape: entry.shape,
    isAnti: entry.isAnti === true,
  });
}

/** The reading the five-field key addresses — see cell-key.ts. */
function isCanonicalReading(entry: TranscriptionEntry): boolean {
  if (entry.quarters !== undefined && entry.quarters !== 1) return false;
  if (entry.reversePlane !== undefined && entry.reversePlane !== false)
    return false;
  return true;
}

const addressable = new Map<string, TranscriptionEntry>();
for (const entry of transcription) {
  if (!isCanonicalReading(entry)) continue;
  const key = keyOf(entry);
  if (!addressable.has(key)) addressable.set(key, entry);
}

beforeAll(() => {
  injectRealCsvData();
});

describe("spiroanim bridge resolver", () => {
  it(
    "resolves every addressable cell to its transcribed sequence",
    async () => {
      expect(addressable.size).toBe(1008);

      const failures: string[] = [];
      for (const [key, entry] of addressable) {
        const resolved = await resolveCell(key, transcription);
        if (!resolved) {
          failures.push(`${key}: resolved to null`);
          continue;
        }
        const { sequence } = resolved;

        if (sequence.word !== entry.word) {
          failures.push(
            `${key}: derived word ${sequence.word} !== transcribed ${entry.word}`
          );
        }
        if (sequence.steps.length !== entry.steps.length) {
          failures.push(
            `${key}: ${sequence.steps.length} steps !== ${entry.steps.length}`
          );
        }

        for (const color of [MotionColor.BLUE, MotionColor.RED]) {
          for (const [index, step] of sequence.steps.entries()) {
            const motion = step.motions?.[color];
            if (!motion) {
              failures.push(`${key} step${index + 1} ${color}: no motion`);
              break;
            }
            const expected = calculateEndOrientation(motion, color);
            if (motion.endOrientation !== expected) {
              failures.push(
                `${key} step${index + 1} ${color}: endOrientation ` +
                  `${motion.endOrientation} !== calculated ${expected}`
              );
            }
            if (index === 0) continue;
            const previous = sequence.steps[index - 1]?.motions?.[color];
            if (previous?.endOrientation !== motion.startOrientation) {
              failures.push(
                `${key} step${index}->${index + 1} ${color}: orientation break`
              );
            }
            if (previous?.endLocation !== motion.startLocation) {
              failures.push(
                `${key} step${index}->${index + 1} ${color}: location break`
              );
            }
          }
        }
      }

      console.log(
        `resolved cells: ${addressable.size}, failures: ${failures.length}`
      );
      if (failures.length) console.log(failures.slice(0, 20).join("\n"));
      expect(failures).toEqual([]);
    },
    600_000
  );

  it("returns null for a malformed key", async () => {
    expect(await resolveCell("vtg.9-9.1x1.diamond.base", transcription)).toBeNull();
    expect(await resolveCell("", transcription)).toBeNull();
  });

  it("returns null for a well-formed key with no transcription entry", async () => {
    // The 8-step catalogue has no anti variant — the key parses, the cell does
    // not exist. The route shows its honest "no bridge entry" card.
    expect(addressable.has("8stp.1-aa.1x1.diamond.anti")).toBe(false);
    expect(
      await resolveCell("8stp.1-aa.1x1.diamond.anti", transcription)
    ).toBeNull();
  });

  it("carries the transcription entry for provenance", async () => {
    const resolved = await resolveCell("vtg.1-1.1x1.diamond.base", transcription);
    expect(resolved).not.toBeNull();
    expect(resolved!.entry.concept).toBe("vtg");
    expect(resolved!.entry.reference).toBe("1-1");
    expect(resolved!.sequence.startPosition).toBeTruthy();
  });
});
