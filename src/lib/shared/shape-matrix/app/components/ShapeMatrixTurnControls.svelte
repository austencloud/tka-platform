<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixTurnControls.svelte
  The one turn editor for the Shape Matrix app: the Apply-to axis control
  (Left / Both / Right) and the cumulative, level-appropriate turn control in
  the current label system. The matrix ribbon and the compact detail tray
  both present this component; only where the edit navigates differs, and
  the host decides that through `onturn`. -->
<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import {
    matrixTurnSpokenLabel,
    matrixTurnVisibleLabel,
  } from "$lib/shared/shape-matrix/domain/matrix-turn-band";
  import {
    keyToTurnValue,
    turnValueToKey,
    type TurnValue,
  } from "$lib/shared/create/services/level-turn-values";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";
  import type { ShapeMatrixAxisTarget } from "../state/shape-matrix-app-state.svelte";

  interface Props {
    /** Ribbon: the header band. Tray: the compact detail sheet. */
    layout?: "ribbon" | "tray";
    onturn: (turn: TurnValue) => void;
  }
  let { layout = "ribbon", onturn }: Props = $props();

  const appState = getShapeMatrixAppContext();

  const AXIS_OPTIONS = [
    {
      value: "left" as const,
      label: "Left-hand rows",
      shortLabel: "Left",
      tone: "blue" as const,
    },
    {
      value: "both" as const,
      label: "Both axes",
      shortLabel: "Both",
      tone: "both" as const,
    },
    {
      value: "right" as const,
      label: "Right-hand columns",
      shortLabel: "Right",
      tone: "red" as const,
    },
  ];

  function turnVisibleLabel(
    turn: TurnValue,
    labelMode: "turns" | "ratios"
  ): string {
    return matrixTurnVisibleLabel(turn, labelMode);
  }

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
    ...appState.availableTurns.map((turn) => {
      const key = turnValueToKey(turn);
      const turnLabel = matrixTurnSpokenLabel(turn, appState.labelMode);
      return {
        value: key,
        label: turnLabel,
        shortLabel: turnVisibleLabel(turn, appState.labelMode),
        tone:
          appState.activeAxis === "left"
            ? "blue"
            : appState.activeAxis === "right"
              ? "red"
              : "both",
      };
    }),
  ]);
  const selectedTurnKey = $derived(
    appState.activeAxis === "both" && appState.leftTurn !== appState.rightTurn
      ? "mixed"
      : turnValueToKey(appState.activeTurn)
  );

  /*
   * A first-time viewer reads this row as a caption on the grid rather than as
   * the thing that CHANGES the grid, and concludes the app is one 4x4 matrix.
   * Three signals correct that: a position readout that admits how many
   * matrices there are, steppers that are unmistakably buttons and walk the
   * list one at a time, and segment chrome so the unselected values look
   * pressable instead of printed.
   */
  const turnKeys = $derived(appState.availableTurns.map(turnValueToKey));
  const turnCount = $derived(turnKeys.length);
  const turnIndex = $derived(turnKeys.indexOf(turnValueToKey(appState.activeTurn)));
  const showStepper = $derived(layout === "ribbon" && turnCount > 1);

  function stepTurn(delta: number): void {
    const next = turnIndex + delta;
    if (turnIndex < 0 || next < 0 || next >= turnCount) return;
    onturn(appState.availableTurns[next]);
  }

  /*
   * Stepping past the viewport edge must bring its value into view, or the
   * button appears to do nothing on the values that are currently clipped.
   */
  let viewport = $state<HTMLDivElement | null>(null);
  $effect(() => {
    const key = selectedTurnKey;
    const host = viewport;
    if (!host || key === "mixed") return;
    const index = turnKeys.indexOf(key);
    const segment = host.querySelectorAll<HTMLElement>(".segment")[index];
    segment?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
      inline: "nearest",
    });
  });

  /*
   * Level 3 lists eight values and Level 4 lists fourteen. One row of those in
   * a popover is a long thin scroller: the values run off the edge, and the
   * ones still on screen are the narrowest, hardest targets in the app. The
   * tray wraps them onto two rows and spends the room it saves on full-size
   * segments. The ribbon has real width on a wide screen, so it keeps one row.
   */
  const TRAY_SINGLE_ROW_LIMIT = 6;
  /** The narrowest a wrapped segment may get, holding the touch-target floor. */
  const TRAY_MIN_SEGMENT_PX = 48;
  /*
   * The popover is portalled and sized by its own content, so its box cannot
   * say how much room the row has. The window can: the popover caps itself at
   * the viewport less its collision padding.
   */
  let viewportWidth = $state(1280);
  const trayColumns = $derived.by(() => {
    if (layout !== "tray") return undefined;
    const count = turnOptions.length;
    if (count <= TRAY_SINGLE_ROW_LIMIT) return undefined;
    const room = Math.max(
      2,
      Math.floor((viewportWidth - 44) / TRAY_MIN_SEGMENT_PX)
    );
    const twoRows = Math.ceil(count / 2);
    if (room >= twoRows) return twoRows;
    // A phone cannot hold seven full-size segments side by side, so it takes a
    // third row rather than shrink them under the floor.
    const rows = Math.min(4, Math.ceil(count / room));
    return Math.ceil(count / rows);
  });
</script>

<svelte:window bind:innerWidth={viewportWidth} />

<div class="turn-editor" class:tray={layout === "tray"}>
  <div class="control-cell axis-control">
    <span class="control-label">Apply to</span>
    <SegmentedControl
      options={AXIS_OPTIONS}
      value={appState.activeAxis}
      onchange={(axis: ShapeMatrixAxisTarget) => appState.setActiveAxis(axis)}
      size="sm"
      density="tight"
      color="accent"
      semantics="radiogroup"
      ariaLabel="Axis edited by the turn control"
    />
  </div>
  <div class="control-cell turn-cell">
    <span class="control-label">
      {turnControlLabel}
      {#if showStepper && turnIndex >= 0}
        <span class="turn-position">{turnIndex + 1} of {turnCount}</span>
      {/if}
    </span>
    {#if appState.availableTurns.length === 1}
      <output
        class="fixed-turn-value"
        aria-label={`${turnControlLabel}: ${turnOptions[0]?.label ?? "Zero"}`}
      >
        {turnOptions[0]?.shortLabel ?? "0"}
        <span>Only value at Level 1</span>
      </output>
    {:else}
      <div class="turn-row">
        {#if showStepper}
          <button
            type="button"
            class="turn-step"
            onclick={() => stepTurn(-1)}
            disabled={turnIndex <= 0}
            aria-label={`Previous ${turnControlLabel.toLowerCase()}`}
          >
            <i class="fas fa-chevron-left" aria-hidden="true"></i>
          </button>
        {/if}
        <div
          class="turn-viewport themed-scrollbar-accent"
          bind:this={viewport}
        >
          <div
            class="turn-control"
            style="--turn-option-count: {turnOptions.length}; --turn-columns: {trayColumns ??
              turnOptions.length}"
          >
            <!-- The turn value is read and chosen, not a caption, so it keeps
                 the 14px essential-text step in both layouts. Tight density is
                 what keeps fifteen of them on one line. -->
            <SegmentedControl
              options={turnOptions}
              value={selectedTurnKey}
              onchange={(key: string) => {
                if (key !== "mixed") onturn(keyToTurnValue(key));
              }}
              columns={trayColumns}
              size="md"
              density={trayColumns ? "standard" : "tight"}
              color="accent"
              semantics="radiogroup"
              ariaLabel={turnControlLabel}
            />
          </div>
        </div>
        {#if showStepper}
          <button
            type="button"
            class="turn-step"
            onclick={() => stepTurn(1)}
            disabled={turnIndex < 0 || turnIndex >= turnCount - 1}
            aria-label={`Next ${turnControlLabel.toLowerCase()}`}
          >
            <i class="fas fa-chevron-right" aria-hidden="true"></i>
          </button>
        {/if}
      </div>
    {/if}
  </div>
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

  /* The bento cell: a caption row over its control, each cell carrying its
     own card chrome, matching the ribbon's level and notation cells. */
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

  .control-label {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.52));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .axis-control {
    flex: 0 0 auto;
  }

  /* SegmentedControl's sliding indicator assumes equal-width segments, so
     the wrapper hands it a definite width sized to its longest label. */
  .axis-control :global(.segmented-control) {
    width: 9.75rem;
  }

  .turn-cell {
    flex: 0 1 auto;
    min-width: 0;
  }

  /* The caption carries the count. "1 of 14" is the whole correction: it says
     out loud that the grid on screen is one of fourteen, which the row of
     values alone never managed to. */
  .control-label {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
  }

  .turn-position {
    color: color-mix(in srgb, var(--theme-accent, #f59e0b) 82%, #fff);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    text-transform: none;
  }

  .turn-row {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    min-width: 0;
  }

  /* Only the values scroll. The steppers sit outside the scrolling box so
     they stay reachable at both ends of a fourteen-value list. */
  .turn-viewport {
    min-width: 0;
    overflow-x: auto;
    scrollbar-gutter: stable;
  }

  .turn-editor.tray .turn-viewport {
    overflow: visible;
    scrollbar-gutter: auto;
  }

  .turn-step {
    display: inline-flex;
    flex: 0 0 auto;
    width: var(--min-touch-target, 44px);
    min-width: var(--min-touch-target, 44px);
    align-self: stretch;
    min-height: var(--min-touch-target, 44px);
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.16));
    border-radius: 8px;
    background: color-mix(in srgb, var(--theme-text, #fff) 6%, transparent);
    color: var(--theme-text, #fff);
    font-size: 0.8rem;
    cursor: pointer;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast);
  }

  .turn-step:hover:not(:disabled) {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 62%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 16%,
      transparent
    );
  }

  .turn-step:disabled {
    opacity: 0.34;
    cursor: default;
  }

  /* Unselected values were bare text on the panel, which reads as a printed
     scale rather than a row of buttons. A hairline and a lifted ground make
     each one look pressable; the selected indicator still outranks them. */
  .turn-editor:not(.tray) .turn-control :global(.segment:not(.selected)) {
    border-radius: 8px;
    background: color-mix(in srgb, var(--theme-text, #fff) 4%, transparent);
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--theme-text, #fff) 11%, transparent);
  }

  .turn-editor:not(.tray)
    .turn-control
    :global(.segment:not(.selected):hover) {
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 14%,
      transparent
    );
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--theme-accent, #f59e0b) 45%, transparent);
  }

  .turn-control {
    width: min(100%, calc(var(--turn-option-count, 4) * 3rem));
    justify-self: start;
    /* Level changes rewrite the option count, so the control's width is an
       intentional structural change: ease it instead of snapping. */
    transition: width var(--transition-normal);
  }

  /* Ribbon only: the row is allowed to grow past its cell and scroll. In the
     tray the same floor would force a fourteen-value palette to 42rem, which
     is what made the popover a horizontal scroller. */
  .turn-editor:not(.tray) .turn-control :global(.segmented-control) {
    min-width: calc(var(--count) * 3rem);
    /* The segments carry their own chrome now, so the group's own track would
       double the border under every value. */
    gap: 0.2rem;
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

  /* The tray stacks the two cells at their content width so the popover
     that holds it hugs the controls; captions always show. */
  .turn-editor.tray {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  .turn-editor.tray .control-cell {
    justify-items: start;
    padding: 0.5rem 0.6rem 0.55rem;
  }

  /* Sized by COLUMNS, not by option count, and capped so the popover it sits
     in still fits a 375px phone beside its own padding. */
  .turn-editor.tray .turn-control {
    width: min(
      calc(100vw - 2.75rem),
      calc(var(--turn-columns, 4) * 3.4rem)
    );
    max-width: 100%;
  }

  @container shape-matrix-app (max-width: 74.99rem) or (max-height: 41.99rem) {
    /* Compact ribbons trade the captions for canvas; the tray keeps them.
       The count survives on its own, since it is the signal a narrow header
       can least afford to drop. */
    .turn-editor:not(.tray) .control-label {
      font-size: 0;
      gap: 0;
    }

    .turn-editor:not(.tray) .control-cell:not(.turn-cell) .control-label {
      display: none;
    }

    .turn-editor:not(.tray) .turn-position {
      font-size: var(--font-size-compact, 0.75rem);
    }

    .turn-editor:not(.tray) .control-cell {
      gap: 0;
      padding: 0.25rem 0.35rem;
      border-radius: 10px;
    }

    .turn-editor:not(.tray) {
      gap: 0.4rem;
    }
  }

  @container shape-matrix-app (max-width: 25rem) {
    .turn-editor:not(.tray) {
      overflow-x: auto;
      scrollbar-width: none;
    }

    /* The vertical stack has room for captions again, and a first-time
       phone viewer needs them more than anyone. */
    .turn-editor:not(.tray) .control-label {
      display: inline;
    }

    .turn-editor:not(.tray) .control-cell {
      gap: 0.25rem;
      padding: 0.35rem 0.45rem 0.45rem;
    }

    .fixed-turn-value span {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .turn-control {
      transition: none;
    }
  }
</style>
