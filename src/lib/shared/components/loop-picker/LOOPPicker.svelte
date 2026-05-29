<!--
  LOOPPicker.svelte - Unified LOOP Selection Component

  Reusable component for selecting LOOP patterns to extend a sequence.
  Used by both Spell tab and Sequence Actions Extend feature.

  Features:
  - Responsive 2-3 column grid layout
  - 60px touch targets for accessibility
  - Direct LOOP options (no bridge letter needed)
  - Bridge letter options (when position groups don't match)
  - Immediate action on click (no selection state)
-->
<script lang="ts">
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import type { LOOPOption } from "../../../features/create/shared/services/loop-validator";
  import type { CircularizationOption } from "$lib/shared/create/domain/spell-models";
  import type { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import { slide } from "svelte/transition";

  interface Props {
    /** Direct LOOP options (no bridge letter needed) */
    directOptions: LOOPOption[];
    /** Bridge letter options (when position groups don't match) */
    circularizationOptions?: CircularizationOption[];
    /** Called when user clicks a LOOP option */
    onSelect: (bridgeLetter: Letter | null, loopType: LOOPType) => void;
    /** Reason why direct LOOPs aren't available (optional info text) */
    directUnavailableReason?: string | null;
    /** Whether an action is in progress */
    isApplying?: boolean;
  }

  let {
    directOptions,
    circularizationOptions = [],
    onSelect,
    directUnavailableReason = null,
    isApplying = false,
  }: Props = $props();

  // Derived state
  const hasDirectOptions = $derived(directOptions.length > 0);
  const hasBridgeOptions = $derived(circularizationOptions.length > 0);
  const showBridgeSection = $derived(hasBridgeOptions);

  // Format LOOP type for display
  function formatLOOPType(loopType: LOOPType): string {
    return loopType
      .replace(/^strict_/i, "")
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  }

  // Handle direct LOOP click
  function handleDirectClick(loopType: LOOPType) {
    if (isApplying) {
      return;
    }
    onSelect(null, loopType);
  }

  // Handle bridge letter LOOP click
  function handleBridgeClick(bridgeLetter: Letter, loopType: LOOPType) {
    if (isApplying) {
      return;
    }
    onSelect(bridgeLetter, loopType);
  }
</script>

<div class="loop-picker" class:applying={isApplying}>
  <!-- Header -->
  <header class="picker-header">
    <h3>Apply LOOP</h3>
    <span class="subtitle">Click to extend your sequence</span>
  </header>

  <!-- Direct LOOP Options -->
  {#if hasDirectOptions}
    <section class="options-section" transition:slide={{ duration: 200 }}>
      <div class="options-grid">
        {#each directOptions as option}
          <button
            class="loop-button"
            onclick={() => handleDirectClick(option.loopType)}
            disabled={isApplying}
            title={option.description}
          >
            <span class="loop-name">{option.name}</span>
          </button>
        {/each}
      </div>
    </section>
  {:else if directUnavailableReason}
    <div class="unavailable-reason">
      <i class="fas fa-info-circle" aria-hidden="true"></i>
      <span>{directUnavailableReason}</span>
    </div>
  {/if}

  <!-- Bridge Letter Options -->
  {#if showBridgeSection}
    <section class="bridge-section" transition:slide={{ duration: 200 }}>
      <div class="section-header">
        <span class="section-label">Add bridge letter + LOOP</span>
      </div>

      <div class="bridge-options">
        {#each circularizationOptions as option}
          <div class="bridge-group">
            <div class="bridge-header">
              <span class="bridge-letter">+{option.bridgeLetters.join("")}</span
              >
              <span class="bridge-arrow">→</span>
              <span class="bridge-end">{option.endPosition}</span>
            </div>
            <div class="bridge-loops">
              {#each option.availableLOOPs as loop}
                <button
                  class="loop-button bridge"
                  onclick={() => {
                    const bridgeLetter = option.bridgeLetters[0];
                    if (bridgeLetter)
                      handleBridgeClick(bridgeLetter, loop.loopType);
                  }}
                  disabled={isApplying}
                  title={loop.description || formatLOOPType(loop.loopType)}
                >
                  <span class="loop-name">{formatLOOPType(loop.loopType)}</span>
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Applying overlay -->
  {#if isApplying}
    <div class="applying-overlay">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <span>Applying...</span>
    </div>
  {/if}
</div>

<style>
  .loop-picker {
    container-type: inline-size;
    container-name: loop-picker;
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-md, 16px);
    position: relative;
    padding: var(--settings-spacing-md, 16px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 12px);
  }

  .loop-picker.applying {
    pointer-events: none;
  }

  .picker-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .picker-header h3 {
    margin: 0;
    font-size: var(--font-size-md, 16px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .subtitle {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  /* Options Grid - responsive 2-3 columns */
  .options-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--settings-spacing-sm, 8px);
  }

  @container loop-picker (min-width: 400px) {
    .options-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  /* LOOP Buttons - 60px touch targets */
  .loop-button {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60px;
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 16px);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent, #6366f1) 20%, transparent) 0%,
      color-mix(in srgb, var(--theme-accent, #6366f1) 8%, transparent) 100%
    );
    border: 2px solid
      color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
    border-radius: var(--settings-radius-md, 12px);
    cursor: pointer;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-md, 16px);
    font-weight: 600;
    transition: all var(--duration-normal) ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .loop-button:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent, #6366f1) 30%, transparent) 0%,
      color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent) 100%
    );
    border-color: var(--theme-accent, #6366f1);
    transform: translateY(-2px);
    box-shadow: 0 4px 20px
      color-mix(in srgb, var(--theme-accent, #6366f1) 30%, transparent);
  }

  .loop-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .loop-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .loop-button.bridge {
    min-height: var(--min-touch-target);
    font-size: var(--font-size-min, 14px);
  }

  .loop-name {
    text-align: center;
  }

  /* Unavailable reason */
  .unavailable-reason {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 16px);
    background: color-mix(
      in srgb,
      var(--semantic-warning, #f59e0b) 10%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--semantic-warning, #f59e0b) 30%, transparent);
    border-radius: var(--settings-radius-sm, 8px);
    font-size: var(--font-size-min, 14px);
    color: var(--semantic-warning, #f59e0b);
  }

  .unavailable-reason i {
    flex-shrink: 0;
  }

  /* Bridge section */
  .bridge-section {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
    padding-top: var(--settings-spacing-sm, 8px);
    border-top: 1px dashed var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .bridge-options {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-md, 16px);
  }

  .bridge-group {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
    padding: var(--settings-spacing-sm, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-sm, 8px);
  }

  .bridge-header {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
    font-size: var(--font-size-min, 14px);
  }

  .bridge-letter {
    font-weight: 600;
    color: var(--theme-accent, #6366f1);
    font-size: var(--font-size-md, 16px);
  }

  .bridge-arrow {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .bridge-end {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-family: monospace;
  }

  .bridge-loops {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--settings-spacing-xs, 4px);
  }

  @container loop-picker (min-width: 400px) {
    .bridge-loops {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  /* Applying overlay */
  .applying-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--settings-spacing-sm, 8px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.95));
    border-radius: var(--settings-radius-md, 12px);
    color: var(--theme-accent, #6366f1);
    font-size: var(--font-size-min, 14px);
  }

  .applying-overlay i {
    font-size: var(--font-size-xl, 1.5rem);
  }

  /* Reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .loop-button {
      transition: none;
    }

    .loop-button:hover:not(:disabled),
    .loop-button:active:not(:disabled) {
      transform: none;
    }
  }
</style>
