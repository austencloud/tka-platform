import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), "utf-8");

const harness = readSource("src/routes/test/landing-directions/+page.svelte");
const frontPage = readSource(
  "src/routes/test/landing-directions/_components/EditorialFrontPage.svelte"
);
const readingIndex = readSource(
  "src/routes/test/landing-directions/_components/ReadingIndex.svelte"
);
const combinedDirections = `${frontPage}\n${readingIndex}`;
const hasHref = (href: string): boolean =>
  combinedDirections.includes(`href="${href}"`) ||
  combinedDirections.includes(`href: "${href}"`);

describe("landing direction mockups", () => {
  it("offers two live-component directions through the shared switch control", () => {
    expect(harness).toContain('value: "front-page"');
    expect(harness).toContain('value: "reading-index"');
    expect(harness).toContain("<SegmentedControl");
    expect(harness).toContain("<MarketingChrome>");
  });

  it("uses the real public sequence demo without turning the page into a playground", () => {
    expect(frontPage).toContain("<SequenceHeroDemo");
    expect(readingIndex).toContain("<SequenceHeroDemo");
    expect(combinedDirections).not.toMatch(
      /PlayWithItSection|ComposerGenerateDemo|generatePerVisitDemo/
    );
  });

  it("routes readers to current articles without restoring the retired Roots hub", () => {
    for (const href of [
      "/notation",
      "/composer",
      "/roots/software",
      "/atlas",
      "/about",
      "/shop",
      "/shape-engine",
    ]) {
      expect(hasHref(href)).toBe(true);
    }

    expect(combinedDirections).not.toMatch(/href=[{]?['"]\/roots['"]/);
  });

  it("clusters the shelf into Read and Explore groups, matrix under Explore", () => {
    for (const source of [frontPage, readingIndex]) {
      expect(source).toContain('label: "Read"');
      expect(source).toContain('label: "Explore"');
      expect(source).toContain('href: "/shape-engine"');
    }
  });
});
