<!--
OrientationPickerGrid.svelte - 2x2 grid for selecting prop orientation
Shows all 4 orientations: in, out, clock, counter
50px touch targets for accessibility
-->
<script lang="ts">
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  let { currentOrientation = null, onOrientationChange } = $props<{
    currentOrientation: Orientation | null;
    onOrientationChange: (orientation: Orientation | null) => void;
  }>();

  let hapticService: IHapticFeedback | null = null;

  onMount(() => {
    hapticService = container.items.hapticFeedback ?? null;
  });

  // Orientation options with display info
  const orientationOptions: Array<{
    value: Orientation;
    label: string;
    icon: string;
    description: string;
  }> = [
    {
      value: Orientation.IN,
      label: "In",
      icon: "↓",
      description: "Facing inward",
    },
    {
      value: Orientation.OUT,
      label: "Out",
      icon: "↑",
      description: "Facing outward",
    },
    {
      value: Orientation.CLOCK,
      label: "Clock",
      icon: "↻",
      description: "Clockwise",
    },
    {
      value: Orientation.COUNTER,
      label: "Counter",
      icon: "↺",
      description: "Counter-clockwise",
    },
  ];

  function handleSelect(orientation: Orientation) {
    hapticService?.trigger("selection");
    // Toggle off if already selected
    if (currentOrientation === orientation) {
      onOrientationChange(null);
    } else {
      onOrientationChange(orientation);
    }
  }

  function handleClear() {
    hapticService?.trigger("selection");
    onOrientationChange(null);
  }
</script>

<div class="orientation-picker-grid">
  <div class="grid">
    {#each orientationOptions as option (option.value)}
      <button
        class="orientation-cell"
        class:selected={currentOrientation === option.value}
        onclick={() => handleSelect(option.value)}
        aria-label="{option.label}: {option.description}"
        title={option.description}
        type="button"
      >
        <span class="orientation-icon">{option.icon}</span>
        <span class="orientation-label">{option.label}</span>
      </button>
    {/each}
  </div>

  {#if currentOrientation !== null}
    <button class="clear-button" onclick={handleClear} type="button">
      Clear Selection
    </button>
  {/if}
</div>

<style>
  .orientation-picker-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .orientation-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 80px;
    padding: 16px 12px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 2px solid var(--theme-stroke, var(--theme-stroke-strong));
    border-radius: 16px;
    color: var(--theme-text, white);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .orientation-cell:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    transform: translateY(-2px);
  }

  .orientation-cell:active {
    transform: translateY(0);
    background: var(--theme-card-hover-bg);
  }

  .orientation-cell.selected {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent) 25%, transparent),
      color-mix(
        in srgb,
        var(--theme-accent-strong, var(--theme-accent)) 25%,
        transparent
      )
    );
    border-color: color-mix(in srgb, var(--theme-accent) 60%, transparent);
    box-shadow: 0 0 20px
      color-mix(in srgb, var(--theme-accent) 25%, transparent);
  }

  .orientation-cell:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 80%, transparent);
    outline-offset: 2px;
  }

  .orientation-icon {
    font-size: var(--font-size-3xl);
    line-height: 1;
  }

  .orientation-label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .clear-button {
    min-height: var(--min-touch-target);
    padding: 12px 24px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 12px;
    color: rgba(239, 68, 68, 0.9);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .clear-button:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .clear-button:active {
    transform: scale(0.98);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .orientation-cell,
    .clear-button {
      transition: none;
    }

    .orientation-cell:hover {
      transform: none;
    }
  }
</style>
