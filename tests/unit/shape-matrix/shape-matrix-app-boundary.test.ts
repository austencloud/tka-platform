import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = resolve("src/lib/shared/shape-matrix/app");

function readTree(directory: string): string {
  return readdirSync(directory)
    .flatMap((name) => {
      const path = resolve(directory, name);
      return statSync(path).isDirectory()
        ? readTree(path)
        : readFileSync(path, "utf8");
    })
    .join("\n");
}

describe("Shape Matrix app boundary", () => {
  it("keeps route navigation and viewport ownership outside the embeddable app", () => {
    const appSource = readTree(APP_ROOT);

    expect(appSource).not.toContain('href="/notation"');
    expect(appSource).not.toContain("$app/");
    expect(appSource).not.toContain("window.location");
    expect(appSource).not.toMatch(/position:\s*fixed/);
    expect(appSource).toContain("ResizeObserver");
    expect(appSource).toContain("container: shape-matrix-app / size");
  });

  it("keeps URL persistence in the public route host", () => {
    const pageSource = readFileSync(
      resolve("src/routes/(public)/shape-engine/+page.svelte"),
      "utf8"
    );

    expect(pageSource).toContain(
      "$lib/shared/shape-matrix/app/ShapeMatrixApp.svelte"
    );
    expect(pageSource).toContain("mutateCurrentUrl");
    expect(pageSource).toContain("<ShapeMatrixApp {persistence} />");
  });

  it("reuses the canonical animation menu and pictograph carousel", () => {
    const drillSource = readFileSync(
      resolve("src/lib/shared/shape-matrix/components/ShapeMatrixDrill.svelte"),
      "utf8"
    );

    expect(drillSource).toContain("disableContextMenu: false");
    // The drill lets the animator pick sidecar vs stacked from its host box.
    expect(drillSource).toContain('disassemblyLayout: "auto"');
    expect(drillSource).toContain(
      'import("$lib/shared/timeline/StepStrip.svelte")'
    );
    expect(drillSource).toContain("includeStartPosition: false");
    expect(drillSource).toContain("currentStep: visibleStep");
    expect(drillSource).toContain("propElementalType: railPropElementalType");
    expect(drillSource).toContain(
      "propElementalType: propElementalTypeOf(layer.realization)"
    );
    expect(drillSource).toContain("initialQualityTier: QualityTier.LOW");
    expect(drillSource).toContain("resolveRealizationEntryStep");
    expect(drillSource).toContain("initialStep: layer.initialStep");
    expect(drillSource).toContain("onsettled={finishCrossfade}");
    expect(drillSource).not.toContain("fadeSettlementTimer");
    expect(drillSource).toContain("retryPlayerLoad");
    expect(drillSource).toContain("railLoadError");
    // The Hands -> Props derivation lives in the shared relationship bridge.
    const bridgeSource = readFileSync(
      resolve(
        "src/lib/shared/shape-matrix/components/PropRelationshipChipRow.svelte"
      ),
      "utf8"
    );
    expect(drillSource).toContain("PropRelationshipChipRow");
    expect(bridgeSource).toContain(
      '<i class="fas fa-arrow-right bridge-arrow" aria-hidden="true"></i>'
    );
    expect(bridgeSource).toContain('<span class="sr-only">produces</span>');
  });

  it("threads the optional prop element through the canonical animation overlay", () => {
    const inlinePlayerSource = readFileSync(
      resolve(
        "src/lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte"
      ),
      "utf8"
    );
    const animatorSource = readFileSync(
      resolve(
        "src/lib/shared/animation-engine/components/AnimatorCanvas.svelte"
      ),
      "utf8"
    );
    const surfaceSource = readFileSync(
      resolve(
        "src/lib/shared/animation-engine/components/CanvasSurface.svelte"
      ),
      "utf8"
    );
    const overlaySource = readFileSync(
      resolve(
        "src/lib/shared/animation-engine/components/layers/GlyphOverlay.svelte"
      ),
      "utf8"
    );

    expect(inlinePlayerSource).toContain("{propElementalType}");
    expect(animatorSource).toContain("{propElementalType}");
    expect(surfaceSource).toContain("{propElementalType}");
    expect(overlaySource).toContain('corner="top-right"');
    expect(overlaySource).toContain("Prop timing and direction element:");
  });

  it("keeps embedded disassembly inside the Shape Matrix atmosphere", () => {
    const inlinePlayerSource = readFileSync(
      resolve(
        "src/lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte"
      ),
      "utf8"
    );
    const animatorSource = readFileSync(
      resolve(
        "src/lib/shared/animation-engine/components/AnimatorCanvas.svelte"
      ),
      "utf8"
    );
    const splitSource = readFileSync(
      resolve(
        "src/lib/shared/animation-engine/components/SplitCanvasView.svelte"
      ),
      "utf8"
    );
    const frameSystemSource = readFileSync(
      resolve(
        "src/lib/shared/animation-engine/services/managers/frame-system.ts"
      ),
      "utf8"
    );
    const playbackSyncSource = readFileSync(
      resolve(
        "src/lib/shared/animation-engine/services/managers/playback-sync.ts"
      ),
      "utf8"
    );
    const renderLoopSource = readFileSync(
      resolve(
        "src/lib/shared/animation-engine/services/animation-render-loop.ts"
      ),
      "utf8"
    );

    expect(inlinePlayerSource).toContain("{disassemblyLayout}");
    expect(animatorSource).toContain(
      "data-disassembly-layout={resolvedDisassemblyLayout}"
    );
    expect(animatorSource).toContain("layout={resolvedDisassemblyLayout}");
    expect(animatorSource).toContain("{backgroundAlpha}");
    expect(splitSource.match(/\{backgroundAlpha\}/g)).toHaveLength(2);
    expect(splitSource).not.toContain("backgroundAlpha={1}");
    expect(splitSource.match(/mandalaVisibleOverride=\{true\}/g)).toHaveLength(
      2
    );
    expect(frameSystemSource).toContain(
      "props.mandalaVisibleOverride ?? this.state.visibilityState.mandala"
    );
    expect(playbackSyncSource).toContain(
      "props.mandalaVisibleOverride ?? this.state.visibilityState.mandala"
    );
    expect(playbackSyncSource).toContain(
      "this._lastPropsRef?.mandalaVisibleOverride ?? state.mandala"
    );
    expect(renderLoopSource).toContain("const show: MandalaHandVisibility");
    expect(renderLoopSource).toContain(
      'showLeft && showRight ? "both" : showLeft ? "left" : "right"'
    );
  });

  it("does not reserve an empty hand-path row for ordinary prop relationships", () => {
    const propPickerSource = readFileSync(
      resolve(
        "src/lib/shared/shape-matrix/components/PropRelationshipChipRow.svelte"
      ),
      "utf8"
    );

    // No reserved hand-path row and no in-flow slot that could reflow the
    // stage. The result crossfade is content-sized with an eased height: the
    // branching phase variant is taller than the one-line result, and `fill`
    // made its absolute layers spill out over the animation below.
    expect(propPickerSource).not.toContain("hand-choice-slot");
    expect(propPickerSource).toContain(
      "<Crossfade key={resultKey} animateHeight"
    );
    expect(propPickerSource).not.toContain("<Crossfade key={resultKey} fill");
    expect(propPickerSource).not.toContain("transition:growFade");
  });

  it("chooses a prop over the grid, never over the animation", () => {
    const read = (path: string) => readFileSync(resolve(path), "utf8");
    const drillSource = read(
      "src/lib/shared/shape-matrix/components/ShapeMatrixDrill.svelte"
    );
    const theoryDetailSource = read(
      "src/lib/shared/shape-matrix/app/components/ShapeMatrixTheoryDetail.svelte"
    );
    const matrixPaneSource = read(
      "src/lib/shared/shape-matrix/app/components/ShapeMatrixMatrixPane.svelte"
    );
    const theoryPaneSource = read(
      "src/lib/shared/shape-matrix/app/components/ShapeMatrixTheoryPane.svelte"
    );
    const overlaySource = read(
      "src/lib/shared/shape-matrix/app/components/ShapeMatrixPropOverlay.svelte"
    );
    const shellSource = read(
      "src/lib/shared/shape-matrix/app/components/ShapeMatrixAppShell.svelte"
    );
    const detailSource = read(
      "src/lib/shared/shape-matrix/app/components/ShapeMatrixDetailPane.svelte"
    );
    const stateSource = read(
      "src/lib/shared/shape-matrix/app/state/shape-matrix-app-state.svelte.ts"
    );
    const dockSource = read(
      "src/lib/shared/sequence-viewer/components/ControlDock.svelte"
    );

    // The catalogue left the animation stage. Nothing on the drill or the
    // theory detail shrinks to make room for it any more.
    expect(drillSource).not.toContain("BentoPropGrid");
    expect(drillSource).not.toContain("prop-catalogue");
    expect(theoryDetailSource).not.toContain("BentoPropGrid");

    // Wide hosts: the grid pane hosts it. You are not changing your shape
    // while you change your prop, so that is the one region that can be
    // covered while the hero, the relationships, the carousel and the dock
    // stay put and the prop is judged against the live shape.
    expect(matrixPaneSource).toContain(
      '<ShapeMatrixPropOverlay surface="matrix" />'
    );
    expect(theoryPaneSource).toContain(
      '<ShapeMatrixPropOverlay surface="theory" />'
    );
    expect(matrixPaneSource).toContain("inert={pickingProp}");
    // The full sectioned bento grid, not the dense compact drawer packing.
    expect(overlaySource).toContain("<BentoPropGrid");
    expect(overlaySource).not.toContain("flat={true}");
    // A titled close, Escape through the shared layer manager, click-away.
    expect(overlaySource).toContain("<DrawerHeader");
    expect(overlaySource).toContain('id: "shape-matrix:prop-overlay"');
    expect(overlaySource).toContain('target.closest("[data-shape-matrix-dock]")');
    expect(shellSource).toContain("data-shape-matrix-app");

    // Compact hosts: the grid pane is off screen behind the detail view, so
    // the canonical prop sheet takes over.
    expect(shellSource).toMatch(/\{#if appState\.compact\}\s*<PropSelectionSheet/);

    // The Props pill shows pressed while the catalogue is open, without a
    // tray of its own, so the way back is visible.
    expect(drillSource).toContain("propPickerActive={propPickerOpen}");
    expect(theoryDetailSource).toContain("propPickerActive={app.propPickerOpen}");
    expect(drillSource).toContain("data-shape-matrix-dock");
    expect(theoryDetailSource).toContain("data-shape-matrix-dock");
    expect(dockSource).toContain(
      "aria-pressed={activeTab === t.id || !!t.pressed}"
    );

    // Still not one of the dock's tray sections.
    expect(detailSource).not.toContain('setActiveSection("props")');

    // Choosing keeps the catalogue open, so the change can be watched: pick a
    // prop, see the shape traced by it, pick the next one.
    expect(stateSource).toContain("async function setPropType");
    expect(stateSource).toContain("The picker stays open.");
  });

  it("offers prop choice once, under the animation", () => {
    const overflowSource = readFileSync(
      resolve(
        "src/lib/shared/shape-matrix/app/components/ShapeMatrixOverflowMenu.svelte"
      ),
      "utf8"
    );

    // The Props control under the canvas owns the choice; a second entry in
    // the overflow menu pointed at the same catalogue.
    expect(overflowSource).not.toContain("Choose prop");
    expect(overflowSource).not.toContain("getPropTypeDisplayInfo");
  });

  it("marks the chosen relationship with more than a colour", () => {
    const chipSource = readFileSync(
      resolve(
        "src/lib/shared/shape-matrix/components/RelationshipChoiceChip.svelte"
      ),
      "utf8"
    );

    // Six element accents, several of them dark: a tint difference alone did
    // not answer "which one did I pick?" at a glance.
    expect(chipSource).toContain('class="choice-check"');
    expect(chipSource).toContain("aria-pressed={active}");
    expect(chipSource).toContain(".relationship-choice.active .choice-check {");
    // Whole-surface treatment, never a decorative edge strip.
    expect(chipSource).toContain("inset 0 0 0 2px var(--choice-accent)");
    expect(chipSource).not.toMatch(/border-(left|right|top|bottom):\s*\d/);
  });

  it("wraps a long value palette instead of scrolling it sideways", () => {
    // The scroller owns the long-band behaviour wherever a surface picks from
    // an ordered palette. That is the Matrix turn band. Theory types its ratio
    // instead, so it is checked below for the entry rather than the scroller.
    const scrollerSource = readFileSync(
      resolve(
        "src/lib/shared/shape-matrix/app/components/ShapeMatrixValueScroller.svelte"
      ),
      "utf8"
    );
    const turnSource = readFileSync(
      resolve(
        "src/lib/shared/shape-matrix/app/components/ShapeMatrixTurnControls.svelte"
      ),
      "utf8"
    );
    const theorySource = readFileSync(
      resolve(
        "src/lib/shared/shape-matrix/app/components/ShapeMatrixTheoryControls.svelte"
      ),
      "utf8"
    );
    const ratioEntrySource = readFileSync(
      resolve(
        "src/lib/shared/shape-matrix/app/components/ShapeMatrixRatioEntry.svelte"
      ),
      "utf8"
    );
    const segmentedSource = readFileSync(
      resolve("src/lib/shared/ui/components/SegmentedControl.svelte"),
      "utf8"
    );

    // Level 4 lists fourteen ratios. The tray splits them over two rows and
    // spends the saved room on full-size segments.
    expect(scrollerSource).toContain("columns={trayColumns}");
    expect(scrollerSource).toContain(
      ".scroller-host:not(.tray) .value-control :global(.segmented-control)"
    );
    // The turn ribbon may not fork it back into a local palette.
    expect(turnSource).toContain("<ShapeMatrixValueScroller");
    expect(turnSource).not.toContain("trayColumns");
    // The 0–15 ratio square is a field, not a ladder, so Theory takes the two
    // numbers directly and must not grow a palette of its own.
    expect(theorySource).toContain("<ShapeMatrixRatioEntry");
    expect(theorySource).not.toContain("<ShapeMatrixValueScroller");
    expect(theorySource).not.toContain("SegmentedControl");
    expect(theorySource).toContain("Link ratios");
    expect(theorySource).toContain("Which ratio should both use?");
    expect(theorySource).toContain('hand="both"');
    expect(ratioEntrySource).toContain('onclick={() => nudge("hand", -1)}');
    expect(ratioEntrySource).toContain('onclick={() => nudge("prop", 1)}');
    // The indicator tracks the chosen cell on both axes.
    expect(segmentedSource).toContain(".grid .indicator {");
    expect(segmentedSource).toContain("--row: {selectedRow}");
  });

  it("keeps each elemental button's visible mode and name in its accessible name", () => {
    const elementChipSource = readFileSync(
      resolve("src/lib/shared/shape-matrix/components/ElementChipRow.svelte"),
      "utf8"
    );

    expect(elementChipSource).toContain(
      "ariaLabel={`${c.mode} ${elementName(c.el.element)} (${c.label})${"
    );
  });

  it("loads public base words from the checked-in snapshot, not Firebase", () => {
    const flowerSource = readFileSync(
      resolve(
        "src/lib/shared/shape-matrix/services/rotation-style-archetypes.ts"
      ),
      "utf8"
    );
    const realizationSource = readFileSync(
      resolve(
        "src/lib/shared/shape-matrix/services/build-realization-sequence.ts"
      ),
      "utf8"
    );
    const snapshot = JSON.parse(
      readFileSync(resolve("static/data/hero/tnd-base-words.json"), "utf8")
    ) as unknown[];

    expect(flowerSource).toContain("loadTndBaseWords");
    expect(flowerSource).not.toContain("loadCatalogSequences");
    expect(realizationSource).toContain("loadTndBaseWords");
    expect(realizationSource).not.toContain("loadCatalogSequences");
    expect(snapshot).toHaveLength(22);
  });
});
