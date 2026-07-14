/**
 * Level-2 reader nav rows — the level-2 counterpart of level-1's
 * guide-reader-nav.ts. Produces the SAME `ReaderNavRow[]` shape GuidePageNav
 * consumes, so the shared 3-pane reader renders a level-2 side nav without
 * forking the component (never-hand-roll).
 *
 * Level2Document renders exactly ONE unnumbered front-matter page (the cover)
 * before body page 0 — no drink/support/read-me/TOC — so a body entry at
 * 0-based position `i` sits at reader index `FRONT_MATTER_COUNT_2 + i`.
 */
import type { Component } from "svelte";
import type { ReaderNavRow } from "../../level-1/_data/guide-reader-nav";
import { LEVEL2_BODY_PAGES, LEVEL2_GROUP_TITLES, type Level2Group } from "./guide-manifest";

/** Level2Document renders 1 unnumbered front-matter page (cover) before body 0. */
export const FRONT_MATTER_COUNT_2 = 1;

/** Front-matter jumps surfaced in the nav (Level 2 has only the cover). */
const FRONT_ROWS: { index: number; title: string }[] = [{ index: 0, title: "Cover" }];

export function buildLevel2ReaderNav(built: Record<string, Component>): ReaderNavRow[] {
  const rows: ReaderNavRow[] = FRONT_ROWS.map((f) => ({ kind: "front", ...f }));
  const seen: Level2Group[] = [];
  LEVEL2_BODY_PAGES.forEach((entry, i) => {
    if (!seen.includes(entry.group)) {
      seen.push(entry.group);
      rows.push({ kind: "group", group: entry.group, title: LEVEL2_GROUP_TITLES[entry.group] });
    }
    rows.push({
      kind: "page",
      index: FRONT_MATTER_COUNT_2 + i, // body page i (0-based) → reader index 1 + i
      id: entry.id,
      title: entry.title,
      group: entry.group,
      level: entry.level,
      built: !!built[entry.id],
    });
  });
  return rows;
}

/** Total reader page count = front matter (cover) + all body pages. */
export const READER_PAGE_COUNT_2 = FRONT_MATTER_COUNT_2 + LEVEL2_BODY_PAGES.length;
