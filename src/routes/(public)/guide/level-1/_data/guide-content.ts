/**
 * Single-source content per migrated guide page, keyed by manifest id (mirrors
 * built-pages.ts). FlowFrame + the crawlable routes look up a page's GuideBlock[]
 * here; the reader's flow toggle only reflows slugs present in this map. Add an
 * entry as each page is migrated to the single-source model.
 */
import type { GuideBlock } from "./guide-content-blocks";
import { handPositionsContent } from "./content/hand-positions.content";

export const GUIDE_CONTENT: Record<string, GuideBlock[]> = {
  "hand-positions": handPositionsContent,
};

/** Whether a manifest id has a reflowable single-source content array. */
export function hasReflowContent(id: string): boolean {
  return id in GUIDE_CONTENT;
}
