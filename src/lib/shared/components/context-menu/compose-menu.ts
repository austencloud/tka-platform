/**
 * compose-menu.ts
 *
 * Additive context-menu composition. A right-click target that sits inside
 * multiple scopes (a pictograph inside a choreo card) shows one menu built
 * from a section per scope, in inner→outer order.
 *
 * Rules:
 * - Empty sections vanish entirely.
 * - Section headers render only when TWO OR MORE sections survive — a header
 *   over a whole single-section menu is noise.
 * - Sections are joined by separators; leading/trailing separators inside a
 *   section are stripped so builders don't have to care about boundaries.
 */

import type { ContextMenuEntry } from "./context-menu-types";
import { isSeparator } from "./context-menu-types";

export interface MenuSection {
  /** Section label rendered as a ContextMenuHeader (only when >=2 sections). */
  header?: string;
  entries: ContextMenuEntry[];
}

export function composeMenu(sections: MenuSection[]): ContextMenuEntry[] {
  const surviving = sections
    .map((s) => ({ ...s, entries: trimSeparators(s.entries) }))
    .filter((s) => s.entries.length > 0);

  const showHeaders = surviving.length >= 2;
  const out: ContextMenuEntry[] = [];

  for (const section of surviving) {
    if (out.length > 0) out.push({ type: "separator" });
    if (showHeaders && section.header) {
      out.push({ type: "header", label: section.header });
    }
    out.push(...section.entries);
  }

  return out;
}

function trimSeparators(entries: ContextMenuEntry[]): ContextMenuEntry[] {
  let start = 0;
  let end = entries.length;
  while (start < end && isSeparator(entries[start]!)) start++;
  while (end > start && isSeparator(entries[end - 1]!)) end--;
  return entries.slice(start, end);
}
