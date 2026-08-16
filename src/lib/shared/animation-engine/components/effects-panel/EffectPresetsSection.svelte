<script lang="ts">
  import type { EffectPresetGroup } from "./presets/types";
  import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
  import EffectPresetThumbnail from "./EffectPresetThumbnail.svelte";
  import { createEffectLookPreview } from "./effect-look-preview";
  import { describeBloomLook } from "./thumbnails/bloom-look-copy";

  interface Props {
    presetGroup: EffectPresetGroup;
    activePresetId: string | null;
    /** Sentinel id for the synthetic Default chip (the factory default look). */
    defaultChipId?: string;
    /** Sentinel id for the synthetic Custom chip (your auto-captured look). */
    customChipId?: string;
    /** Render the Custom chip disabled (no custom captured yet). */
    customDisabled?: boolean;
    /** Trail's captured custom blue/red for the Custom chip preview (else null). */
    customColors?: { blue: string; red: string } | null;
    onSelectPreset: (presetId: string) => void;
    onCustomize?: () => void;
    effectLabel: string;
    accentColor: string;
    summary: string;
    /** Compact consumers already expose the raw controls directly. */
    showSummary?: boolean;
    showCustomize?: boolean;
  }

  const {
    presetGroup,
    activePresetId,
    defaultChipId,
    customChipId,
    customDisabled = false,
    customColors = null,
    onSelectPreset,
    onCustomize,
    effectLabel,
    accentColor,
    summary,
    showSummary = true,
    showCustomize = true,
  }: Props = $props();

  // Trail's Default IS the colour-matched factory blue/red, so its Default chip
  // shows those dots instead of the generic accent dot. Static (the factory look),
  // not the live config — Default always reads as the matched red/blue.
  const trailDefaultColors = $derived(
    presetGroup.effectType === "trails"
      ? {
          blue: DEFAULT_EFFECTS_CONFIG.trails.blueColor,
          red: DEFAULT_EFFECTS_CONFIG.trails.redColor,
        }
      : null
  );

  const presetModels = $derived(
    presetGroup.presets.map((preset) => {
      const preview = createEffectLookPreview(presetGroup.effectType, preset);
      return {
        preset,
        preview,
        description:
          presetGroup.effectType === "bloom"
            ? (describeBloomLook(preset.id) ?? preview.trait)
            : preview.trait,
      };
    })
  );
</script>

<div class="presets-section">
  <span class="section-label">Looks</span>

  <div
    class="look-choices"
    role="radiogroup"
    aria-label="Choose a {effectLabel} look"
  >
    {#if presetModels.length > 0}
      <div class="preset-grid">
        {#each presetModels as item (item.preset.id)}
          {@const isActive = item.preset.id === activePresetId}
          <button
            class="preset-card"
            class:active={isActive}
            type="button"
            role="radio"
            aria-checked={isActive}
            style:--card-accent={accentColor}
            onclick={() => onSelectPreset(item.preset.id)}
          >
            <div class="preview-area">
              <EffectPresetThumbnail
                effectType={presetGroup.effectType}
                preset={item.preset}
                legacyModel={item.preview}
                active={isActive}
              />
            </div>
            <span class="preset-name">{item.preset.name}</span>
            <span class="preset-trait">{item.description}</span>
          </button>
        {/each}
      </div>
    {/if}

    {#if defaultChipId || customChipId}
      <div class="anchor-grid">
        {#if defaultChipId}
          {@const isDefaultActive = activePresetId === defaultChipId}
          <button
            class="anchor-card"
            class:active={isDefaultActive}
            type="button"
            role="radio"
            aria-checked={isDefaultActive}
            style:--card-accent={accentColor}
            onclick={() => onSelectPreset(defaultChipId)}
          >
            <span class="anchor-mark" aria-hidden="true">
              {#if trailDefaultColors}
                <span class="dual-dots">
                  <span class="dot" style:background={trailDefaultColors.blue}
                  ></span>
                  <span class="dot" style:background={trailDefaultColors.red}
                  ></span>
                </span>
              {:else}
                <i class="fas fa-rotate-left"></i>
              {/if}
            </span>
            <span class="anchor-copy">
              <span class="anchor-name">Original</span>
              <span class="anchor-description">Factory settings</span>
            </span>
          </button>
        {/if}

        {#if customChipId}
          {@const isCustomActive = activePresetId === customChipId}
          <button
            class="anchor-card"
            class:active={isCustomActive}
            class:disabled={customDisabled}
            type="button"
            role="radio"
            aria-checked={isCustomActive}
            disabled={customDisabled}
            style:--card-accent={accentColor}
            onclick={() => onSelectPreset(customChipId)}
          >
            <span class="anchor-mark" aria-hidden="true">
              {#if customColors}
                <span class="dual-dots">
                  <span class="dot" style:background={customColors.blue}></span>
                  <span class="dot" style:background={customColors.red}></span>
                </span>
              {:else}
                <i class="fas fa-wand-magic-sparkles"></i>
              {/if}
            </span>
            <span class="anchor-copy">
              <span class="anchor-name">Your look</span>
              <span class="anchor-description">
                {customDisabled
                  ? "Tune anything to create"
                  : "Updates as controls move"}
              </span>
            </span>
          </button>
        {/if}
      </div>
    {/if}
  </div>

  {#if showSummary}
    <div class="summary-row">
      <span class="summary-label">Current</span>
      <span class="summary-text">{summary}</span>
    </div>
  {/if}

  {#if showCustomize && onCustomize}
    <button
      class="customize-btn"
      type="button"
      style:--btn-accent={accentColor}
      onclick={onCustomize}
    >
      Customize {effectLabel} Settings
    </button>
  {/if}
</div>

<style>
  .presets-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    container: looks / inline-size;
  }

  .section-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--theme-text, white);
  }

  .look-choices {
    display: grid;
    gap: 8px;
  }

  .preset-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .preset-card {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 5px;
    min-width: 0;
    min-height: 0;
    padding: 9px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
    cursor: pointer;
    transition:
      transform var(--duration-fast, 100ms) ease,
      border-color var(--duration-fast, 100ms) ease,
      background var(--duration-fast, 100ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .preset-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    transform: translateY(-1px);
  }

  .preset-card.active {
    border-color: var(--card-accent);
    background: color-mix(in srgb, var(--card-accent) 8%, transparent);
  }

  .preset-card:focus-visible {
    outline: 2px solid var(--card-accent, var(--theme-accent, #8b5cf6));
    outline-offset: 2px;
  }

  .preview-area {
    width: 100%;
    aspect-ratio: 8 / 3;
  }

  .preview-area :global(.look-preview) {
    height: 100%;
    aspect-ratio: auto;
  }

  .preset-name {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, white);
    text-align: left;
    line-height: 1.2;
  }

  .preset-trait {
    min-width: 0;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-align: left;
    line-height: 1.25;
  }

  .anchor-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .anchor-card {
    min-width: 0;
    min-height: 58px;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 8px 10px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
    cursor: pointer;
    text-align: left;
  }

  .anchor-card.active {
    border-color: var(--card-accent);
    background: color-mix(in srgb, var(--card-accent) 8%, transparent);
  }

  .anchor-card.disabled {
    opacity: 0.48;
    cursor: not-allowed;
  }

  .anchor-card:focus-visible {
    outline: 2px solid var(--card-accent, var(--theme-accent, #8b5cf6));
    outline-offset: 2px;
  }

  .anchor-mark {
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    background: color-mix(in srgb, var(--card-accent) 10%, transparent);
    color: var(--card-accent);
  }

  .anchor-copy {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .anchor-name {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
  }

  .anchor-description {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
  }

  .dual-dots {
    display: inline-flex;
    gap: 3px;
  }

  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    box-shadow: 0 0 5px currentColor;
  }

  .summary-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    padding: 7px 9px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
  }

  .summary-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    color: var(--theme-text, white);
  }

  .summary-text {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .customize-btn {
    width: 100%;
    min-height: 44px;
    padding: 10px 16px;
    border: 1.5px solid color-mix(in srgb, var(--btn-accent) 40%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, var(--btn-accent) 8%, transparent);
    color: var(--btn-accent);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--duration-fast, 100ms) ease,
      border-color var(--duration-fast, 100ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .customize-btn:hover {
    background: color-mix(in srgb, var(--btn-accent) 14%, transparent);
    border-color: color-mix(in srgb, var(--btn-accent) 60%, transparent);
  }

  .customize-btn:focus-visible {
    outline: 2px solid var(--btn-accent);
    outline-offset: 2px;
  }

  @container looks (min-width: 30rem) {
    .preset-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .anchor-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  @container looks (min-width: 42rem) {
    .preset-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .preset-card,
    .customize-btn {
      transition: none;
    }
  }
</style>
