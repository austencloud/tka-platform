import { describe, it, expect } from "vitest";
import { GET } from "../../src/routes/sitemap.xml/+server";

async function renderSitemap(): Promise<string> {
  // The handler takes no event fields it needs here; the curated-sequence
  // Firestore query is wrapped in try/catch and falls back to [] without creds.
  const res = await (GET as unknown as () => Promise<Response>)();
  return res.text();
}

describe("image sitemap", () => {
  it("declares the image sitemap namespace", async () => {
    const xml = await renderSitemap();
    expect(xml).toContain("http://www.google.com/schemas/sitemap-image/1.1");
  });

  it("lists the letters index page", async () => {
    const xml = await renderSitemap();
    expect(xml).toContain("<loc>https://tkaflowarts.com/notation/letters</loc>");
  });

  it("emits an image:image for a known letter with a WebP loc, title, and caption", async () => {
    const xml = await renderSitemap();
    expect(xml).toContain("<loc>https://tkaflowarts.com/notation/letters/a</loc>");
    expect(xml).toContain(
      "<image:loc>https://tkaflowarts.com/notation/letters/kinetic-alphabet-letter-a.webp</image:loc>",
    );
    expect(xml).toMatch(/<image:title>Kinetic Alphabet letter A[^<]*<\/image:title>/);
    expect(xml).toContain("<image:caption>");
  });

  it("emits an image entry for every canonical letter", async () => {
    const xml = await renderSitemap();
    const count = (xml.match(/<image:image>/g) ?? []).length;
    expect(count).toBe(47);
  });
});
