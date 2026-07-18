import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  resolve(process.cwd(), "src/routes/(public)/notation/+page.svelte"),
  "utf-8"
);

const qftFigure = page.match(
  /<!-- QFT:[\s\S]*?-->\s*(<figure[\s\S]*?<\/figure>)/
)?.[1];

if (!qftFigure) {
  throw new Error("The QFT figure is missing from the notation page");
}

describe("notation page QFT diagram", () => {
  it("uses QFT's canonical clockwise point numbering", () => {
    const points = [
      [100, 22, 100, 26, 8],
      [155, 45, 155, 49, 1],
      [178, 100, 178, 104, 2],
      [155, 155, 155, 159, 3],
      [100, 178, 100, 182, 4],
      [45, 155, 45, 159, 5],
      [22, 100, 22, 104, 6],
      [45, 45, 45, 49, 7],
    ];

    for (const [circleX, circleY, textX, textY, label] of points) {
      expect(qftFigure).toMatch(
        new RegExp(
          `<circle cx="${circleX}" cy="${circleY}" r="12" \\/>\\s*<text x="${textX}" y="${textY}">${label}<\\/text\\s*>`
        )
      );
    }
  });

  it("draws and describes the move from point eight to point one", () => {
    expect(qftFigure).toContain(
      'aria-label="A circle with eight numbered points: eight at the top, then one through seven clockwise, with an arrow drawn from point eight to point one."'
    );
    expect(qftFigure).toContain(
      "<!-- 8 positions: 8 at top, clockwise through 1..7 -->"
    );
    expect(qftFigure).toContain('d="M113 26 Q140 26 147 39"');
  });
});
