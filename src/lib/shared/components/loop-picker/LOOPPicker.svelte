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
  import type { Letter } from "$lib/shared/foundation/domain/models/letter";
  import type { LOOPOption } from "../../../features/create/shared/services/loop-validator";
  import type { CircularizationOption } from "$lib/shared/create/domain/spell-models";
  import type { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import { slide } from "svelte/transition";
  import {
    loopTypeTint,
    loopOptionTint,
    ORIENTATION_REPEAT_COLOR,
  } from "./loop-option-color";

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
    /**
     * Set when the sequence is back at its start position but not its start
     * orientation. `count` total repeats close the orientation cycle.
     */
    orientationRepeat?: { count: 2 | 4 | 8 } | null;
    /** Called when the user picks the orientation repeat. */
    onOrientationRepeat?: () => void;
  }

  let {
    directOptions,
    circularizationOptions = [],
    onSelect,
    directUnavailableReason = null,
    isApplying = false,
    orientationRepeat = null,
    onOrientationRepeat,
  }: Props = $props();

  const repeatTint = loopOptionTint([ORIENTATION_REPEAT_COLOR]);
  const showRepeat = $derived(Boolean(orientationRepeat && onOrientationRepeat));

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
  {#if hasDirectOptions || showRepeat}
    <section class="options-section" transition:slide={{ duration: 200 }}>
      <div class="options-grid">
        {#each directOptions as option}
          <button
            class="loop-button"
            style={loopTypeTint(option.loopType)}
            onclick={() => handleDirectClick(option.loopType)}
            disabled={isApplying}
            title={option.description}
          >
            <span class="loop-name">{option.name}</span>
          </button>
        {/each}

        {#if orientationRepeat && onOrientationRepeat}
          <button
            class="loop-button repeat"
            style={repeatTint}
            onclick={() => !isApplying && onOrientationRepeat?.()}
            disabled={isApplying}
            title="The sequence returns to its start position but not its start orientation. Repeating it {orientationRepeat.count} times brings the props back to where they began."
          >
            <span class="loop-name">Repeated &times;{orientationRepeat.count}</span>
            <span class="loop-sub">closes orientation</span>
          </button>
        {/if}
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
                  style={loopTypeTint(loop.loopType)}
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

  /*
   * Options wrap as content-sized cards, not equal grid tracks.
   *
   * A fixed column count has no good answer here: the option count is
   * data-driven (1 to 6), so any pinned track count either stretches two
   * short labels across a 900px panel or strands an empty cell beside them.
   * Wrapping from a sane minimum sizes each button to its own label, keeps
   * the 44px touch floor, and never leaves a hole — at any option count and
   * any panel width.
   */
  .options-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--settings-spacing-sm, 8px);
  }

  .options-grid > :global(*) {
    flex: 0 1 auto;
    min-width: 9.5rem;
    max-width: 18rem;
  }

  /* Narrow panels get two per row rather than a lonely column of one. */
  @container loop-picker (max-width: 22rem) {
    .options-grid > :global(*) {
      flex: 1 1 8rem;
      min-width: 0;
    }
  }

  /*
   * LOOP Buttons.
   *
   * --loop-c1 / --loop-c2 come from the option's own primitives (see
   * loop-option-color.ts), so Swapped is green, Inverted is orange, and
   * "Swapped / Inverted" sweeps green into orange — matching the badge the
   * same LOOP carries on a sequence card. The theme accent is the fallback
   * for any option whose type names no known primitive.
   */
  .loop-button {
    --c1: var(--loop-c1, var(--theme-accent, #6366f1));
    --c2: var(--loop-c2, var(--theme-accent, #6366f1));
    --c2-mix: var(--loop-c2-mix, 9%);

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.125rem;
    min-height: 3.75rem;
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 16px);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--c1) 22%, transparent) 0%,
      color-mix(in srgb, var(--c2) var(--c2-mix), transparent) 100%
    );
    border: 2px solid color-mix(in srgb, var(--c1) 45%, transparent);
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
      color-mix(in srgb, var(--c1) 34%, transparent) 0%,
      color-mix(in srgb, var(--c2) calc(var(--c2-mix) + 10%), transparent) 100%
    );
    border-color: var(--c1);
    transform: translateY(-2px);
    box-shadow: 0 4px 20px color-mix(in srgb, var(--c1) 32%, transparent);
  }

  .loop-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .loop-button:focus-visible {
    outline: 2px solid var(--c1);
    outline-offset: 2px;
  }

  .loop-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .loop-button.bridge {
    min-height: var(--min-touch-target);
    font-size: var(--font-size-min, 14px);
  }

  /*
   * The repeat spans the full row. It is a different KIND of extension from
   * its neighbours (no transform, just repetition), and spanning also means a
   * trailing odd option can never strand a half-empty row.
   */
  .loop-button.repeat {
    flex-basis: 100%;
    max-width: none;
  }

  .loop-name {
    text-align: center;
  }

  .loop-sub {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
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

  /* Same content-sizing rationale as .options-grid above. */
  .bridge-loops {
    display: flex;
    flex-wrap: wrap;
    gap: var(--settings-spacing-xs, 4px);
  }

  .bridge-loops > .loop-button {
    flex: 0 1 auto;
    min-width: 8rem;
    max-width: 16rem;
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
