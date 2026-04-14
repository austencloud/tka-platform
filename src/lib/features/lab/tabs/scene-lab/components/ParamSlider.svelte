<script lang="ts">
  /**
   * ParamSlider
   *
   * Labeled slider + number input for numeric scene params.
   * Binds a getter/setter pair rather than a value so deeply-nested state mutates.
   */

  interface Props {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    onChange: (next: number) => void;
  }

  let { label, value, min, max, step = 0.01, unit, onChange }: Props = $props();

  function clamp(n: number): number {
    if (Number.isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  }
</script>

<div class="param-slider">
  <div class="label-row">
    <span class="label">{label}</span>
    {#if unit}
      <span class="unit">{unit}</span>
    {/if}
  </div>
  <div class="controls">
    <input
      type="range"
      {min}
      {max}
      {step}
      {value}
      oninput={(e) => onChange(clamp(+e.currentTarget.value))}
    />
    <input
      type="number"
      {min}
      {max}
      {step}
      {value}
      onchange={(e) => onChange(clamp(+e.currentTarget.value))}
    />
  </div>
</div>

<style>
  .param-slider {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 0;
  }

  .label-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-weight: 500;
  }

  .unit {
    font-size: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-variant-numeric: tabular-nums;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    flex: 1;
    min-width: 0;
    height: 4px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 2px;
    cursor: pointer;
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    background: var(--theme-accent, #38bdf8);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: var(--theme-accent, #38bdf8);
    border: none;
    border-radius: 50%;
    cursor: pointer;
  }

  input[type="number"] {
    width: 60px;
    padding: 4px 6px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    color: var(--theme-text, white);
    font-size: var(--font-size-compact, 12px);
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  input[type="number"]:focus {
    outline: none;
    border-color: var(--theme-accent, #38bdf8);
  }

  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
</style>
