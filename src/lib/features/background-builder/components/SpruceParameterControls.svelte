<script lang="ts">
  import type { SmoothParams, WhorlParams, SpruceAlgorithm } from "../services/contracts/ITreeLabRenderer";
  import ChipToggle from "$lib/shared/components/selection/ChipToggle.svelte";
  import ChipGroup from "$lib/shared/components/selection/ChipGroup.svelte";

  interface Props {
    algorithm: SpruceAlgorithm;
    smoothParams: SmoothParams;
    whorlParams: WhorlParams;
    onAlgorithmChange: (algorithm: SpruceAlgorithm) => void;
    onSmoothParamsChange: (params: SmoothParams) => void;
    onWhorlParamsChange: (params: WhorlParams) => void;
    onReset: () => void;
    onRandomizeSeeds: () => void;
  }

  let {
    algorithm,
    smoothParams,
    whorlParams,
    onAlgorithmChange,
    onSmoothParamsChange,
    onWhorlParamsChange,
    onReset,
    onRandomizeSeeds,
  }: Props = $props();

  function updateSmoothParam<K extends keyof SmoothParams>(key: K, value: SmoothParams[K]) {
    onSmoothParamsChange({ ...smoothParams, [key]: value });
  }

  function updateWhorlParam<K extends keyof WhorlParams>(key: K, value: WhorlParams[K]) {
    onWhorlParamsChange({ ...whorlParams, [key]: value });
  }
</script>

<!-- Algorithm Selector -->
<ChipGroup label="Algorithm" variant="row">
  <ChipToggle
    label="Whorl"
    active={algorithm === "whorl"}
    color="lime"
    onclick={() => onAlgorithmChange("whorl")}
  />
  <ChipToggle
    label="Smooth"
    active={algorithm === "smooth"}
    color="lime"
    onclick={() => onAlgorithmChange("smooth")}
  />
</ChipGroup>

<!-- Algorithm-specific Parameter Sliders -->
<div class="params-section">
  <div class="section-header">
    <span class="label">{algorithm === "whorl" ? "Branch Layers" : "Organic Taper"}</span>
    <button class="reset-btn" onclick={onReset} title="Reset to defaults">
      <i class="fas fa-undo"></i>
    </button>
  </div>

  {#if algorithm === "whorl"}
    <!-- Whorl Algorithm Parameters -->
    <div class="slider-group">
      <label class="slider-label">
        <span>Spread</span>
        <span class="slider-value">{whorlParams.spread.toFixed(2)}</span>
      </label>
      <input type="range" min="0.40" max="0.65" step="0.01" value={whorlParams.spread}
        oninput={(e) => updateWhorlParam("spread", parseFloat(e.currentTarget.value))} />
      <div class="slider-labels"><span>Narrow</span><span>Wide</span></div>
    </div>

    <div class="slider-group">
      <label class="slider-label">
        <span>Taper</span>
        <span class="slider-value">{whorlParams.taperExponent.toFixed(1)}</span>
      </label>
      <input type="range" min="1.2" max="2.0" step="0.1" value={whorlParams.taperExponent}
        oninput={(e) => updateWhorlParam("taperExponent", parseFloat(e.currentTarget.value))} />
      <div class="slider-labels"><span>Columnar</span><span>Conical</span></div>
    </div>

    <div class="slider-group">
      <label class="slider-label">
        <span>Layers</span>
        <span class="slider-value">{whorlParams.layers}</span>
      </label>
      <input type="range" min="6" max="12" step="1" value={whorlParams.layers}
        oninput={(e) => updateWhorlParam("layers", parseInt(e.currentTarget.value))} />
      <div class="slider-labels"><span>Few</span><span>Many</span></div>
    </div>

    <div class="slider-group">
      <label class="slider-label">
        <span>Droop</span>
        <span class="slider-value">{whorlParams.droop.toFixed(2)}</span>
      </label>
      <input type="range" min="0.05" max="0.35" step="0.02" value={whorlParams.droop}
        oninput={(e) => updateWhorlParam("droop", parseFloat(e.currentTarget.value))} />
      <div class="slider-labels"><span>Upright</span><span>Droopy</span></div>
    </div>

    <div class="slider-group">
      <label class="slider-label">
        <span>Jaggedness</span>
        <span class="slider-value">{whorlParams.jaggedness.toFixed(1)}</span>
      </label>
      <input type="range" min="0.5" max="2.0" step="0.1" value={whorlParams.jaggedness}
        oninput={(e) => updateWhorlParam("jaggedness", parseFloat(e.currentTarget.value))} />
      <div class="slider-labels"><span>Smooth</span><span>Jagged</span></div>
    </div>

  {:else}
    <!-- Smooth Algorithm Parameters -->
    <div class="slider-group">
      <label class="slider-label">
        <span>Spread</span>
        <span class="slider-value">{smoothParams.spread.toFixed(2)}</span>
      </label>
      <input type="range" min="0.45" max="0.65" step="0.01" value={smoothParams.spread}
        oninput={(e) => updateSmoothParam("spread", parseFloat(e.currentTarget.value))} />
      <div class="slider-labels"><span>Narrow</span><span>Wide</span></div>
    </div>

    <div class="slider-group">
      <label class="slider-label">
        <span>Taper</span>
        <span class="slider-value">{smoothParams.taperPower.toFixed(2)}</span>
      </label>
      <input type="range" min="0.45" max="0.75" step="0.02" value={smoothParams.taperPower}
        oninput={(e) => updateSmoothParam("taperPower", parseFloat(e.currentTarget.value))} />
      <div class="slider-labels"><span>Columnar</span><span>Conical</span></div>
    </div>

    <div class="slider-group">
      <label class="slider-label">
        <span>Wave Frequency</span>
        <span class="slider-value">{smoothParams.waveFreq.toFixed(0)}</span>
      </label>
      <input type="range" min="4" max="10" step="1" value={smoothParams.waveFreq}
        oninput={(e) => updateSmoothParam("waveFreq", parseFloat(e.currentTarget.value))} />
      <div class="slider-labels"><span>Few</span><span>Many</span></div>
    </div>

    <div class="slider-group">
      <label class="slider-label">
        <span>Wave Amplitude</span>
        <span class="slider-value">{smoothParams.waveAmp.toFixed(1)}</span>
      </label>
      <input type="range" min="2" max="8" step="0.5" value={smoothParams.waveAmp}
        oninput={(e) => updateSmoothParam("waveAmp", parseFloat(e.currentTarget.value))} />
      <div class="slider-labels"><span>Subtle</span><span>Strong</span></div>
    </div>

    <div class="slider-group">
      <label class="slider-label">
        <span>Jitter</span>
        <span class="slider-value">{smoothParams.jitter.toFixed(1)}</span>
      </label>
      <input type="range" min="0" max="4" step="0.5" value={smoothParams.jitter}
        oninput={(e) => updateSmoothParam("jitter", parseFloat(e.currentTarget.value))} />
      <div class="slider-labels"><span>None</span><span>Random</span></div>
    </div>
  {/if}
</div>

<button class="action-btn" onclick={onRandomizeSeeds}>
  <i class="fas fa-dice"></i>
  New Random Seeds
</button>

<style>
  .params-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .label {
    font-size: 0.8rem;
    font-weight: 500;
    color: #a3e635;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .reset-btn {
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #9ca3af;
    font-size: 0.7rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .reset-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .slider-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .slider-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
    color: #d1d5db;
  }

  .slider-value {
    font-family: monospace;
    font-size: 0.75rem;
    color: #a3e635;
    min-width: 36px;
    text-align: right;
  }

  .slider-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.65rem;
    color: #6b7280;
    margin-top: 2px;
  }

  .params-section input[type="range"] {
    width: 100%;
    height: 6px;
    appearance: none;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    outline: none;
    cursor: pointer;
  }

  .params-section input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    background: linear-gradient(135deg, #84cc16, #65a30d);
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.15s ease;
  }

  .params-section input[type="range"]::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }

  .params-section input[type="range"]::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: linear-gradient(135deg, #84cc16, #65a30d);
    border: none;
    border-radius: 50%;
    cursor: pointer;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #84cc16, #65a30d);
    border: none;
    border-radius: 12px;
    color: #ffffff;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 20px rgba(132, 204, 22, 0.35);
  }

  .action-btn:active {
    transform: translateY(0);
  }
</style>
