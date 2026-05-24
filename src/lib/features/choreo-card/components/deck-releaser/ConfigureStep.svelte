<script lang="ts">
  import type { StepCountWeight } from "../../domain/models/DeckRelease";

  interface Props {
    weights: StepCountWeight[];
    totalCards: number;
    notes: string;
    onWeightChange: (stepCount: number, weight: number) => void;
    onTotalCardsChange: (total: number) => void;
    onNotesChange: (notes: string) => void;
    onDraw: () => void;
    isLoading: boolean;
  }

  let {
    weights,
    totalCards,
    notes,
    onWeightChange,
    onTotalCardsChange,
    onNotesChange,
    onDraw,
    isLoading,
  }: Props = $props();

  const totalWeight = $derived(weights.reduce((s, w) => s + w.weight, 0));

  function cardCount(w: StepCountWeight): number {
    if (totalWeight === 0) return 0;
    return Math.round((totalCards * w.weight) / totalWeight);
  }
</script>

<div class="configure-step">
  <h2 class="step-title">
    <i class="fas fa-sliders-h" aria-hidden="true"></i>
    Compose Your Deck
  </h2>

  <div class="controls">
    <div class="control-group">
      <label class="control-label">Total Cards</label>
      <div class="card-count-row">
        {#each [26, 36, 52] as count (count)}
          <button
            type="button"
            class="count-btn"
            class:selected={totalCards === count}
            onclick={() => onTotalCardsChange(count)}
          >
            {count}
          </button>
        {/each}
      </div>
    </div>

    <div class="control-group">
      <label class="control-label">Edition Notes</label>
      <input
        type="text"
        class="notes-input"
        value={notes}
        placeholder="e.g. Fire Drums 2026"
        oninput={(e) => onNotesChange((e.target as HTMLInputElement).value)}
      />
    </div>

    <div class="control-group">
      <label class="control-label">Step Count Mix</label>
      <div class="weight-sliders">
        {#each weights as w (w.stepCount)}
          <div class="weight-row">
            <span class="step-label">{w.stepCount}-step</span>
            <input
              type="range"
              min="0"
              max="100"
              value={w.weight}
              class="weight-slider"
              oninput={(e) => onWeightChange(w.stepCount, parseInt((e.target as HTMLInputElement).value))}
            />
            <span class="weight-pct">
              {totalWeight > 0 ? Math.round((w.weight / totalWeight) * 100) : 0}%
            </span>
            <span class="weight-count">~{cardCount(w)} cards</span>
            <span class="pool-size">({w.available.toLocaleString()} available)</span>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <button
    type="button"
    class="draw-btn"
    disabled={isLoading || totalWeight === 0}
    onclick={onDraw}
  >
    {#if isLoading}
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      Loading Pools...
    {:else}
      <i class="fas fa-dice" aria-hidden="true"></i>
      Draw {totalCards} Cards
    {/if}
  </button>
</div>

<style>
  .configure-step {
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 640px;
    margin: 0 auto;
    padding: 24px;
  }

  .step-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--theme-text, #fff);
  }

  .step-title i {
    color: var(--theme-accent, #8b5cf6);
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .control-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .card-count-row {
    display: flex;
    gap: 8px;
  }

  .count-btn {
    flex: 1;
    min-height: 44px;
    padding: 8px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .count-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .count-btn.selected {
    background: var(--theme-accent, #8b5cf6);
    border-color: var(--theme-accent, #8b5cf6);
  }

  .notes-input {
    padding: 10px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font-size: 14px;
    outline: none;
  }

  .notes-input:focus {
    border-color: var(--theme-accent, #8b5cf6);
  }

  .notes-input::placeholder {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
  }

  .weight-sliders {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .weight-row {
    display: grid;
    grid-template-columns: 80px 1fr 48px 72px 120px;
    align-items: center;
    gap: 10px;
  }

  .step-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .weight-slider {
    width: 100%;
    accent-color: var(--theme-accent, #8b5cf6);
  }

  .weight-pct {
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-accent, #8b5cf6);
    text-align: right;
  }

  .weight-count {
    font-size: 13px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    text-align: right;
  }

  .pool-size {
    font-size: 11px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
    text-align: right;
  }

  .draw-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 52px;
    padding: 14px 28px;
    background: var(--theme-accent, #8b5cf6);
    border: none;
    border-radius: 12px;
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .draw-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  .draw-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .weight-row {
      grid-template-columns: 64px 1fr 40px 60px;
    }

    .pool-size {
      display: none;
    }
  }
</style>
