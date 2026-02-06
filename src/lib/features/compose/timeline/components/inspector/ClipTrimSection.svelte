<script lang="ts">
  /**
   * ClipTrimSection - In/out point trim controls with visual preview
   */

  interface Props {
    inPoint: number;
    outPoint: number;
    stepCount: number;
    onUpdateInPoint: (percent: number) => void;
    onUpdateOutPoint: (percent: number) => void;
    onResetTrim: () => void;
  }

  let {
    inPoint,
    outPoint,
    stepCount,
    onUpdateInPoint,
    onUpdateOutPoint,
    onResetTrim,
  }: Props = $props();

  // Convert to percentages for display
  let inPointPercent = $derived(Math.round(inPoint * 100));
  let outPointPercent = $derived(Math.round(outPoint * 100));
</script>

<section class="section">
  <div class="section-header">
    <i class="fa-solid fa-scissors" aria-hidden="true"></i>
    <span>Trim</span>
  </div>

  <div class="trim-range">
    <div
      class="trim-bar"
      style="left: {inPoint * 100}%; right: {100 - outPoint * 100}%"
    ></div>
    <div class="trim-markers">
      {#each { length: stepCount } as _, i}
        {@const percent = (i / (stepCount - 1 || 1)) * 100}
        <div class="beat-marker" style="left: {percent}%"></div>
      {/each}
    </div>
  </div>

  <div class="field-row">
    <div class="field">
      <label class="field-label" for="in-point-range">In Point</label>
      <div class="input-group">
        <input
          id="in-point-range"
          type="range"
          class="range-input"
          min="0"
          max="99"
          value={inPointPercent}
          oninput={(e) =>
            onUpdateInPoint(parseInt((e.target as HTMLInputElement).value))}
        />
        <span class="value-label">{inPointPercent}%</span>
      </div>
    </div>

    <div class="field">
      <label class="field-label" for="out-point-range">Out Point</label>
      <div class="input-group">
        <input
          id="out-point-range"
          type="range"
          class="range-input"
          min="1"
          max="100"
          value={outPointPercent}
          oninput={(e) =>
            onUpdateOutPoint(parseInt((e.target as HTMLInputElement).value))}
        />
        <span class="value-label">{outPointPercent}%</span>
      </div>
    </div>
  </div>

  <button class="action-btn" onclick={onResetTrim}>
    <i class="fa-solid fa-expand" aria-hidden="true"></i>
    Reset Trim
  </button>
</section>

<style>
  .section {
    margin-bottom: 20px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 8px;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--theme-stroke);
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .section-header i {
    font-size: var(--font-size-compact);
    opacity: 0.6;
  }

  .field {
    margin-bottom: 12px;
  }

  .input-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .range-input {
    flex: 1;
    height: 4px;
    appearance: none;
    background: var(--theme-stroke);
    border-radius: 2px;
  }

  .range-input::-webkit-slider-thumb {
    appearance: none;
    width: 14px;
    height: 14px;
    background: var(--theme-accent);
    border-radius: 50%;
    cursor: pointer;
  }

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 6px;
    font-size: var(--font-size-compact);
    color: var(--theme-text);
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .action-btn:hover {
    background: var(--theme-card-hover-bg);
  }

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .field-label {
    display: block;
    margin-bottom: 6px;
    font-size: var(--font-size-compact);
    color: var(--theme-text-muted, var(--theme-text-dim));
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .value-label {
    min-width: 40px;
    font-size: var(--font-size-compact);
    color: var(--theme-text-muted, var(--theme-text-dim));
    text-align: right;
  }

  .trim-range {
    position: relative;
    height: 32px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border-radius: 4px;
    margin-bottom: 12px;
    overflow: hidden;
  }

  .trim-bar {
    position: absolute;
    top: 4px;
    bottom: 4px;
    background: var(--theme-accent);
    opacity: 0.3;
    border-radius: 2px;
  }

  .trim-markers {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
  }

  .beat-marker {
    position: absolute;
    width: 2px;
    height: 60%;
    background: var(--theme-text-dim);
    border-radius: 1px;
    transform: translateX(-50%);
  }
</style>
