/**
 * Contract: the Shape Matrix tile and the detail hero are one artwork
 * primitive, and exactly one endpoint claims the shared-element name.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  SHAPE_MATRIX_ACTIVE_MANDALA_NAME,
  SHAPE_MATRIX_ACTIVE_STAGE_NAME,
} from "$lib/shared/shape-matrix/services/shape-matrix-artwork";

const ROOT = resolve(process.cwd(), "src/lib/shared/shape-matrix");
const read = (relative: string) =>
  readFileSync(resolve(ROOT, relative), "utf8");
const readSrc = (relative: string) =>
  readFileSync(resolve(process.cwd(), "src", relative), "utf8");

describe("shape matrix mandala continuity", () => {
  it("uses two fixed shared-element names, stage around mandala", () => {
    expect(SHAPE_MATRIX_ACTIVE_MANDALA_NAME).toBe(
      "shape-matrix-active-mandala"
    );
    expect(SHAPE_MATRIX_ACTIVE_STAGE_NAME).toBe("shape-matrix-active-stage");
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

    // The hero floor is the tile's extent-fit picture in the engine-sized
    // box; no CSS align scale, no glow the live guide does not have.
    const hero = read("components/MandalaHeroLayer.svelte");
    const art = read("components/ShapeMatrixMandalaArt.svelte");
    expect(hero).toContain("pathsArtworkSrc(paths, sizePx, tipDx)");
    expect(hero).toContain("engineExtentBoxRatio(paths, tipDx)");
    expect(hero).toContain("calc(100% * var(--extent-ratio))");
    expect(hero).not.toMatch(/alignScale|glowColor/);
    expect(art).not.toMatch(/--art-scale|drop-shadow|glow/);
    expect(art).toContain("new ResizeObserver");
    expect(art).toMatch(/paint\(side\)/);
  });

  it("moves one picture between tile and hero: same fit, same square, no overshoot", () => {
    // Tiles fill their box (extent fit). The hero paints that same extent-fit
    // picture in a box of engineExtentBoxRatio times the animator's square,
    // so the shared-element morph scales one drawing instead of crossfading
    // two, and the tiles keep their size.
    const render = read("services/shape-matrix-render.ts");
    expect(render).toMatch(
      /export function renderCell[\s\S]*?renderExtentFit\(merged, sizePx, tipDx, options\)/
    );
    expect(render).toMatch(
      /export function renderHeader[\s\S]*?"extent", options\)/
    );
    expect(render).toContain("export function engineExtentBoxRatio");
    const artwork = read("services/shape-matrix-artwork.ts");
    expect(artwork).toMatch(/renderExtentFit\(paths, size, tipDx\)/);

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
    expect(drill).toContain(
      "livePlayerShowsPair ? 0 : MANDALA_GUIDE_FLOOR_OPACITY"
    );
    expect(loop).toContain("opacity: MANDALA_GUIDE_FLOOR_OPACITY");
  });

  it("keeps one mandala on stage: a canvas for another pair, or mid-capture, is offstage", () => {
    const drill = read("components/ShapeMatrixDrill.svelte");
    expect(drill).toMatch(
      /class:offstage=\{layer\.pairKey !== pairKey \|\| mandalaTransition\.handoff\}/
    );
    expect(drill).toMatch(/\.player-layer\.offstage \{\s*visibility: hidden;/);
    expect(drill).toMatch(
      /getLayer\(visibleSource\)\?\.pairKey === pairKey/
    );
  });

  it("flies the whole stage rectangle, with the mandala riding it", () => {
    // The selected tile's box and the detail stage share the stage name;
    // the mandala inside each keeps its own, so it is left out of the stage
    // snapshot and travels as a second, nested picture.
    const grid = read("components/ShapeMatrixGrid.svelte");
    expect(grid).toMatch(
      /<button[\s\S]*?use:claimedViewTransitionName=\{\{\s*name: SHAPE_MATRIX_ACTIVE_STAGE_NAME,\s*enabled: claimSelected && selectedKey === key,/
    );
    const drill = read("components/ShapeMatrixDrill.svelte");
    expect(drill).toMatch(
      /class="hero-stage"\s*use:claimedViewTransitionName=\{\{\s*name: SHAPE_MATRIX_ACTIVE_STAGE_NAME,\s*enabled: mandalaTransition\.claim,/
    );
    const shell = read("app/components/ShapeMatrixAppShell.svelte");
    expect(shell).toMatch(
      /view-transition-group\(shape-matrix-active-stage\)[\s\S]*?--ease-in-out/
    );
    expect(shell).toMatch(
      /view-transition-new\(shape-matrix-active-stage\)\s*\)\s*\{[^}]*object-fit: cover/
    );
    expect(shell).not.toContain("--ease-spring");
    // The tile's hairline rings sit out the flight; the wash may travel.
    expect(grid).toMatch(
      /html\.shape-matrix-morph\) \.cell\.sel::after \{\s*opacity: 0;/
    );
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
    const popover = read("app/components/ShapeMatrixTurnPopover.svelte");
    expect(popover).toContain("stayOnDetail: true");
    expect(popover).toContain("ShapeMatrixTurnControls");
    // An anchored popover sized to its controls, not a full-width drawer.
    expect(popover).toContain("<Popover.Root");
    expect(popover).toMatch(/\.turn-popover \{[^}]*width: max-content/);
    expect(popover).not.toMatch(/Drawer/);
    const shell = read("app/components/ShapeMatrixAppShell.svelte");
    expect(shell).toContain(
      "<ShapeMatrixTurnControls onturn={appState.setTurn} />"
    );
    expect(shell).toContain("<ShapeMatrixTurnPopover />");
    expect(shell).toContain("runMandalaMorph");
  });

  it("keeps the compact topbar as the only chrome row on the detail view", () => {
    // The shell owns the animation state so the relationships toggle can
    // live in the topbar; the pane heading is a wide-layout row only.
    const shell = read("app/components/ShapeMatrixAppShell.svelte");
    expect(shell).toContain("setShapeMatrixAnimationContext(");
    expect(shell).toContain('class="top-action relationships-action"');
    expect(shell).toContain(
      'appState.activeView === "detail" && animationState.activeSection !== null'
    );
    const detailPane = read("app/components/ShapeMatrixDetailPane.svelte");
    expect(detailPane).toContain("getShapeMatrixAnimationContext()");
    expect(detailPane).toMatch(
      /\{#if !state\.compact\}\s*<header class="pane-heading">/
    );
    // The toggle never borrows the back arrow the Matrix button owns.
    expect(detailPane).not.toContain("fa-arrow-left");
    const controls = read("app/components/ShapeMatrixTurnControls.svelte");
    expect(controls).not.toMatch(/\.turn-editor\.tray[^{]*\{[^}]*(?<![-\w])width: 100%/);
  });
});
