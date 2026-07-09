/**
 * Guide page deep links — the slug ↔ reader-index map behind
 * `/learn/guide/<slug>` (spec: 2026-07-09-guide-deep-links-design.md).
 *
 * Body pages use their manifest id verbatim (stable, unique, kebab-case), so
 * new manifest entries are linkable automatically. The five unnumbered
 * front-matter pages get fixed slugs by reader index. Pure module — the
 * GuideReader consumes it for landing + live URL sync; GuidePageNav for row
 * hrefs; anyone (including Claude in chat) can mint links from manifest ids.
 */
import { GUIDE_BODY_PAGES } from "./guide-manifest";
import { FRONT_MATTER_COUNT } from "./guide-reader-nav";

export const GUIDE_READER_BASE = "/learn/guide";

/** Reader indexes 0–4 (cover, drink, support, read-me, contents). */
export const FRONT_MATTER_SLUGS = [
  "cover",
  "drink-water",
  "support",
  "read-me",
  "contents",
] as const;

/** Slug for a reader page index (front matter + body), or null out of range. */
export function slugForIndex(index: number): string | null {
  if (index >= 0 && index < FRONT_MATTER_COUNT) {
    return FRONT_MATTER_SLUGS[index] ?? null;
  }
  return GUIDE_BODY_PAGES[index - FRONT_MATTER_COUNT]?.id ?? null;
}

/** Reader page index for a slug, or null when unknown. */
export function indexForSlug(slug: string): number | null {
  const front = (FRONT_MATTER_SLUGS as readonly string[]).indexOf(slug);
  if (front !== -1) return front;
  const body = GUIDE_BODY_PAGES.findIndex((e) => e.id === slug);
  return body === -1 ? null : FRONT_MATTER_COUNT + body;
}

/** Shareable href for a reader page index, or null out of range. */
export function hrefForIndex(index: number): string | null {
  const slug = slugForIndex(index);
  return slug ? `${GUIDE_READER_BASE}/${slug}` : null;
}

/**
 * The deep-link slug carried by a reader pathname, or null when the path isn't
 * under /learn/guide (print, book, and the test harness never engage).
 */
export function slugFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/learn\/guide\/([^/?#]+)\/?$/);
  return m ? decodeURIComponent(m[1]!) : null;
}
