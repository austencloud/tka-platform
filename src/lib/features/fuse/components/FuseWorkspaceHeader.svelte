<script lang="ts">
  import HelpButton from "$lib/shared/components/help/HelpButton.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import { FUSE_LENGTHS, type FuseLength } from "../state/fuse-state.svelte";

  let { onHelp }: { onHelp: () => void } = $props();
  const { state } = getFuseContext();

  function isFuseLength(value: number): value is FuseLength {
    return (FUSE_LENGTHS as readonly number[]).includes(value);
  }

  function handleLengthChange(event: Event): void {
    const value = Number((event.currentTarget as HTMLSelectElement).value);
    if (isFuseLength(value)) void state.setLength(value);
  }
</script>

<header class="fuse-header">
  <div class="title-group">
    <p class="eyebrow">
      <span class="path-token blue-token">Blue</span>
      <i class="fas fa-plus" aria-hidden="true"></i>
      <span class="path-token red-token">Red</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
      <span class="path-token output-token">Combined</span>
    </p>
    <h2>Fuse two paths</h2>
    <p class="instruction">
      Set the length. Shuffle either path. The preview shows them together.
    </p>
  </div>

  <div class="header-controls">
    <label class="length-field">
      <span>Length</span>
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
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--settings-spacing-lg, 20px);
    padding: var(--settings-spacing-md, 16px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: var(--settings-radius-lg, 20px);
    background: var(--theme-panel-bg, rgba(12, 14, 22, 0.94));
  }

  .title-group {
    min-width: 0;
  }

  .eyebrow {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 0 0 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .eyebrow i {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.72;
  }

  .path-token {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    padding: 3px 8px;
    border: 1px solid color-mix(in srgb, var(--token-color) 42%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--token-color) 12%, transparent);
    color: color-mix(in srgb, var(--token-color) 78%, var(--theme-text, white));
  }

  .blue-token {
    --token-color: var(--prop-blue, #2196f3);
  }

  .red-token {
    --token-color: var(--prop-red, #f44336);
  }

  .output-token {
    --token-color: var(--semantic-warning, #f97316);
  }

  h2 {
    margin: 0;
    color: var(--theme-text, #fff);
    font-size: clamp(1.35rem, 3cqw, 1.9rem);
    font-weight: 750;
    letter-spacing: -0.025em;
  }

  .instruction {
    max-width: 660px;
    margin: 7px 0 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-min, 14px);
    line-height: 1.45;
  }

  .header-controls {
    display: flex;
    align-items: flex-end;
    gap: var(--settings-spacing-sm, 10px);
    flex-shrink: 0;
  }

  .length-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.66));
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
  }

  .select-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  select {
    width: 132px;
    min-height: var(--min-touch-target, 44px);
    padding: 0 36px 0 13px;
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

  .select-wrap i {
    position: absolute;
    right: 13px;
    pointer-events: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
  }

  @container fuse (max-width: 599px) {
    .fuse-header {
      flex-direction: column;
      align-items: stretch;
      gap: var(--settings-spacing-md, 14px);
      padding: 14px;
    }

    .eyebrow {
      flex-wrap: wrap;
    }

    .instruction {
      max-width: none;
    }

    .header-controls {
      align-items: flex-end;
    }

    .length-field,
    .select-wrap,
    select {
      width: 100%;
    }

    .length-field {
      flex: 1;
    }
  }

  @container fuse (max-width: 380px) {
    .path-token {
      padding-inline: 6px;
    }

    .eyebrow {
      gap: 5px;
      letter-spacing: 0.035em;
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
