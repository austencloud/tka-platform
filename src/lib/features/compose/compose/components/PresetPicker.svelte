<script lang="ts">
  /**
   * PresetPicker - Full-screen preset selection for new compositions
   *
   * Entry gate for the CompositionBuilder. Users either:
   * 1. Pick a built-in template preset
   * 2. Pick a custom preset (created in Composition Lab)
   * 3. Click "Build Custom" to go to the Composition Lab
   */

  import { onMount } from "svelte";
  import { LAYOUT_PRESETS } from "$lib/features/lab/constraint-layout-lab/services/layout-presets";
  import type { LayoutPreset } from "$lib/features/lab/constraint-layout-lab/domain/types";
  import {
    loadCustomPresets,
    type CustomPreset,
  } from "$lib/features/lab/constraint-layout-lab/services/layout-persistence";

  interface Props {
    onSelectPreset: (templateId: string) => void;
    onBuildCustom: () => void;
  }

  let { onSelectPreset, onBuildCustom }: Props = $props();

  // Custom presets from Composition Lab
  let customPresets = $state<CustomPreset[]>([]);

  // Load custom presets on mount
  onMount(() => {
    customPresets = loadCustomPresets();
  });

  // Focus management for accessibility
  let gridRef: HTMLDivElement | null = $state(null);

  // Calculate total items for keyboard navigation
  const totalBuiltIn = LAYOUT_PRESETS.length;
  const totalCustom = $derived(customPresets.length);
  const totalItems = $derived(totalBuiltIn + totalCustom + 1); // +1 for "Build Custom"

  // Keyboard navigation state
  let focusedIndex = $state(0);

  function handleKeyDown(e: KeyboardEvent) {
    const cols = getColumnCount();

    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        focusedIndex = (focusedIndex + 1) % totalItems;
        focusItem(focusedIndex);
        break;
      case "ArrowLeft":
        e.preventDefault();
        focusedIndex = (focusedIndex - 1 + totalItems) % totalItems;
        focusItem(focusedIndex);
        break;
      case "ArrowDown":
        e.preventDefault();
        focusedIndex = Math.min(focusedIndex + cols, totalItems - 1);
        focusItem(focusedIndex);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusedIndex = Math.max(focusedIndex - cols, 0);
        focusItem(focusedIndex);
        break;
      case "Home":
        e.preventDefault();
        focusedIndex = 0;
        focusItem(focusedIndex);
        break;
      case "End":
        e.preventDefault();
        focusedIndex = totalItems - 1;
        focusItem(focusedIndex);
        break;
    }
  }

  function getColumnCount(): number {
    if (!gridRef) return 3;
    const gridStyle = getComputedStyle(gridRef);
    const cols = gridStyle.gridTemplateColumns.split(" ").length;
    return cols || 3;
  }

  function focusItem(index: number) {
    if (!gridRef) return;
    const buttons = gridRef.querySelectorAll("button");
    const button = buttons[index] as HTMLButtonElement | undefined;
    button?.focus();
  }

  function handleSelectTemplate(preset: LayoutPreset) {
    onSelectPreset(preset.id);
  }

  function handleSelectCustomPreset(preset: CustomPreset) {
    // Custom presets use the same ID format, so just pass it through
    onSelectPreset(preset.id);
  }

  function handleBuildCustom() {
    // Just call the callback - CompositionLab is now embedded in Compose module
    onBuildCustom();
  }

  // Auto-focus first card on mount
  onMount(() => {
    const timeout = setTimeout(() => {
      focusItem(0);
    }, 100);
    return () => clearTimeout(timeout);
  });
</script>

<div
  class="preset-picker"
  role="region"
  aria-label="Choose a composition template"
>
  <header class="picker-header">
    <h1 class="picker-title">Start a Composition</h1>
    <p class="picker-subtitle">
      Choose a template or build from scratch
    </p>
  </header>

  <!-- Template Grid -->
  <div
    class="templates-grid"
    role="grid"
    aria-label="Composition templates"
    tabindex="-1"
    bind:this={gridRef}
    onkeydown={handleKeyDown}
  >
    <!-- Built-in Presets -->
    {#each LAYOUT_PRESETS as preset, index (preset.id)}
      <button
        class="template-card"
        style:--template-color="#8b5cf6"
        onclick={() => handleSelectTemplate(preset)}
        tabindex={index === focusedIndex ? 0 : -1}
        aria-label="{preset.name}: {preset.description}"
      >
        <div class="preset-preview" aria-hidden="true">
          <i class="fas fa-{preset.icon}" aria-hidden="true"></i>
        </div>

        <div class="template-info">
          <span class="template-name">{preset.name}</span>
          <span class="template-description">{preset.description}</span>
        </div>
      </button>
    {/each}

    <!-- Custom Presets from Composition Lab -->
    {#each customPresets as preset, index (preset.id)}
      {@const globalIndex = totalBuiltIn + index}
      <button
        class="template-card custom-preset-card"
        style:--template-color="#8b5cf6"
        onclick={() => handleSelectCustomPreset(preset)}
        tabindex={globalIndex === focusedIndex ? 0 : -1}
        aria-label="{preset.name}: {preset.description}"
      >
        <div class="custom-preview" aria-hidden="true">
          <i class="fas fa-{preset.icon}" aria-hidden="true"></i>
          <span class="cell-count">{preset.cells.length}</span>
        </div>
        <div class="template-info">
          <span class="template-name">{preset.name}</span>
          <span class="template-description">{preset.description}</span>
        </div>
        <span class="custom-badge">Custom</span>
      </button>
    {/each}

    <!-- Build Custom Button -->
    <button
      class="template-card build-custom-card"
      onclick={handleBuildCustom}
      tabindex={focusedIndex === totalBuiltIn + totalCustom ? 0 : -1}
      aria-label="Build Custom: Open the Composition Lab to design your own layout"
    >
      <div class="build-custom-preview" aria-hidden="true">
        <i class="fas fa-flask"></i>
      </div>
      <div class="template-info">
        <span class="template-name">Build Custom</span>
        <span class="template-description">Open Composition Lab</span>
      </div>
    </button>
  </div>
</div>

<style>
  .preset-picker {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: clamp(16px, 4cqi, 32px);
    container-type: size;
    container-name: picker;
    overflow-y: auto;
  }

  .picker-header {
    text-align: center;
    margin-bottom: clamp(24px, 6cqi, 48px);
  }

  .picker-title {
    font-size: clamp(1.5rem, 5cqi, 2.25rem);
    font-weight: 700;
    color: var(--theme-text, rgba(255, 255, 255, 0.95));
    margin: 0 0 clamp(6px, 1.5cqi, 12px) 0;
  }

  .picker-subtitle {
    font-size: clamp(0.9rem, 3cqi, 1.1rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  /* Templates Grid */
  .templates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(clamp(140px, 25cqi, 180px), 1fr));
    gap: clamp(12px, 3cqi, 20px);
    width: 100%;
    max-width: 900px;
    justify-content: center;
  }

  /* Template Card */
  .template-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(10px, 2.5cqi, 16px);
    padding: clamp(16px, 4cqi, 24px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: clamp(1px, 0.3cqi, 2px) solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: clamp(10px, 2.5cqi, 16px);
    cursor: pointer;
    transition:
      background var(--duration-normal, 150ms) ease,
      border-color var(--duration-normal, 150ms) ease,
      transform var(--duration-normal, 150ms) ease,
      box-shadow var(--duration-normal, 150ms) ease;
    min-height: var(--min-touch-target);
  }

  .template-card:hover {
    background: color-mix(in srgb, var(--template-color, #3b82f6) 15%, transparent);
    border-color: var(--template-color, #3b82f6);
    transform: translateY(clamp(-2px, -0.5cqi, -4px));
    box-shadow: 0 clamp(4px, 1cqi, 8px) clamp(16px, 4cqi, 24px) rgba(0, 0, 0, 0.3);
  }

  .template-card:focus-visible {
    outline: 2px solid var(--template-color, #3b82f6);
    outline-offset: 2px;
    border-color: var(--template-color, #3b82f6);
    background: color-mix(in srgb, var(--template-color, #3b82f6) 20%, transparent);
  }

  .template-card:active {
    transform: translateY(0);
  }

  /* Template Preview */
  /* Template Info */
  .template-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(2px, 0.5cqi, 4px);
    text-align: center;
  }

  .template-name {
    font-size: clamp(0.9rem, 3cqi, 1.05rem);
    font-weight: 600;
    color: var(--theme-text, rgba(255, 255, 255, 0.95));
  }

  .template-description {
    font-size: clamp(0.7rem, 2.2cqi, 0.8rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  /* Custom Preset Card */
  .custom-preset-card {
    --template-color: #8b5cf6;
  }

  .preset-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(60px, 15cqi, 96px);
    height: clamp(60px, 15cqi, 96px);
    background: rgba(0, 0, 0, 0.3);
    border-radius: clamp(6px, 1.5cqi, 10px);
    font-size: clamp(1.5rem, 5cqi, 2rem);
    color: var(--template-color);
  }

  .custom-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(4px, 1cqi, 8px);
    width: clamp(60px, 15cqi, 96px);
    height: clamp(60px, 15cqi, 96px);
    background: rgba(0, 0, 0, 0.3);
    border-radius: clamp(6px, 1.5cqi, 10px);
    font-size: clamp(1.25rem, 4cqi, 1.75rem);
    color: var(--template-color);
  }

  .cell-count {
    font-size: clamp(0.65rem, 2cqi, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .custom-badge {
    position: absolute;
    top: clamp(6px, 1.5cqi, 10px);
    right: clamp(6px, 1.5cqi, 10px);
    padding: 2px 6px;
    background: rgba(139, 92, 246, 0.3);
    border-radius: 4px;
    font-size: clamp(0.6rem, 1.8cqi, 0.7rem);
    color: rgba(167, 139, 250, 0.95);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Build Custom Card */
  .build-custom-card {
    --template-color: rgba(255, 255, 255, 0.3);
    border-style: dashed;
  }

  .build-custom-card:hover {
    --template-color: #06b6d4;
  }

  .build-custom-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(60px, 15cqi, 96px);
    height: clamp(60px, 15cqi, 96px);
    background: rgba(0, 0, 0, 0.3);
    border-radius: clamp(6px, 1.5cqi, 10px);
    font-size: clamp(1.5rem, 5cqi, 2rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .build-custom-card:hover .build-custom-preview {
    color: var(--template-color);
  }

  /* Responsive adjustments */
  @container picker (max-height: 500px) {
    .picker-header {
      margin-bottom: clamp(12px, 3cqi, 20px);
    }

    .picker-title {
      font-size: clamp(1.25rem, 4cqi, 1.5rem);
    }

    .template-card {
      padding: clamp(10px, 2.5cqi, 16px);
      gap: clamp(6px, 1.5cqi, 10px);
    }

    .template-preview,
    .custom-preview,
    .build-custom-preview {
      padding: clamp(6px, 1.5cqi, 10px);
    }

    .preview-cell {
      width: clamp(22px, 5.5cqi, 32px);
      height: clamp(22px, 5.5cqi, 32px);
    }

    .custom-preview,
    .build-custom-preview {
      width: clamp(48px, 12cqi, 72px);
      height: clamp(48px, 12cqi, 72px);
    }
  }

  @container picker (max-width: 400px) {
    .templates-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .template-card {
      transition: none;
    }

    .template-card:hover {
      transform: none;
    }
  }
</style>
