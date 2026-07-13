/**
 * Level 2 guide — body page manifest. Single source of truth for the Level 2
 * printable guide's page order and page numbers, mirroring the Level 1
 * architecture (see level-1/_data/guide-manifest.ts and the rebuild tracker
 * docs/superpowers/specs/2026-07-13-level-2-guide-rebuild-tracker.md).
 *
 * One entry = one physical body page; page number = index + 1. Front matter
 * (cover) prints unnumbered ahead of page 1. Original v0.5 page mapping is
 * noted per entry. Back matter (Let's Collaborate / Taco Tuesday / back cover)
 * is intentionally parked, matching Level 1.
 *
 * Landscape codex originals reflow to portrait per the tracker decision (the
 * original's own portrait codexes p20/p22/p32/p34 are the layout templates).
 */

export type Level2Group = "2.0" | "2.1";

export type Level2PageEntry = {
  /** Stable slug. Matches the BUILT2 registry key. */
  id: string;
  /** TOC/dev label (and placeholder heading until the page is built). */
  title: string;
  /** 0 = section row, 1 = indented sub-entry. */
  level: 0 | 1;
  group: Level2Group;
  /** Page paints its own header(s); suppress the manifest title. */
  selfTitled?: boolean;
};

export const LEVEL2_GROUP_TITLES: Record<Level2Group, string> = {
  "2.0": "1-Turns",
  "2.1": "2-Turns",
};

export const LEVEL2_BODY_PAGES: Level2PageEntry[] = [
  // ── 2.0 1-Turns ────────────────────────────────────────────────────────
  { id: "divider-1-turns", title: "2.0 — 1-Turns", level: 0, group: "2.0", selfTitled: true }, // old p2 (divider art)
  { id: "turns-shifts", title: "Turns", level: 0, group: "2.0" }, // old p3 — pro/anti 1-turn breakdowns
  { id: "turns-dash-static", title: "Dashes / Static", level: 1, group: "2.0", selfTitled: true }, // old p4
  { id: "glyphs-pads", title: "Glyphs / PADS", level: 0, group: "2.0" }, // old p5
  { id: "t1-dual-shift", title: "Type 1 - Dual-Shift", level: 0, group: "2.0" }, // old p6
  { id: "s-and-t", title: "S and T", level: 1, group: "2.0" }, // old p7
  { id: "t2-shift", title: "Type 2 - Shift", level: 0, group: "2.0" }, // old p8
  { id: "t3-cross-shift", title: "Type 3 - Cross-Shift", level: 0, group: "2.0" }, // old p9
  { id: "t4-dash", title: "Type 4 - Dash", level: 0, group: "2.0" }, // old p10
  { id: "opening-closing", title: "Opening/Closing", level: 1, group: "2.0" }, // old p11
  { id: "t5-dual-dash", title: "Type 5 - Dual-Dash", level: 0, group: "2.0" }, // old p12
  { id: "t6-static", title: "Type 6 - Static", level: 0, group: "2.0" }, // old p13
  { id: "one-one-t1", title: "1|1 Turns", level: 0, group: "2.0" }, // old p14
  { id: "one-one-t23", title: "1|1 - Type 2/3", level: 1, group: "2.0", selfTitled: true }, // old p15
  { id: "one-one-t456", title: "1|1 - Type 4/5/6", level: 1, group: "2.0", selfTitled: true }, // old p16
  { id: "codex-1-0-t1", title: "Codex: 1|0 Type 1", level: 0, group: "2.0" }, // old p17 (landscape → portrait)
  { id: "codex-0-1-t23", title: "Codex: 0/1 Type 2/3", level: 1, group: "2.0", selfTitled: true }, // old p18 (landscape → portrait)
  { id: "codex-1-0-t23-456", title: "Codex: 1/0 Type 2/3 + 4/5/6", level: 1, group: "2.0", selfTitled: true }, // old p19 (landscape → portrait)
  { id: "codex-1-1-t1", title: "Codex: 1|1 Type 1", level: 1, group: "2.0" }, // old p20 (portrait template)
  { id: "codex-1-1-t23", title: "Codex: 1/1 Type 2/3", level: 1, group: "2.0", selfTitled: true }, // old p21 (landscape → portrait)
  { id: "codex-1-1-t456", title: "Codex: 1|1 Type 4/5/6", level: 1, group: "2.0", selfTitled: true }, // old p22 (portrait template)

  // ── 2.1 2-Turns ────────────────────────────────────────────────────────
  { id: "two-turns-shifts", title: "2-Turns", level: 0, group: "2.1" }, // old p23
  { id: "two-turns-dash-static", title: "Dashes / Static", level: 1, group: "2.1", selfTitled: true }, // old p24
  { id: "codex-2-0-t1", title: "Codex: 2|0 Type 1", level: 0, group: "2.1" }, // old p25 (landscape → portrait)
  { id: "codex-0-2-t23", title: "Codex: 0/2 Type 2/3", level: 1, group: "2.1", selfTitled: true }, // old p26 (landscape → portrait)
  { id: "codex-2-0-t23-456", title: "Codex: 2/0 Type 2/3 + 4/5/6", level: 1, group: "2.1", selfTitled: true }, // old p27 (landscape → portrait)
  { id: "codex-2-1-t1", title: "Codex: 2|1 Type 1", level: 1, group: "2.1" }, // old p28 (landscape → portrait)
  { id: "codex-1-2-t23", title: "Codex: 1/2 Type 2/3", level: 1, group: "2.1", selfTitled: true }, // old p29 (landscape → portrait)
  { id: "codex-2-1-t23", title: "Codex: 2/1 Type 2/3", level: 1, group: "2.1", selfTitled: true }, // old p30 (landscape → portrait)
  { id: "codex-21-12-t456", title: "Codex: 2/1 + 1/2 Type 4/5/6", level: 1, group: "2.1", selfTitled: true }, // old p31 (landscape → portrait)
  { id: "codex-2-2-t1", title: "Codex: 2|2 Type 1", level: 1, group: "2.1" }, // old p32 (portrait template)
  { id: "codex-2-2-t23", title: "Codex: 2/2 Type 2/3", level: 1, group: "2.1", selfTitled: true }, // old p33 (landscape → portrait)
  { id: "codex-2-2-t456", title: "Codex: 2|2 Type 4/5/6", level: 1, group: "2.1", selfTitled: true }, // old p34 (portrait template)
];

/** 1-based page number of an entry id, or undefined if not in the manifest. */
export function level2PageNumberOf(id: string): number | undefined {
  const i = LEVEL2_BODY_PAGES.findIndex((e) => e.id === id);
  return i === -1 ? undefined : i + 1;
}
