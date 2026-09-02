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
    expect(SHAPE_MATRIX_ACTIVE_MANDALA_NAME).toBe(
      "shape-matrix-active-mandala"
    );
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
    const overlay = readSrc(
      "lib/shared/mandala/services/mandala-overlay-canvas.ts"
    );
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

  it("moves one picture between tile and hero: same fit, same square, no overshoot", () => {
    // Tiles and headers paint at engine fit, the hero floor's fit, so the
    // shared-element morph scales one drawing instead of crossfading two.
    const render = read("services/shape-matrix-render.ts");
    expect(render).not.toMatch(/"extent"/);
    expect(render.match(/"engine"/g)?.length).toBeGreaterThanOrEqual(3);

    // The word header lives above the square in a drill-owned band, so the
    // hero frame IS the canvas region and both inscribed squares coincide.
    const drill = read("components/ShapeMatrixDrill.svelte");
    expect(drill).toContain("showWordHeader: false");
    expect(drill).toContain('class="hero-header"');
    expect(drill).toContain('class="hero-header-ghost"');
    expect(drill).toMatch(
      /\.hero-stage \{[^}]*grid-template-rows: auto minmax\(0, 1fr\)/s
    );

    // The hero square's box is CSS container math, present in the layout
    // pass that sizes the frame; a measured side reads 0 from a collapsed
    // pane at capture time. The morph service then re-measures every art
    // instance synchronously and waits for the endpoint's image to decode
    // before the new-state capture.
    const art = read("components/ShapeMatrixMandalaArt.svelte");
    expect(art).toContain("registerMandalaArtMeasurer(measure)");
    // The tile's box is container math as well, so the return trip lands on
    // the tile at its real size instead of a stale measured one.
    const grid = read("components/ShapeMatrixGrid.svelte");
    expect(grid).not.toMatch(/bind:clientWidth|new ResizeObserver/);
    expect(grid).toContain("100cqw / var(--cols)");
    // The player's first mount does not run inside the morph's capture window.
    expect(drill).toContain("active={!mandalaTransition.handoff}");
    const heroLayer = read("components/MandalaHeroLayer.svelte");
    expect(heroLayer).not.toContain("ResizeObserver");
    expect(heroLayer).toContain("min(100cqw, 100cqh)");
    const morph = read("app/services/shape-matrix-mandala-morph.ts");
    expect(morph).toContain("settleMandalaEndpoint");
    expect(morph).toContain("measureMandalaArt();");
    expect(morph).toMatch(/img\.decode\(\)/);
    const results = readSrc("lib/shared/transitions/results-morph.ts");
    expect(results).toMatch(/if \(settle\) await settle\(\);/);

    // The group animation settles; a spring would overshoot the square.
    const shell = read("app/components/ShapeMatrixAppShell.svelte");
    expect(shell).not.toContain("--ease-spring");
    expect(shell).toMatch(
      /view-transition-group\(shape-matrix-active-mandala\)[\s\S]*?--ease-in-out/
    );
  });

  it("shows the still floor at the live guide's opacity so the handoff is invisible", () => {
    const drill = read("components/ShapeMatrixDrill.svelte");
    const loop = readSrc(
      "lib/shared/animation-engine/services/animation-render-loop.ts"
    );
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
