<!--
  FormatSelector.svelte

  Horizontal selector for choosing media format in Single Media mode.
  Displays three options: Animation, Static, Performance.

  Design:
  - Horizontal chip/pill layout
  - Active format highlighted
  - Icons + labels
  - Theme-based colors
  - Keyboard accessible

  Domain: Export Panel - Single Media Format Selection
-->
<script lang="ts">
  import type { MediaFormat } from "../../domain/models/media-format";

  let {
    selectedFormat = "animation",
    onFormatSelect,
  }: {
    selectedFormat?: MediaFormat;
    onFormatSelect?: (format: MediaFormat) => void;
  } = $props();

  // MVP: Only Animation and Image available
  // Performance video not ready - requires camera/upload implementation
  const formats: Array<{ id: MediaFormat; label: string; icon: string }> = [
    { id: "animation", label: "Animation", icon: "fa-play-circle" },
    { id: "static", label: "Image", icon: "fa-image" },
    // { id: 'performance', label: 'Performance', icon: 'fa-video' }, // TODO: Enable post-MVP
  ];

  function handleFormatSelect(format: MediaFormat) {
    onFormatSelect?.(format);
  }

  function handleKeydown(event: KeyboardEvent, format: MediaFormat) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleFormatSelect(format);
    }
  }
</script>

<div
  class="format-selector"
  role="radiogroup"
  aria-label="Media format selection"
>
  {#each formats as format}
    <button
      class="format-chip"
      class:active={selectedFormat === format.id}
      role="radio"
      aria-checked={selectedFormat === format.id}
      tabindex={selectedFormat === format.id ? 0 : -1}
      onclick={() => handleFormatSelect(format.id)}
      onkeydown={(e) => handleKeydown(e, format.id)}
    >
      <i class="fas {format.icon}" aria-hidden="true"></i>
      <span>{format.label}</span>
    </button>
  {/each}
</div>

<style>
  .format-selector {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
    padding: 16px 0;
  }

  .format-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    min-height: var(--min-touch-target); /* WCAG 2.1 AA touch target */
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: 24px;
    font-size: var(--font-size-min);
    font-weight: 500;
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    white-space: nowrap;
  }

  .format-chip i {
    font-size: var(--font-size-base);
  }

  .format-chip:hover {
    border-color: var(--theme-accent);
    color: var(--theme-text);
    transform: translateY(-2px);
  }

  .format-chip:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .format-chip.active {
    background: var(--theme-accent);
    border-color: var(--theme-accent);
    color: white;
    box-shadow:
      0 2px 8px var(--theme-shadow),
      0 0 0 1px var(--theme-accent-glow);
  }

  .format-chip.active:hover {
    transform: translateY(-1px) scale(1.02);
  }

  /* Mobile optimization */
  @media (max-width: 600px) {
    .format-selector {
      gap: 8px;
      padding: 12px 0;
    }

    .format-chip {
      flex: 1;
      justify-content: center;
      padding: 8px 16px;
      font-size: var(--font-size-compact);
    }

    .format-chip i {
      font-size: var(--font-size-sm);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .format-chip {
      transition: none;
    }

    .format-chip:hover,
    .format-chip.active:hover {
      transform: none;
    }
  }
</style>
