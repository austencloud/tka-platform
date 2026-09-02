<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixTurnControls.svelte
  The one turn editor for the Shape Matrix app: the Apply-to axis control
  (Left / Both / Right) and the cumulative, level-appropriate turn control in
  the current label system. The matrix ribbon and the compact detail tray
  both present this component; only where the edit navigates differs, and
  the host decides that through `onturn`. -->
<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import { ratioLabel } from "$lib/shared/shape-matrix/domain/flower-signature";
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
    if (turn === "fl") return "Float";
    return labelMode === "ratios" ? ratioLabel(turn) : String(turn);
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
      const turnLabel =
        turn === "fl"
          ? "Float"
          : appState.labelMode === "ratios"
            ? `${ratioLabel(turn)} ratio`
            : `${turn} turn${turn === 1 ? "" : "s"}`;
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
  <div class="control-cell turn-scroller themed-scrollbar-accent">
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
        style="--turn-option-count: {turnOptions.length}; --turn-columns: {trayColumns ??
          turnOptions.length}"
      >
        <SegmentedControl
          options={turnOptions}
          value={selectedTurnKey}
          onchange={(key: string) => {
            if (key !== "mixed") onturn(keyToTurnValue(key));
          }}
          columns={trayColumns}
          size={trayColumns ? "md" : "sm"}
          density={trayColumns ? "standard" : "tight"}
          color="accent"
          semantics="radiogroup"
          ariaLabel={turnControlLabel}
        />
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

  .turn-scroller {
    flex: 0 1 auto;
    min-width: 0;
    overflow-x: auto;
    scrollbar-gutter: stable;
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
    /* Compact ribbons trade the captions for canvas; the tray keeps them. */
    .turn-editor:not(.tray) .control-label {
      display: none;
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
