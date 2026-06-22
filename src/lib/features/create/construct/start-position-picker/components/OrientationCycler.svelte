<!--
OrientationCycler.svelte - Hybrid orientation selector
Three touch targets: left arrow cycles back, center label opens drawer, right arrow cycles forward.
-->
<script lang="ts">
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { orientationPickerState } from "../state/orientation-picker-state.svelte";

  interface Props {
    orientation: Orientation;
    onOrientationChange: (orientation: Orientation) => void;
    color?: "blue" | "red";
    /**
     * Center tap opens the global OrientationPickerDrawer (full-width bottom
     * sheet). Useful in the construct start-position picker; redundant + visually
     * wrong in compact panels where the arrows already cycle all four cardinals.
     * Set false to render the center as a static label.
     */
    enableDrawer?: boolean;
  }

  const {
    orientation,
    onOrientationChange,
    color,
    enableDrawer = true,
  }: Props = $props();

  const CYCLE_ORDER: Orientation[] = [
    Orientation.IN,
    Orientation.CLOCK,
    Orientation.OUT,
    Orientation.COUNTER,
  ];

  const ORIENTATION_DISPLAY: Record<string, { label: string; icon: string }> = {
    [Orientation.IN]: { label: "In", icon: "fa-compress-arrows-alt" },
    [Orientation.CLOCK]: { label: "Clock", icon: "fa-redo" },
    [Orientation.OUT]: { label: "Out", icon: "fa-expand-arrows-alt" },
    [Orientation.COUNTER]: { label: "Counter", icon: "fa-undo" },
  };

  const currentDisplay = $derived(
    ORIENTATION_DISPLAY[orientation] ?? ORIENTATION_DISPLAY[Orientation.IN]!
  );

  const colorLabel = $derived(color === "blue" ? "Blue" : color === "red" ? "Red" : "");

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

  function openDrawer() {
    orientationPickerState.open(
      color ?? "blue",
      orientation,
      onOrientationChange
    );
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

  {#if enableDrawer}
    <button
      class="cycle-center"
      onclick={openDrawer}
      aria-label="{colorLabel} orientation: {currentDisplay.label}. Tap to see all options."
    >
      <span class="trigger-label">{currentDisplay.label}</span>
    </button>
  {:else}
    <span
      class="cycle-center cycle-center-static"
      aria-label="{colorLabel} orientation: {currentDisplay.label}"
    >
      <span class="trigger-label">{currentDisplay.label}</span>
    </span>
  {/if}

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

  .cycle-center-static {
    cursor: default;
  }

  .cycle-center-static:hover,
  .cycle-center-static:active {
    background: none;
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
</style>
