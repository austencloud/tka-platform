<!--
OrientationCycler.svelte - Hybrid orientation selector
Three touch targets: left arrow cycles back, right arrow cycles forward, and the
center label opens an anchored popover with all four orientations.
-->
<script lang="ts">
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { Popover } from "bits-ui";
  import { scale } from "svelte/transition";
  import { backOut, cubicOut } from "svelte/easing";

  interface Props {
    orientation: Orientation;
    onOrientationChange: (orientation: Orientation) => void;
    color?: "blue" | "red";
  }

  const { orientation, onOrientationChange, color }: Props = $props();

  const CYCLE_ORDER: Orientation[] = [
    Orientation.IN,
    Orientation.CLOCK,
    Orientation.OUT,
    Orientation.COUNTER,
  ];

  // Full option set rendered inside the popover (label + hint + icon).
  const ORIENTATIONS: {
    value: Orientation;
    label: string;
    icon: string;
    hint: string;
  }[] = [
    { value: Orientation.IN, label: "In", icon: "fa-compress-arrows-alt", hint: "Toward center" },
    { value: Orientation.CLOCK, label: "Clock", icon: "fa-redo", hint: "Clockwise" },
    { value: Orientation.OUT, label: "Out", icon: "fa-expand-arrows-alt", hint: "Away from center" },
    { value: Orientation.COUNTER, label: "Counter", icon: "fa-undo", hint: "Counterclockwise" },
  ];

  const currentDisplay = $derived(
    ORIENTATIONS.find((o) => o.value === orientation) ?? ORIENTATIONS[0]!
  );

  const colorLabel = $derived(color === "blue" ? "Blue" : color === "red" ? "Red" : "");

  let popoverOpen = $state(false);

  function currentIndex(): number {
    const idx = CYCLE_ORDER.indexOf(orientation);
    return idx >= 0 ? idx : 0;
  }

  function cyclePrev() {
    const idx = (currentIndex() + 1) % CYCLE_ORDER.length;
    onOrientationChange(CYCLE_ORDER[idx]!);
  }

  function cycleNext() {
    const idx = (currentIndex() - 1 + CYCLE_ORDER.length) % CYCLE_ORDER.length;
    onOrientationChange(CYCLE_ORDER[idx]!);
  }

  function handleSelect(value: Orientation) {
    onOrientationChange(value);
    popoverOpen = false;
  }
</script>

<div
  class="orientation-cycler"
  class:color-blue={color === "blue"}
  class:color-red={color === "red"}
>
  <button
    class="cycle-arrow"
    onclick={cyclePrev}
    aria-label="Previous {colorLabel} orientation"
  >
    <i class="fas fa-chevron-left" aria-hidden="true"></i>
  </button>

  <Popover.Root bind:open={popoverOpen}>
    <Popover.Trigger>
      {#snippet child({ props })}
        <button
          {...props}
          class="cycle-center"
          aria-label="{colorLabel} orientation: {currentDisplay.label}. Tap to see all options."
        >
          <span class="trigger-label">{currentDisplay.label}</span>
        </button>
      {/snippet}
    </Popover.Trigger>

    <Popover.Portal>
      <Popover.Content
        side="top"
        sideOffset={8}
        align="center"
        avoidCollisions={true}
        collisionPadding={12}
        forceMount
      >
        {#snippet child({ open, wrapperProps, props })}
          <div {...wrapperProps}>
            {#if open}
              <div
                {...props}
                class="orientation-popover"
                class:color-blue={color === "blue"}
                class:color-red={color === "red"}
                in:scale={{ duration: 180, start: 0.92, opacity: 0, easing: backOut }}
                out:scale={{ duration: 130, start: 0.95, opacity: 0, easing: cubicOut }}
              >
                <div class="orientation-options">
                  {#each ORIENTATIONS as opt (opt.value)}
                    <button
                      class="orientation-option"
                      class:selected={opt.value === orientation}
                      onclick={() => handleSelect(opt.value)}
                      aria-pressed={opt.value === orientation}
                      aria-label="{opt.label}: {opt.hint}"
                    >
                      <i class="fas {opt.icon}" aria-hidden="true"></i>
                      <div class="option-text">
                        <span class="option-label">{opt.label}</span>
                        <span class="option-hint">{opt.hint}</span>
                      </div>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/snippet}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>

  <button
    class="cycle-arrow"
    onclick={cycleNext}
    aria-label="Next {colorLabel} orientation"
  >
    <i class="fas fa-chevron-right" aria-hidden="true"></i>
  </button>
</div>

<style>
  .orientation-cycler {
    display: flex;
    align-items: stretch;
    flex: 1;
    min-height: var(--min-touch-target, 48px);
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: 12px;
    overflow: hidden;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .orientation-cycler.color-blue {
    border-color: var(--prop-blue-border, rgba(59, 130, 246, 0.4));
    background: color-mix(in srgb, var(--prop-blue, #3b82f6) 8%, transparent);
  }

  .orientation-cycler.color-red {
    border-color: var(--prop-red-border, rgba(239, 68, 68, 0.4));
    background: color-mix(in srgb, var(--prop-red, #ef4444) 8%, transparent);
  }

  /* Shared button reset */
  .cycle-arrow,
  .cycle-center {
    border: none;
    background: none;
    color: var(--theme-text);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s ease;
  }

  .cycle-arrow {
    flex: 3;
    font-size: 12px;
    opacity: 0.6;
  }

  .cycle-center {
    flex: 4;
    gap: 8px;
    padding: 10px 4px;
    font-size: var(--font-size-min);
    font-weight: 600;
    letter-spacing: 0.3px;
    white-space: nowrap;
  }

  @media (hover: hover) {
    .cycle-arrow:hover {
      background: rgba(255, 255, 255, 0.08);
      opacity: 1;
    }

    .cycle-center:hover {
      background: rgba(255, 255, 255, 0.06);
    }
  }

  .cycle-arrow:active,
  .cycle-center:active {
    background: rgba(255, 255, 255, 0.12);
    transition: background var(--duration-instant) ease;
  }

  .cycle-arrow:focus-visible,
  .cycle-center:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: -2px;
  }

  @container (max-width: 500px) {
    .cycle-arrow {
      padding: 0 8px;
    }

    .cycle-center {
      padding: 8px 4px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cycle-arrow,
    .cycle-center {
      transition: none;
    }
  }

  /* ============================================
     Popover panel — portalled, anchored above the cycler
     ============================================ */
  .orientation-popover {
    --sheet-bg: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    z-index: 1000;
    padding: 10px;
    background: var(--sheet-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 14px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
  }

  .orientation-popover.color-blue {
    border-top: 2px solid
      color-mix(in srgb, var(--prop-blue, #3b82f6) 50%, transparent);
  }

  .orientation-popover.color-red {
    border-top: 2px solid
      color-mix(in srgb, var(--prop-red, #ef4444) 50%, transparent);
  }

  .orientation-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .orientation-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: 10px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    min-height: var(--min-touch-target, 48px);
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .orientation-option i {
    font-size: 16px;
    opacity: 0.8;
    color: var(--theme-text);
    flex-shrink: 0;
  }

  .option-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: left;
  }

  .option-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text);
  }

  .option-hint {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
  }

  .orientation-popover.color-blue .orientation-option.selected {
    border-color: color-mix(in srgb, var(--prop-blue, #3b82f6) 60%, transparent);
    background: var(--prop-blue-bg, rgba(59, 130, 246, 0.15));
  }

  .orientation-popover.color-red .orientation-option.selected {
    border-color: color-mix(in srgb, var(--prop-red, #ef4444) 60%, transparent);
    background: var(--prop-red-bg, rgba(239, 68, 68, 0.15));
  }

  @media (hover: hover) {
    .orientation-option:hover:not(.selected) {
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-stroke-strong);
    }
  }

  .orientation-option:active {
    transform: scale(0.98);
  }

  .orientation-option:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .orientation-option {
      transition: none;
    }

    .orientation-option:active {
      transform: none;
    }
  }
</style>
