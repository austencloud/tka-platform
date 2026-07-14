import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

const ARTICLES = ["src/routes/(public)/guide/flow-arts-positions"];

describe("Guide article system contract", () => {
  for (const dir of ARTICLES) {
    describe(dir, () => {
      const page = read(`${dir}/+page.svelte`);

      it("prerenders (static HTML that ranks)", () => {
        expect(read(`${dir}/+page.ts`)).toContain("prerender = true");
      });

      it("renders through GuideArticle (no hand-rolled article chrome/head)", () => {
        expect(page).toContain("GuideArticle");
        // Article-level SEO comes from GuideArticle→GuideSeo, never inline here.
        expect(page).not.toContain("<svelte:head");
      });

      it("GuideArticle carries the required SEO/nav props", () => {
        for (const prop of ["seoTitle", "heading", "description", "path=", "breadcrumbs"]) {
          expect(page).toContain(prop);
        }
      });

      it("embeds pictographs only through GuideFigure (reserved box + crawlable caption)", () => {
        expect(page).toContain("GuideFigure");
      });
    });
  }

  it("GuideArticle reuses GuideSeo + the shared editorial system (no drift)", () => {
    const src = read("src/routes/(public)/guide/_components/GuideArticle.svelte");
    expect(src).toContain("GuideSeo");
    expect(src).toContain("public-editorial.css");
  });

  it("GuideFigure wraps the zero-context GuidePictograph and server-renders its caption", () => {
    const src = read("src/routes/(public)/guide/_components/GuideFigure.svelte");
    expect(src).toContain("GuidePictograph");
    expect(src).toContain("<figcaption>");
  });

  it("every guide article is listed in the sitemap", () => {
    const sitemap = read("src/routes/sitemap.xml/+server.ts");
    expect(sitemap).toContain("guide/flow-arts-positions");
  });
});
