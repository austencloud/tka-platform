import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

describe("notation letter page SEO contract", () => {
  const letterPage = "src/routes/(public)/notation/letters/[slug]/+page.svelte";
  const indexPage = "src/routes/(public)/notation/letters/+page.svelte";

  describe(letterPage, () => {
    const src = read(letterPage);
    it("has a head with canonical, og:image, and twitter card", () => {
      expect(src).toContain("<svelte:head>");
      expect(src).toContain('rel="canonical"');
      expect(src).toContain("og:image");
      expect(src).toContain("twitter:card");
    });
    it("renders a real <img> with non-empty alt and reserved dimensions", () => {
      expect(src).toContain("<img");
      expect(src).toContain("alt={seo.alt}");
      expect(src).toContain("width={LETTER_IMAGE_SIZE}");
      expect(src).toContain("height={LETTER_IMAGE_SIZE}");
    });
    it("emits ImageObject structured data", () => {
      expect(src).toContain('"@type": "ImageObject"');
      expect(src).toContain("contentUrl");
    });
  });

  describe(indexPage, () => {
    const src = read(indexPage);
    it("has canonical and CollectionPage/ItemList structured data", () => {
      expect(src).toContain('rel="canonical"');
      expect(src).toContain('"@type": "CollectionPage"');
      expect(src).toContain('"@type": "ItemList"');
    });
    it("links each letter card with an alt-tagged thumbnail", () => {
      expect(src).toContain("l.images.webpSmall");
      expect(src).toContain("alt={l.alt}");
    });
  });

  it("prerenders every letter page (entries generator present)", () => {
    const pageTs = read("src/routes/(public)/notation/letters/[slug]/+page.ts");
    expect(pageTs).toContain("export const prerender = true");
    expect(pageTs).toContain("export const entries");
  });

  it("the referenced og-image.png actually exists on disk", () => {
    // Guards the dead-reference regression: 7 marketing pages point here.
    expect(existsSync(resolve(process.cwd(), "static/branding/og-image.png"))).toBe(true);
  });
});
