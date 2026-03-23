import { APP_DOMAIN, LANDING_DOMAIN } from "../../config/domains";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request }) => {
  // Detect which context we're serving from based on path
  const url = new URL(request.url);
  const isApp = url.pathname.startsWith("/app");
  const domain = isApp ? APP_DOMAIN : LANDING_DOMAIN;

  // Different robots.txt content based on domain
  const robots = isApp
    ? `User-agent: *
Allow: /

# Sitemap
Sitemap: ${domain}/sitemap.xml

# Main application pages
Allow: /
Allow: /profile
Allow: /sequence/

# Block internal paths
Disallow: /api/
Disallow: /admin/
Disallow: /test/
Disallow: /demo/
Disallow: /_app/
Disallow: /.svelte-kit/

# Crawl delay for respectful crawling
Crawl-delay: 1`
    : `User-agent: *
Allow: /

# Sitemap
Sitemap: ${domain}/sitemap.xml

# Landing pages
Allow: /
Allow: /landing

# Block internal paths
Disallow: /api/
Disallow: /admin/
Disallow: /test/
Disallow: /demo/
Disallow: /_app/
Disallow: /.svelte-kit/
Disallow: /app/

# Crawl delay for respectful crawling
Crawl-delay: 1`;

  return new Response(robots, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400",
    },
  });
};
