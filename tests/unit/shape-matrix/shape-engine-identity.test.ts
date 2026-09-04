import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  KINETIC_SHAPE_ENGINE_NAME,
  ORIGINAL_SHAPE_MATRIX_NAME,
  ORIGINAL_SHAPE_MATRIX_PROP_HAND_RATIOS,
  ORIGINAL_SHAPE_MATRIX_URL,
  ORIGINAL_SHAPE_MATRIX_VTG_RATIOS,
  SHAPE_ENGINE_SHORT_NAME,
  SHAPE_MATRIX_EXPLORER_LEGACY_NAME,
} from "$lib/shared/shape-matrix/app/shape-engine-identity";

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

describe("Kinetic Shape Engine identity", () => {
  it("keeps the product name distinct from its matrix surfaces and legacy name", () => {
    expect(KINETIC_SHAPE_ENGINE_NAME).toBe("Kinetic Shape Engine");
    expect(SHAPE_ENGINE_SHORT_NAME).toBe("Shape Engine");
    expect(SHAPE_MATRIX_EXPLORER_LEGACY_NAME).toBe("Shape Matrix Explorer");

    const page = read("src/routes/(public)/notation/shape-matrix/+page.svelte");
    const shell = read(
      "src/lib/shared/shape-matrix/app/components/ShapeMatrixAppShell.svelte"
    );
    const surface = read(
      "src/lib/shared/shape-matrix/app/components/ShapeMatrixSurfaceControl.svelte"
    );

    expect(page).toContain("KINETIC_SHAPE_ENGINE_NAME");
    expect(page).toContain("SHAPE_MATRIX_EXPLORER_LEGACY_NAME");
    expect(shell).toContain("{KINETIC_SHAPE_ENGINE_NAME}");
    expect(shell).toContain('theory ? "Theory Matrix" : "Shape Matrix"');
    expect(surface).toContain('ariaLabel="Shape Engine surface"');
  });

  it("keeps Lorq Nichols' source visible and the independent-work boundary explicit", () => {
    expect(ORIGINAL_SHAPE_MATRIX_NAME).toBe("144 Shape Matrix");
    expect(ORIGINAL_SHAPE_MATRIX_URL).toContain("spinscience.xyz");
    expect(ORIGINAL_SHAPE_MATRIX_VTG_RATIOS).toBe("1:1, 1:3, and 1:5");
    expect(ORIGINAL_SHAPE_MATRIX_PROP_HAND_RATIOS).toBe("1:1, 3:1, and 5:1");

    const page = read("src/routes/(public)/notation/shape-matrix/+page.svelte");
    const shell = read(
      "src/lib/shared/shape-matrix/app/components/ShapeMatrixAppShell.svelte"
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
    expect(shell).toContain("ORIGINAL_SHAPE_MATRIX_VTG_RATIOS");
    expect(shell).toContain("<span>Lorq Nichols’ original</span>");
    expect(about).toContain("<strong>The foundation.</strong>");
    expect(about).toContain("Each ratio contributes four even-petaled driving");
    expect(about).toContain("giving twelve choices per hand");
    expect(about).toContain("ORIGINAL_SHAPE_MATRIX_PROP_HAND_RATIOS");
    expect(about).toContain("<strong>What this engine adds.</strong>");
    expect(about).toMatch(/not an official\s+Spin Science release/);
    expect(menu).toContain("Lorq Nichols’ original 144 Shape Matrix");
  });

  it("uses the Shape Engine name at entry points without renaming Lorq's work", () => {
    const header = read("src/lib/shared/landing/components/SiteHeader.svelte");
    const catalog = read("src/lib/shared/notation/notation-catalog.ts");

    expect(header).toContain('label: "Shape Engine"');
    expect(catalog).toContain('label: "Open Kinetic Shape Engine"');
    expect(catalog).toContain('name: "144 Shape Matrix"');
  });
});
