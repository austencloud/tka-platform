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
    <div class="bone-row">
      <span class="bone-label">{label}</span>

      {#if isThumb || showAllAxes}
        <label class="slider-label">
          Y
          <input
            type="range"
            min="-90"
            max="90"
            step="1"
            value={rotations[i].y}
            oninput={(e) => onchange(i, "y", Number(e.currentTarget.value))}
          />
          <span class="value">{rotations[i].y}°</span>
        </label>
        <label class="slider-label">
          Z
          <input
            type="range"
            min="-90"
            max="90"
            step="1"
            value={rotations[i].z}
            oninput={(e) => onchange(i, "z", Number(e.currentTarget.value))}
          />
          <span class="value">{rotations[i].z}°</span>
        </label>
      {/if}

      <label class="slider-label">
        X
        <input
          type="range"
          min="-10"
          max="120"
          step="1"
          value={rotations[i].x}
          oninput={(e) => onchange(i, "x", Number(e.currentTarget.value))}
        />
        <span class="value">{rotations[i].x}°</span>
      </label>
    </div>
  {/each}
</div>

<style>
  .finger-group {
    padding: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    margin-bottom: 8px;
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

  .bone-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
  }

  .bone-label {
    width: 30px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .slider-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    flex: 1;
  }

  input[type="range"] {
    flex: 1;
    height: 4px;
    accent-color: var(--theme-accent, #8b5cf6);
  }

  .value {
    width: 36px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
