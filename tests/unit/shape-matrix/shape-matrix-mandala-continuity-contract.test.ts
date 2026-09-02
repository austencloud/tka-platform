/**
 * Contract: the Shape Matrix tile and the detail hero are one artwork
 * primitive, and exactly one endpoint claims the shared-element name.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { SHAPE_MATRIX_ACTIVE_MANDALA_NAME } from "$lib/shared/shape-matrix/services/shape-matrix-artwork";

const ROOT = resolve(process.cwd(), "src/lib/shared/shape-matrix");
const read = (relative: string) =>
  readFileSync(resolve(ROOT, relative), "utf8");
const readSrc = (relative: string) =>
  readFileSync(resolve(process.cwd(), "src", relative), "utf8");

describe("shape matrix mandala continuity", () => {
  it("uses one fixed shared-element name", () => {
    expect(SHAPE_MATRIX_ACTIVE_MANDALA_NAME).toBe("shape-matrix-active-mandala");
  });

  it("routes both endpoints through the artwork primitive", () => {
    const grid = read("components/ShapeMatrixGrid.svelte");
    const hero = read("components/MandalaHeroLayer.svelte");
    expect(grid).toContain("ShapeMatrixMandalaArt");
    expect(hero).toContain("ShapeMatrixMandalaArt");
    expect(grid).not.toMatch(/renderCell\(/);
    expect(hero).not.toMatch(/getContext\("2d"\)|drawAlignedMandala/);
  });

  it("paints every still with the animation canvas's own guide painter", () => {
    // One painter: the live overlay and the still image renderer both stroke
    // through paintMandalaGuide, so a tile IS the animator's guide.
    const overlay = readSrc("lib/shared/mandala/services/mandala-overlay-canvas.ts");
    const image = readSrc("lib/shared/mandala/services/mandala-guide-image.ts");
    expect(overlay).toContain("paintMandalaGuide(");
    expect(image).toContain("paintMandalaGuide");
    expect(overlay).not.toMatch(/paintPurpleOverlap|paintHandMask/);

    const render = read("services/shape-matrix-render.ts");
    expect(render).toContain("renderMandalaGuideImage");
    expect(render).toContain("HERO_TRAIL_PRESET.leftColor");
    expect(render).toContain("DEFAULT_MANDALA_OVERLAY_CONFIG.strokeWidth");
    expect(render).not.toMatch(/renderMandalaSVG|strokeWidth:\s*2\.4/);

    // The hero floor is painted at engine alignment; no CSS align scale, no
    // glow the live guide does not have.
    const hero = read("components/MandalaHeroLayer.svelte");
    const art = read("components/ShapeMatrixMandalaArt.svelte");
    expect(hero).toContain("pathsArtworkSrc(paths, sizePx)");
    expect(hero).not.toMatch(/alignScale|glowColor/);
    expect(art).not.toMatch(/--art-scale|drop-shadow|glow/);
    expect(art).toContain("new ResizeObserver");
    expect(art).toMatch(/paint\(side\)/);
  });

  it("shows the still floor at the live guide's opacity so the handoff is invisible", () => {
    const drill = read("components/ShapeMatrixDrill.svelte");
    const loop = readSrc("lib/shared/animation-engine/services/animation-render-loop.ts");
    expect(drill).toContain("visibleSource ? 0 : MANDALA_GUIDE_FLOOR_OPACITY");
    expect(loop).toContain("opacity: MANDALA_GUIDE_FLOOR_OPACITY");
  });

  it("claims the name only through the primitive, only on the active endpoint", () => {
    const art = read("components/ShapeMatrixMandalaArt.svelte");
    expect(art).toContain("use:claimedViewTransitionName");
    expect(art).toContain("SHAPE_MATRIX_ACTIVE_MANDALA_NAME");
    expect(art).toContain("enabled: claim");

    const grid = read("components/ShapeMatrixGrid.svelte");
    expect(grid).toContain("claim={claimSelected && selectedKey === key}");

    const hero = read("components/MandalaHeroLayer.svelte");
    expect(hero).toMatch(/<ShapeMatrixMandalaArt[\s\S]*?\{claim\}/);

    const matrixPane = read("app/components/ShapeMatrixMatrixPane.svelte");
    expect(matrixPane).toContain(
      'claimSelected={state.compact && state.activeView === "matrix"}'
    );
    const detailPane = read("app/components/ShapeMatrixDetailPane.svelte");
    expect(detailPane).toContain(
      'claim: state.compact && state.activeView === "detail"'
    );

    // No file stamps the name as a literal style: the registry owns it.
    for (const relative of [
      "components/ShapeMatrixGrid.svelte",
      "components/MandalaHeroLayer.svelte",
      "components/ShapeMatrixDrill.svelte",
      "app/components/ShapeMatrixAppShell.svelte",
    ]) {
      expect(read(relative)).not.toMatch(/view-transition-name\s*:/);
    }
  });

  it("keeps the compact detail turn editor on the detail pane", () => {
    const tray = read("app/components/ShapeMatrixTurnTray.svelte");
    expect(tray).toContain("stayOnDetail: true");
    expect(tray).toContain("ShapeMatrixTurnControls");
    const shell = read("app/components/ShapeMatrixAppShell.svelte");
    expect(shell).toContain(
      "<ShapeMatrixTurnControls onturn={appState.setTurn} />"
    );
    expect(shell).toContain("<ShapeMatrixTurnTray />");
    expect(shell).toContain("runMandalaMorph");
  });
});
