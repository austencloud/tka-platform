<script lang="ts">
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import { FUSE_TRANSFORMS } from "../state/fuse-state.svelte";
  import FuseLengthPicker from "./FuseLengthPicker.svelte";

  let {
    compact = false,
    onOpenOptions = () => {},
  }: {
    compact?: boolean;
    onOpenOptions?: () => void;
  } = $props();
  const { state: fuseState } = getFuseContext();

  const compactModeLabel = $derived.by(() => {
    if (fuseState.mode === "shuffle") return "Independent";
    const transformLabel =
      FUSE_TRANSFORMS.find(
        (transform) => transform.id === fuseState.transformId
      )?.label ?? "Mirror";
    return `Symmetry · ${transformLabel}`;
  });
  const optionsDisabled = $derived(
    fuseState.isLoadingLength || fuseState.isFusing
  );
</script>

<header class="fuse-header" class:compact>
  {#if compact}
    <div class="sr-only">
      <h2>Fuse two paths</h2>
      <p>Generate or adjust either one-hand LOOP, then Fuse.</p>
    </div>

    <div class="compact-summary" aria-label="Current Fuse options">
      <span class="summary-length">{fuseState.requestedLength} steps</span>
      <span class="summary-separator" aria-hidden="true">·</span>
      <span class="summary-mode">{compactModeLabel}</span>
    </div>

    <div class="options-trigger">
      <PanelButton
        variant="secondary"
        disabled={optionsDisabled}
        onclick={onOpenOptions}
      >
        <i class="fas fa-sliders" aria-hidden="true"></i>
        Options
      </PanelButton>
    </div>
  {:else}
    <h2>Fuse two paths</h2>
    <div class="header-controls">
      <div class="length-field">
        <FuseLengthPicker />
      </div>
    </div>
  {/if}
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

  .compact-summary {
    display: flex;
    align-items: baseline;
    flex: 1 1 auto;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    white-space: nowrap;
  }

  .summary-length {
    flex: 0 0 auto;
    font-variant-numeric: tabular-nums;
  }

  .summary-separator {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .summary-mode {
    min-width: 0;
    overflow: hidden;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-weight: 600;
    text-overflow: ellipsis;
  }

  .options-trigger {
    flex: 0 0 auto;
  }

  .options-trigger :global(.panel-btn) {
    min-width: 112px;
    padding-inline: 14px;
    border-color: color-mix(
      in srgb,
      var(--semantic-warning, #f97316) 45%,
      var(--theme-stroke, transparent)
    );
    border-radius: var(--settings-radius-md, 12px);
    background: color-mix(
      in srgb,
      var(--semantic-warning, #f97316) 12%,
      var(--theme-card-bg, #161821)
    );
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
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
      padding: 0 0 0 var(--settings-spacing-sm, 8px);
      border-color: color-mix(
        in srgb,
        var(--semantic-warning, #f97316) 22%,
        var(--theme-stroke, transparent)
      );
      border-radius: var(--settings-radius-md, 14px);
      background: color-mix(
        in srgb,
        var(--theme-panel-bg, #0c0e16) 88%,
        transparent
      );
    }
  }

  @container fuse (min-width: 1680px) and (min-height: 900px) {
    .fuse-header {
      min-height: 72px;
      padding-inline: 20px;
    }

    h2 {
      font-size: 1.65rem;
    }

    .length-field {
      width: 31rem;
    }
  }
</style>
