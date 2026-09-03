<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixTurnControls.svelte
  The one turn editor for the Shape Matrix app: the Apply-to axis control
  (Left / Both / Right) and the cumulative, level-appropriate turn control in
  the current label system. The matrix ribbon and the compact detail tray
  both present this component; only where the edit navigates differs, and
  the host decides that through `onturn`.

  The cell chrome and the stepping value scroller are shared with the Theory
  ribbon, which needed the identical control for its ratio band. -->
<script lang="ts">
  import {
    matrixTurnSpokenLabel,
    matrixTurnVisibleLabel,
  } from "$lib/shared/shape-matrix/domain/matrix-turn-band";
  import {
    keyToTurnValue,
    turnValueToKey,
    type TurnValue,
  } from "$lib/shared/create/services/level-turn-values";
  import ShapeMatrixAxisControl from "./ShapeMatrixAxisControl.svelte";
  import ShapeMatrixRibbonCell from "./ShapeMatrixRibbonCell.svelte";
  import ShapeMatrixValueScroller from "./ShapeMatrixValueScroller.svelte";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";

  interface Props {
    /** Ribbon: the header band. Tray: the compact detail sheet. */
    layout?: "ribbon" | "tray";
    onturn: (turn: TurnValue) => void;
  }
  let { layout = "ribbon", onturn }: Props = $props();

  const appState = getShapeMatrixAppContext();

  const turnControlLabel = $derived(
    appState.labelMode === "ratios" ? "VTG ratio" : "TKA turn"
  );
  const turnOptions = $derived([
    ...(appState.activeAxis === "both" &&
    appState.leftTurn !== appState.rightTurn
      ? [
          {
            value: "mixed",
            label: "Mixed axis values",
            shortLabel: "Mixed",
            disabled: true,
          },
        ]
      : []),
    ...appState.availableTurns.map((turn) => ({
      value: turnValueToKey(turn),
      label: matrixTurnSpokenLabel(turn, appState.labelMode),
      shortLabel: matrixTurnVisibleLabel(turn, appState.labelMode),
      tone:
        appState.activeAxis === "left"
          ? "blue"
          : appState.activeAxis === "right"
            ? "red"
            : "both",
    })),
  ]);
  const turnKeys = $derived(appState.availableTurns.map(turnValueToKey));
  const selectedTurnKey = $derived(
    appState.activeAxis === "both" && appState.leftTurn !== appState.rightTurn
      ? "mixed"
      : turnValueToKey(appState.activeTurn)
  );
</script>

<div class="turn-editor" class:tray={layout === "tray"}>
  <ShapeMatrixAxisControl {layout} steers="the turn control" />
  {#if appState.availableTurns.length === 1}
    <ShapeMatrixRibbonCell
      label={turnControlLabel}
      tray={layout === "tray"}
      keepLabel
    >
      <output
        class="fixed-turn-value"
        aria-label={`${turnControlLabel}: ${turnOptions[0]?.label ?? "Zero"}`}
      >
        {turnOptions[0]?.shortLabel ?? "0"}
        <span>Only value at Level 1</span>
      </output>
    </ShapeMatrixRibbonCell>
  {:else}
    <ShapeMatrixValueScroller
      label={turnControlLabel}
      options={turnOptions}
      keys={turnKeys}
      value={selectedTurnKey}
      onchange={(key) => {
        if (key !== "mixed") onturn(keyToTurnValue(key));
      }}
      {layout}
    />
  {/if}
</div>

<style>
  .turn-editor {
    --ribbon-control-h: 3.25rem;
    display: flex;
    flex: 0 1 auto;
    align-items: stretch;
    gap: 0.5rem;
    min-width: 0;
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

  /* The tray stacks the cells at their content width so the popover that holds
     it hugs the controls. */
  .turn-editor.tray {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  @container shape-matrix-app (max-width: 74.99rem) or (max-height: 41.99rem) {
    .turn-editor:not(.tray) {
      gap: 0.4rem;
    }
  }

  @container shape-matrix-app (max-width: 25rem) {
    .turn-editor:not(.tray) {
      overflow-x: auto;
      scrollbar-width: none;
    }

    .fixed-turn-value span {
      display: none;
    }
  }
</style>
