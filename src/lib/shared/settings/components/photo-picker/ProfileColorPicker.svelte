<!--
  ProfileColorPicker.svelte

  A compact color swatch picker for the user's profile accent color.
  This color is used for the avatar ring and profile card accents.
  Users pick from curated presets or enter a custom hex value.
-->
<script lang="ts">
  interface Props {
    selectedColor: string;
    onColorChange: (color: string) => void;
    saving?: boolean;
  }

  let { selectedColor, onColorChange, saving = false }: Props = $props();

  // Curated color presets organized by tone.
  // Each row is a visual group in the picker grid.
  const COLOR_PRESETS = [
    // Vibrant
    { hex: "#ef4444", name: "Red" },
    { hex: "#f97316", name: "Orange" },
    { hex: "#eab308", name: "Yellow" },
    { hex: "#22c55e", name: "Green" },
    { hex: "#06b6d4", name: "Cyan" },
    { hex: "#3b82f6", name: "Blue" },
    { hex: "#8b5cf6", name: "Violet" },
    { hex: "#ec4899", name: "Pink" },
    // Muted / Earth
    { hex: "#d97706", name: "Amber" },
    { hex: "#65a30d", name: "Lime" },
    { hex: "#0d9488", name: "Teal" },
    { hex: "#7c3aed", name: "Purple" },
    { hex: "#db2777", name: "Fuchsia" },
    { hex: "#dc2626", name: "Crimson" },
    { hex: "#2563eb", name: "Royal Blue" },
    { hex: "#059669", name: "Emerald" },
  ];

  let showCustomInput = $state(false);
  let customHex = $state(selectedColor);

  // Whether the current selection matches a preset
  const isPreset = $derived(
    COLOR_PRESETS.some((p) => p.hex.toLowerCase() === selectedColor.toLowerCase())
  );

  function handlePresetClick(hex: string) {
    showCustomInput = false;
    onColorChange(hex);
  }

  function handleCustomSubmit() {
    // Normalize: accept "#abc", "#aabbcc", "abc", "aabbcc"
    let value = customHex.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$/.test(value)) {
      value = value
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (/^[0-9a-fA-F]{6}$/.test(value)) {
      onColorChange(`#${value}`);
    }
  }

  function handleCustomKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCustomSubmit();
    }
  }
</script>

<div class="profile-color-picker">
  <h4 class="picker-label">Profile Color</h4>
  <p class="picker-desc">Ring color around your avatar</p>

  <div class="color-grid" role="radiogroup" aria-label="Profile color presets">
    {#each COLOR_PRESETS as preset (preset.hex)}
      {@const isSelected =
        preset.hex.toLowerCase() === selectedColor.toLowerCase()}
      <button
        class="color-swatch"
        class:selected={isSelected}
        style="--swatch-color: {preset.hex}"
        onclick={() => handlePresetClick(preset.hex)}
        disabled={saving}
        role="radio"
        aria-checked={isSelected}
        aria-label={preset.name}
        title={preset.name}
      >
        {#if isSelected}
          <i class="fas fa-check" aria-hidden="true"></i>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Custom color toggle -->
  <button
    class="custom-toggle"
    class:active={showCustomInput || !isPreset}
    onclick={() => {
      showCustomInput = !showCustomInput;
      customHex = selectedColor;
    }}
    disabled={saving}
  >
    <div
      class="custom-preview"
      style="background: {selectedColor}"
      aria-hidden="true"
    ></div>
    <span>Custom color</span>
    <i
      class="fas {showCustomInput ? 'fa-chevron-up' : 'fa-chevron-down'}"
      aria-hidden="true"
    ></i>
  </button>

  {#if showCustomInput}
    <div class="custom-input-row">
      <input
        type="color"
        value={selectedColor}
        oninput={(e) => {
          const value = (e.target as HTMLInputElement).value;
          customHex = value;
          onColorChange(value);
        }}
        disabled={saving}
        class="native-color-input"
        aria-label="Pick a custom color"
      />
      <input
        type="text"
        bind:value={customHex}
        onkeydown={handleCustomKeydown}
        onblur={handleCustomSubmit}
        placeholder="#8b5cf6"
        maxlength="7"
        disabled={saving}
        class="hex-input"
        aria-label="Custom hex color"
      />
      <button
        class="apply-btn"
        onclick={handleCustomSubmit}
        disabled={saving}
        aria-label="Apply custom color"
      >
        <i class="fas fa-check" aria-hidden="true"></i>
      </button>
    </div>
  {/if}
</div>

<style>
  .profile-color-picker {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
  }

  .picker-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    margin: 0;
    color: var(--theme-text, #ffffff);
  }

  .picker-desc {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin: 0;
  }

  /* ═══════ Color Grid ═══════ */

  .color-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 6px;
  }

  .color-swatch {
    aspect-ratio: 1;
    min-width: 28px;
    min-height: 28px;
    border-radius: 50%;
    border: 2px solid transparent;
    background: var(--swatch-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      border-color 0.15s ease,
      transform 0.15s ease,
      box-shadow 0.15s ease;
    padding: 0;
    color: white;
    font-size: 10px;
  }

  .color-swatch:hover:not(:disabled) {
    transform: scale(1.15);
    border-color: rgba(255, 255, 255, 0.4);
  }

  .color-swatch.selected {
    border-color: white;
    box-shadow: 0 0 0 2px var(--swatch-color), 0 0 12px var(--swatch-color);
    transform: scale(1.1);
  }

  .color-swatch:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .color-swatch:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .color-swatch i {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
  }

  /* ═══════ Custom Color Toggle ═══════ */

  .custom-toggle {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    padding: 8px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-sm, 8px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: var(--min-touch-target, 44px);
  }

  .custom-toggle:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .custom-toggle.active {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .custom-toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .custom-preview {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
    flex-shrink: 0;
  }

  .custom-toggle span {
    flex: 1;
    text-align: left;
  }

  .custom-toggle i {
    font-size: 10px;
    opacity: 0.5;
  }

  /* ═══════ Custom Input Row ═══════ */

  .custom-input-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .native-color-input {
    width: 40px;
    height: 40px;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-sm, 8px);
    background: transparent;
    cursor: pointer;
    padding: 2px;
  }

  .native-color-input::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .native-color-input::-webkit-color-swatch {
    border: none;
    border-radius: 6px;
  }

  .hex-input {
    flex: 1;
    padding: 8px 12px;
    min-height: var(--min-touch-target, 44px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-sm, 8px);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    font-family: monospace;
  }

  .hex-input:focus {
    outline: none;
    border-color: var(--theme-accent, #6366f1);
  }

  .hex-input:disabled {
    opacity: 0.5;
  }

  .apply-btn {
    width: 40px;
    height: 40px;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    border-radius: var(--radius-sm, 8px);
    background: var(--theme-accent, #6366f1);
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.15s ease;
  }

  .apply-btn:hover:not(:disabled) {
    opacity: 0.85;
  }

  .apply-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ═══════ Accessibility ═══════ */

  @media (prefers-reduced-motion: reduce) {
    .color-swatch,
    .custom-toggle {
      transition: none;
    }

    .color-swatch:hover:not(:disabled) {
      transform: none;
    }

    .color-swatch.selected {
      transform: none;
    }
  }
</style>
