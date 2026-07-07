/**
 * Reader nav rows — the manifest, flattened for the GuideReader's left nav.
 *
 * GuideDocument renders 5 unnumbered front-matter pages (cover, drink, support,
 * readme, toc) before body page 0, so a body entry at 1-based manifest position
 * `page` sits at reader index `FRONT_MATTER_COUNT + (page - 1)`. The nav surfaces
 * three front-matter jumps (Cover, Read Me, Contents); drink/support stay
 * reachable via Prev/Next but aren't nav rows.
 */
import type { Component } from "svelte";
import {
  GUIDE_BODY_PAGES,
  GROUP_TITLES,
  bodyPagesByGroup,
  type GuideGroup,
} from "./guide-manifest";

/** GuideDocument renders 5 unnumbered front-matter pages before body page 0. */
export const FRONT_MATTER_COUNT = 5;

export type ReaderNavRow =
  | { kind: "front"; index: number; title: string }
  | { kind: "group"; group: GuideGroup; title: string }
  | {
      kind: "page";
      index: number;
      id: string;
      title: string;
      group: GuideGroup;
      level: 0 | 1;
      built: boolean;
    };

/** Front-matter jumps surfaced in the nav (drink/support remain reachable via paging). */
const FRONT_ROWS: { index: number; title: string }[] = [
  { index: 0, title: "Cover" },
  { index: 3, title: "Read Me" },
  { index: 4, title: "Contents" },
];

export function buildReaderNav(built: Record<string, Component>): ReaderNavRow[] {
  const rows: ReaderNavRow[] = FRONT_ROWS.map((f) => ({ kind: "front", ...f }));
  for (const bucket of bodyPagesByGroup()) {
    rows.push({ kind: "group", group: bucket.group, title: GROUP_TITLES[bucket.group] });
    for (const { entry, page } of bucket.entries) {
      rows.push({
        kind: "page",
        index: FRONT_MATTER_COUNT + (page - 1), // page is 1-based manifest position
        id: entry.id,
        title: entry.title,
        group: entry.group,
        level: entry.level,
        built: !!built[entry.id],
      });
    }
  }
  return rows;
}

/** Total reader page count = front matter + all body pages. */
export const READER_PAGE_COUNT = FRONT_MATTER_COUNT + GUIDE_BODY_PAGES.length;
