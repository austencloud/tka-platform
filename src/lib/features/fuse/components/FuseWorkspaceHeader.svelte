<script lang="ts">
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import { FUSE_LENGTHS, type FuseLength } from "../state/fuse-state.svelte";

  let {
    compact = false,
  }: {
    compact?: boolean;
  } = $props();
  const { state } = getFuseContext();

  function isFuseLength(value: number): value is FuseLength {
    return (FUSE_LENGTHS as readonly number[]).includes(value);
  }

  // SegmentedControl works over string values, so stringify the numeric
  // FUSE_LENGTHS and parse back on select. Every option carries the same
  // disabled flag while a length is loading or a fuse is in flight —
  // SegmentedControl has no whole-control disabled, so it's per-option.
  const lengthOptions = $derived(
    FUSE_LENGTHS.map((length) => ({
      value: String(length),
      label: String(length),
      disabled: state.isLoadingLength || state.isFusing,
    })),
  );

  function handleLengthSelect(value: string): void {
    const num = Number(value);
    if (isFuseLength(num)) void state.setLength(num);
  }
</script>

<header class="fuse-header" class:compact>
  {#if compact}
    <div class="sr-only">
      <h2>Fuse two paths</h2>
      <p>Shuffle Blue or Red, then Fuse.</p>
    </div>
  {:else}
    <h2>Fuse two paths</h2>
  {/if}

  <div class="header-controls">
    <div class="length-field" role="group" aria-label="Length in steps">
      <SegmentedControl
        options={lengthOptions}
        value={String(state.requestedLength)}
        onchange={handleLengthSelect}
        color="accent"
        size="sm"
      />
    </div>
  </div>
</header>

<style>
  .fuse-header {
    grid-area: header;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--settings-spacing-md, 14px);
    min-height: var(--min-touch-target, 48px);
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 14px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: var(--settings-radius-lg, 20px);
    background: var(--theme-panel-bg, rgba(12, 14, 22, 0.94));
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }

  h2 {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--theme-text, #fff);
    font-size: clamp(1.05rem, 2.2cqw, 1.35rem);
    font-weight: 750;
    letter-spacing: -0.02em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-sm, 10px);
    flex-shrink: 0;
  }

  .length-field {
    display: flex;
    /* Enough room for all 7 segments inline on desktop; min-width:0 lets it
       shrink before overflowing. Segment digits (2, 4, … 32) stay tabular. */
    width: 24rem;
    min-width: 0;
    font-variant-numeric: tabular-nums;
  }

  .length-field :global(.segmented-control) {
    width: 100%;
  }

  @container fuse (max-width: 599px) {
    .fuse-header.compact {
      min-height: var(--min-touch-target, 48px);
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
    }

    .compact .header-controls {
      width: 100%;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--settings-spacing-sm, 8px);
    }

    /* Only the length segments remain in the compact header (playback is a
       canvas tap now; no transport or help button), so give them the full row. */
    .compact .length-field {
      width: 100%;
      flex-basis: 100%;
    }
  }
</style>
