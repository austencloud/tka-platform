<!--
OrientationCycler.svelte - Compact prev/next orientation control
Cycles through IN -> CLOCK -> OUT -> COUNTER (clockwise order)
Arrow buttons overlay the full left/right halves for large touch targets.
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
  <!-- Visual display layer (not interactive) -->
  <div class="orientation-display">
    <svg
      class="arrow-icon left"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>

    <div class="orientation-value">
      <i class="fas {currentDisplay?.icon ?? 'fa-compress-arrows-alt'}" aria-hidden="true"></i>
      <span>{currentDisplay?.label ?? 'In'}</span>
    </div>

    <svg
      class="arrow-icon right"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  </div>

  <!-- Touch target layer: two invisible buttons covering full left/right halves -->
  <button
    class="touch-target left"
    onclick={cycleNext}
    aria-label="Previous orientation"
  ></button>
  <button
    class="touch-target right"
    onclick={cyclePrev}
    aria-label="Next orientation"
  ></button>
</div>

<style>
  .orientation-cycler {
    position: relative;
    display: flex;
    align-items: center;
    min-height: var(--min-touch-target, 48px);
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: 12px;
    overflow: hidden;
  }

  /* Visual display fills the entire component */
  .orientation-display {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: var(--min-touch-target, 48px);
    padding: 0 12px;
    pointer-events: none;
  }

  .arrow-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    opacity: 0.7;
    color: var(--theme-text);
  }

  .orientation-value {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text);
    letter-spacing: 0.3px;
    white-space: nowrap;
  }

  .orientation-value i {
    font-size: 14px;
    opacity: 0.85;
  }

  /* Invisible touch targets covering full left/right halves */
  .touch-target {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 50%;
    padding: 0;
    margin: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    z-index: 1;
    transition: background 0.15s ease;
  }

  .touch-target.left {
    left: 0;
    border-radius: 12px 0 0 12px;
  }

  .touch-target.right {
    right: 0;
    border-radius: 0 12px 12px 0;
  }

  .touch-target:active {
    background: rgba(255, 255, 255, 0.06);
  }

  .touch-target:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: -2px;
  }

  @media (hover: hover) {
    .touch-target:hover {
      background: rgba(255, 255, 255, 0.04);
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

  /* Narrow container */
  @container (max-width: 500px) {
    .arrow-icon {
      width: 14px;
      height: 14px;
    }

    .orientation-display {
      padding: 0 8px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .touch-target {
      transition: none;
    }
  }
</style>
