import { describe, it, expect } from "vitest";
import { groupRuns } from "../../../src/routes/(public)/guide/level-1/_data/proof-grouping";
import type { ProofRun } from "../../../src/routes/(public)/guide/level-1/_data/proof-text";

const run = (p: Partial<ProofRun> & Pick<ProofRun, "x" | "y" | "w" | "t">): ProofRun => ({
  fs: 14,
  s: "regular",
  ...p,
});

describe("groupRuns", () => {
  it("returns [] for no runs", () => {
    expect(groupRuns([], "p")).toEqual([]);
  });

  it("merges runs on the same visual line (Δy ≤ 4pt) into one line", () => {
    // Real shape from letters-type2: a fs16 lead + fs15 body ~1pt apart.
    const groups = groupRuns(
      [
        run({ x: 24.5, y: 59.5, w: 119.6, fs: 16, t: "To move between" }),
        run({ x: 147.6, y: 60.5, w: 439.6, fs: 15, t: "Γ and α/β, you can shift one hand." }),
      ],
      "p"
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.multi).toBe(true);
    expect(groups[0]!.html).toBe("To move between Γ and α/β, you can shift one hand.");
  });

  it("groups consecutive lines with normal leading; breaks on a large gap", () => {
    // hm-type1: 3 lines at 16.8pt leading are one paragraph; a 33.6pt gap breaks.
    const groups = groupRuns(
      [
        run({ x: 117.5, y: 68.5, w: 380, t: "line one of the paragraph text here" }),
        run({ x: 120.0, y: 85.3, w: 375, t: "line two of the paragraph text here" }),
        run({ x: 121.0, y: 102.1, w: 373, t: "line three of the paragraph text here" }),
        run({ x: 130.0, y: 135.7, w: 350, t: "a separate paragraph after a big gap" }),
      ],
      "p"
    );
    expect(groups).toHaveLength(2);
    expect(groups[0]!.runs).toHaveLength(3);
    expect(groups[0]!.html).toBe(
      "line one of the paragraph text here<br>line two of the paragraph text here<br>line three of the paragraph text here"
    );
    expect(groups[1]!.runs).toHaveLength(1);
  });

  it("detects a centered multi-line paragraph (line centers agree)", () => {
    // Indented first line but centers coincide → centered, anchored at the center.
    const groups = groupRuns(
      [
        run({ x: 98.3, y: 68.5, w: 408.7, t: "When both hands move it is called a Dual-Shift" }),
        run({ x: 47.2, y: 85.3, w: 511.3, t: "correspond to the four modes of timing and direction" }),
      ],
      "p"
    );
    expect(groups[0]!.align).toBe("center");
    // centers: (98.3+507)/2 ≈ 302.65 and (47.2+558.5)/2 ≈ 302.85
    expect(groups[0]!.anchorX).toBeCloseTo(302.75, 0);
  });

  it("keeps an emphasis fragment inline as <strong>, space-joined on an x-gap", () => {
    const groups = groupRuns(
      [
        run({ x: 98.3, y: 68.5, w: 338.7, t: "it is called a" }),
        run({ x: 440.1, y: 68.5, w: 64, s: "bold", t: "Dual-Shift" }),
        run({ x: 504.1, y: 68.5, w: 2.9, t: "." }),
      ],
      "p"
    );
    expect(groups).toHaveLength(1);
    // gap before "Dual-Shift" (440.1 − 437.0 = 3.1 > 2) → space; before "." (0) → none.
    expect(groups[0]!.html).toBe("it is called a <strong>Dual-Shift</strong>.");
  });

  it("keeps a distant standalone caption as its own singleton group", () => {
    const groups = groupRuns(
      [
        run({ x: 100, y: 68.5, w: 300, t: "body paragraph line" }),
        run({ x: 12.7, y: 190.2, w: 70.6, fs: 16, s: "italic", t: "Split-Same" }),
      ],
      "p"
    );
    expect(groups).toHaveLength(2);
    const caption = groups.find((g) => g.html.includes("Split-Same"))!;
    expect(caption.multi).toBe(false);
    expect(caption.runs).toHaveLength(1);
  });

  it("escapes html-special characters in run text", () => {
    const groups = groupRuns(
      [
        run({ x: 10, y: 10, w: 100, t: "a < b & c" }),
        run({ x: 10, y: 26, w: 100, t: "next line" }),
      ],
      "p"
    );
    expect(groups[0]!.html).toBe("a &lt; b &amp; c<br>next line");
  });

  it("does not merge lines that share a gap but sit in different columns (no x-overlap)", () => {
    const groups = groupRuns(
      [
        run({ x: 20, y: 100, w: 120, t: "left column line" }),
        run({ x: 400, y: 116, w: 120, t: "right column line" }),
      ],
      "p"
    );
    expect(groups).toHaveLength(2);
  });

  it("assigns stable ids from the page id and index", () => {
    const groups = groupRuns(
      [
        run({ x: 10, y: 10, w: 100, t: "one" }),
        run({ x: 10, y: 200, w: 100, t: "two" }),
      ],
      "hm-type1"
    );
    expect(groups.map((g) => g.id)).toEqual(["proof-hm-type1-g0", "proof-hm-type1-g1"]);
  });
});
