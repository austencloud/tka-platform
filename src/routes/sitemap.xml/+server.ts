import { LANDING_DOMAIN } from "../../config/domains";
import { GUIDE_BODY_PAGES } from "../(public)/guide/level-1/_data/guide-manifest";
import { hasReflowContent } from "../(public)/guide/level-1/_data/guide-content";
import { allLetterSeo } from "$lib/shared/seo/notation-letters";
import type { RequestHandler } from "./$types";

interface SitemapImage {
  loc: string;
  title: string;
  caption: string;
}

interface SitemapEntry {
  url: string;
  priority: string;
  changefreq: string;
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
    priority: "0.6",
    changefreq: "monthly",
    images: [
      {
        loc: `${LANDING_DOMAIN}${l.images.webp}`,
        title: `Kinetic Alphabet letter ${l.letter} pictograph`,
        caption: l.caption,
      },
    ],
  }));
}

const pages = [
  // Landing page (canonical — /landing duplicates this and is dropped)
  { url: "", priority: "1.0", changefreq: "weekly" },
  // Shop
  { url: "shop", priority: "0.9", changefreq: "weekly" },
  { url: "shop/loop-deck", priority: "0.8", changefreq: "monthly" },
  { url: "shop/tnd-trilogy", priority: "0.8", changefreq: "monthly" },
  { url: "shop/choreography-cards", priority: "0.8", changefreq: "monthly" },
  // Pillar pages (SEO content roadmap)
  { url: "composer", priority: "0.9", changefreq: "monthly" },
  { url: "notation", priority: "0.9", changefreq: "monthly" },
  // Per-prop notation pages (2026-07-16-per-prop-notation-pages-design.md)
  { url: "notation/staves", priority: "0.7", changefreq: "monthly" },
  { url: "notation/fans", priority: "0.7", changefreq: "monthly" },
  { url: "notation/clubs", priority: "0.7", changefreq: "monthly" },
  { url: "notation/buugeng", priority: "0.7", changefreq: "monthly" },
  { url: "notation/poi", priority: "0.7", changefreq: "monthly" },
  { url: "notation/shape-matrix", priority: "0.7", changefreq: "monthly" },
  { url: "notation/loops", priority: "0.7", changefreq: "monthly" },
  // Per-letter notation pages with baked pictographs (2026-07-14-image-seo-google-images-design.md)
  { url: "notation/letters", priority: "0.7", changefreq: "monthly" },
  { url: "glossary", priority: "0.8", changefreq: "monthly" },
  {
    url: "learn/staff-spinning-choreography",
    priority: "0.8",
    changefreq: "monthly",
  },
  // /roots redirects (301) to /notation and is intentionally omitted here, same
  // convention as /landing above — a redirected URL doesn't self-list.
  { url: "roots/software", priority: "0.7", changefreq: "monthly" },
  // Marketing
  { url: "about", priority: "0.6", changefreq: "monthly" },
  // /support is noindex (see support/+page.svelte) — omitted to avoid a
  // sitemap↔robots "index this / don't index this" conflict.
  // Guide — the indexable, reflowable article routes (the /print + /book
  // replicas are noindex; the canonical is the article, so only these are listed)
  { url: "guide", priority: "0.7", changefreq: "monthly" },
  // Level-1 topic routes are enumerated dynamically from the manifest below
  // (guideLevel1Entries) — each is a prerendered /guide/level-1/<slug> page that
  // is BOTH the crawlable SEO surface and the interactive reader (prerender +
  // hydrate). Flow-ready (mobile-first) pages rank higher than sheet-fallback
  // ones; see 2026-07-14-guide-crawlable-paginated-reader-design.md.
  // The downloadable guide PDFs — indexed directly so "what we have" is
  // discoverable, and so a doorway page + its PDF can both surface in search.
  { url: "guides/level-1.pdf", priority: "0.6", changefreq: "yearly" },
  { url: "guides/level-2.pdf", priority: "0.6", changefreq: "yearly" },
  { url: "guides/level-3.pdf", priority: "0.6", changefreq: "yearly" },
  { url: "guide/level-2", priority: "0.8", changefreq: "monthly" },
  { url: "guide/level-2/turns", priority: "0.7", changefreq: "monthly" },
  { url: "guide/level-2/double-turns", priority: "0.7", changefreq: "monthly" },
  { url: "guide/codex", priority: "0.7", changefreq: "monthly" },
];

/**
 * Every Level-1 topic route (/guide/level-1/<slug>), enumerated from the manifest
 * so a new body page is listed automatically. Flow-ready pages (mobile-first
 * reflow content registered in GUIDE_CONTENT) rank higher than sheet-fallback
 * pages, which still crawl but render the desktop print sheet.
 */
const guideLevel1Entries = GUIDE_BODY_PAGES.map((p) => ({
  url: `guide/level-1/${p.id}`,
  priority: hasReflowContent(p.id) ? "0.7" : "0.6",
  changefreq: "monthly",
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

    return [...ids].map((id) => `sequence/${id}`);
  } catch {
    // Non-fatal: admin creds may be absent in preview/dev environments.
    return [];
  }
}

export const GET: RequestHandler = async () => {
  const now = new Date().toISOString().split("T")[0];
  const curatedUrls = await getCuratedSequenceUrls();

  const allEntries: SitemapEntry[] = [
    ...pages.map((page) => ({
      url: page.url,
      priority: page.priority,
      changefreq: page.changefreq,
    })),
    ...guideLevel1Entries,
    ...getLetterImageEntries(),
    ...curatedUrls.map((url) => ({
      url,
      priority: "0.6",
      changefreq: "monthly",
    })),
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  ${allEntries
    .map(
      (page) => `
  <url>
    <loc>${LANDING_DOMAIN}/${page.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>${(page.images ?? [])
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
