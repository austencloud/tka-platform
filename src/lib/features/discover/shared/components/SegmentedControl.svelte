<!--
SegmentedControl - Modern iOS-style segmented control
Provides a clean button group for mutually exclusive options
Used for sort method selection (Letter/Length/Date)
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
    import { onMount } from "svelte";

  interface Segment<T = string> {
    value: T;
    label: string;
    icon?: string;
  }

  let hapticService: IHapticFeedback;

  // Props
  const {
    segments,
    value,
    onChange = () => {},
    ariaLabel = "Segmented control",
  } = $props<{
    segments: Segment[];
    value: string;
    onChange?: (value: string) => void;
    ariaLabel?: string;
  }>();

  // Handle segment click
  function handleClick(segment: Segment) {
    if (segment.value !== value) {
      hapticService?.trigger("selection");
      onChange(segment.value);
    }
  }

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });
</script>

<div class="segmented-control" role="group" aria-label={ariaLabel}>
  {#each segments as segment (segment.value)}
    <button
      type="button"
      class="segment"
      class:active={value === segment.value}
      onclick={() => handleClick(segment)}
      aria-pressed={value === segment.value}
      aria-label={segment.label}
    >
      {#if segment.icon}
        <i class="fas {segment.icon}" aria-hidden="true"></i>
      {/if}
      <span class="segment-label">{segment.label}</span>
    </button>
  {/each}
</div>

<style>
  /* Modern segmented control - iOS 18 / macOS Sequoia inspired */
  .segmented-control {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 3px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border-radius: 100px; /* Full pill */
    box-shadow:
      inset 0 0.5px 1px var(--theme-shadow),
      0 1px 2px var(--theme-shadow);
    transition: all 0.2s ease;
  }

  .segment {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 7px 14px;
    background: transparent;
    border: none;
    border-radius: 100px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-sm);
    font-weight: 590; /* SF Pro semibold weight */
    letter-spacing: -0.2px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
    position: relative;
    -webkit-tap-highlight-color: transparent;
  }

  .segment:hover:not(.active) {
    color: color-mix(in srgb, var(--theme-text, white) 85%, transparent);
    background: var(--theme-card-hover-bg);
  }

  /* Active state - modern iOS pill style */
  .segment.active {
    background: color-mix(in srgb, var(--theme-text, white) 22%, transparent);
    color: color-mix(in srgb, var(--theme-text, white) 98%, transparent);
    box-shadow:
      0 1px 3px var(--theme-shadow, var(--theme-shadow)),
      0 0.5px 1px var(--theme-shadow),
      inset 0 0.5px 0.5px var(--theme-stroke, var(--theme-stroke-strong));
  }

  .segment:active {
    transform: scale(0.97);
  }

  .segment i {
    font-size: var(--font-size-compact);
    opacity: 0.9;
  }

  .segment-label {
    font-size: var(--font-size-sm);
  }

  /* Compact mode for smaller screens */
  @media (max-width: 480px) {
    .segmented-control {
      padding: 2px;
      gap: 1px;
    }

    .segment {
      padding: 6px 11px;
      font-size: var(--font-size-compact);
    }

    .segment i {
      font-size: var(--font-size-compact);
    }

    .segment-label {
      font-size: var(--font-size-compact);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .segmented-control,
    .segment {
      transition: none;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .segmented-control {
      background: rgba(0, 0, 0, 0.8);
      border: 1px solid white;
    }

    .segment.active {
      background: white;
      color: black;
    }
  }
</style>
