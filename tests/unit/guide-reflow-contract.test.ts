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

describe("FlowFrame", () => {
  const src = read("src/routes/(public)/guide/level-1/_components/FlowFrame.svelte");
  it("renders semantic headings + prose and uses GuidePictograph for figures", () => {
    expect(src).toContain("GuidePictograph");
    expect(src).toMatch(/<h2|<h3/);
    expect(src).not.toContain("position: absolute");
  });
});

describe("GUIDE_CONTENT registry", () => {
  it("registers hand-positions", async () => {
    const { GUIDE_CONTENT, hasReflowContent } = await import(
      "../../src/routes/(public)/guide/level-1/_data/guide-content"
    );
    expect(hasReflowContent("hand-positions")).toBe(true);
    expect(GUIDE_CONTENT["hand-positions"]!.length).toBeGreaterThan(0);
  });
});

describe("frame toggle wiring", () => {
  it("GuideDocument routes the flow frame via GUIDE_CONTENT", () => {
    const src = read("src/routes/(public)/guide/level-1/_components/GuideDocument.svelte");
    expect(src).toContain("FlowFrame");
    expect(src).toContain('frame === "flow"');
  });
  it("GuideReader renders the sheet/flow SegmentedControl and a full-width flow page", () => {
    const src = read("src/routes/(public)/guide/level-1/_components/GuideReader.svelte");
    expect(src).toContain("SegmentedControl");
    expect(src).toContain("guideFramePrefs.frame");
    expect(src).toContain("reader-flow-page");
  });
});
