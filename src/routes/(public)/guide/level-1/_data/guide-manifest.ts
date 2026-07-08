/**
 * Level 1 guide — body page manifest. The SINGLE SOURCE OF TRUTH for the
 * printable guide's page order, page numbers, and Table of Contents.
 *
 * One entry = one physical body page. Page number = (index + 1): the first body
 * page (The Grid) is page 1. Front matter (cover, drink water, support, read me,
 * TOC) is intentionally NOT in here — it prints unnumbered, ahead of page 1.
 *
 * Editing this array updates everything downstream at once: the generated TOC
 * (`GuideTOC.svelte`), each page's recto/verso footer number, and the page
 * order in the print route. Add / remove / reorder here, never hand-number a
 * page or a TOC row.
 *
 * Seeded 1 entry = 1 reserved page from the rebuild's intended pagination (see
 * docs/superpowers/specs/2026-06-22-guide-page-numbering-toc-design.md and the
 * rebuild tracker). As real pages split or merge during the page-by-page
 * conversion, add/remove entries — numbers re-derive automatically.
 */

import type { Snippet } from "svelte";

/**
 * Metadata GuideDocument hands each page to the route's wrapper snippet. The
 * route decides the frame (stacked GuidePage for print, scaled flip page for
 * the book); GuideDocument supplies the title, number, full-bleed flag, and the
 * page's content snippet.
 */
export type GuidePageMeta = {
  /** cover | drink | support | readme | toc | body. */
  kind: string;
  title?: string;
  pageNumber?: number;
  fullBleed?: boolean;
  label?: string;
  content: Snippet;
};

export type GuideGroup = "1.0" | "1.1" | "1.2";

export type GuidePageEntry = {
  /** Stable slug. Matches the built-page registry key in the print route. */
  id: string;
  /** TOC label (and placeholder heading until the page is built). */
  title: string;
  /** 0 = section row (TOC main), 1 = indented sub-entry. */
  level: 0 | 1;
  /** TOC section grouping + heading. */
  group: GuideGroup;
  /**
   * The built page paints its own header(s) — GuidePage suppresses the single
   * manifest title. For multi-section pages (e.g. Type 4/5/6, three calligraphic
   * titles). The `title` above still drives the TOC row + dev label.
   */
  selfTitled?: boolean;
};

export const GROUP_TITLES: Record<GuideGroup, string> = {
  "1.0": "Positions / Motions",
  "1.1": "Letters",
  "1.2": "Words",
};

export const GUIDE_BODY_PAGES: GuidePageEntry[] = [
  // ── 1.0 Positions / Motions (p1–p10) ──────────────────────────────────
  { id: "the-grid", title: "The Grid", level: 0, group: "1.0" },
  { id: "hand-positions", title: "Hand Positions", level: 0, group: "1.0" },
  { id: "hand-motions", title: "Hand Motions", level: 0, group: "1.0" },
  { id: "hm-type1", title: "Type 1 Dual-Shifts - Alpha, Beta", level: 1, group: "1.0" },
  { id: "hm-gamma", title: "Gamma - Quarter-Opp, Quarter-Same", level: 1, group: "1.0" },
  { id: "hm-type2", title: "Type 2 - Shifts", level: 1, group: "1.0" },
  { id: "hm-type34", title: "Type 3 - Cross-Shifts", level: 1, group: "1.0" },
  { id: "hm-type56", title: "Type 4/5/6 - Dash, Dual-Dash, Static", level: 1, group: "1.0", selfTitled: true },
  { id: "staff-positions", title: "Staff Positions", level: 0, group: "1.0" },
  { id: "staff-motions", title: "Staff Motions", level: 0, group: "1.0" },
  { id: "negative-space", title: "Negative Space / Body Turns", level: 0, group: "1.0" },

  // ── 1.1 Letters (p11–p29) ─────────────────────────────────────────────
  { id: "base-letters", title: "Base Letters", level: 0, group: "1.1" },
  { id: "bl-double-staff", title: "Double Staff", level: 1, group: "1.1" },
  { id: "bl-clubs", title: "Clubs", level: 1, group: "1.1" },
  { id: "bl-buugeng", title: "Buugeng", level: 1, group: "1.1" },
  { id: "bl-triads", title: "Triads", level: 1, group: "1.1" },
  { id: "bl-fans", title: "Fans", level: 1, group: "1.1" },
  { id: "bl-mini-hoops", title: "Mini Hoops", level: 1, group: "1.1" },
  { id: "letters-type1", title: "Type 1 - Dual-Shifts", level: 0, group: "1.1" },
  { id: "lt1-abc-ghi", title: "ABC, GHI", level: 1, group: "1.1" },
  { id: "lt1-dj-ek-fl", title: "DJ, EK, FL", level: 1, group: "1.1" },
  { id: "lt1-mp-nq-or-stuv", title: "MP, NQ, OR, STUV", level: 1, group: "1.1" },
  { id: "letters-type2", title: "Type 2 - Shifts", level: 0, group: "1.1" },
  { id: "lt2-wxyz", title: "WXYZ, ΣΔθΩ", level: 1, group: "1.1" },
  { id: "letters-type3", title: "Type 3 - Cross-Shifts", level: 0, group: "1.1" },
  { id: "lt3-dash-letters", title: "W- X- Y- Z-, Σ- Δ- θ- Ω-", level: 1, group: "1.1" },
  { id: "letters-type456", title: "Type 4, 5, 6", level: 0, group: "1.1" },
  { id: "lt456-phi-psi-lambda", title: "Φ, Ψ, Λ", level: 1, group: "1.1" },
  { id: "lt456-phi-psi-lambda-dash", title: "Φ-, Ψ-, Λ-", level: 1, group: "1.1" },
  { id: "lt456-alpha-beta-gamma", title: "α, β, γ", level: 1, group: "1.1" },

  // ── 1.2 Words (p30–p34) ───────────────────────────────────────────────
  { id: "words", title: "Words", level: 0, group: "1.2" },
  { id: "permutations", title: "Permutations", level: 0, group: "1.2" },
  { id: "reversals", title: "Reversals", level: 0, group: "1.2" },
  { id: "examples-abc", title: "Examples with A, B, C", level: 0, group: "1.2" },
  { id: "misc-permutations", title: "Misc. Permutation Examples", level: 0, group: "1.2" },
];

/** 1-based page number of an entry id, or undefined if not in the manifest. */
export function pageNumberOf(id: string): number | undefined {
  const i = GUIDE_BODY_PAGES.findIndex((e) => e.id === id);
  return i === -1 ? undefined : i + 1;
}

/** The body entries grouped in manifest order, for TOC rendering. */
export function bodyPagesByGroup(): { group: GuideGroup; entries: { entry: GuidePageEntry; page: number }[] }[] {
  const out: { group: GuideGroup; entries: { entry: GuidePageEntry; page: number }[] }[] = [];
  GUIDE_BODY_PAGES.forEach((entry, i) => {
    let bucket = out.find((b) => b.group === entry.group);
    if (!bucket) {
      bucket = { group: entry.group, entries: [] };
      out.push(bucket);
    }
    bucket.entries.push({ entry, page: i + 1 });
  });
  return out;
}
