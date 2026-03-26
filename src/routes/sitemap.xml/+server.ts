import { LANDING_DOMAIN } from "../../config/domains";
import type { RequestHandler } from "./$types";

const pages = [
  // Landing page
  { url: "", priority: "1.0", changefreq: "weekly" },
  // App entry (default module)
  { url: "create", priority: "0.9", changefreq: "weekly" },
  // Public pages
  { url: "profile", priority: "0.5", changefreq: "monthly" },
  { url: "landing", priority: "0.8", changefreq: "weekly" },
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
