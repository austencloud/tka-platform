import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  KINETIC_SHAPE_ENGINE_AUTHOR,
  KINETIC_SHAPE_ENGINE_NAME,
  ORIGINAL_SHAPE_MATRIX_NAME,
  ORIGINAL_SHAPE_MATRIX_URL,
  ORIGINAL_SHAPE_MATRIX_VTG_RATIOS,
  SHAPE_ENGINE_SHORT_NAME,
  SHAPE_MATRIX_EXPLORER_LEGACY_NAME,
} from "$lib/shared/shape-matrix/app/shape-engine-identity";

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

describe("Shape Engine identity", () => {
  it("keeps the product name distinct from its matrix surfaces and legacy name", () => {
    expect(KINETIC_SHAPE_ENGINE_NAME).toBe("Shape Engine");
    expect(KINETIC_SHAPE_ENGINE_AUTHOR).toBe("Austen Cloud");
    expect(SHAPE_ENGINE_SHORT_NAME).toBe("Shape Engine");
    expect(SHAPE_MATRIX_EXPLORER_LEGACY_NAME).toBe("Shape Matrix Explorer");

    const page = read("src/routes/(public)/shape-engine/+page.svelte");
    const shell = read(
      "src/lib/shared/shape-matrix/app/components/ShapeMatrixAppShell.svelte"
    );
    const surface = read(
      "src/lib/shared/shape-matrix/app/components/ShapeMatrixSurfaceControl.svelte"
    );

    expect(page).toContain("KINETIC_SHAPE_ENGINE_NAME");
    expect(page).toContain("SHAPE_MATRIX_EXPLORER_LEGACY_NAME");
    expect(shell).toContain("{KINETIC_SHAPE_ENGINE_NAME}");
    expect(shell).toContain('theory ? "Ratio Playground" : "Level Matrix"');
    expect(surface).toContain('ariaLabel="Choose a Shape Engine mode"');
    expect(surface).toContain('"Level Matrix"');
    expect(surface).toContain('"Explore Levels 1–4"');
    expect(surface).toContain('"Ratio Playground"');
  });

  it("keeps Lorq Nichols' source visible and the independent-work boundary explicit", () => {
    expect(ORIGINAL_SHAPE_MATRIX_NAME).toBe("144 Shape Matrix");
    expect(ORIGINAL_SHAPE_MATRIX_URL).toContain("spinscience.xyz");
    expect(ORIGINAL_SHAPE_MATRIX_VTG_RATIOS).toBe("1:1, 1:3, and 1:5");

    const page = read("src/routes/(public)/shape-engine/+page.svelte");
    const shell = read(
      "src/lib/shared/shape-matrix/app/components/ShapeMatrixAppShell.svelte"
    );
    const surface = read(
      "src/lib/shared/shape-matrix/app/components/ShapeMatrixSurfaceControl.svelte"
    );
    const about = read(
      "src/lib/shared/shape-matrix/app/components/ShapeMatrixAboutModal.svelte"
    );
    const menu = read(
      "src/lib/shared/shape-matrix/app/components/ShapeMatrixOverflowMenu.svelte"
    );

    expect(page).toContain('"isBasedOn"');
    expect(page).toContain('"name": "Lorq Nichols"');
    expect(page).toContain("ORIGINAL_SHAPE_MATRIX_VTG_RATIOS");
    expect(shell).toContain("<span>Lorq Nichols’ original</span>");
    expect(surface).toContain("Build your own 4×4");
    expect(shell).not.toContain("prop:hand ratios");
    expect(about).toContain("<h2>Lorq Nichols’ 144 Shape Matrix</h2>");
    expect(about).toContain("Each supplied four even-petaled");
    expect(about).toContain("giving twelve choices per hand");
    expect(about).not.toContain("prop rotations : hand cycles");
    expect(about).toContain("<h2>What Austen Cloud built</h2>");
    expect(about).toContain("KINETIC_SHAPE_ENGINE_AUTHOR");
    expect(about).toMatch(/not an official\s+Spin Science release/);
    expect(menu).toContain("Lorq Nichols’ original 144 Shape Matrix");
  });

  it("uses the Shape Engine name at entry points without renaming Lorq's work", () => {
    const header = read("src/lib/shared/landing/components/SiteHeader.svelte");
    const catalog = read("src/lib/shared/notation/notation-catalog.ts");

    expect(header).toContain('label: "Shape Engine"');
    expect(catalog).toContain('label: "Shape Engine"');
    expect(catalog).toContain('name: "144 Shape Matrix"');
  });
});
