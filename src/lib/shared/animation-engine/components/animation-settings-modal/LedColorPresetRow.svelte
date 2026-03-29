<script lang="ts">
  import { onDestroy } from "svelte";
  import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";
  import { BUILT_IN_COLOR_PRESETS, type LedColorPreset } from "../../domain/types/LedColorPresets";

  const vm = getAnimationVisibilityManager();

  let activePresetId = $state(vm.getActivePresetId());
  let userPresets = $state<LedColorPreset[]>(vm.getUserPresets());
  let colorInputRef: HTMLInputElement | null = $state(null);

  function handleVisibilityChange(): void {
    activePresetId = vm.getActivePresetId();
    userPresets = vm.getUserPresets();
  }

  vm.registerObserver(handleVisibilityChange);
  onDestroy(() => vm.unregisterObserver(handleVisibilityChange));

  function selectPreset(id: string) {
    vm.setActivePreset(id);
  }

  function addCustomColor(event: Event) {
    const input = event.target as HTMLInputElement;
    const color = input.value;
    vm.addUserPreset("Custom", color);
  }

  function openColorPicker() {
    colorInputRef?.click();
  }

  function removePreset(id: string) {
    vm.removeUserPreset(id);
  }

  const allPresets: LedColorPreset[] = $derived([...BUILT_IN_COLOR_PRESETS, ...userPresets]);
</script>

<div class="preset-row">
  {#each allPresets as preset (preset.id)}
    <button
      type="button"
      class="swatch"
      class:active={activePresetId === preset.id}
      style="--swatch-color: {preset.primaryColor}"
      title={preset.name}
      aria-label="Select {preset.name} color preset"
      aria-pressed={activePresetId === preset.id}
      onclick={() => selectPreset(preset.id)}
      oncontextmenu={(e) => {
        if (!preset.builtIn) {
          e.preventDefault();
          removePreset(preset.id);
        }
      }}
    ></button>
  {/each}

  <button
    type="button"
    class="swatch add-btn"
    title="Add custom color"
    aria-label="Add custom color"
    onclick={openColorPicker}
  >
    <i class="fas fa-plus" aria-hidden="true"></i>
  </button>

  <input
    bind:this={colorInputRef}
    type="color"
    class="hidden-color-input"
    value="#ffffff"
    oninput={addCustomColor}
    aria-hidden="true"
    tabindex={-1}
  />
</div>

<style>
  .preset-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .swatch {
    width: 26px;
    height: 26px;
    min-width: 26px;
    border-radius: 50%;
    border: 2px solid transparent;
    background: var(--swatch-color, var(--theme-card-bg));
    cursor: pointer;
    padding: 0;
    transition: border-color var(--duration-fast, 100ms) ease,
      box-shadow var(--duration-fast, 100ms) ease;
  }

  .swatch:hover {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--swatch-color, white) 40%, transparent);
  }

  .swatch.active {
    border-color: white;
    box-shadow: 0 0 6px color-mix(in srgb, var(--swatch-color, white) 60%, transparent);
  }

  .swatch:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .add-btn {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px dashed var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 10px;
  }

  .add-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .hidden-color-input {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .swatch {
      transition: none;
    }
  }
</style>
