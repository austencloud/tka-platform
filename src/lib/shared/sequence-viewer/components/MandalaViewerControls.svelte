<script lang="ts">
  import type { MandalaPathShape } from "$lib/shared/mandala/components/SequenceMandala.svelte";

  export type MandalaColorMode = "solid" | "flow";
  export type MandalaPresetId = "aurora" | "neon" | "ember" | "twilight" | "ice" | "solar" | "custom";

  export interface PresetDisplay { id: MandalaPresetId; label: string; colors: [string, string] }

  export const PRESETS: PresetDisplay[] = [
    { id: "aurora", label: "Aurora", colors: ["#00e5ff", "#76ff03"] },
    { id: "neon", label: "Neon", colors: ["#ff0099", "#00ddff"] },
    { id: "ember", label: "Ember", colors: ["#ff3d00", "#ffd600"] },
    { id: "twilight", label: "Twilight", colors: ["#aa00ff", "#f50057"] },
    { id: "ice", label: "Ice", colors: ["#4dd0e1", "#b388ff"] },
    { id: "solar", label: "Solar", colors: ["#ffab00", "#dd2c00"] },
  ];

  interface Props {
    paused: boolean;
    pathShape: MandalaPathShape;
    rotation: number;
    speed: number;
    depth: number;
    colorMode: MandalaColorMode;
    preset: MandalaPresetId;
    customBlue: string;
    customRed: string;
    strokeWidth: number;
    onPausedChange: (v: boolean) => void;
    onPathShapeChange: (v: MandalaPathShape) => void;
    onRotationChange: (v: number) => void;
    onSpeedChange: (v: number) => void;
    onDepthChange: (v: number) => void;
    onColorModeChange: (v: MandalaColorMode) => void;
    onPresetChange: (v: MandalaPresetId) => void;
    onCustomBlueChange: (v: string) => void;
    onCustomRedChange: (v: string) => void;
    onStrokeWidthChange: (v: number) => void;
    onDownload?: () => void;
  }

  let {
    paused,
    pathShape,
    rotation,
    speed,
    depth,
    colorMode,
    preset,
    customBlue,
    customRed,
    strokeWidth,
    onPausedChange,
    onPathShapeChange,
    onRotationChange,
    onSpeedChange,
    onDepthChange,
    onColorModeChange,
    onPresetChange,
    onCustomBlueChange,
    onCustomRedChange,
    onStrokeWidthChange,
    onDownload,
  }: Props = $props();

  const PATH_SHAPES: { id: MandalaPathShape; label: string }[] = [
    { id: "arc", label: "Arc" },
    { id: "linear", label: "Linear" },
    { id: "concave", label: "Concave" },
    { id: "motion-aware", label: "Hybrid" },
  ];

  const SPEEDS: { value: number; label: string }[] = [
    { value: 0.5, label: "0.5x" },
    { value: 1, label: "1x" },
    { value: 1.5, label: "1.5x" },
    { value: 2, label: "2x" },
    { value: 3, label: "3x" },
  ];

  const STROKE_WIDTHS: { value: number; label: string }[] = [
    { value: 1, label: "Thin" },
    { value: 2.5, label: "Normal" },
    { value: 4, label: "Thick" },
  ];
</script>

<div class="mandala-controls">
  <div class="controls-top">
    <div class="control-group">
      <div class="transport-row">
        <button
          type="button"
          class="chip transport-chip"
          class:active={!paused}
          onclick={() => onPausedChange(!paused)}
          aria-label={paused ? "Play" : "Pause"}
          aria-pressed={!paused}
        >
          <i class="fas {paused ? 'fa-play' : 'fa-pause'}" aria-hidden="true"></i>
        </button>
        <span class="setting-label">Breathe</span>
      </div>
      <div class="chip-grid cols-5">
        {#each SPEEDS as s}
          <button
            type="button"
            class="chip"
            class:active={speed === s.value}
            onclick={() => onSpeedChange(s.value)}
            aria-pressed={speed === s.value}
          >{s.label}</button>
        {/each}
      </div>
    </div>

    <div class="control-group">
      <span class="setting-label">Path Shape</span>
      <div class="chip-grid cols-4">
        {#each PATH_SHAPES as shape}
          <button
            type="button"
            class="chip"
            class:active={pathShape === shape.id}
            onclick={() => onPathShapeChange(shape.id)}
            aria-pressed={pathShape === shape.id}
          >{shape.label}</button>
        {/each}
      </div>
    </div>

    <div class="control-group">
      <div class="slider-row">
        <span class="setting-label">Spin</span>
        <input
          type="range"
          min="0"
          max="360"
          step="15"
          value={rotation}
          oninput={(e) => onRotationChange(Number((e.target as HTMLInputElement).value))}
          class="slider"
        />
        <span class="slider-value">{rotation}°</span>
      </div>
    </div>

    <div class="control-group">
      <div class="color-header">
        <span class="setting-label">Colors</span>
        <div class="mode-toggle">
          <button
            type="button"
            class="chip mini-chip"
            class:active={colorMode === "solid"}
            onclick={() => onColorModeChange("solid")}
            aria-pressed={colorMode === "solid"}
          >Solid</button>
          <button
            type="button"
            class="chip mini-chip"
            class:active={colorMode === "flow"}
            onclick={() => onColorModeChange("flow")}
            aria-pressed={colorMode === "flow"}
          >Flow</button>
        </div>
      </div>
      <div class="chip-grid cols-3">
        {#each PRESETS as p}
          <button
            type="button"
            class="chip color-chip"
            class:active={preset === p.id}
            onclick={() => onPresetChange(p.id)}
            aria-pressed={preset === p.id}
          >
            <span class="color-dots">
              <span class="color-dot" style:background={p.colors[0]}></span>
              <span class="color-dot" style:background={p.colors[1]}></span>
            </span>
            <span>{p.label}</span>
          </button>
        {/each}
        <button
          type="button"
          class="chip color-chip"
          class:active={preset === "custom"}
          onclick={() => onPresetChange("custom")}
          aria-pressed={preset === "custom"}
        >
          <span class="color-dots">
            <span class="color-dot" style:background={customBlue}></span>
            <span class="color-dot" style:background={customRed}></span>
          </span>
          <span>Custom</span>
        </button>
      </div>
      {#if preset === "custom"}
        <div class="custom-pickers">
          <label class="picker-label">
            <input
              type="color"
              value={customBlue}
              oninput={(e) => onCustomBlueChange((e.target as HTMLInputElement).value)}
              class="color-input"
            />
            <span>Blue hand</span>
          </label>
          <label class="picker-label">
            <input
              type="color"
              value={customRed}
              oninput={(e) => onCustomRedChange((e.target as HTMLInputElement).value)}
              class="color-input"
            />
            <span>Red hand</span>
          </label>
        </div>
      {/if}
    </div>

    <div class="control-group">
      <span class="setting-label">Line Weight</span>
      <div class="chip-grid cols-3">
        {#each STROKE_WIDTHS as sw}
          <button
            type="button"
            class="chip"
            class:active={strokeWidth === sw.value}
            onclick={() => onStrokeWidthChange(sw.value)}
            aria-pressed={strokeWidth === sw.value}
          >{sw.label}</button>
        {/each}
      </div>
    </div>

    <div class="control-group">
      <div class="slider-row">
        <span class="setting-label">Depth</span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={depth}
          oninput={(e) => onDepthChange(Number((e.target as HTMLInputElement).value))}
          class="slider"
        />
        <span class="slider-value">{depth}%</span>
      </div>
    </div>
  </div>

  {#if onDownload}
    <button
      type="button"
      class="download-btn"
      onclick={onDownload}
      aria-label="Download animation"
    >
      <i class="fas fa-download" aria-hidden="true"></i>
      <span>Download Animation</span>
    </button>
  {/if}

</div>

<style>
  .mandala-controls {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 16px;
  }

  .controls-top {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .transport-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .transport-chip {
    flex-shrink: 0;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .color-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .mode-toggle {
    display: flex;
    gap: 4px;
  }

  .mini-chip {
    min-height: 28px;
    padding: 4px 10px;
    font-size: 11px;
  }

  .setting-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .chip-grid {
    display: grid;
    gap: 6px;
  }

  .chip-grid.cols-3 {
    grid-template-columns: repeat(3, 1fr);
  }

  .chip-grid.cols-4 {
    grid-template-columns: repeat(4, 1fr);
  }

  .chip-grid.cols-5 {
    grid-template-columns: repeat(5, 1fr);
  }

  .chip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    padding: 8px 6px;
    background: color-mix(in srgb, var(--theme-card-bg, rgba(255, 255, 255, 0.04)) 70%, transparent);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .chip:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .chip:active {
    transform: scale(0.92);
    transition-duration: 50ms;
  }

  .chip.active {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 35%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 60%, transparent);
    color: white;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
  }

  .chip:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    outline-offset: 2px;
  }

  .color-chip {
    flex-direction: column;
    gap: 4px;
    padding: 6px 4px;
  }

  .color-dots {
    display: flex;
    gap: 3px;
  }

  .color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .custom-pickers {
    display: flex;
    gap: 12px;
    padding: 8px 0;
  }

  .picker-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
  }

  .color-input {
    width: 32px;
    height: 32px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    cursor: pointer;
    background: none;
    padding: 2px;
  }

  .color-input::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .color-input::-webkit-color-swatch {
    border: none;
    border-radius: 6px;
  }

  .slider {
    flex: 1;
    height: 6px;
    appearance: none;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 3px;
    cursor: pointer;
  }

  .slider::-webkit-slider-thumb {
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--theme-accent, #6366f1);
    border: 2px solid var(--theme-panel-bg, rgba(10, 10, 26, 0.9));
    cursor: pointer;
    transition: transform 0.1s ease;
  }

  .slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }

  .slider-value {
    font-size: 13px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-variant-numeric: tabular-nums;
    min-width: 40px;
    text-align: right;
  }

  .download-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 48px;
    margin-top: auto;
    padding: 12px 16px;
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 25%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    border: 1px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    border-radius: 10px;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .download-btn:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 40%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 70%, transparent);
  }

  .download-btn:active {
    transform: scale(0.96);
    transition-duration: 50ms;
  }

  .download-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .chip,
    .download-btn {
      transition: none !important;
    }
    .chip:active,
    .download-btn:active {
      transform: none !important;
    }
  }
</style>
