/**
 * Generates src/routes/admin/tutorials/_data/tutorial-scripts.ts from the
 * canonical tutorial voiceover markdown (scripts 12–38). The markdown stays
 * the source of truth for spoken text; re-run this after editing it:
 *
 *   node scripts/build-tutorial-content.mjs
 *
 * Parity with the markdown is asserted by
 * tests/unit/tutorial-scripts-content.test.ts.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = [
  "docs/tutorial-video-voiceover/Voiceover-Scripts-Next.md",
  "docs/tutorial-video-voiceover/Voiceover-Scripts-Advanced.md",
];
const OUT = "src/routes/admin/tutorials/_data/tutorial-scripts.ts";

/** Seeded pictograph picks per script — the letters each script teaches.
 *  Swappable in-app later (P3); empty = concept video with no letter demo. */
const PICTOGRAPH_SEEDS = {
  12: ["G"], 13: ["H"], 14: ["I"],
  15: ["γ"],
  16: ["S"], 17: ["T"], 18: ["U", "V"],
  19: ["M", "P"], 20: ["N", "Q"], 21: ["O", "R"],
  22: ["A", "G", "S"],
  23: ["Σ"], 24: ["Σ", "Δ"], 25: ["θ", "Ω"], 26: ["W", "X", "Y", "Z"],
  27: ["Σ-", "W-"],
  28: ["Φ", "Ψ", "Λ"], 29: ["Φ-", "Ψ-", "Λ-"],
  30: ["α", "β", "γ"],
  31: ["A", "Σ", "Σ-", "Φ", "Φ-", "α"],
  32: ["C", "W"], 33: ["A", "B"],
  34: ["C"], 35: [],
  36: [], 37: [], 38: [],
};

function parseFile(path) {
  const raw = readFileSync(join(root, path), "utf8");
  const lines = raw.split(/\r?\n/);

  // runtime targets from header tables: | 12 | Letter G | ~2:30 |
  const runtimes = new Map();
  for (const l of lines) {
    const m = l.match(/^\|\s*(\d+)\s*\|\s*[^|]+\|\s*(~[\d:]+)\s*\|/);
    if (m) runtimes.set(Number(m[1]), m[2]);
  }

  const scripts = [];
  let part = "";
  let cur = null;
  let para = [];
  let inOpenQuestions = false;

  const pushBlocks = (text) => {
    if (!cur) return;
    text = text.trim();
    if (!text) return;
    if (/^\*Goal:/.test(text)) {
      cur.goal = text.replace(/^\*Goal:\s*/, "").replace(/\*$/, "").trim();
      return;
    }
    if (/^`?\[CUE:/.test(text)) {
      cur.blocks.push({
        kind: "cue",
        text: text.replace(/^`?\[CUE:\s*/, "").replace(/\]`?$/, "").trim(),
      });
      return;
    }
    // split inline AUSTEN slots out of spoken text, preserving order
    const re = /`?\[AUSTEN:\s*([\s\S]*?)\]`?/g;
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const before = text.slice(last, m.index).trim();
      if (before) cur.blocks.push({ kind: "spoken", text: before });
      cur.blocks.push({
        kind: "slot",
        id: `s${cur.number}-${++cur._slotCount}`,
        prompt: m[1].replace(/\s+/g, " ").trim(),
      });
      last = re.lastIndex;
    }
    const after = text.slice(last).trim();
    if (after) cur.blocks.push({ kind: "spoken", text: after });
  };

  const flush = () => {
    pushBlocks(para.join(" "));
    para = [];
  };
  const closeScript = () => {
    if (!cur) return;
    flush();
    delete cur._slotCount;
    scripts.push(cur);
    cur = null;
  };

  for (const line of lines) {
    if (/^# /.test(line)) {
      closeScript();
      const t = line.replace(/^# /, "").trim();
      if (/^Open domain/i.test(t)) { inOpenQuestions = true; continue; }
      if (/^Part /.test(t)) { part = t; inOpenQuestions = false; }
      continue;
    }
    if (inOpenQuestions) continue;
    const h = line.match(/^## (\d+)\s*—\s*(.+)$/);
    if (h) {
      closeScript();
      const number = Number(h[1]);
      cur = {
        id: `${number}-${h[2].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
        number,
        title: h[2].trim(),
        part,
        targetRuntime: runtimes.get(number) ?? "",
        goal: "",
        blocks: [],
        _slotCount: 0,
      };
      const seed = PICTOGRAPH_SEEDS[number] ?? [];
      if (seed.length) {
        cur.blocks.push({
          kind: "pictographs",
          picks: seed.map((letter) => ({ letter, variationIndex: 0 })),
        });
      }
      continue;
    }
    if (!cur) continue;
    if (/^---+$/.test(line.trim()) || /^\|/.test(line)) { flush(); continue; }
    if (line.trim() === "") { flush(); continue; }
    para.push(line.trim());
  }
  closeScript();
  return scripts;
}

const all = SOURCES.flatMap(parseFile);

const header = `// GENERATED FILE — do not edit by hand.
// Source: docs/tutorial-video-voiceover/Voiceover-Scripts-{Next,Advanced}.md
// Regenerate: node scripts/build-tutorial-content.mjs

export interface PictographPick {
  letter: string;
  variationIndex: number;
  caption?: string;
}

export type ScriptBlock =
  | { kind: "spoken"; text: string }
  | { kind: "cue"; text: string }
  | { kind: "slot"; id: string; prompt: string }
  | { kind: "pictographs"; picks: PictographPick[] };

export interface TutorialScript {
  id: string;
  number: number;
  title: string;
  part: string;
  targetRuntime: string;
  goal: string;
  blocks: ScriptBlock[];
}

export const TUTORIAL_SCRIPTS: TutorialScript[] = `;

mkdirSync(join(root, dirname(OUT)), { recursive: true });
writeFileSync(join(root, OUT), header + JSON.stringify(all, null, 2) + ";\n");
console.log(
  `wrote ${OUT}: ${all.length} scripts, ` +
  `${all.reduce((n, s) => n + s.blocks.filter((b) => b.kind === "slot").length, 0)} slots, ` +
  `${all.reduce((n, s) => n + s.blocks.filter((b) => b.kind === "cue").length, 0)} cues`
);
