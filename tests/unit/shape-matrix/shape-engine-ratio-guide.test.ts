import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  flowerPetals,
  ratioLabel,
} from "$lib/shared/shape-matrix/domain/flower-signature";
import { matrixTurnsForLevel } from "$lib/shared/shape-matrix/domain/matrix-turn-band";
import { levelForTurnValue } from "$lib/shared/create/services/level-turn-values";

function read(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

describe("Shape Engine ratio guide", () => {
  it("derives the complete Level 1–4 translation from canonical domain owners", () => {
    const rows = matrixTurnsForLevel(4).map((turn) => ({
      turn,
      ratio: ratioLabel(turn),
      level: levelForTurnValue(turn),
      pro: turn === "fl" ? null : flowerPetals({ style: "pro", turns: turn }),
      anti: turn === "fl" ? null : flowerPetals({ style: "anti", turns: turn }),
    }));

    expect(rows).toHaveLength(15);
    expect(rows).toContainEqual({
      turn: 0,
      ratio: "1:1",
      level: 1,
      pro: 0,
      anti: 2,
    });
    expect(rows).toContainEqual({
      turn: 1,
      ratio: "3:1",
      level: 2,
      pro: 2,
      anti: 4,
    });
    expect(rows).toContainEqual({
      turn: 2,
      ratio: "5:1",
      level: 2,
      pro: 4,
      anti: 6,
    });
    expect(rows).toContainEqual({
      turn: 0.25,
      ratio: "3:2",
      level: 4,
      pro: 1,
      anti: 5,
    });
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
    expect(page).toContain("matrixTurnsForLevel(4)");
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
