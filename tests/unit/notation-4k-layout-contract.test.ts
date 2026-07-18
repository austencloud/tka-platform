import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("notation 4K layout lab artifacts", () => {
  it("renders the TKA specimen through the real pictograph primitive", () => {
    const source = read(
      "src/routes/test/notation-4k/_components/NotationRosetta.svelte"
    );
    expect(source).toContain(
      'import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte"'
    );
    expect(source).toContain("<PictographContainer");
    expect(source).toContain('aria-label="A two by two grid');
    expect(source).not.toContain("kinetic-alphabet-letter-a.webp");
  });

  it("keeps all 144 Shape Matrix pairings and names both axes", () => {
    const source = read(
      "src/routes/test/notation-4k/_components/NotationShapeMatrix.svelte"
    );
    expect(source).toContain("Array.from({ length: 144 })");
    expect(source).toContain("Left-hand driving styles (12)");
    expect(source).toContain("Right-hand driving styles (12)");
    expect(source).toContain("as _, i (i)");
  });
});
