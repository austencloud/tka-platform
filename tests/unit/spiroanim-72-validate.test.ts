/**
 * Validate the 72 Eight Step base cells against TKA's own orientation engine.
 *
 * The cells were transcribed from SpiroAnim's compiled geometry (his rootCompile
 * + closestPoint as oracle). This asserts TKA's orientation algebra reproduces
 * his per-frame prop orientations exactly — 72 cells x 12 steps x 2 hands.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { calculateEndOrientation } from "@tka/sequence-engine/core";

// Repo-root-relative, matching every other fixture-reading test here. An
// `import.meta.url` base is not safe in this runner: CI resolved it to a
// non-file scheme and the suite died at import with ERR_INVALID_URL_SCHEME,
// which gated deploys.
const DATA = (name: string) => resolve("docs/research/spiroanim", name);

type Hand = {
  motionType: string;
  startLoc: string;
  endLoc: string;
  rotationDirection: string;
  turns: number;
  startOrientation: string;
  endOrientation: string;
};
type Step = { letter: string; startPos: string; endPos: string; blue: Hand; red: Hand };
type Cell = { reference: string; word: string; steps: Step[] };

const cells: Cell[] = JSON.parse(readFileSync(DATA("eightstep-72-base.json"), "utf8"));

describe("SpiroAnim Eight Step base cells", () => {
  it("agrees with TKA's orientation engine on every motion", () => {
    const mismatches: string[] = [];
    let checked = 0;
    for (const cell of cells) {
      for (const [i, step] of cell.steps.entries()) {
        for (const color of ["blue", "red"] as const) {
          const m = step[color];
          const got = calculateEndOrientation({
            motionType: m.motionType,
            turns: m.turns,
            rotationDirection: m.rotationDirection,
            startLocation: m.startLoc,
            endLocation: m.endLoc,
            startOrientation: m.startOrientation,
          });
          checked++;
          if (got !== m.endOrientation) {
            mismatches.push(
              `${cell.reference} step${i + 1} ${step.letter} ${color} ` +
                `${m.motionType}${m.turns}t ${m.startLoc}->${m.endLoc} ` +
                `${m.startOrientation}: tka=${got} spiroanim=${m.endOrientation}`
            );
          }
        }
      }
    }
    console.log(`orientation checks: ${checked}, mismatches: ${mismatches.length}`);
    if (mismatches.length) console.log(mismatches.slice(0, 20).join("\n"));
    expect(mismatches).toEqual([]);
  });

  it("propagates continuously and closes the cycle", () => {
    const open: string[] = [];
    for (const cell of cells) {
      for (const color of ["blue", "red"] as const) {
        for (let i = 1; i < cell.steps.length; i++) {
          const prev = cell.steps[i - 1]![color];
          const cur = cell.steps[i]![color];
          if (prev.endOrientation !== cur.startOrientation)
            open.push(`${cell.reference} ${color} step${i}->${i + 1} orientation break`);
          if (prev.endLoc !== cur.startLoc)
            open.push(`${cell.reference} ${color} step${i}->${i + 1} location break`);
        }
        const first = cell.steps[0]![color];
        const last = cell.steps.at(-1)![color];
        if (last.endLoc !== first.startLoc)
          open.push(`${cell.reference} ${color} does not close (location)`);
        if (last.endOrientation !== first.startOrientation)
          open.push(`${cell.reference} ${color} does not close (orientation)`);
      }
    }
    console.log(`continuity/closure failures: ${open.length}`);
    if (open.length) console.log(open.slice(0, 20).join("\n"));
    expect(open).toEqual([]);
  });

  it("emits persisted sequence blobs", () => {
    const blobs = cells.map((cell) => ({
      word: cell.word,
      metadata: {
        source: "spiroanim-eight-step",
        cell: cell.reference,
        attribution: "8-Step Concepts by Gage DeMello; generated geometry by Ryan Girard (spiroanim)",
      },
      startPosition: {
        letter: null,
        gridPosition: cell.steps[0]!.startPos,
        motions: {
          blue: motionBlob(cell.steps[0]!.blue, "blue", true),
          red: motionBlob(cell.steps[0]!.red, "red", true),
        },
      },
      steps: cell.steps.map((s, i) => ({
        stepNumber: i + 1,
        letter: s.letter,
        startPosition: s.startPos,
        endPosition: s.endPos,
        duration: 1,
        motions: { blue: motionBlob(s.blue, "blue"), red: motionBlob(s.red, "red") },
      })),
    }));
    writeFileSync(DATA("eightstep-72-sequences.json"), JSON.stringify(blobs, null, 1));
    console.log(`wrote ${blobs.length} sequence blobs; sample word ${blobs[0]!.word}`);
    expect(blobs).toHaveLength(72);
  });
});

function motionBlob(m: Hand, color: "blue" | "red", asStart = false) {
  return {
    color,
    motionType: asStart ? "static" : m.motionType,
    rotationDirection: asStart ? "no_rot" : m.rotationDirection,
    startLocation: m.startLoc,
    endLocation: asStart ? m.startLoc : m.endLoc,
    turns: asStart ? 0 : m.turns,
    startOrientation: m.startOrientation,
    endOrientation: asStart ? m.startOrientation : m.endOrientation,
  };
}
