<!--
OrientationCycler.svelte - Compact prev/next orientation control
Cycles through IN -> CLOCK -> OUT -> COUNTER (clockwise order)
-->
<script lang="ts">
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  interface Props {
    orientation: Orientation;
    onOrientationChange: (orientation: Orientation) => void;
    color?: "blue" | "red";
  }

  const { orientation, onOrientationChange, color }: Props = $props();

  // Clockwise cycle order for the 4 cardinal orientations
  const CYCLE: Orientation[] = [
    Orientation.IN,
    Orientation.CLOCK,
    Orientation.OUT,
    Orientation.COUNTER,
  ];

  // Display config for each orientation
  const ORIENTATION_DISPLAY: Record<string, { label: string; icon: string }> = {
    [Orientation.IN]: { label: "In", icon: "fa-compress-arrows-alt" },
    [Orientation.CLOCK]: { label: "Clock", icon: "fa-redo" },
    [Orientation.OUT]: { label: "Out", icon: "fa-expand-arrows-alt" },
    [Orientation.COUNTER]: { label: "Counter", icon: "fa-undo" },
  };

  const currentDisplay = $derived(
    ORIENTATION_DISPLAY[orientation] ?? ORIENTATION_DISPLAY[Orientation.IN]
  );

  function cyclePrev() {
    const idx = CYCLE.indexOf(orientation);
    const prevIdx = (idx - 1 + CYCLE.length) % CYCLE.length;
    onOrientationChange(CYCLE[prevIdx]!);
  }

  function cycleNext() {
    const idx = CYCLE.indexOf(orientation);
    const nextIdx = (idx + 1) % CYCLE.length;
    onOrientationChange(CYCLE[nextIdx]!);
  }
</script>

<div class="orientation-cycler" class:color-blue={color === "blue"} class:color-red={color === "red"} role="group" aria-label="{color ? `${color} prop orientation` : 'Orientation selector'}">
  <button
    class="cycle-arrow"
    onclick={cyclePrev}
    aria-label="Previous orientation"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  </button>

  <div class="orientation-display">
    <i class="fas {currentDisplay?.icon ?? 'fa-compress-arrows-alt'}" aria-hidden="true"></i>
    <span class="control-label">{currentDisplay?.label ?? 'In'}</span>
  </div>

  <button
    class="cycle-arrow"
    onclick={cycleNext}
    aria-label="Next orientation"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  </button>
</div>

<style>
  .orientation-cycler {
    display: inline-flex;
    align-items: center;
    min-height: var(--min-touch-target, 48px);
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: 12px;
    overflow: hidden;
  }

  .cycle-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    min-height: var(--min-touch-target, 48px);
    padding: 0;
    background: transparent;
    border: none;
    color: var(--theme-text);
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    opacity: 0.7;
    transition: opacity 0.15s ease, background 0.15s ease;
  }

  .cycle-arrow svg {
    width: 16px;
    height: 16px;
  }

  .cycle-arrow:active {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
    opacity: 1;
  }

  .cycle-arrow:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: -2px;
  }

  @media (hover: hover) {
    .cycle-arrow:hover {
      opacity: 1;
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
    }
  }

  /* Color-tinted variants */
  .orientation-cycler.color-blue {
    border-color: rgba(59, 130, 246, 0.4);
    background: rgba(59, 130, 246, 0.08);
  }

  .orientation-cycler.color-red {
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.08);
  }

  .orientation-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    /* Fixed width to fit longest label ("Counter") so arrows don't shift */
    width: 80px;
    padding: 0 4px;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text);
    letter-spacing: 0.3px;
    white-space: nowrap;
    pointer-events: none;
  }

  .orientation-display i {
    font-size: 14px;
    opacity: 0.85;
  }

  /* Mobile responsive - hide label, compress width */
  @media (max-width: 480px) {
    .orientation-display {
      padding: 0 2px;
    }

    .cycle-arrow {
      width: 32px;
    }

    .cycle-arrow svg {
      width: 14px;
      height: 14px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .cycle-arrow {
      transition: none;
    }
  }
</style>
