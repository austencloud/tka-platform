import { LANDING_DOMAIN } from "../../config/domains";
import type { RequestHandler } from "./$types";

const pages = [
  // Landing page (canonical — /landing duplicates this and is dropped)
  { url: "", priority: "1.0", changefreq: "weekly" },
  // Shop
  { url: "shop", priority: "0.9", changefreq: "weekly" },
  { url: "shop/loop-deck", priority: "0.8", changefreq: "monthly" },
  { url: "shop/tnd-trilogy", priority: "0.8", changefreq: "monthly" },
  // Marketing
  { url: "about", priority: "0.6", changefreq: "monthly" },
  { url: "support", priority: "0.5", changefreq: "monthly" },
  // Guide — the indexable, reflowable article routes (the /print + /book
  // replicas are noindex; the canonical is the article, so only these are listed)
  { url: "guide", priority: "0.7", changefreq: "monthly" },
  { url: "guide/level-1", priority: "0.8", changefreq: "monthly" },
  { url: "guide/level-1/positions-motions", priority: "0.7", changefreq: "monthly" },
  { url: "guide/level-1/letters", priority: "0.7", changefreq: "monthly" },
  { url: "guide/level-1/words", priority: "0.7", changefreq: "monthly" },
];

export const GET: RequestHandler = async () => {
  const now = new Date().toISOString().split("T")[0];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${pages
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
