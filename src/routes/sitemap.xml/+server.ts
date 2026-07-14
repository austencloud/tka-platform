import { LANDING_DOMAIN } from "../../config/domains";
import type { RequestHandler } from "./$types";

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
  { url: "learn/staff-spinning-choreography", priority: "0.8", changefreq: "monthly" },
  { url: "roots", priority: "0.8", changefreq: "monthly" },
  // Marketing
  { url: "about", priority: "0.6", changefreq: "monthly" },
  // /support is noindex (see support/+page.svelte) — omitted to avoid a
  // sitemap↔robots "index this / don't index this" conflict.
  // Guide — the indexable, reflowable article routes (the /print + /book
  // replicas are noindex; the canonical is the article, so only these are listed)
  { url: "guide", priority: "0.7", changefreq: "monthly" },
  // Level 1 lives in the in-app reader at /learn/guide, which is ssr=false
  // (client-only shell — not crawlable). Omitted here until the Level 1 topics
  // get a prerendered/SSR article form (SEO roadmap P0).
  { url: "guide/level-2", priority: "0.8", changefreq: "monthly" },
  { url: "guide/level-2/turns", priority: "0.7", changefreq: "monthly" },
  { url: "guide/level-2/double-turns", priority: "0.7", changefreq: "monthly" },
  { url: "guide/codex", priority: "0.7", changefreq: "monthly" },
];

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
    const snapshot = await db.collection("deckReleases/counter/manifests").get();

    const ids = new Set<string>();
    for (const doc of snapshot.docs) {
      const sequences = doc.data()?.sequences as { sequenceId?: string }[] | undefined;
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

  const allEntries = [
    ...pages.map((page) => ({
      url: page.url,
      priority: page.priority,
      changefreq: page.changefreq,
    })),
    ...curatedUrls.map((url) => ({
      url,
      priority: "0.6",
      changefreq: "monthly",
    })),
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${allEntries
    .map(
      (page) => `
  <url>
    <loc>${LANDING_DOMAIN}/${page.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
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
