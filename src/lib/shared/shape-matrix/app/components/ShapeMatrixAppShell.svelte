<script lang="ts">
  import { tick } from "svelte";
  import PanelGroup from "$lib/shared/panels/PanelGroup.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import DualSourceCrossfade from "$lib/shared/components/DualSourceCrossfade.svelte";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import LevelSelector from "$lib/shared/components/LevelSelector.svelte";
  import type { MatrixLabelMode } from "$lib/shared/shape-matrix/domain/matrix-turn-band";
  import type { Flower } from "$lib/shared/shape-matrix/domain/flower-signature";
  import {
    KINETIC_SHAPE_ENGINE_NAME,
    ORIGINAL_SHAPE_MATRIX_URL,
    ORIGINAL_SHAPE_MATRIX_VTG_RATIOS,
  } from "../shape-engine-identity";

  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";
  import { createShapeMatrixAnimationState } from "../state/shape-matrix-animation-state.svelte";
  import { setShapeMatrixAnimationContext } from "../context/shape-matrix-animation-context";
  import { setAnimationScopeContext } from "$lib/shared/animation-engine/state/animation-scope-context";
  import { setAnimationVisibilityContext } from "$lib/shared/animation-engine/state/animation-visibility-context";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import ShapeMatrixDetailPane from "./ShapeMatrixDetailPane.svelte";
  import ShapeMatrixMatrixPane from "./ShapeMatrixMatrixPane.svelte";
  import ShapeMatrixOverflowMenu from "./ShapeMatrixOverflowMenu.svelte";
  import ShapeMatrixTurnControls from "./ShapeMatrixTurnControls.svelte";
  import ShapeMatrixTurnPopover from "./ShapeMatrixTurnPopover.svelte";
  import ShapeMatrixSurfaceControl from "./ShapeMatrixSurfaceControl.svelte";
  import ShapeMatrixTheoryControls from "./ShapeMatrixTheoryControls.svelte";
  import ShapeMatrixTheoryDetail from "./ShapeMatrixTheoryDetail.svelte";
  import ShapeMatrixTheoryPane from "./ShapeMatrixTheoryPane.svelte";
  import { runMandalaMorph } from "../services/shape-matrix-mandala-morph";
  import { growFade } from "$lib/shared/transitions/motion";

  interface Props {
    /** Embedded hosts (the Toys tab) get their name from module chrome, so
        the header drops the identity block and leads with the controls. */
    variant?: "standalone" | "embedded";
  }

  const { variant = "standalone" }: Props = $props();
  const appState = getShapeMatrixAppContext();
  // The hero's animation state lives here, above both panes, so the compact
  // topbar can host the relationships toggle the wide detail heading shows.
  const animationState = setShapeMatrixAnimationContext(
    createShapeMatrixAnimationState()
  );
  setAnimationScopeContext(animationState.scope);
  setAnimationVisibilityContext(animationState.scope.visibility);
  setEffectsConfigContext(animationState.scope.effects);
  import {
    SHAPE_MATRIX_LEVELS,
    SHAPE_MATRIX_LEVEL_DESCRIPTIONS,
  } from "../shape-matrix-levels";

  /* Both surfaces are a grid of pairs with a detail beside it, so the shell
     runs one layout and swaps what fills the panes. Matrix adds a Kinetic
     Alphabet difficulty choice; Theory's typed ratios need no second bound. */
  const theory = $derived(appState.surface === "theory");

  /* The app always mounts on the Matrix and restores its saved or linked
     surface immediately afterwards, so a deep link into Theory would dissolve
     one ribbon into the other while the page is still arriving. Chrome does
     not animate into place on first paint: the restore lands instantly, and
     every surface change the user makes after that crossfades. */
  let booted = $state(false);
  $effect(() => {
    const frame = requestAnimationFrame(() => {
      booted = true;
    });
    return () => cancelAnimationFrame(frame);
  });
  const hasPair = $derived(
    theory ? appState.theoryPair !== null : appState.selectedPair !== null
  );
  const LABEL_OPTIONS = [
    { value: "turns" as const, label: "TKA turns", shortLabel: "Turns" },
    { value: "ratios" as const, label: "VTG ratios", shortLabel: "Ratios" },
  ];
  let sizes = $state([1.28, 0.82]);
  let theorySizes = $state([1.28, 0.82]);
  let matrixPaneElement: HTMLDivElement;
  let detailPaneElement: HTMLDivElement;
  let theoryPaneElement: HTMLDivElement;
  let theoryDetailElement: HTMLDivElement;
  let theoryEditingAxis = $state<"left" | "right" | "both" | null>(null);

  $effect(() => {
    if (!theory) theoryEditingAxis = null;
  });

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
  // The morph is a shared-element handoff between the matrix tile and the
  // matrix hero. Theory tiles do not own that name, so theory navigates
  // plainly rather than capturing the hidden matrix behind it.
  function showDetail(): void {
    if (!appState.compact || theory) {
      appState.showDetail();
      return;
    }
    runMandalaMorph(appState, () => appState.showDetail());
  }
  function showMatrix(): void {
    if (!appState.compact || theory) {
      appState.showMatrix();
      return;
    }
    runMandalaMorph(appState, () => appState.showMatrix());
  }

  function surpriseMe(): void {
    if (!appState.compact || theory || appState.activeView === "detail") {
      appState.surpriseMe();
      return;
    }
    runMandalaMorph(appState, () => appState.showDetail(), {
      before: () => appState.surpriseMe(Math.random, { navigate: false }),
    });
  }

  $effect(() => {
    const request = appState.compactFocusRequest;
    if (!request || !appState.compact) return;

    let frame = 0;
    let cancelled = false;
    void tick().then(() => {
      if (cancelled) return;
      frame = requestAnimationFrame(() => {
        const pane = theory
          ? request.target === "matrix"
            ? theoryPaneElement
            : theoryDetailElement
          : request.target === "matrix"
            ? matrixPaneElement
            : detailPaneElement;
        if (!pane) return;
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

{#snippet surpriseAction(compact = false)}
  <button
    type="button"
    class="top-action surprise-action"
    class:compact
    aria-label="Surprise me with a new grid, crossing, and hand relationship"
    title="Pick a new grid, crossing, and hand relationship"
    disabled={!theory && !appState.data}
    onclick={surpriseMe}
  >
    <i class="fas fa-dice" aria-hidden="true"></i>
    {#if !compact}<span>Surprise me</span>{/if}
  </button>
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

{#snippet matrixWorkspace()}
  <!-- The crossfade lays its sources out as absolutely positioned blocks, so a
       child that fills by flex-grow has nothing to grow inside. Each source
       gets its own filling stage, the way the viewer's panel workspace does. -->
  <div class="workspace-source">
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
{/snippet}

{#snippet theoryPane()}
  <div
    class="workspace-pane"
    bind:this={theoryPaneElement}
    inert={appState.compact && appState.activeView !== "matrix"}
    aria-hidden={appState.compact && appState.activeView !== "matrix"}
  >
    <ShapeMatrixTheoryPane emphasizedAxis={theoryEditingAxis} />
  </div>
{/snippet}

{#snippet theoryDetail()}
  <div
    class="workspace-pane"
    bind:this={theoryDetailElement}
    inert={appState.compact && appState.activeView !== "detail"}
    aria-hidden={appState.compact && appState.activeView !== "detail"}
  >
    <ShapeMatrixTheoryDetail />
  </div>
{/snippet}

{#snippet theoryWorkspace()}
  <!-- Same two panes, same split, same compact behaviour as the Matrix. The
       surface changes what the grid is made of, not how the app works. -->
  <div class="workspace-source">
    <PanelGroup
      direction="horizontal"
      bind:sizes={theorySizes}
      gap={appState.compact ? 0 : 8}
      panels={[
        {
          id: "theory-matrix",
          content: theoryPane,
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
          id: "theory-realization",
          content: theoryDetail,
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
{/snippet}

<main
  class="shape-app"
  class:compact-detail={appState.compact && appState.activeView === "detail"}
  class:theory
>
  <header class="topbar">
    {#if appState.compact}
      <div class="compact-context">
        {#if appState.activeView === "detail"}
          <button
            type="button"
            class="back-to-matrix"
            aria-label={theory
              ? "Back to the theory matrix"
              : "Back to the shape matrix"}
            onclick={showMatrix}
          >
            <i class="fas fa-arrow-left" aria-hidden="true"></i>
            <span>{theory ? "Playground" : "Matrix"}</span>
          </button>
        {:else}
          <strong>{theory ? "Ratio Playground" : "Level Matrix"}</strong>
        {/if}
        <!-- The compact value editor keeps the grid as the hero. Matrix opens
             its level and turns; Theory names ratio editing directly and
             opens both axis ratios together. -->
        <ShapeMatrixSurfaceControl compact />
        <ShapeMatrixTurnPopover
          onratiofocuschange={(hand) => (theoryEditingAxis = hand)}
        />
      </div>
    {:else if variant === "standalone"}
      <div class="identity">
        <strong>{KINETIC_SHAPE_ENGINE_NAME}</strong>
        {#if !theory}
          <span class="identity-note">
            Lorq’s 144 Shape Matrix: VTG ratios
            {ORIGINAL_SHAPE_MATRIX_VTG_RATIOS}
          </span>
        {/if}
      </div>
    {/if}

    {#if !appState.compact}
      <!-- The surface choice outranks everything below it. Matrix adds its
           difficulty beside that choice; Theory has no parallel setting. -->
      <div class="header-meta">
        <div class="surface-control-cell">
          <ShapeMatrixSurfaceControl />
        </div>
        <div class="surprise-presence">
          {@render surpriseAction()}
        </div>
        {#if !theory}
          <!-- The wrapper owns the gap as well as the cell width, so removing
               Difficulty releases one continuous piece of space instead of
               leaving a final half-rem gap to snap away at teardown. -->
          <div
            class="level-presence"
            transition:growFade={{
              axis: "x",
              duration: booted ? DURATION.normal : 0,
            }}
          >
            <div class="control-cell level-control">
              <span class="control-label">Difficulty</span>
              <LevelSelector
                value={appState.level}
                levels={SHAPE_MATRIX_LEVELS}
                describe={(level) => SHAPE_MATRIX_LEVEL_DESCRIPTIONS[level]}
                onchange={appState.setLevel}
                compact={true}
                ariaLabel="Kinetic Alphabet level"
              />
            </div>
          </div>
        {/if}
      </div>
      <!-- The two ribbons already shared one grid area, so a pair of
           independent fades painted Matrix's turn row through Theory's ratio
           row: two legible bands of numbers on top of each other for the
           length of the swap. The shared primitive runs them sequentially in
           that same cell, so only one ribbon is ever readable. -->
      <div class="controls-swap">
        <Crossfade
          key={theory ? "theory" : "matrix"}
          mode="swap"
          duration={booted ? DURATION.normal : 0}
        >
          {#if theory}
            <div class="surface-controls">
              <ShapeMatrixTheoryControls
                onfocuschange={(hand) => (theoryEditingAxis = hand)}
              />
            </div>
          {:else}
            <div class="matrix-controls">
              <div class="control-cell label-control neutral-accent">
                <span class="control-label">Notation</span>
                <SegmentedControl
                  options={LABEL_OPTIONS}
                  value={appState.labelMode}
                  onchange={(mode: MatrixLabelMode) =>
                    appState.setLabelMode(mode)}
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
        </Crossfade>
      </div>
    {/if}

    <div class="top-actions">
      {#if appState.compact}
        {@render surpriseAction(true)}
        {#if appState.activeView === "matrix" && hasPair}
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
        <!-- Only while a control section covers the relationships: the button
             is the way back to them, so it has nothing to do when they are
             already showing, and it never competes with Matrix for the tap.
             Both surfaces mount the element row above the same dock, so both
             lose it to an open panel and both need the way back. -->
        {#if appState.activeView === "detail" && animationState.activeSection !== null}
          <button
            type="button"
            class="top-action relationships-action"
            aria-label="Back to element relationships"
            onclick={animationState.showRelationships}
            transition:growFade={{ axis: "x", x: 4 }}
          >
            <i class="fas fa-shapes" aria-hidden="true"></i>
            <span>Relationships</span>
          </button>
        {/if}
        <ShapeMatrixOverflowMenu />
      {:else}
        <a
          class="top-action source-action"
          href={ORIGINAL_SHAPE_MATRIX_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open Lorq Nichols’ original 144 Shape Matrix"
        >
          <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
          <!-- The fuller identity line yields below 1600px to protect the
               control ribbon. Keep the visible action itself attributable so
               that breakpoint never reduces Lorq's work to a generic source. -->
          <span>Lorq Nichols’ original</span>
        </a>
        <button
          class="top-action"
          type="button"
          aria-label={`About ${KINETIC_SHAPE_ENGINE_NAME}`}
          onclick={appState.openAbout}
        >
          <i class="fas fa-circle-info" aria-hidden="true"></i>
          <span>About</span>
        </button>
      {/if}
    </div>
  </header>

  <div class="workspace">
    <DualSourceCrossfade
      active={appState.surface === "matrix" ? "first" : "second"}
      duration={booted ? DURATION.normal : 0}
      first={matrixWorkspace}
      second={theoryWorkspace}
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
    grid-template-columns: minmax(6rem, 1fr) auto minmax(6rem, 1fr);
    grid-template-areas:
      "identity meta actions"
      "controls controls controls";
    align-items: center;
    gap: 0.3rem 0.8rem;
    padding: 0.3rem 0.75rem 0.45rem;
    border-bottom: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.11));
    background: var(--theme-panel-bg, rgb(10 15 20 / 0.94));
  }

  .top-action {
    min-height: var(--min-touch-target, 44px);
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.12));
    border-radius: 10px;
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

  /* Preserve the existing action footprint while giving the attributed source
     label enough text width to render Lorq's name without an ellipsis. */
  .source-action {
    padding-inline: 0.6rem;
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

  .surprise-action {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 58%,
      var(--theme-stroke, transparent)
    );
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 13%,
      var(--theme-card-bg, transparent)
    );
    color: var(--theme-text, #fff);
    font-weight: 750;
  }

  .surprise-action i {
    color: var(--theme-accent, #f59e0b);
  }

  .surprise-action:disabled {
    border-color: var(--theme-stroke, rgb(255 255 255 / 0.09));
    background: transparent;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.42));
    cursor: wait;
    opacity: 0.6;
  }

  .surprise-action.compact {
    width: var(--min-touch-target, 44px);
    max-width: none;
    padding: 0;
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

  .identity-note {
    display: grid;
    overflow: hidden;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.68));
    font-size: var(--font-size-min, 0.875rem);
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

  /* The crossfade owns the grid cell both ribbons used to claim directly, so
     the outgoing and incoming bands are stacked by the primitive rather than
     by two elements happening to name the same area. */
  .controls-swap {
    grid-area: controls;
    /* Centered, not start-justified: the turn control swings from 4 to 14
       segments across levels, and a left-packed band strands the width
       reserved for level 4 as a dead field on the right. Centering splits
       the slack into balanced gutters at every level. */
    justify-self: center;
    max-width: 100%;
    min-width: 0;
  }

  .matrix-controls,
  .surface-controls {
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
    justify-content: center;
    margin-inline: auto;
    gap: 0.5rem;
    min-width: 0;
  }

  /* The title-line pair. It carries the ribbon's control height so the two
     cells match the band below rather than shrinking to the title's line box. */
  .header-meta {
    grid-area: meta;
    --ribbon-control-h: 3.25rem;
    display: flex;
    align-items: stretch;
    justify-self: center;
    gap: 0;
    min-width: 0;
  }

  .surface-control-cell {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
  }

  .surprise-presence {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    margin-left: 0.5rem;
  }

  .surprise-presence .surprise-action {
    min-height: 3.65rem;
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

  .level-presence {
    flex: 0 0 auto;
    margin-left: 0.5rem;
  }

  .level-control {
    /* The three widths track LevelSelector's own 1680/2600 ramp. */
    min-width: 17.5rem;
  }

  /* Centre the badges in the cell. */
  .level-control :global(.level-selector) {
    width: 100%;
    justify-content: center;
  }

  @media (min-width: 1680px) {
    .level-control {
      min-width: 19.25rem;
    }
  }

  @media (min-width: 2600px) {
    .level-control {
      min-width: 22.5rem;
    }
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

  .matrix-controls :global(.turn-editor),
  .surface-controls :global(.theory-editor) {
    grid-area: turns;
  }

  .top-actions {
    grid-area: actions;
    min-width: max-content;
    justify-content: flex-end;
    gap: 0.4rem;
  }

  /* The complete ratio instrument fits beside the page identity once the
     identity line can remain readable. Laptop widths keep it on its own row
     rather than squeezing the axis labels and copy actions. */
  @container shape-matrix-app (min-width: 112rem) and (min-height: 42rem) {
    .shape-app.theory .topbar {
      grid-template-columns:
        minmax(max-content, 1fr)
        auto
        minmax(0, max-content)
        minmax(max-content, 1fr);
      grid-template-areas: "identity meta controls actions";
    }

    .shape-app.theory .identity {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.15rem;
    }
  }

  .relationships-action i {
    color: var(--theme-accent, #f59e0b);
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

  .workspace-source {
    display: flex;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
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
      grid-template-columns: minmax(0, 1fr) auto auto;
      grid-template-areas:
        "context meta actions"
        "controls controls controls";
      gap: 0.3rem 0.5rem;
      padding: 0.3rem 0.45rem 0.45rem;
    }

    .controls-swap {
      grid-area: controls;
    }

    .matrix-controls,
    .surface-controls {
      gap: 0.4rem;
    }

    .header-meta {
      gap: 0;
    }

    .level-presence {
      margin-left: 0.4rem;
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

    /* This tier trades the whole title-line pair for compact chrome. */
    .level-control {
      min-width: 0;
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

  @container shape-matrix-app (max-width: 25rem) {
    .topbar {
      gap: 0.3rem;
    }
  }
  @container shape-matrix-app (max-width: 99.99rem) {
    .identity > .identity-note {
      display: none;
    }
  }

  /* Wide hosts hold the whole header in one row: identity, the Explore and
     Difficulty pair, the notation-and-turn band, and the actions. The seam
     sits above the widest state, level 4's fourteen turn values, and the
     band column may shrink to zero so any drift degrades into the turn
     viewport's own scroll rather than page overflow. */
  @container shape-matrix-app (min-width: 140rem) {
    .topbar {
      grid-template-columns:
        minmax(max-content, 1fr)
        auto
        minmax(0, max-content)
        minmax(max-content, 1fr);
      grid-template-areas: "identity meta controls actions";
    }

    .matrix-controls,
    .surface-controls {
      min-width: 0;
    }
  }

  /* Phone widths: the relationships pill keeps its glyph and aria-label and
     drops the word so the turn chip beside it never clips. */
  @container shape-matrix-app (max-width: 30rem) {
    /* The chip already names the surface; a title that truncates to
       "Sha..." beside it is noise. */
    .compact-context > strong {
      display: none;
    }

    .relationships-action {
      padding-inline: 0;
    }

    .relationships-action span {
      display: none;
    }

    /* The back button drops its word for the same reason, and it has one more:
       the surface control sitting right beside it already says Matrix or
       Theory, so the word was printed twice. Theory is where the row actually
       ran out of width, because two ratios are wider than two turn values. */
    .back-to-matrix {
      padding-inline: 0.6rem;
    }

    .back-to-matrix span {
      display: none;
    }
  }

  @container shape-matrix-app (max-width: 25rem) {
    .topbar {
      gap: 0.3rem;
    }
  }

  @container shape-matrix-app (min-width: 50.01rem) and (max-height: 30rem) {
    .shape-app:not(.compact-detail) .topbar {
      padding-block: 0.3rem;
    }
  }

  /* While the tile-to-hero morph runs, the panes must land in place at once:
     the browser snapshots the new layout the frame it changes, and a pane
     still sliding open would be captured at zero width. The morph is the
     continuity cue; PanelGroup keeps owning the geometry. */
  :global(html.shape-matrix-morph) .workspace :global(.panel-wrapper) {
    transition: none;
  }

  /* Two nested shared elements travel together: the stage rectangle (the
     selected tile's box, or the detail stage with its header band and
     corner annotations) and, riding on top of it, the mandala. The mandala
     is excluded from the stage's snapshot because it has its own name, so
     each is one picture. Both settle without overshoot; a spring would swing
     the mandala past the square the live canvas is about to paint in. */
  :global(
    html.shape-matrix-morph::view-transition-group(shape-matrix-active-stage)
  ),
  :global(
    html.shape-matrix-morph::view-transition-group(shape-matrix-active-mandala)
  ) {
    animation-duration: var(--duration-dramatic);
    animation-timing-function: var(--ease-in-out);
  }
  :global(
    html.shape-matrix-morph::view-transition-old(shape-matrix-active-stage)
  ),
  :global(
    html.shape-matrix-morph::view-transition-new(shape-matrix-active-stage)
  ),
  :global(
    html.shape-matrix-morph::view-transition-old(shape-matrix-active-mandala)
  ),
  :global(
    html.shape-matrix-morph::view-transition-new(shape-matrix-active-mandala)
  ) {
    animation-duration: var(--duration-emphasis);
    animation-timing-function: var(--ease-in-out);
  }
  /* The tile and the stage are different rectangles. Each snapshot fills the
     travelling box for the whole flight instead of keeping its own aspect
     and leaving the box partly empty. */
  :global(
    html.shape-matrix-morph::view-transition-old(shape-matrix-active-stage)
  ),
  :global(
    html.shape-matrix-morph::view-transition-new(shape-matrix-active-stage)
  ) {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }

  /* The page under the flight is one snapshot on each side. Left alone the
     browser holds both at full strength and sums them, so the matrix grid
     burns through the arriving detail view for the whole flight and then
     vanishes at teardown. Crossfading them dissolves the grid away instead;
     `plus-lighter` keeps the parts common to both sides (the top bar) at
     constant strength through the middle of the fade. */
  @keyframes -global-shape-matrix-page-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes -global-shape-matrix-page-out {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
  :global(html.shape-matrix-morph::view-transition-old(root)),
  :global(html.shape-matrix-morph::view-transition-new(root)) {
    mix-blend-mode: plus-lighter;
  }
  :global(html.shape-matrix-morph::view-transition-old(root)) {
    animation: shape-matrix-page-out var(--duration-emphasis) var(--ease-in)
      both;
  }
  :global(html.shape-matrix-morph::view-transition-new(root)) {
    animation: shape-matrix-page-in var(--duration-emphasis) var(--ease-out)
      both;
  }

  /* The three frames around the stage — chips above, carousel below, control
     bar at the foot — are not in the flying rectangle. Each has its own name,
     so instead of being painted complete under the flight they settle into
     their landed positions on a wave that starts while the stage is still
     arriving and finishes just after it lands. The wave runs outward from the
     stage: nearest first, and from the side each frame sits on. Only one side
     of the morph has these frames, so their groups have nothing to
     interpolate. */
  @keyframes -global-shape-matrix-settle-in {
    from {
      opacity: 0;
      transform: translateY(var(--settle-from));
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes -global-shape-matrix-settle-out {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(var(--settle-from));
    }
  }
  :global(html.shape-matrix-morph::view-transition-new(shape-matrix-modes)),
  :global(html.shape-matrix-morph::view-transition-new(shape-matrix-strip)),
  :global(html.shape-matrix-morph::view-transition-new(shape-matrix-controls)) {
    animation: shape-matrix-settle-in var(--duration-emphasis) var(--ease-out)
      both;
  }
  :global(html.shape-matrix-morph::view-transition-old(shape-matrix-modes)),
  :global(html.shape-matrix-morph::view-transition-old(shape-matrix-strip)),
  :global(html.shape-matrix-morph::view-transition-old(shape-matrix-controls)) {
    animation: shape-matrix-settle-out var(--duration-normal) var(--ease-in)
      both;
  }
  /* Above the stage, so it drops in from above. */
  :global(html.shape-matrix-morph::view-transition-new(shape-matrix-modes)),
  :global(html.shape-matrix-morph::view-transition-old(shape-matrix-modes)) {
    --settle-from: -0.9rem;
  }
  :global(html.shape-matrix-morph::view-transition-new(shape-matrix-strip)) {
    --settle-from: 1.2rem;
  }
  :global(html.shape-matrix-morph::view-transition-old(shape-matrix-strip)) {
    --settle-from: 1rem;
  }
  :global(html.shape-matrix-morph::view-transition-new(shape-matrix-controls)) {
    --settle-from: 1.5rem;
  }
  :global(html.shape-matrix-morph::view-transition-old(shape-matrix-controls)) {
    --settle-from: 1rem;
  }
  :global(html.shape-matrix-morph::view-transition-new(shape-matrix-modes)) {
    animation-delay: calc(var(--duration-dramatic) * 0.45);
  }
  :global(html.shape-matrix-morph::view-transition-new(shape-matrix-strip)) {
    animation-delay: calc(var(--duration-dramatic) * 0.6);
  }
  :global(html.shape-matrix-morph::view-transition-new(shape-matrix-controls)) {
    animation-delay: calc(var(--duration-dramatic) * 0.72);
  }

  @media (prefers-reduced-motion: reduce) {
    .top-action,
    .back-to-matrix {
      transition: none;
    }

    /* Without the crossfade there is nothing for the additive blend to sum,
       and both page snapshots would burn through each other. */
    :global(html.shape-matrix-morph::view-transition-old(root)),
    :global(html.shape-matrix-morph::view-transition-new(root)) {
      mix-blend-mode: normal;
    }

    :global(html.shape-matrix-morph::view-transition-old(root)),
    :global(html.shape-matrix-morph::view-transition-new(root)),
    :global(html.shape-matrix-morph::view-transition-new(shape-matrix-modes)),
    :global(html.shape-matrix-morph::view-transition-old(shape-matrix-modes)),
    :global(html.shape-matrix-morph::view-transition-new(shape-matrix-strip)),
    :global(html.shape-matrix-morph::view-transition-old(shape-matrix-strip)),
    :global(
      html.shape-matrix-morph::view-transition-new(shape-matrix-controls)
    ),
    :global(
      html.shape-matrix-morph::view-transition-old(shape-matrix-controls)
    ) {
      animation: none;
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
    ),
    :global(
      html.shape-matrix-morph::view-transition-group(shape-matrix-active-stage)
    ),
    :global(
      html.shape-matrix-morph::view-transition-old(shape-matrix-active-stage)
    ),
    :global(
      html.shape-matrix-morph::view-transition-new(shape-matrix-active-stage)
    ) {
      animation: none;
    }
  }
</style>
