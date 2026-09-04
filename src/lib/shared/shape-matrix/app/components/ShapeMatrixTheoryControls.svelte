<!-- Both ratios form one instrument. Each entry owns its fields; this parent
     owns the relationship between them so copy actions can name both their
     source and destination. -->
<script lang="ts">
  import { spinRatioKey } from "@vtg/domain";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { theoryRatioLabel } from "$lib/shared/shape-matrix/domain/theory-ratio";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";
  import ShapeMatrixRatioEntry from "./ShapeMatrixRatioEntry.svelte";

  interface Props {
    layout?: "ribbon" | "tray";
    onfocuschange?: (hand: "left" | "right" | null) => void;
  }
  let { layout = "ribbon", onfocuschange }: Props = $props();

  const appState = getShapeMatrixAppContext();
  const leftLabel = $derived(theoryRatioLabel(appState.theoryLeftRatio));
  const rightLabel = $derived(theoryRatioLabel(appState.theoryRightRatio));
  const ratiosMatch = $derived(
    spinRatioKey(appState.theoryLeftRatio) ===
      spinRatioKey(appState.theoryRightRatio)
  );

  function copyRowsToColumns(): void {
    appState.setTheoryRatios(
      appState.theoryLeftRatio,
      appState.theoryLeftRatio
    );
  }

  function copyColumnsToRows(): void {
    appState.setTheoryRatios(
      appState.theoryRightRatio,
      appState.theoryRightRatio
    );
  }
</script>

<section
  class="theory-builder"
  class:tray={layout === "tray"}
  aria-label="Theory ratio editor. Enter whole numbers from 0 through 15."
>
  <ShapeMatrixRatioEntry hand="left" {layout} {onfocuschange} />

  <div class="ratio-transfer">
    <Crossfade
      key={ratiosMatch ? "matched" : "different"}
      fill={layout === "ribbon"}
      animateHeight={layout === "tray"}
    >
      {#if ratiosMatch}
        <div class="match-state" role="status">
          <span class="match-check" aria-hidden="true">✓</span>
          <span>Rows and columns use <strong>{leftLabel}</strong></span>
        </div>
      {:else}
        <div class="copy-actions">
          <PanelButton
            fullWidth
            ariaLabel={`Set right-hand columns to ${leftLabel}, matching left-hand rows`}
            onclick={copyRowsToColumns}
          >
            <strong class="left-value">{leftLabel}</strong>
            <span class="direction-arrow" aria-hidden="true">→</span>
            <span class="right-destination">columns</span>
          </PanelButton>
          <PanelButton
            fullWidth
            ariaLabel={`Set left-hand rows to ${rightLabel}, matching right-hand columns`}
            onclick={copyColumnsToRows}
          >
            <span class="left-destination">rows</span>
            <span class="direction-arrow" aria-hidden="true">←</span>
            <strong class="right-value">{rightLabel}</strong>
          </PanelButton>
        </div>
      {/if}
    </Crossfade>
  </div>

  <ShapeMatrixRatioEntry hand="right" {layout} {onfocuschange} />
</section>

<style>
  .theory-builder {
    display: grid;
    grid-template-columns: max-content 20.5rem max-content;
    align-items: start;
    width: fit-content;
    max-width: 100%;
    gap: 0.65rem;
  }

  /* The transfer controls align with the editable values, while validation
     can expand beneath either ratio without dragging its neighbour downward. */
  .ratio-transfer {
    width: 20.5rem;
    height: var(--min-touch-target, 44px);
    margin-top: 2.65rem;
  }

  .copy-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.4rem;
    width: 100%;
    height: 100%;
  }

  .copy-actions :global(.panel-btn) {
    padding-inline: 0.65rem;
    border-color: var(--theme-stroke-strong, rgb(255 255 255 / 0.2));
    background: color-mix(in srgb, var(--theme-text, #fff) 5%, transparent);
    white-space: nowrap;
  }

  .copy-actions :global(.panel-btn:hover) {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 55%,
      transparent
    );
  }

  .copy-actions strong,
  .match-state strong {
    font-variant-numeric: tabular-nums;
  }

  .direction-arrow {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.72));
    font-size: 1rem;
  }

  .left-value,
  .left-destination {
    color: var(--prop-blue-text, #818cf8);
  }

  .right-value,
  .right-destination {
    color: var(--prop-red-text, #f87171);
  }

  .match-state {
    display: flex;
    width: 100%;
    height: var(--min-touch-target, 44px);
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.72));
    font-size: var(--font-size-min, 0.875rem);
  }

  .match-check {
    color: var(--semantic-success, #22c55e);
    font-size: 1rem;
    font-weight: 800;
  }

  .match-state strong {
    color: var(--theme-text, #fff);
  }

  .theory-builder.tray {
    grid-template-columns: minmax(0, 1fr);
    /* Leave room for the popover's padding and collision gutter at phone
       widths; the fixed cap keeps wider compact layouts content-sized. */
    width: min(21rem, calc(100vw - 3rem));
    gap: 0.45rem;
  }

  .theory-builder.tray .ratio-transfer {
    width: 100%;
    height: auto;
    margin-top: 0;
  }

  .theory-builder.tray .copy-actions {
    height: var(--min-touch-target, 44px);
  }
</style>
