import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

describe("SEO head contract", () => {
  const routes = [
    "src/routes/sequence/[id]/+page.svelte",
    "src/routes/q/[code]/+page.svelte",
    "src/routes/(public)/shop/[productId]/+page.svelte",
  ];

  for (const route of routes) {
    describe(route, () => {
      const src = read(route);
      it("has svelte:head with og:title and canonical", () => {
        expect(src).toContain("<svelte:head>");
        expect(src).toContain("og:title");
        expect(src).toContain('rel="canonical"');
        expect(src).toContain("twitter:card");
      });
    });
  }

  it("sequence + q layouts keep ssr enabled", () => {
    expect(read("src/routes/sequence/+layout.ts")).toContain("ssr = true");
    expect(read("src/routes/q/+layout.ts")).toContain("ssr = true");
  });

  it("shop product page emits Product JSON-LD", () => {
    expect(read("src/routes/(public)/shop/[productId]/+page.svelte")).toContain(
      "application/ld+json"
    );
  });
});
