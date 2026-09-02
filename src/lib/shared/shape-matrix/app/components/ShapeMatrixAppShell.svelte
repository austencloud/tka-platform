<script lang="ts">
  import { tick } from "svelte";
  import PanelGroup from "$lib/shared/panels/PanelGroup.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import LevelSelector from "$lib/shared/components/LevelSelector.svelte";
  import type { MatrixLabelMode } from "$lib/shared/shape-matrix/domain/matrix-turn-band";
  import type { TurnLevel } from "$lib/shared/create/services/level-turn-values";
  import type { Flower } from "$lib/shared/shape-matrix/domain/flower-signature";

  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";
  import ShapeMatrixDetailPane from "./ShapeMatrixDetailPane.svelte";
  import ShapeMatrixMatrixPane from "./ShapeMatrixMatrixPane.svelte";
  import ShapeMatrixOverflowMenu from "./ShapeMatrixOverflowMenu.svelte";
  import ShapeMatrixTurnControls from "./ShapeMatrixTurnControls.svelte";
  import ShapeMatrixTurnTray from "./ShapeMatrixTurnTray.svelte";
  import { runMandalaMorph } from "../services/shape-matrix-mandala-morph";
  import { growFade } from "$lib/shared/transitions/motion";

  interface Props {
    /** Embedded hosts (the Toys tab) get their name from module chrome, so
        the header drops the identity block and leads with the controls. */
    variant?: "standalone" | "embedded";
  }

  const { variant = "standalone" }: Props = $props();
  const appState = getShapeMatrixAppContext();
  const LEVELS: readonly TurnLevel[] = [1, 2, 3, 4];
  const LEVEL_DESCRIPTIONS: Record<TurnLevel, { name: string; blurb: string }> =
    {
      1: { name: "Base Motions", blurb: "Zero turns" },
      2: { name: "Whole Turns", blurb: "Adds whole turns" },
      3: { name: "Half Turns + Float", blurb: "Adds half turns and Float" },
      4: {
        name: "Quarter Turns",
        blurb: "Adds quarter turns",
      },
    };
  const LABEL_OPTIONS = [
    { value: "turns" as const, label: "TKA turns", shortLabel: "Turns" },
    { value: "ratios" as const, label: "VTG ratios", shortLabel: "Ratios" },
  ];
  let sizes = $state([1.28, 0.82]);
  let matrixPaneElement: HTMLDivElement;
  let detailPaneElement: HTMLDivElement;

  // Compact navigation runs as a shared-element morph between the selected
  // tile and the hero. Wide layouts show both panes at once, so the same
  // calls fall through to the plain state mutation.
  function selectPair(pair: { left: Flower; right: Flower }): void {
    if (!appState.compact) {
      appState.selectPair(pair);
      return;
    }
    runMandalaMorph(appState, () => appState.showDetail(), {
      before: () => appState.selectPair(pair, { navigate: false }),
    });
  }
  function showDetail(): void {
    if (!appState.compact) {
      appState.showDetail();
      return;
    }
    runMandalaMorph(appState, () => appState.showDetail());
  }
  function showMatrix(): void {
    if (!appState.compact) {
      appState.showMatrix();
      return;
    }
    runMandalaMorph(appState, () => appState.showMatrix());
  }

  $effect(() => {
    const request = appState.compactFocusRequest;
    if (!request || !appState.compact) return;

    let frame = 0;
    let cancelled = false;
    void tick().then(() => {
      if (cancelled) return;
      frame = requestAnimationFrame(() => {
        const pane =
          request.target === "matrix" ? matrixPaneElement : detailPaneElement;
        const focusTarget =
          request.target === "matrix"
            ? pane.querySelector<HTMLButtonElement>(
                'button.cell[aria-pressed="true"], button.cell.sel'
              )
            : pane.querySelector<HTMLButtonElement>(
                'button[role="radio"][aria-checked="true"]'
              );
        focusTarget?.focus({ preventScroll: true });
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  });
</script>

{#snippet matrixPane()}
  <div
    class="workspace-pane"
    bind:this={matrixPaneElement}
    inert={appState.compact && appState.activeView !== "matrix"}
    aria-hidden={appState.compact && appState.activeView !== "matrix"}
  >
    <ShapeMatrixMatrixPane onselect={selectPair} />
  </div>
{/snippet}

{#snippet detailPane()}
  <div
    class="workspace-pane"
    bind:this={detailPaneElement}
    inert={appState.compact && appState.activeView !== "detail"}
    aria-hidden={appState.compact && appState.activeView !== "detail"}
  >
    <ShapeMatrixDetailPane />
  </div>
{/snippet}

<main
  class="shape-app"
  class:compact-detail={appState.compact && appState.activeView === "detail"}
>
  <header class="topbar">
    {#if appState.compact}
      <div class="compact-context">
        {#if appState.activeView === "detail"}
          <button
            type="button"
            class="back-to-matrix"
            aria-label="Back to the shape matrix"
            onclick={showMatrix}
          >
            <i class="fas fa-arrow-left" aria-hidden="true"></i>
            <span>Matrix</span>
          </button>
          <ShapeMatrixTurnTray />
        {:else}
          <strong>Shape Matrix</strong>
        {/if}
      </div>
    {:else if variant === "standalone"}
      <div class="identity">
        <strong>Shape Matrix Explorer</strong>
        <span>Built on Lorq Nichols’ Shape Matrix</span>
      </div>
    {/if}

    {#if !appState.compact || appState.activeView === "matrix"}
      <div class="matrix-controls">
        <div class="control-cell level-control">
          <span class="control-label">Difficulty</span>
          <LevelSelector
            value={appState.level}
            levels={LEVELS}
            describe={(level) => LEVEL_DESCRIPTIONS[level]}
            onchange={appState.setLevel}
            compact={true}
            ariaLabel="Kinetic Alphabet level"
          />
        </div>
        <div class="control-cell label-control neutral-accent">
          <span class="control-label">Notation</span>
          <SegmentedControl
            options={LABEL_OPTIONS}
            value={appState.labelMode}
            onchange={(mode: MatrixLabelMode) => appState.setLabelMode(mode)}
            size="sm"
            density="tight"
            color="accent"
            semantics="radiogroup"
            ariaLabel="Turn label system"
          />
        </div>
        <ShapeMatrixTurnControls onturn={appState.setTurn} />
      </div>
    {/if}

    <div class="top-actions">
      {#if appState.compact}
        {#if appState.activeView === "matrix" && appState.selectedPair}
          <button
            type="button"
            class="top-action compact-detail-action"
            onclick={showDetail}
            transition:growFade={{ axis: "x", x: 4 }}
          >
            <span>Detail</span>
            <i class="fas fa-arrow-right" aria-hidden="true"></i>
          </button>
        {/if}
        <ShapeMatrixOverflowMenu />
      {:else}
        <a
          class="top-action source-action"
          href="http://spinscience.xyz/2014/07/10/144-shape-matrix-even-petaled-flowers-rework/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
          <span>Original</span>
        </a>
        <button
          class="top-action"
          type="button"
          aria-label="About the Shape Matrix"
          onclick={appState.openAbout}
        >
          <i class="fas fa-circle-info" aria-hidden="true"></i>
          <span>About</span>
        </button>
      {/if}
    </div>
  </header>

  <div class="workspace">
    <PanelGroup
      direction="horizontal"
      bind:sizes
      gap={appState.compact ? 0 : 8}
      panels={[
        {
          id: "matrix",
          content: matrixPane,
          defaultSize: 1.28,
          minSize: 440,
          fixedSize: appState.compact
            ? appState.activeView === "matrix"
              ? "100%"
              : "0px"
            : undefined,
          resizable: !appState.compact,
        },
        {
          id: "realization",
          content: detailPane,
          defaultSize: 0.82,
          minSize: 380,
          fixedSize: appState.compact
            ? appState.activeView === "detail"
              ? "100%"
              : "0px"
            : undefined,
        },
      ]}
    />
  </div>
</main>

<style>
  .shape-app {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background:
      radial-gradient(
        circle at 75% 0%,
        color-mix(in srgb, var(--theme-accent, #f59e0b) 8%, transparent),
        transparent 30rem
      ),
      var(--theme-panel-bg, #0a0f14);
    color: var(--theme-text, #f5f7fa);
  }

  .topbar {
    display: grid;
    grid-template-columns: minmax(12rem, 1fr) max-content;
    grid-template-areas:
      "identity actions"
      "controls controls";
    align-items: center;
    gap: 0.3rem 0.8rem;
    padding: 0.3rem 0.75rem 0.45rem;
    border-bottom: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.11));
    background: var(--theme-panel-bg, rgb(10 15 20 / 0.94));
  }

  .top-action {
    min-height: var(--min-touch-target, 44px);
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.12));
    border-radius: 999px;
    background: var(--theme-card-bg, rgb(255 255 255 / 0.05));
    color: var(--theme-text-dim, rgb(255 255 255 / 0.72));
    text-decoration: none;
    cursor: pointer;
    transition:
      color var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease;
  }

  .top-action,
  .top-actions {
    display: flex;
    align-items: center;
  }

  .top-action {
    flex: 0 0 auto;
    min-width: var(--min-touch-target, 44px);
    max-width: 11rem;
    justify-content: center;
    gap: 0.45rem;
    padding: 0.45rem 0.8rem;
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    white-space: nowrap;
    overflow: hidden;
  }

  .top-action span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .top-action:hover {
    color: var(--theme-text, #fff);
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 55%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 8%,
      transparent
    );
  }

  .top-action:focus-visible {
    outline: 2px solid var(--theme-accent, #f59e0b);
    outline-offset: 2px;
  }

  .identity {
    grid-area: identity;
    display: flex;
    align-items: baseline;
    gap: 0.65rem;
    min-width: 0;
  }

  .identity strong {
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 0.005em;
    white-space: nowrap;
  }

  .identity span {
    overflow: hidden;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.68));
    font-size: var(--font-size-min, 0.875rem);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .compact-context {
    grid-area: context;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .compact-context > strong {
    overflow: hidden;
    font-size: var(--font-size-min, 0.875rem);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .back-to-matrix {
    display: inline-flex;
    min-width: 0;
    min-height: var(--min-touch-target, 44px);
    flex: 0 0 auto;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.75rem;
    border: 1px solid
      color-mix(
        in srgb,
        var(--theme-accent, #f59e0b) 44%,
        var(--theme-stroke, transparent)
      );
    border-radius: 10px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 9%,
      var(--theme-card-bg, transparent)
    );
    box-shadow: inset 0 1px 0
      color-mix(in srgb, var(--theme-text, #fff) 5%, transparent);
    color: var(--theme-text, #fff);
    cursor: pointer;
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 650;
    transition:
      color var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease;
  }

  .back-to-matrix:hover {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 72%,
      var(--theme-stroke, transparent)
    );
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 16%,
      var(--theme-card-hover-bg, transparent)
    );
  }

  .back-to-matrix:focus-visible {
    outline: 2px solid var(--theme-accent, #f59e0b);
    outline-offset: 2px;
  }

  .matrix-controls {
    grid-area: controls;
    /* One shared control height for all ribbon cells: a one-line sm
       SegmentedControl (44px segment + its own padding and border). Cells
       size to content — fixed cell widths overflowed once the four level
       tiles outgrew them, and stretched the tiles into full-width swatches
       in the stacked compact bands. */
    --ribbon-control-h: 3.25rem;
    width: fit-content;
    max-width: 100%;
    display: flex;
    align-items: stretch;
    /* Centered, not start-justified: the turn control swings from 4 to 14
       segments across levels, and a left-packed band strands the width
       reserved for level 4 as a dead field on the right. Centering splits
       the slack into balanced gutters at every level. */
    justify-self: center;
    gap: 0.5rem;
    min-width: 0;
  }

  /* The bento cell: a caption row over its control, each cell carrying its
     own card chrome. The caption names the control so the band reads as
     labeled instruments instead of a strip of anonymous widgets. */
  .control-cell {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    align-items: center;
    justify-items: start;
    gap: 0.3rem;
    min-width: 0;
    padding: 0.45rem 0.55rem 0.5rem;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.09));
    border-radius: 12px;
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, #101721) 82%,
      transparent
    );
    box-shadow: inset 0 1px 0
      color-mix(in srgb, var(--theme-text, #fff) 3.5%, transparent);
  }

  .level-control {
    grid-area: level;
    flex: 0 0 auto;
  }

  .control-label {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.52));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* Pin the badge tiles to the shared ribbon height; the selector's own
     big-screen media ramp would otherwise outgrow the segmented controls. */
  .level-control :global(.lvl) {
    flex: 0 0 auto;
    min-width: var(--min-touch-target, 44px);
    height: var(--ribbon-control-h);
    min-height: var(--min-touch-target, 44px);
  }

  .label-control {
    grid-area: labels;
    flex: 0 0 auto;
  }

  /* SegmentedControl's sliding indicator assumes equal-width segments, so
     each wrapper hands it a definite width sized to its longest label. */
  .label-control :global(.segmented-control) {
    width: 7.5rem;
  }

  .matrix-controls :global(.turn-editor) {
    grid-area: turns;
  }

  .top-actions {
    grid-area: actions;
    min-width: max-content;
    justify-content: flex-end;
    gap: 0.4rem;
  }

  .compact-detail-action {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 56%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 13%,
      transparent
    );
    color: var(--theme-text, #fff);
  }

  .workspace {
    display: flex;
    min-width: 0;
    min-height: 0;
    padding: 0.6rem;
    overflow: hidden;
  }

  .workspace-pane {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  @container shape-matrix-app (max-width: 74.99rem) or (max-height: 41.99rem) {
    .topbar {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas:
        "context actions"
        "controls controls";
      gap: 0.3rem 0.5rem;
      padding: 0.3rem 0.45rem 0.45rem;
    }

    .matrix-controls {
      grid-area: controls;
      gap: 0.4rem;
    }

    /* Compact hosts trade the captions for canvas; the cells keep their
       card chrome so the band still reads as grouped instruments. */
    .control-label {
      display: none;
    }

    .control-cell {
      gap: 0;
      padding: 0.25rem 0.35rem;
      border-radius: 10px;
    }

    .top-actions {
      grid-area: actions;
    }

    .workspace {
      padding: 0;
    }

    .compact-detail .topbar {
      padding-block: 0.2rem;
    }
  }

  /* The 800–1024px band is tall enough for hierarchy but too narrow for four
     dense tool groups in one ribbon. Give turn selection its own line there;
     short-wide hosts keep the single-row composition to protect the canvas. */
  @container shape-matrix-app (max-width: 64rem) and (min-width: 25.01rem) and (min-height: 30.01rem) {
    .matrix-controls {
      width: 100%;
      display: grid;
      grid-template-columns: max-content 1fr;
      grid-template-areas:
        "level labels"
        "turns turns";
      justify-items: start;
    }

  }

  @container shape-matrix-app (max-width: 99.99rem) {
    .identity span {
      display: none;
    }
  }

  /* Wide hosts hold the whole header in one row. The seam sits above the
     WIDEST ribbon state: level 4's fourteen-segment turn control plus
     identity and actions measures ~138rem, so 140rem guarantees the row
     fits with slack. The controls column may shrink to zero so any drift
     degrades into the turn-scroller's own scroll, never page overflow. */
  @container shape-matrix-app (min-width: 140rem) {
    .topbar {
      grid-template-columns:
        minmax(max-content, 1fr)
        minmax(0, max-content)
        minmax(max-content, 1fr);
      grid-template-areas: "identity controls actions";
    }

    .matrix-controls {
      min-width: 0;
    }
  }

  @container shape-matrix-app (max-width: 25rem) {
    .topbar {
      gap: 0.3rem;
    }

    .matrix-controls {
      width: 100%;
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas:
        "level"
        "labels"
        "turns";
      justify-items: start;
    }

    /* The vertical stack has room for captions again, and a first-time
       phone viewer needs them more than anyone. */
    .control-label {
      display: inline;
    }

    .control-cell {
      gap: 0.25rem;
      padding: 0.35rem 0.45rem 0.45rem;
    }
  }

  @container shape-matrix-app (min-width: 50.01rem) and (max-height: 30rem) {
    .shape-app:not(.compact-detail) .topbar {
      grid-template-areas: "controls actions";
      padding-block: 0.3rem;
    }

    .shape-app:not(.compact-detail) .compact-context {
      display: none;
    }
  }

  /* While the tile-to-hero morph runs, the panes must land in place at once:
     the browser snapshots the new layout the frame it changes, and a pane
     still sliding open would be captured at zero width. The morph is the
     continuity cue; PanelGroup keeps owning the geometry. */
  :global(html.shape-matrix-morph) .workspace :global(.panel-wrapper) {
    transition: none;
  }

  :global(
    html.shape-matrix-morph::view-transition-group(shape-matrix-active-mandala)
  ) {
    animation-duration: var(--duration-dramatic);
    animation-timing-function: var(--ease-spring);
  }
  :global(
    html.shape-matrix-morph::view-transition-old(shape-matrix-active-mandala)
  ),
  :global(
    html.shape-matrix-morph::view-transition-new(shape-matrix-active-mandala)
  ) {
    animation-duration: var(--duration-emphasis);
    animation-timing-function: var(--ease-in-out);
  }

  @media (prefers-reduced-motion: reduce) {
    .top-action,
    .back-to-matrix {
      transition: none;
    }

    :global(
      html.shape-matrix-morph::view-transition-group(
          shape-matrix-active-mandala
        )
    ),
    :global(
      html.shape-matrix-morph::view-transition-old(shape-matrix-active-mandala)
    ),
    :global(
      html.shape-matrix-morph::view-transition-new(shape-matrix-active-mandala)
    ) {
      animation: none;
    }
  }
</style>
