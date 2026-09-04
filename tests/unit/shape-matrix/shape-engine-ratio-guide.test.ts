import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

describe("Shape Engine ratio guide", () => {
  it("keeps the original ratios and their TKA turn names together", () => {
    const page = read("src/routes/(public)/guide/ratios/+page.svelte");

    expect(page).toContain('ratio: "1:1"');
    expect(page).toContain('ratio: "1:3"');
    expect(page).toContain('ratio: "1:5"');
    expect(page).toContain('turnLabel: "0 turns"');
    expect(page).toContain('turnLabel: "1 turn"');
    expect(page).toContain('turnLabel: "2 turns"');
    expect(page).toContain("Each family supplied four driving");
    expect(page).toContain("Theory Matrix can pair any two whole-number");
    expect(page).not.toContain("prop rotations : hand cycles");
    expect(page).not.toContain("One family, two reading orders");
  });

  it("connects the guide, Shape Engine, and both relevant history records", () => {
    const page = read("src/routes/(public)/guide/ratios/+page.svelte");
    const about = read(
      "src/lib/shared/shape-matrix/app/components/ShapeMatrixAboutModal.svelte"
    );
    const sidebar = read(
      "src/routes/(public)/guide/_components/GuideSidebar.svelte"
    );
    const sitemap = read("src/routes/sitemap.xml/+server.ts");

    expect(page).toContain('path="/guide/ratios"');
    expect(page).toContain("/history#archive-record-vtg");
    expect(page).toContain("/history#archive-record-lorq");
    expect(page).toContain("/notation/shape-matrix?");
    expect(about).toContain('size="xl"');
    expect(about).toContain('href="/guide/ratios"');
    expect(about).toContain("/history#archive-record-vtg");
    expect(about).toContain("/history#archive-record-lorq");
    expect(sidebar).toContain('href="/guide/ratios"');
    expect(sitemap).toContain('{ url: "guide/ratios" }');
  });
});
