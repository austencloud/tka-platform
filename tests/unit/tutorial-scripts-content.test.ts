import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TUTORIAL_SCRIPTS } from "../../src/routes/admin/tutorials/_data/tutorial-scripts";

// Parity check: the generated TUTORIAL_SCRIPTS content must match the source
// markdown script counts. This is a generator-drift guard, not a re-parse of
// the markdown — it counts headings/markers on both sides and asserts equal
// totals, per-script.

const NEXT_MD = resolve(process.cwd(), "docs/tutorial-video-voiceover/Voiceover-Scripts-Next.md");
const ADVANCED_MD = resolve(
  process.cwd(),
  "docs/tutorial-video-voiceover/Voiceover-Scripts-Advanced.md"
);

const HEADING_RE = /^## (\d+) — (.+)$/gm;

interface ParsedSection {
  number: number;
  title: string;
  body: string;
}

function parseSections(markdown: string): ParsedSection[] {
  const matches = [...markdown.matchAll(HEADING_RE)];
  const sections: ParsedSection[] = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const start = match.index! + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : markdown.length;
    sections.push({
      number: Number(match[1]),
      title: match[2].trim(),
      body: markdown.slice(start, end),
    });
  }
  return sections;
}

function countOccurrences(text: string, marker: string): number {
  return [...text.matchAll(new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))]
    .length;
}

const nextMarkdown = readFileSync(NEXT_MD, "utf8");
const advancedMarkdown = readFileSync(ADVANCED_MD, "utf8");
const allSections = [...parseSections(nextMarkdown), ...parseSections(advancedMarkdown)];
const sectionsByNumber = new Map(allSections.map((s) => [s.number, s]));

describe("tutorial-scripts.ts generator parity", () => {
  it("has one generated script per markdown heading (## N — Title)", () => {
    expect(TUTORIAL_SCRIPTS.length).toBe(allSections.length);
  });

  it("every generated script number has a matching markdown section", () => {
    for (const script of TUTORIAL_SCRIPTS) {
      expect(sectionsByNumber.has(script.number), `script ${script.number} missing in markdown`).toBe(
        true
      );
    }
  });

  it.each(TUTORIAL_SCRIPTS.map((s) => [s.number, s] as const))(
    "script %i: slot/cue block counts match [AUSTEN:] / [CUE:] markers",
    (_number, script) => {
      const section = sectionsByNumber.get(script.number);
      expect(section, `no markdown section for script ${script.number}`).toBeDefined();
      if (!section) return;

      const expectedSlots = countOccurrences(section.body, "[AUSTEN:");
      const expectedCues = countOccurrences(section.body, "[CUE:");

      const actualSlots = script.blocks.filter((b) => b.kind === "slot").length;
      const actualCues = script.blocks.filter((b) => b.kind === "cue").length;

      expect(actualSlots).toBe(expectedSlots);
      expect(actualCues).toBe(expectedCues);
    }
  );
});
