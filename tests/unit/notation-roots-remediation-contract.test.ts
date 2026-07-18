import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), "utf-8");

const notationPage = readSource("src/routes/(public)/notation/+page.svelte");
const notationCopy = notationPage.replace(/\s+/g, " ");
const rootRedirect = readSource("src/routes/(public)/roots/+page.ts");
const softwarePage = readSource(
  "src/routes/(public)/roots/software/+page.svelte"
);
const softwareCopy = softwarePage.replace(/\s+/g, " ");
const domains = readSource("src/config/domains.ts");
const rootLayout = readSource("src/routes/+layout.svelte");
const landingPreview = readSource(
  "src/lib/features/landing-preview/LandingPreviewModule.svelte"
);
const screenshotOrchestrator = readSource(
  "src/lib/features/lab/services/screenshot-orchestrator.ts"
);
const screenshotDevices = readSource("tests/screenshots/devices.ts");
const sitemap = readSource("src/routes/sitemap.xml/+server.ts");
const componentManifest = readSource("scripts/component-manifest.json");

describe("notation lineage remediation", () => {
  it("keeps TKA in peer framing and scopes comparisons to the displayed VTG model", () => {
    expect(notationCopy).toContain(
      "The timing-and-direction quadrant shown above directly describes Type 1 dual-shifts such as A"
    );
    expect(notationCopy).toContain(
      "another spinner who knows the conventions can read the page back"
    );
    expect(notationPage).not.toMatch(
      /gap none|slot TKA|reaches past what VTG named|VTG leaves alone/i
    );
  });

  it("renders the 144 Shape Matrix with visible axis meaning", () => {
    expect(notationPage).toContain("Array.from({ length: 144 })");
    expect(notationPage).toContain("Left-hand driving styles (12)");
    expect(notationPage).toContain("Right-hand driving styles (12)");
    expect(notationPage).toContain("as _, i (i)");
  });

  it("uses real PoiNotation operators and links the retained software lineage", () => {
    expect(notationPage).toContain(
      '<span class="section-kicker">Three notation languages, three views</span>'
    );
    expect(notationPage).not.toContain("Three notation languages, one move");
    expect(notationPage).toMatch(/<span class="tok-op">\*<\/span\s*>/);
    expect(notationPage).toMatch(/<span class="tok-op">~<\/span\s*>/);
    expect(notationPage).toContain("handleSpin: antispin");
    expect(notationPage).not.toMatch(/\bhandle: antispin/);
    expect(notationPage).toContain("siteswapHistory:");
    expect(notationPage).not.toContain("wikipedia.org/wiki/Siteswap");
    expect(notationPage).toContain('href="/roots/software"');
  });

  it("avoids universal and conqueror framing on both retained lineage pages", () => {
    expect(notationCopy).toContain(
      "Siteswap was built for juggling, so TKA treats it as an analogy"
    );
    expect(notationCopy).toContain(
      "The demo places pictographs beside the animation"
    );
    expect(notationPage).not.toMatch(
      /Everyone writes down a different thing|Siteswap only ever meant|No prop in hand|no phone at the jam|full lexicon.*every/i
    );

    expect(softwareCopy).toContain(
      "The surviving public repository ends with that course release"
    );
    expect(softwareCopy).toContain("TKA takes a different route");
    expect(softwarePage).not.toMatch(
      /No software company was ever going to|The one thing missing|never shipped as a tool|stayed an open problem|problem The Kinetic Alphabet solves/i
    );
    expect(softwarePage).not.toContain(
      '<section class="editorial-section panel"'
    );
  });
});

describe("roots-to-notation route migration", () => {
  it("keeps a permanent root redirect and public chrome for software history", () => {
    expect(rootRedirect).toContain('redirect(301, "/notation")');
    expect(rootRedirect).toContain("export const prerender = false");
    expect(domains).toMatch(/PUBLIC_PATH_PREFIXES[\s\S]*?"\/roots"/);
    expect(rootLayout).toMatch(/MARKETING_EXACT[\s\S]*?"\/roots\/software"/);
  });

  it("replaces Roots with Notation in preview and capture registries", () => {
    expect(landingPreview).toContain(
      '{ id: "notation", label: "Notation", icon: "fa-language" }'
    );
    expect(landingPreview).toContain(
      'notation: () => import("../../../routes/(public)/notation/+page.svelte")'
    );
    expect(screenshotOrchestrator).toContain(
      '{ label: "notation", moduleId: "public", requiresAuth: false }'
    );
    expect(screenshotDevices).toMatch(
      /path: "\/notation",\s*label: "notation",[\s\S]*?waitSelector: "\.editorial \.page-title"/
    );
  });

  it("keeps canonical sitemap and breadcrumb labels without a stale Roots page", () => {
    expect(sitemap).toContain(
      '{ url: "notation", priority: "0.9", changefreq: "monthly" }'
    );
    expect(sitemap).toContain(
      '{ url: "roots/software", priority: "0.7", changefreq: "monthly" }'
    );
    expect(sitemap).not.toMatch(/\{ url: "roots",/);
    expect(softwarePage).toContain(
      '"name": "Notation", "item": "https://tkaflowarts.com/notation"'
    );
    expect(softwarePage).toContain('href="/notation">Notation lineage</a>');
    expect(componentManifest).not.toContain(
      '"file": "routes/(public)/roots/+page.svelte"'
    );
    expect(componentManifest).toContain(
      '"file": "routes/(public)/notation/+page.svelte"'
    );
  });
});
