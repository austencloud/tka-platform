<!--
  LOOPPicker.svelte - Unified LOOP Selection Component

  Reusable component for selecting LOOP patterns to extend a sequence.
  Used by both Spell tab and Sequence Actions Extend feature.

  Features:
  - Compact choice shelf that centers without stretching to fill the drawer
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
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";
  import { parseLoopComponents } from "$lib/shared/create/services/loop-type-utils";

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
  const showRepeat = $derived(
    Boolean(orientationRepeat && onOrientationRepeat)
  );
  const choiceCount = $derived(directOptions.length + (showRepeat ? 1 : 0));

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
  <div class="picker-content" data-count={choiceCount}>
    <!-- Header -->
    <header class="picker-header">
      <h3>Apply LOOP</h3>
      <span class="subtitle">Click to extend your sequence</span>
    </header>

    <!-- Direct LOOP Options -->
    {#if hasDirectOptions || showRepeat}
      <section class="options-section" transition:slide={{ duration: 200 }}>
        <div class="options-grid" data-count={choiceCount}>
          {#each directOptions as option}
            <button
              type="button"
              class="loop-button"
              style={loopTypeTint(option.loopType)}
              onclick={() => handleDirectClick(option.loopType)}
              disabled={isApplying}
            >
              <!--
              The same glyph badge these LOOPs already wear on a sequence card,
              in the same brand colours — so the choice here and the thing it
              produces are recognisably one object.
            -->
              <span class="loop-glyph" aria-hidden="true">
                <LOOPIconStrip
                  activeComponents={parseLoopComponents(option.loopType)}
                  size={38}
                  showFreeformWhenEmpty={false}
                />
              </span>
              <span class="loop-text">
                <span class="loop-name">{option.name}</span>
                <span class="loop-desc">{option.description}</span>
              </span>
            </button>
          {/each}

          {#if orientationRepeat && onOrientationRepeat}
            <button
              type="button"
              class="loop-button repeat"
              style={repeatTint}
              onclick={() => !isApplying && onOrientationRepeat?.()}
              disabled={isApplying}
            >
              <span class="loop-glyph" aria-hidden="true">
                <i class="fas fa-repeat"></i>
              </span>
              <span class="loop-text">
                <span class="loop-name"
                  >Repeated &times;{orientationRepeat.count}</span
                >
                <span class="loop-desc">
                  Back at the start position, but the props are turned.
                  Repeating
                  {orientationRepeat.count} times returns their orientation too.
                </span>
              </span>
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
                <span class="bridge-letter"
                  >+{option.bridgeLetters.join("")}</span
                >
                <span class="bridge-arrow">→</span>
                <span class="bridge-end">{option.endPosition}</span>
              </div>
              <div class="bridge-loops">
                {#each option.availableLOOPs as loop}
                  <button
                    type="button"
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
                    <span class="loop-name"
                      >{formatLOOPType(loop.loopType)}</span
                    >
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}
  </div>

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
    flex: 1;
    min-height: 0;
    position: relative;
    padding: clamp(0.75rem, 2cqw, 1.5rem);
    overflow-y: auto;
  }

  .loop-picker.applying {
    pointer-events: none;
  }

  /*
   * The options form one deliberate object in the middle of the available
   * canvas. The shelf grows only as wide and tall as its choices, so a tall
   * drawer no longer turns a handful of labels into four wall-sized buttons.
   */
  .picker-content {
    width: 100%;
    max-width: 72rem;
    margin: auto;
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-md, 16px);
    padding: clamp(0.875rem, 1.75cqw, 1.25rem);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 12px);
  }

  .picker-content[data-count="1"] {
    max-width: 20rem;
  }

  .picker-content[data-count="2"] {
    max-width: 38rem;
  }

  .picker-content[data-count="3"],
  .picker-content[data-count="5"],
  .picker-content[data-count="6"] {
    max-width: 56rem;
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
   * Flex lines center independently, so data-driven counts never leave a lone
   * option stuck against the left edge. Four choices fit in one row at the
   * desktop drawer width; narrower containers recompose to two and then one.
   */
  .options-grid {
    --choice-basis: 100%;
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.625rem;
  }

  @container loop-picker (min-width: 32rem) {
    .options-grid {
      --choice-basis: calc((100% - 0.625rem) / 2);
      max-width: 34.625rem;
      margin-inline: auto;
    }
  }

  @container loop-picker (min-width: 48rem) {
    .options-grid {
      --choice-basis: calc((100% - 1.875rem) / 4);
      max-width: 69.875rem;
    }

    .options-grid[data-count="1"] {
      --choice-basis: 17rem;
      max-width: 17rem;
    }

    .options-grid[data-count="2"] {
      --choice-basis: calc((100% - 0.625rem) / 2);
      max-width: 34.625rem;
    }

    .options-grid[data-count="3"],
    .options-grid[data-count="5"],
    .options-grid[data-count="6"] {
      --choice-basis: calc((100% - 1.25rem) / 3);
      max-width: 52.25rem;
    }
  }

  /* Portrait tablets keep two readable columns even though their raw width can
     technically hold four. Phones remain one column through the base rule. */
  @media (orientation: portrait) and (max-width: 60rem) {
    @container loop-picker (min-width: 32rem) {
      .options-grid {
        --choice-basis: calc((100% - 0.625rem) / 2);
        max-width: 34.625rem;
      }
    }
  }

  /* A true 4K canvas has no operating-system scale helping it. Recompose the
     same shelf at presentation distance without letting controls fill the panel. */
  @container loop-picker (min-width: 90rem) {
    .picker-content {
      max-width: 92rem;
      gap: 1.25rem;
      padding: 1.75rem;
    }

    .picker-content[data-count="1"] {
      max-width: 25rem;
    }

    .picker-content[data-count="2"] {
      max-width: 48rem;
    }

    .picker-content[data-count="3"],
    .picker-content[data-count="5"],
    .picker-content[data-count="6"] {
      max-width: 70rem;
    }

    .options-grid {
      --choice-basis: calc((100% - 2.625rem) / 4);
      max-width: 88rem;
      gap: 0.875rem;
    }

    .options-grid[data-count="1"] {
      --choice-basis: 21rem;
      max-width: 21rem;
    }

    .options-grid[data-count="2"] {
      --choice-basis: calc((100% - 0.875rem) / 2);
      max-width: 42.875rem;
    }

    .options-grid[data-count="3"],
    .options-grid[data-count="5"],
    .options-grid[data-count="6"] {
      --choice-basis: calc((100% - 1.75rem) / 3);
      max-width: 64.75rem;
    }
  }

  /* Sequence Actions keeps the pictographs visible above the drawer. Inside
     that compact context the picker spends its height on choices instead of
     double padding, while the choice cards retain full touch targets. */
  @container sequence-action-subview (max-width: 599px) and (max-height: 430px) {
    .loop-picker {
      padding: var(--settings-spacing-sm, 8px);
    }

    .picker-content {
      margin-block: 0;
      gap: var(--settings-spacing-sm, 8px);
      padding: var(--settings-spacing-sm, 8px);
      border-radius: 10px;
    }

    .picker-header {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      align-items: baseline;
      gap: 8px;
    }

    .subtitle {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .loop-button {
      min-height: 4.75rem;
      padding: 0.75rem;
      gap: 0.25rem;
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
    flex: 0 1 var(--choice-basis);
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-width: 0;
    min-height: 8.75rem;
    padding: 1rem 0.875rem;
    text-align: center;
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

  .loop-glyph {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 2.375rem;
    font-size: 2rem;
    color: var(--c1);
  }

  .loop-text {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
  }

  .loop-name {
    font-size: 1rem;
    line-height: 1.2;
  }

  .loop-desc {
    max-width: 24ch;
    font-size: 0.8125rem;
    font-weight: 400;
    line-height: 1.35;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.62));
  }

  @container loop-picker (min-width: 90rem) {
    .picker-header h3,
    .loop-name {
      font-size: 1.25rem;
    }

    .subtitle,
    .loop-desc {
      font-size: 1rem;
    }

    .loop-button {
      min-height: 10rem;
      padding: 1.25rem 1rem;
    }

    .loop-glyph {
      min-height: 3rem;
      transform: scale(1.25);
    }

    .loop-desc {
      max-width: 28ch;
    }
  }

  /* Phone-width drawers read faster as compact horizontal rows. */
  @container loop-picker (max-width: 31.999rem) {
    .loop-button {
      flex-direction: row;
      justify-content: flex-start;
      min-height: 5.25rem;
      padding: 0.75rem 1rem;
      text-align: left;
    }

    .loop-glyph {
      flex: 0 0 3rem;
    }

    .loop-text {
      align-items: flex-start;
    }

    .loop-desc {
      max-width: none;
    }
  }

  /*
   * Descriptions are the first thing to go on a short viewport (a folded phone
   * in landscape). A container query cannot ask this — the picker is
   * `container-type: inline-size`, which answers inline-axis questions only,
   * and switching it to `size` would make its height stop depending on its
   * own content.
   */
  @media (max-height: 34rem) {
    .loop-desc {
      display: none;
    }

    .loop-button {
      min-height: 4.75rem;
      padding: 0.625rem 0.75rem;
      gap: 0.25rem;
    }
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
