<!--
  FingerSliderGroup.svelte — Sliders for one finger's 3 bone rotations.
  Thumb shows Y/Z sliders by default (abduction). Other fingers show X (flexion).
-->
<script lang="ts">
  interface Props {
    fingerName: string;
    isThumb?: boolean;
    rotations: { x: number; y: number; z: number }[];
    onchange: (boneIndex: number, axis: "x" | "y" | "z", degrees: number) => void;
  }

  let { fingerName, isThumb = false, rotations, onchange }: Props = $props();

  let showAllAxes = $state(false);

  const boneLabels = ["Base", "Mid", "Tip"];
</script>

<div class="finger-group">
  <div class="finger-header">
    <span class="finger-name">{fingerName}</span>
    <button
      class="axis-toggle"
      onclick={() => (showAllAxes = !showAllAxes)}
    >
      {showAllAxes ? "Simple" : "All Axes"}
    </button>
  </div>

  {#each boneLabels as label, i}
    {@const rot = rotations[i] ?? { x: 0, y: 0, z: 0 }}
    <div class="bone-section">
      <span class="bone-label">{label}</span>
      <div class="bone-sliders">
        <label class="slider-label">
          <span class="axis-label">X</span>
          <input
            type="range"
            min="-10"
            max="120"
            step="1"
            value={rot.x}
            oninput={(e) => onchange(i, "x", Number(e.currentTarget.value))}
          />
          <span class="value">{rot.x}°</span>
        </label>

        {#if isThumb || showAllAxes}
          <label class="slider-label">
            <span class="axis-label">Y</span>
            <input
              type="range"
              min="-90"
              max="90"
              step="1"
              value={rot.y}
              oninput={(e) => onchange(i, "y", Number(e.currentTarget.value))}
            />
            <span class="value">{rot.y}°</span>
          </label>
          <label class="slider-label">
            <span class="axis-label">Z</span>
            <input
              type="range"
              min="-90"
              max="90"
              step="1"
              value={rot.z}
              oninput={(e) => onchange(i, "z", Number(e.currentTarget.value))}
            />
            <span class="value">{rot.z}°</span>
          </label>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .finger-group {
    padding: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    margin-bottom: 8px;
    min-width: 0;
    overflow: hidden;
  }

  .finger-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .finger-name {
    font-weight: 600;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #fff);
  }

  .axis-toggle {
    font-size: var(--font-size-compact, 12px);
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    cursor: pointer;
  }

  .bone-section {
    display: flex;
    gap: 6px;
    margin-bottom: 4px;
    align-items: flex-start;
  }

  .bone-label {
    width: 28px;
    flex-shrink: 0;
    padding-top: 2px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .bone-sliders {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .slider-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    min-width: 0;
  }

  .axis-label {
    width: 10px;
    flex-shrink: 0;
  }

  input[type="range"] {
    flex: 1;
    min-width: 0;
    height: 4px;
    accent-color: var(--theme-accent, #8b5cf6);
  }

  .value {
    width: 32px;
    flex-shrink: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
