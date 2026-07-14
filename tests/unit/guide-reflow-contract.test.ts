import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  blockProseText,
  type GuideBlock,
} from "../../src/routes/(public)/guide/level-1/_data/guide-content-blocks";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

describe("blockProseText", () => {
  it("concatenates heading + prose text, stripping HTML", () => {
    const blocks: GuideBlock[] = [
      { kind: "heading", level: 2, text: "Alpha" },
      {
        kind: "prose",
        html: "In <strong>Alpha</strong>, the hands occupy the points across from each other.",
      },
      { kind: "rule", sheet: { x: 0, y: 0 } },
    ];
    expect(blockProseText(blocks)).toBe(
      "Alpha In Alpha, the hands occupy the points across from each other."
    );
  });
});

describe("SheetFrame", () => {
  const src = read("src/routes/(public)/guide/level-1/_components/SheetFrame.svelte");
  it("keeps the 816/612 pt→px scale and absolute positioning", () => {
    expect(src).toContain("816 / 612");
    expect(src).toContain("position: absolute");
  });
});
