import { APP_DOMAIN, LANDING_DOMAIN, isAppDomain } from "../../config/domains";
import type { RequestHandler } from "./$types";

// Pages for the app domain (tkascribe.com)
const appPages = [
  // Main Application - Home/Dashboard
  {
    url: "",
    priority: "1.0",
    changefreq: "weekly",
  },
  // Authentication
  {
    url: "auth/login",
    priority: "0.6",
    changefreq: "monthly",
  },
  // User Profile
  {
    url: "profile",
    priority: "0.5",
    changefreq: "monthly",
  },
];

// Pages for the landing domain (tkaflowarts.com)
const landingPages = [
  // Landing page home
  {
    url: "",
    priority: "1.0",
    changefreq: "weekly",
  },
  // Landing page (if accessed directly)
  {
    url: "landing",
    priority: "0.9",
    changefreq: "weekly",
  },
];

export const GET: RequestHandler = async ({ request }) => {
  // Detect which domain we're serving from
  const origin = new URL(request.url).origin;
  const isApp = isAppDomain(origin);
  const domain = isApp ? APP_DOMAIN : LANDING_DOMAIN;
  const pages = isApp ? appPages : landingPages;

  const now = new Date().toISOString().split("T")[0];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${pages
    .map(
      (page) => `
  <url>
    <loc>${domain}/${page.url}</loc>
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
