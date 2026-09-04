import { describe, expect, it } from "vitest";
import { GET as getRobots } from "../../src/routes/robots.txt/+server";
import { GET as getSitemap } from "../../src/routes/sitemap.xml/+server";
import { load as redirectLanding } from "../../src/routes/landing/+page.server";

async function responseText(handler: unknown): Promise<string> {
  const response = await (handler as () => Promise<Response>)();
  return response.text();
}

describe("search indexing controls", () => {
  it("allows crawlers to fetch SvelteKit assets while keeping private routes excluded", async () => {
    const robots = await responseText(getRobots);

    expect(robots).not.toContain("Disallow: /_app/");
    expect(robots).toContain("Disallow: /api/");
    expect(robots).toContain("Disallow: /admin/");
  });

  it("does not emit guessed modification dates or ignored crawl hints", async () => {
    const sitemap = await responseText(getSitemap);

    expect(sitemap).not.toContain("<lastmod>");
    expect(sitemap).not.toContain("<changefreq>");
    expect(sitemap).not.toContain("<priority>");
    expect(sitemap).toContain("<loc>https://tkaflowarts.com/composer</loc>");
    expect(sitemap).toContain("<loc>https://tkaflowarts.com/faq</loc>");
    expect(sitemap).toContain(
      "<loc>https://tkaflowarts.com/timing-and-direction</loc>"
    );
    expect(sitemap).toContain(
      "<loc>https://tkaflowarts.com/timing-and-direction/quarter-time-same-direction</loc>"
    );
    expect(sitemap).toContain(
      "<loc>https://tkaflowarts.com/timing-and-direction/quarter-time-opposite-direction</loc>"
    );
  });

  it("permanently redirects the old landing duplicate to the canonical root", () => {
    try {
      redirectLanding({} as never);
      expect.unreachable("The landing route must redirect");
    } catch (error) {
      expect(error).toMatchObject({ status: 301, location: "/" });
    }
  });
});
