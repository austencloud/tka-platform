import { LANDING_DOMAIN } from "../../config/domains";
import { GUIDE_BODY_PAGES } from "../(public)/guide/level-1/_data/guide-manifest";
import { allLetterSeo } from "$lib/shared/seo/notation-letters";
import type { RequestHandler } from "./$types";

interface SitemapImage {
  loc: string;
  title: string;
  caption: string;
}

interface SitemapEntry {
  url: string;
  images?: SitemapImage[];
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * One indexable page per canonical letter, each carrying the baked pictograph
 * as an <image:image> so Google Images can associate the file with the page.
 */
function getLetterImageEntries(): SitemapEntry[] {
  return allLetterSeo().map((l) => ({
    url: l.href.replace(/^\//, ""),
    images: [
      {
        loc: `${LANDING_DOMAIN}${l.images.webp}`,
        title: `Kinetic Alphabet letter ${l.letter} pictograph`,
        caption: l.caption,
      },
    ],
  }));
}

const pages: SitemapEntry[] = [
  // Landing page (canonical — /landing duplicates this and is dropped)
  { url: "" },
  // Shop
  { url: "shop" },
  { url: "shop/loop-deck" },
  { url: "shop/tnd-trilogy" },
  { url: "shop/choreography-cards" },
  // Pillar pages (SEO content roadmap)
  { url: "composer" },
  { url: "notation" },
  // Per-prop notation pages (2026-07-16-per-prop-notation-pages-design.md)
  { url: "notation/staves" },
  { url: "notation/fans" },
  { url: "notation/clubs" },
  { url: "notation/buugeng" },
  { url: "notation/poi" },
  { url: "notation/shape-matrix" },
  { url: "notation/loops" },
  { url: "notation/caps" },
  // Per-letter notation pages with baked pictographs (2026-07-14-image-seo-google-images-design.md)
  { url: "notation/letters" },
  { url: "glossary" },
  { url: "learn/staff-spinning-choreography" },
  // /roots redirects (301) to /notation and is intentionally omitted here, same
  // convention as /landing above — a redirected URL doesn't self-list.
  { url: "roots/software" },
  // Marketing
  { url: "about" },
  { url: "faq" },
  // /support is noindex (see support/+page.svelte) — omitted to avoid a
  // sitemap↔robots "index this / don't index this" conflict.
  // Guide — the indexable, reflowable article routes (the /print + /book
  // replicas are noindex; the canonical is the article, so only these are listed)
  { url: "guide" },
  // Level-1 topic routes are enumerated dynamically from the manifest below
  // (guideLevel1Entries) — each is a prerendered /guide/level-1/<slug> page that
  // is BOTH the crawlable SEO surface and the interactive reader (prerender +
  // hydrate). Both the mobile-first and sheet-fallback variants are included;
  // see 2026-07-14-guide-crawlable-paginated-reader-design.md.
  // The downloadable guide PDFs — indexed directly so "what we have" is
  // discoverable, and so a doorway page + its PDF can both surface in search.
  { url: "guides/level-1.pdf" },
  { url: "guides/level-2.pdf" },
  { url: "guides/level-3.pdf" },
  { url: "guide/level-2" },
  { url: "guide/level-2/turns" },
  { url: "guide/level-2/double-turns" },
  { url: "guide/codex" },
];

/**
 * Every Level-1 topic route (/guide/level-1/<slug>), enumerated from the manifest
 * so a new body page is listed automatically. This covers both the mobile-first
 * reflow pages and the sheet-fallback pages.
 */
const guideLevel1Entries = GUIDE_BODY_PAGES.map((p) => ({
  url: `guide/level-1/${p.id}`,
}));

/**
 * Curated sequences: cards released into a physical/printable deck
 * (`deckReleases/counter/manifests/{deckNumber}`, written by the deck
 * releaser — see DeckRelease.ts) are the released-deck definition of
 * "curated." Each manifest's `sequences[].sequenceId` is a real published
 * sequence, linkable at /sequence/{sequenceId} (same URL shape used
 * elsewhere, e.g. NearbySyncBanner.svelte, InboxNotificationItem.svelte).
 * Admin SDK query, capped at 200, falls back to [] on any failure so a
 * Firestore/credentials outage never 500s the sitemap.
 */
async function getCuratedSequenceUrls(): Promise<string[]> {
  try {
    const { getAdminDb } = await import("$lib/server/firebaseAdmin");
    const db = getAdminDb();
    const snapshot = await db
      .collection("deckReleases/counter/manifests")
      .get();

    const ids = new Set<string>();
    for (const doc of snapshot.docs) {
      const sequences = doc.data()?.sequences as
        | { sequenceId?: string }[]
        | undefined;
      if (!Array.isArray(sequences)) continue;
      for (const card of sequences) {
        if (card?.sequenceId) ids.add(card.sequenceId);
        if (ids.size >= 200) break;
      }
      if (ids.size >= 200) break;
    }

    return [...ids].map((id) => `sequence/${encodeURIComponent(id)}`);
  } catch {
    // Non-fatal: admin creds may be absent in preview/dev environments.
    return [];
  }
}

export const GET: RequestHandler = async () => {
  const curatedUrls = await getCuratedSequenceUrls();

  const allEntries: SitemapEntry[] = [
    ...pages,
    ...guideLevel1Entries,
    ...getLetterImageEntries(),
    ...curatedUrls.map((url) => ({ url })),
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  ${allEntries
    .map(
      (page) => `
  <url>
    <loc>${xmlEscape(`${LANDING_DOMAIN}/${page.url}`)}</loc>${(
      page.images ?? []
    )
      .map(
        (img) => `
    <image:image>
      <image:loc>${xmlEscape(img.loc)}</image:loc>
      <image:title>${xmlEscape(img.title)}</image:title>
      <image:caption>${xmlEscape(img.caption)}</image:caption>
    </image:image>`
      )
      .join("")}
  </url>`
    )
    .join("")}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
