<script lang="ts">
  import PanelGroup from "$lib/shared/panels/PanelGroup.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import LevelSelector from "$lib/shared/components/LevelSelector.svelte";
  import { ratioLabel } from "$lib/shared/shape-matrix/domain/flower-signature";
  import type { MatrixLabelMode } from "$lib/shared/shape-matrix/domain/matrix-turn-band";
  import {
    keyToTurnValue,
    turnValueToKey,
    type TurnLevel,
  } from "$lib/shared/create/services/level-turn-values";

  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";
  import ShapeMatrixDetailPane from "./ShapeMatrixDetailPane.svelte";
  import ShapeMatrixMatrixPane from "./ShapeMatrixMatrixPane.svelte";
  import ShapeMatrixOverflowMenu from "./ShapeMatrixOverflowMenu.svelte";
  import type { ShapeMatrixAxisTarget } from "../state/shape-matrix-app-state.svelte";
  import { getPropTypeDisplayInfo } from "$lib/shared/settings/components/tabs/prop-type/prop-type-registry";
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
      2: { name: "Whole Turns", blurb: "Zero through three whole turns" },
      3: { name: "Half Turns + Float", blurb: "Half turns and Float" },
      4: {
        name: "Quarter Turns",
        blurb: "Quarter turns, Float, and every prior band",
      },
    };
  const AXIS_OPTIONS = [
    {
      value: "blue" as const,
      label: "Blue rows",
      shortLabel: "Blue",
      tone: "blue" as const,
    },
    {
      value: "both" as const,
      label: "Both axes",
      shortLabel: "Both",
      tone: "both" as const,
    },
    {
      value: "red" as const,
      label: "Red columns",
      shortLabel: "Red",
      tone: "red" as const,
    },
  ];
  const LABEL_OPTIONS = [
    { value: "turns" as const, label: "TKA turns", shortLabel: "Turns" },
    { value: "ratios" as const, label: "VTG ratios", shortLabel: "Ratios" },
  ];
  const turnControlLabel = $derived(
    appState.labelMode === "ratios" ? "VTG ratio" : "TKA turn"
  );
  const turnOptions = $derived([
    ...(appState.activeAxis === "both" && appState.blueTurn !== appState.redTurn
      ? [
          {
            value: "mixed",
            label: "Mixed axis values",
            shortLabel: "Mixed",
            disabled: true,
          },
        ]
      : []),
    ...appState.availableTurns.map((turn) => {
      const key = turnValueToKey(turn);
      const turnLabel =
        turn === "fl"
          ? "Float"
          : appState.labelMode === "ratios"
            ? `${ratioLabel(turn)} ratio`
            : `${turn} turn${turn === 1 ? "" : "s"}`;
      const visible =
        appState.labelMode === "ratios"
          ? turn === "fl"
            ? "Float"
            : ratioLabel(turn)
          : turn === "fl"
            ? "Float"
            : String(turn);
      return {
        value: key,
        label: turnLabel,
        shortLabel: visible,
        tone: appState.activeAxis,
      };
    }),
  ]);
  const selectedTurnKey = $derived(
    appState.activeAxis === "both" && appState.blueTurn !== appState.redTurn
      ? "mixed"
      : turnValueToKey(appState.activeTurn)
  );
  const selectedProp = $derived(getPropTypeDisplayInfo(appState.propType));
  const selectedPropLabel = $derived(selectedProp.label);
  const compactSelectionSummary = $derived.by(() => {
    const selected = turnOptions.find(
      (option) => option.value === selectedTurnKey
    );
    return `Level ${appState.level} · ${selected?.label ?? "Mixed axis values"}`;
  });
  let sizes = $state([1.28, 0.82]);
</script>

{#snippet matrixPane()}
  <div
    class="workspace-pane"
    inert={appState.compact && appState.activeView !== "matrix"}
    aria-hidden={appState.compact && appState.activeView !== "matrix"}
  >
    <ShapeMatrixMatrixPane />
  </div>
{/snippet}

{#snippet detailPane()}
  <div
    class="workspace-pane"
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
            onclick={appState.showMatrix}
          >
            <i class="fas fa-arrow-left" aria-hidden="true"></i>
            <span>Matrix</span>
          </button>
          <span class="selection-summary">{compactSelectionSummary}</span>
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
        <div class="turn-editor">
          <div class="control-cell axis-control">
            <span class="control-label">Apply to</span>
            <SegmentedControl
              options={AXIS_OPTIONS}
              value={appState.activeAxis}
              onchange={(axis: ShapeMatrixAxisTarget) =>
                appState.setActiveAxis(axis)}
              size="sm"
              density="tight"
              color="accent"
              semantics="radiogroup"
              ariaLabel="Axis edited by the turn control"
            />
          </div>
          <div class="control-cell turn-scroller">
            <span class="control-label">{turnControlLabel}</span>
            {#if appState.availableTurns.length === 1}
              <output
                class="fixed-turn-value"
                aria-label={`${turnControlLabel}: ${turnOptions[0]?.label ?? "Zero"}`}
              >
                {turnOptions[0]?.shortLabel ?? "0"}
                <span>Only value at Level 1</span>
              </output>
            {:else}
              <div
                class="turn-control"
                style="--turn-option-count: {turnOptions.length}"
              >
                <SegmentedControl
                  options={turnOptions}
                  value={selectedTurnKey}
                  onchange={(key: string) => {
                    if (key !== "mixed") appState.setTurn(keyToTurnValue(key));
                  }}
                  size="sm"
                  density="tight"
                  color="accent"
                  semantics="radiogroup"
                  ariaLabel={turnControlLabel}
                />
              </div>
            {/if}
          </div>
        </div>
        {#if !appState.compact}
          <div class="control-cell prop-control">
            <span class="control-label">Prop</span>
            <button
              class="prop-action"
              type="button"
              aria-label={`Choose prop. Current prop: ${selectedPropLabel}`}
              onclick={appState.openPropPicker}
            >
              <img class="selected-prop-icon" src={selectedProp.image} alt="" />
              <span>{selectedPropLabel}</span>
              <i
                class="fas fa-chevron-down disclosure-icon"
                aria-hidden="true"
              ></i>
            </button>
          </div>
        {/if}
      </div>
    {/if}

    <div class="top-actions">
      {#if appState.compact}
        {#if appState.activeView === "matrix" && appState.selectedPair}
          <button
            type="button"
            class="top-action compact-detail-action"
            onclick={appState.showDetail}
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
    --shape-surface: #0a0f14;
    --shape-panel: #101721;
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
        rgb(245 158 11 / 0.08),
        transparent 30rem
      ),
      var(--shape-surface);
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
    background: rgb(10 15 20 / 0.94);
    backdrop-filter: blur(18px);
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
    font-size: 0.82rem;
    white-space: nowrap;
    overflow: hidden;
  }

  .top-action span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .selected-prop-icon {
    width: 1.45rem;
    height: 1.45rem;
    flex: 0 0 auto;
    object-fit: contain;
  }

  .disclosure-icon {
    flex: 0 0 auto;
    font-size: 0.62rem;
    opacity: 0.55;
  }

  .top-action:hover {
    color: var(--theme-text, #fff);
    border-color: rgb(245 158 11 / 0.55);
    background: rgb(245 158 11 / 0.08);
  }

  .top-action:focus-visible {
    outline: 2px solid #f59e0b;
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
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.05);
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
    outline: 2px solid #f59e0b;
    outline-offset: 2px;
  }

  .selection-summary {
    min-width: 0;
    overflow: hidden;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.58));
    font-size: var(--font-size-compact, 0.75rem);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .matrix-controls {
    grid-area: controls;
    --theme-accent: #d9901a;
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
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.035);
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

  .neutral-accent {
    --theme-accent: #d9901a;
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

  .axis-control {
    flex: 0 0 auto;
  }

  .axis-control :global(.segmented-control) {
    width: 9.75rem;
  }

  .turn-editor {
    grid-area: turns;
    display: flex;
    flex: 0 1 auto;
    align-items: stretch;
    gap: 0.5rem;
    min-width: 0;
  }

  .turn-scroller {
    flex: 0 1 auto;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .turn-scroller::-webkit-scrollbar {
    display: none;
  }

  .turn-control {
    width: min(100%, calc(var(--turn-option-count, 4) * 3rem));
    justify-self: start;
    /* Level changes rewrite the option count, so the control's width is an
       intentional structural change — ease it instead of snapping. */
    transition: width var(--transition-normal);
  }

  .turn-control :global(.segmented-control) {
    min-width: calc(var(--count) * 3rem);
  }

  .fixed-turn-value {
    display: inline-flex;
    width: fit-content;
    min-width: 7rem;
    min-height: var(--ribbon-control-h);
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    padding: 0.35rem 0.75rem;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.12));
    border-radius: 8px;
    background: var(--theme-card-bg, rgb(255 255 255 / 0.05));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .fixed-turn-value span {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.58));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 500;
  }

  .prop-control {
    flex: 0 0 auto;
  }

  .prop-action {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: var(--ribbon-control-h);
    max-width: 11rem;
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.12));
    border-radius: 10px;
    background: var(--theme-card-bg, rgb(255 255 255 / 0.05));
    color: var(--theme-text, #fff);
    cursor: pointer;
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 600;
    white-space: nowrap;
    transition:
      color var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease;
  }

  .prop-action span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .prop-action:hover {
    border-color: rgb(245 158 11 / 0.55);
    background: rgb(245 158 11 / 0.08);
  }

  .prop-action:focus-visible {
    outline: 2px solid #f59e0b;
    outline-offset: 2px;
  }

  .top-actions {
    grid-area: actions;
    min-width: max-content;
    justify-content: flex-end;
    gap: 0.4rem;
  }

  .compact-detail-action {
    border-color: color-mix(in srgb, #f59e0b 56%, transparent);
    background: color-mix(in srgb, #f59e0b 13%, transparent);
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

    .turn-editor {
      grid-area: turns;
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

    .turn-editor {
      overflow-x: auto;
      scrollbar-width: none;
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

    .fixed-turn-value span {
      display: none;
    }

    .selection-summary {
      display: none;
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

  @media (prefers-reduced-motion: reduce) {
    .top-action,
    .prop-action,
    .back-to-matrix,
    .turn-control {
      transition: none;
    }
  }
</style>
