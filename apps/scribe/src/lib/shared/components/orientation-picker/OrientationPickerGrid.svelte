<!--
OrientationPickerGrid.svelte - Grid for selecting prop orientation
Shows 4 cardinal orientations (in, out, clock, counter).
When showInterradial=true, adds 4 interradial orientations (Level 6).
50px touch targets for accessibility.
-->
<script lang="ts">
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  let {
    currentOrientation = null,
    onOrientationChange,
    showInterradial = false,
  } = $props<{
    currentOrientation: Orientation | null;
    onOrientationChange: (orientation: Orientation | null) => void;
    /** Show interradial orientations (Level 6: clockIn, clockOut, counterIn, counterOut) */
    showInterradial?: boolean;
  }>();

  let hapticService: IHapticFeedback | null = null;

  onMount(() => {
    hapticService = container.items.hapticFeedback ?? null;
  });

  interface OrientationOption {
    value: Orientation;
    label: string;
    icon: string;
    description: string;
  }

  // Cardinal orientation options (Levels 1-4)
  const cardinalOptions: OrientationOption[] = [
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

  // Interradial orientation options (Level 6)
  const interradialOptions: OrientationOption[] = [
    {
      value: Orientation.CLOCK_IN,
      label: "CW·In",
      icon: "↘",
      description: "Between clockwise and inward (gravity at NE)",
    },
    {
      value: Orientation.CLOCK_OUT,
      label: "CW·Out",
      icon: "↗",
      description: "Between clockwise and outward (gravity at SE)",
    },
    {
      value: Orientation.COUNTER_IN,
      label: "CCW·In",
      icon: "↙",
      description: "Between counter-clockwise and inward (gravity at NW)",
    },
    {
      value: Orientation.COUNTER_OUT,
      label: "CCW·Out",
      icon: "↖",
      description: "Between counter-clockwise and outward (gravity at SW)",
    },
  ];

  const orientationOptions = $derived(
    showInterradial ? [...cardinalOptions, ...interradialOptions] : cardinalOptions
  );

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
    {#each cardinalOptions as option (option.value)}
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

  {#if showInterradial}
    <div class="interradial-divider">
      <span class="divider-label">Interradial (Level 6)</span>
    </div>
    <div class="grid">
      {#each interradialOptions as option (option.value)}
        <button
          class="orientation-cell interradial"
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
  {/if}

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

  .interradial-divider {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .interradial-divider::before,
  .interradial-divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .divider-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .orientation-cell.interradial {
    border-style: dashed;
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
