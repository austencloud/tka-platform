<script lang="ts">
  import type { TieredParams, WindsweptParams, PineAlgorithm } from "../services/contracts/ITreeLabRenderer";
  import ChipToggle from "$lib/shared/components/selection/ChipToggle.svelte";
  import ChipGroup from "$lib/shared/components/selection/ChipGroup.svelte";

  interface Props {
    algorithm: PineAlgorithm;
    tieredParams: TieredParams;
    windsweptParams: WindsweptParams;
    onAlgorithmChange: (algorithm: PineAlgorithm) => void;
    onTieredParamsChange: (params: TieredParams) => void;
    onWindsweptParamsChange: (params: WindsweptParams) => void;
    onReset: () => void;
    onRandomizeSeeds: () => void;
  }

  let {
    algorithm,
    tieredParams,
    windsweptParams,
    onAlgorithmChange,
    onTieredParamsChange,
    onWindsweptParamsChange,
    onReset,
    onRandomizeSeeds,
  }: Props = $props();

  function updateTieredParam<K extends keyof TieredParams>(key: K, value: TieredParams[K]) {
    onTieredParamsChange({ ...tieredParams, [key]: value });
  }

  function updateWindsweptParam<K extends keyof WindsweptParams>(key: K, value: WindsweptParams[K]) {
    onWindsweptParamsChange({ ...windsweptParams, [key]: value });
  }
</script>

<!-- Algorithm Selector -->
<ChipGroup label="Algorithm" variant="row">
  <ChipToggle
    label="Tiered"
    active={algorithm === "tiered"}
    color="amber"
    onclick={() => onAlgorithmChange("tiered")}
  />
  <ChipToggle
    label="Windswept"
    active={algorithm === "windswept"}
    color="amber"
    onclick={() => onAlgorithmChange("windswept")}
  />
</ChipGroup>

<!-- Algorithm-specific Parameter Sliders -->
<div class="params-section">
  <div class="section-header">
    <span class="label">{algorithm === "tiered" ? "Branch Tiers" : "Wind Effect"}</span>
    <button class="reset-btn" onclick={onReset} title="Reset to defaults">
      <i class="fas fa-undo"></i>
    </button>
  </div>

  {#if algorithm === "tiered"}
    <!-- Tiered Algorithm Parameters -->
    <div class="slider-group">
      <label class="slider-label">
        <span>Tier Count</span>
        <span class="slider-value">{tieredParams.tierCount}</span>
      </label>
      <input type="range" min="5" max="10" step="1" value={tieredParams.tierCount}
        oninput={(e) => updateTieredParam("tierCount", parseInt(e.currentTarget.value))} />
      <div class="slider-labels"><span>Few</span><span>Many</span></div>
    </div>

    <div class="slider-group">
      <label class="slider-label">
        <span>Tier Spacing</span>
        <span class="slider-value">{tieredParams.tierSpacing.toFixed(2)}</span>
      </label>
      <input type="range" min="0.7" max="1.3" step="0.05" value={tieredParams.tierSpacing}
        oninput={(e) => updateTieredParam("tierSpacing", parseFloat(e.currentTarget.value))} />
      <div class="slider-labels"><span>Top Heavy</span><span>Bottom Heavy</span></div>
    </div>

    <div class="slider-group">
      <label class="slider-label">
        <span>Spread</span>
        <span class="slider-value">{tieredParams.spread.toFixed(2)}</span>
      </label>
      <input type="range" min="0.35" max="0.55" step="0.02" value={tieredParams.spread}
        oninput={(e) => updateTieredParam("spread", parseFloat(e.currentTarget.value))} />
      <div class="slider-labels"><span>Narrow</span><span>Wide</span></div>
    </div>

    <div class="slider-group">
      <label class="slider-label">
        <span>Uplift</span>
        <span class="slider-value">{tieredParams.uplift.toFixed(2)}</span>
      </label>
      <input type="range" min="0.05" max="0.25" step="0.02" value={tieredParams.uplift}
        oninput={(e) => updateTieredParam("uplift", parseFloat(e.currentTarget.value))} />
      <div class="slider-labels"><span>Flat</span><span>Candle Tips</span></div>
    </div>

    <div class="slider-group">
      <label class="slider-label">
        <span>Gap Visibility</span>
        <span class="slider-value">{tieredParams.gapVisibility.toFixed(2)}</span>
      </label>
      <input type="range" min="0.15" max="0.4" step="0.02" value={tieredParams.gapVisibility}
        oninput={(e) => updateTieredParam("gapVisibility", parseFloat(e.currentTarget.value))} />
      <div class="slider-labels"><span>Dense</span><span>Open</span></div>
    </div>

  {:else}
    <!-- Windswept Algorithm Parameters -->
    <div class="slider-group">
      <label class="slider-label">
        <span>Wind Angle</span>
        <span class="slider-value">{windsweptParams.windAngle.toFixed(2)}</span>
      </label>
      <input type="range" min="-0.8" max="0.8" step="0.05" value={windsweptParams.windAngle}
        oninput={(e) => updateWindsweptParam("windAngle", parseFloat(e.currentTarget.value))} />
      <div class="slider-labels"><span>Left</span><span>Right</span></div>
    </div>

    <div class="slider-group">
      <label class="slider-label">
        <span>Wind Strength</span>
        <span class="slider-value">{windsweptParams.windStrength.toFixed(2)}</span>
      </label>
      <input type="range" min="0.15" max="0.5" step="0.02" value={windsweptParams.windStrength}
        oninput={(e) => updateWindsweptParam("windStrength", parseFloat(e.currentTarget.value))} />
      <div class="slider-labels"><span>Gentle</span><span>Strong</span></div>
    </div>

    <div class="slider-group">
      <label class="slider-label">
        <span>Tier Count</span>
        <span class="slider-value">{windsweptParams.tierCount}</span>
      </label>
      <input type="range" min="4" max="8" step="1" value={windsweptParams.tierCount}
        oninput={(e) => updateWindsweptParam("tierCount", parseInt(e.currentTarget.value))} />
      <div class="slider-labels"><span>Few</span><span>Many</span></div>
    </div>

    <div class="slider-group">
      <label class="slider-label">
        <span>Asymmetry</span>
        <span class="slider-value">{windsweptParams.asymmetry.toFixed(2)}</span>
      </label>
      <input type="range" min="0.2" max="0.6" step="0.02" value={windsweptParams.asymmetry}
        oninput={(e) => updateWindsweptParam("asymmetry", parseFloat(e.currentTarget.value))} />
      <div class="slider-labels"><span>Balanced</span><span>Lopsided</span></div>
    </div>

    <div class="slider-group">
      <label class="slider-label">
        <span>Branch Curve</span>
        <span class="slider-value">{windsweptParams.branchCurve.toFixed(2)}</span>
      </label>
      <input type="range" min="0.1" max="0.4" step="0.02" value={windsweptParams.branchCurve}
        oninput={(e) => updateWindsweptParam("branchCurve", parseFloat(e.currentTarget.value))} />
      <div class="slider-labels"><span>Straight</span><span>Curved</span></div>
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
    color: #fbbf24;
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
    color: #fbbf24;
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
    background: linear-gradient(135deg, #f59e0b, #d97706);
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
    background: linear-gradient(135deg, #f59e0b, #d97706);
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
    background: linear-gradient(135deg, #f59e0b, #d97706);
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
    box-shadow: 0 8px 20px rgba(245, 158, 11, 0.35);
  }

  .action-btn:active {
    transform: translateY(0);
  }
</style>
