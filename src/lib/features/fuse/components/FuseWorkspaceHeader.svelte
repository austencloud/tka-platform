<script lang="ts">
  import TransportControls from "$lib/shared/animation-engine/components/controls/TransportControls.svelte";
  import HelpButton from "$lib/shared/components/help/HelpButton.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import { FUSE_LENGTHS, type FuseLength } from "../state/fuse-state.svelte";

  let {
    onHelp,
    compact = false,
  }: {
    onHelp: () => void;
    compact?: boolean;
  } = $props();
  const { state } = getFuseContext();

  function isFuseLength(value: number): value is FuseLength {
    return (FUSE_LENGTHS as readonly number[]).includes(value);
  }

  function handleLengthChange(event: Event): void {
    const value = Number((event.currentTarget as HTMLSelectElement).value);
    if (isFuseLength(value)) void state.setLength(value);
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
    <label class="length-field">
      <span class="sr-only">Length</span>
      <span class="select-wrap">
        <select
          value={state.requestedLength}
          onchange={handleLengthChange}
          disabled={state.isLoadingLength || state.isFusing}
        >
          {#each FUSE_LENGTHS as length}
            <option value={length}>{length} steps</option>
          {/each}
        </select>
        <i class="fas fa-chevron-down" aria-hidden="true"></i>
      </span>
    </label>

    {#if compact}
      <TransportControls
        isPlaying={state.clockRunning}
        disabled={!state.previewSequence || state.isFusing}
        onPlaybackToggle={() => state.toggleClock()}
      />
    {/if}

    <HelpButton
      onclick={onHelp}
      ariaLabel="How Fuse works"
      title="How Fuse works"
    />
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
    min-width: 0;
  }

  .select-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  select {
    width: 122px;
    min-height: var(--min-touch-target, 44px);
    padding: 0 34px 0 13px;
    appearance: none;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: var(--settings-radius-md, 12px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #fff);
    font: inherit;
    font-size: var(--font-size-min, 14px);
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }

  select:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  select:focus-visible {
    outline: 2px solid var(--theme-accent, currentColor);
    outline-offset: 2px;
  }

  .select-wrap i {
    position: absolute;
    right: 13px;
    pointer-events: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
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
      justify-content: flex-end;
      gap: var(--settings-spacing-sm, 8px);
    }

    .compact .length-field {
      width: min(38cqw, 152px);
      margin-right: auto;
    }

    .compact .select-wrap,
    .compact select {
      width: 100%;
    }

    .compact .header-controls :global(.help-button:focus-visible) {
      outline: 2px solid var(--theme-text, #fff);
      outline-offset: 2px;
    }

    .compact .header-controls :global(.help-button) {
      border-color: var(--theme-stroke, rgba(255, 255, 255, 0.14));
      background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
      color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .compact .header-controls :global(.help-button:hover) {
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.24));
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.09));
      color: var(--theme-text, #fff);
    }
  }

  @media (forced-colors: active) {
    select {
      appearance: auto;
    }

    .select-wrap i {
      display: none;
    }
  }
</style>
