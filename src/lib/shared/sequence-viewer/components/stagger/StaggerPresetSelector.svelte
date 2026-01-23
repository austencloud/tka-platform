<!--
  StaggerPresetSelector.svelte

  Chip-style buttons for selecting stagger timing presets.
  Active state uses accent color styling.
-->
<script lang="ts">
  import type { StaggerPreset } from "../../state/stagger-mode-state.svelte";

  interface Props {
    preset: StaggerPreset;
    onPresetChange: (preset: StaggerPreset) => void;
  }

  let { preset, onPresetChange }: Props = $props();

  const presets: Array<{ value: StaggerPreset; label: string }> = [
    { value: "half-beat", label: "½ Beat" },
    { value: "1-beat", label: "1 Beat" },
    { value: "2-beat", label: "2 Beats" },
    { value: "custom", label: "Custom" },
  ];

  // Handle keyboard navigation for radiogroup
  function handleKeyDown(event: KeyboardEvent) {
    const currentIndex = presets.findIndex(p => p.value === preset);
    let newIndex = currentIndex;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      newIndex = (currentIndex + 1) % presets.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      newIndex = (currentIndex - 1 + presets.length) % presets.length;
    } else if (event.key === "Home") {
      event.preventDefault();
      newIndex = 0;
    } else if (event.key === "End") {
      event.preventDefault();
      newIndex = presets.length - 1;
    } else {
      return; // Don't handle other keys
    }

    onPresetChange(presets[newIndex].value);
    // Focus the new button after state update
    setTimeout(() => {
      const buttons = document.querySelectorAll<HTMLButtonElement>('.preset-chip');
      buttons[newIndex]?.focus();
    }, 0);
  }
</script>

<div class="preset-selector" role="radiogroup" aria-label="Stagger timing preset">
  {#each presets as { value, label }, index}
    <button
      type="button"
      role="radio"
      class="preset-chip"
      class:active={preset === value}
      aria-checked={preset === value}
      tabindex={preset === value ? 0 : -1}
      onclick={() => onPresetChange(value)}
      onkeydown={handleKeyDown}
    >
      {label}
    </button>
  {/each}
</div>

<style>
  .preset-selector {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }

  .preset-chip {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    min-width: 48px;
    padding: 8px 16px;
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .preset-chip:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  @media (prefers-reduced-motion: no-preference) {
    .preset-chip:active {
      transform: scale(0.95);
      transition-duration: 50ms;
    }
  }

  .preset-chip.active {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 45%, transparent);
    color: white;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-accent, #6366f1) 20%, transparent);
  }

  .preset-chip:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .preset-chip {
      transition: none;
    }
  }
</style>
