import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), "utf-8");

const staffHref = "/learn/staff-spinning-choreography";
const softwareHref = "/roots/software";

const publicLinkSources = [
  "src/lib/shared/landing/components/launchpad/launchpad-tiles.ts",
  "src/lib/shared/landing/components/SiteHeader.svelte",
  "src/lib/shared/landing/components/SiteFooter.svelte",
  "src/routes/(public)/guide/+page.svelte",
  "src/routes/(public)/notation/staves/+page.svelte",
  "src/routes/(public)/about/+page.svelte",
  "src/routes/(public)/composer/+page.svelte",
];

const gatedRoutes = [
  "src/routes/(public)/learn/staff-spinning-choreography/+page.server.ts",
  "src/routes/(public)/roots/software/+page.server.ts",
];

describe("withdrawn public pages", () => {
  it("removes staff choreography and software roots from public navigation", () => {
    for (const path of publicLinkSources) {
      const source = readSource(path);
      expect(source, `${path} still links staff choreography`).not.toContain(
        staffHref
      );
      expect(source, `${path} still links software roots`).not.toContain(
        softwareHref
      );
    }
  });

  it("returns 404 in production while retaining development access", () => {
    for (const path of gatedRoutes) {
      const source = readSource(path);
      expect(source).toContain('import { dev } from "$app/environment"');
      expect(source).toContain("export const prerender = false");
      expect(source).toMatch(/if \(!dev\) error\(404, "Not found"\)/);
    }
  });

  it("preserves both withdrawn pages in the repository", () => {
    expect(
      readSource(
        "src/routes/(public)/learn/staff-spinning-choreography/_components/StaffSpinningChoreographyDraft.svelte"
      )
    ).toContain("Learn Staff Choreography");
    expect(
      readSource("src/routes/(public)/roots/software/+page.svelte")
    ).toContain("The History of Flow Arts Software");
  });
});
