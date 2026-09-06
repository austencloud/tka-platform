import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { fanAppearanceArtwork } from "$lib/shared/pictograph/prop/domain/fan-appearance";

const root = process.cwd();
const contours = JSON.parse(
  fs.readFileSync(
    path.join(root, "scripts/assets/doodlegrip-day-contours.json"),
    "utf8"
  )
) as { outline: number[][]; holes: number[][][] };

function readArtwork(cover: "bare" | "covered", frameColor: "black" | "white") {
  const href = fanAppearanceArtwork("day", cover, frameColor)!;
  const file = href.replace(/\?.*$/, "");
  return fs.readFileSync(path.join(root, "static", file), "utf8");
}

function plateLoops(svg: string): string[] {
  const plate = /<path data-day-plate="" d="([^"]+)"/.exec(svg)?.[1] ?? "";
  return plate.split(" Z").filter((loop) => loop.trim().length > 0);
}

describe("DoodleGrip Day fan artwork", () => {
  it("draws the traced cut sheet as one even-odd plate on the hand pivot", () => {
    const svg = readArtwork("bare", "black");
    expect(svg).toContain('data-fan-plate="black" fill="#11141a" fill-rule="evenodd"');
    const loops = plateLoops(svg);
    expect(loops).toHaveLength(1 + contours.holes.length);
    expect(loops[0].split(" L ")).toHaveLength(contours.outline.length);

    // Every vertex stays inside the shared 260 x 207 prop box so nothing clips.
    const numbers = loops
      .join(" ")
      .match(/-?\d+(?:\.\d+)?/g)!
      .map(Number);
    for (let index = 0; index < numbers.length; index += 2) {
      expect(numbers[index]).toBeGreaterThanOrEqual(0);
      expect(numbers[index]).toBeLessThanOrEqual(260);
      expect(numbers[index + 1]).toBeGreaterThanOrEqual(0);
      expect(numbers[index + 1]).toBeLessThanOrEqual(207);
    }

    // The finger ring (last hole) is centred on the pivot at 130, 103.5.
    const ring = loops.at(-1)!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    const xs = ring.filter((_, index) => index % 2 === 0);
    const ys = ring.filter((_, index) => index % 2 === 1);
    const center = [
      (Math.min(...xs) + Math.max(...xs)) / 2,
      (Math.min(...ys) + Math.max(...ys)) / 2,
    ];
    expect(center[0]).toBeCloseTo(130, 0);
    expect(center[1]).toBeCloseTo(103.5, 0);
  });

  it("paints the plate in its frame color and leaves only the rim to the hand", () => {
    expect(readArtwork("bare", "black")).toContain(
      'data-fan-plate="black" fill="#11141a"'
    );
    expect(readArtwork("bare", "white")).toContain(
      'data-fan-plate="white" fill="#f0f1f4"'
    );
    // Only the rim group is marked for hand recoloring; the plate is not.
    const white = readArtwork("bare", "white");
    expect(white.match(/data-fan-frame=""/g)).toHaveLength(1);
    expect(white).toContain('data-fan-frame="" fill="none" stroke="#2E3192"');
    expect(readArtwork("bare", "white")).not.toContain('data-fan-cover=""');
    expect(readArtwork("covered", "white")).toContain('data-fan-cover=""');
    expect(fs.existsSync(path.join(root, "static/images/props/appearances/fan-day.svg"))).toBe(false);
  });
});
