<script lang="ts">
  import type { StepCountWeight } from "../../domain/models/DeckRelease";
  import type { CatalogSourceSummary, TnDFamilyOption, TnDTurnPatternOption } from "../../services/deck-composer";
  import TnDTurnMatrix from "../TnDTurnMatrix.svelte";
  import { TND_BY_FAMILY } from "../../domain/tnd-element";

  type DeckMode = "loop" | "tnd";

  interface Props {
    deckMode: DeckMode;
    weights: StepCountWeight[];
    totalCards: number;
    notes: string;
    sourceSummaries: CatalogSourceSummary[];
    selectedSliceTypes: Set<'halved' | 'quartered'>;
    tndFamilies: TnDFamilyOption[];
    selectedTnDFamilies: Set<string>;
    tndTurnPatterns: TnDTurnPatternOption[];
    selectedTnDTurnPatterns: Set<string>;
    tndCardCount: number;
    onModeChange: (mode: DeckMode) => void;
    onWeightChange: (stepCount: number, weight: number) => void;
    onTotalCardsChange: (total: number) => void;
    onNotesChange: (notes: string) => void;
    onSliceTypeToggle: (sliceType: 'halved' | 'quartered') => void;
    onTnDFamilyToggle: (familyId: string) => void;
    onTnDTurnPatternToggle: (tp: string) => void;
    onTnDTurnPatternsSet: (patterns: Set<string>) => void;
    onDraw: () => void;
    isLoading: boolean;
  }

  let {
    deckMode,
    weights,
    totalCards,
    notes,
    sourceSummaries,
    selectedSliceTypes,
    tndFamilies,
    selectedTnDFamilies,
    tndTurnPatterns,
    selectedTnDTurnPatterns,
    tndCardCount,
    onModeChange,
    onWeightChange,
    onTotalCardsChange,
    onNotesChange,
    onSliceTypeToggle,
    onTnDFamilyToggle,
    onTnDTurnPatternToggle,
    onTnDTurnPatternsSet,
    onDraw,
    isLoading,
  }: Props = $props();

  const PRESETS = [
    { id: "even", label: "Even", icon: "fa-equals", weights: { 16: 25, 12: 25, 8: 25, 4: 25 } },
    { id: "beginner", label: "Beginner", icon: "fa-seedling", weights: { 16: 10, 12: 20, 8: 30, 4: 40 } },
    { id: "advanced", label: "Advanced", icon: "fa-fire", weights: { 16: 40, 12: 30, 8: 20, 4: 10 } },
  ] as const;

  const totalWeight = $derived(weights.reduce((s, w) => s + w.weight, 0));

  function cardCount(w: StepCountWeight): number {
    if (totalWeight === 0) return 0;
    return Math.round((totalCards * w.weight) / totalWeight);
  }

  function applyPreset(preset: Record<number, number>) {
    for (const w of weights) {
      const target = preset[w.stepCount];
      if (target !== undefined) onWeightChange(w.stepCount, target);
    }
  }

  const canDraw = $derived(
    deckMode === "tnd" ? tndCardCount > 0 : totalWeight > 0
  );

  const drawLabel = $derived(
    deckMode === "tnd"
      ? `Draw ${tndCardCount} TnD Cards`
      : `Draw ${totalCards} Cards`
  );
</script>

<div class="configure-step">
  <h2 class="step-title">
    <i class="fas fa-sliders-h" aria-hidden="true"></i>
    Compose Your Catalog
  </h2>

  <div class="controls">
    <div class="control-group">
      <span class="control-label">Catalog Type</span>
      <div class="mode-row">
        <button
          type="button"
          class="mode-btn"
          class:selected={deckMode === "loop"}
          onclick={() => onModeChange("loop")}
        >
          <i class="fas fa-infinity" aria-hidden="true"></i>
          LOOP Sequences
        </button>
        <button
          type="button"
          class="mode-btn"
          class:selected={deckMode === "tnd"}
          onclick={() => onModeChange("tnd")}
        >
          <i class="fas fa-shapes" aria-hidden="true"></i>
          TnD Motions
        </button>
      </div>
    </div>

    <div class="control-group">
      <label class="control-label" for="edition-notes">Edition Notes</label>
      <input
        id="edition-notes"
        type="text"
        class="notes-input"
        value={notes}
        placeholder="e.g. Fire Drums 2026"
        oninput={(e) => onNotesChange((e.target as HTMLInputElement).value)}
      />
    </div>

    {#if deckMode === "loop"}
      <div class="control-group">
        <span class="control-label">Total Cards</span>
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

      {#if sourceSummaries.length > 0}
        <div class="control-group">
          <span class="control-label">Source Decks</span>
          <div class="source-row">
            {#each sourceSummaries as source (source.sliceType)}
              <button
                type="button"
                class="source-btn"
                class:selected={selectedSliceTypes.has(source.sliceType)}
                onclick={() => onSliceTypeToggle(source.sliceType)}
              >
                <span class="source-name">{source.sliceType}</span>
                <span class="source-stats">{source.catalogCount} catalogs · {source.sequenceCount.toLocaleString()} seq</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <div class="control-group">
        <span class="control-label">Step Count Mix</span>
        <div class="preset-row">
          {#each PRESETS as preset (preset.id)}
            <button
              type="button"
              class="preset-btn"
              onclick={() => applyPreset(preset.weights)}
            >
              <i class="fas {preset.icon}" aria-hidden="true"></i>
              {preset.label}
            </button>
          {/each}
        </div>
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
    {:else}
      <div class="tnd-layout">
      <div class="control-group tnd-turns-col">
        <span class="control-label">Turn Patterns</span>
        <TnDTurnMatrix
          patternOptions={tndTurnPatterns}
          selected={selectedTnDTurnPatterns}
          onToggle={onTnDTurnPatternToggle}
          onSetPatterns={onTnDTurnPatternsSet}
        />
      </div>

      <div class="control-group tnd-families-col">
        <span class="control-label">TnD Families</span>
        <div class="tnd-families">
          {#each tndFamilies as fam (fam.familyId)}
            {@const el = TND_BY_FAMILY[fam.familyId]}
            <button
              type="button"
              class="tnd-family-btn"
              class:selected={selectedTnDFamilies.has(fam.familyId)}
              style="--accent: {el?.accentColor ?? 'var(--theme-accent, #b763cd)'};"
              onclick={() => onTnDFamilyToggle(fam.familyId)}
            >
              {#if el}
                <img
                  src={el.iconPath}
                  alt="{el.element} element"
                  class="tnd-family-icon"
                  width="36"
                  height="36"
                />
              {/if}
              <span class="tnd-family-name">{fam.label}</span>
              <span class="tnd-family-count">{fam.sequenceCount} cards</span>
            </button>
          {/each}
        </div>
        <div class="tnd-summary">
          {tndCardCount} cards selected
        </div>
      </div>
      </div>
    {/if}
  </div>

  <button
    type="button"
    class="draw-btn"
    disabled={isLoading || !canDraw}
    onclick={onDraw}
  >
    {#if isLoading}
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      Loading Pools...
    {:else}
      <i class="fas fa-dice" aria-hidden="true"></i>
      {drawLabel}
    {/if}
  </button>
</div>

<style>
  .configure-step {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 28px;
    max-width: 1400px;
    min-height: 100%;
    margin: 0 auto;
    padding: 32px 24px;
    box-sizing: border-box;
  }

  /* Top controls + draw button stay a readable narrow band; the TnD layout
     breaks out wide to use the full monitor. */
  .step-title,
  .controls > .control-group,
  .draw-btn {
    max-width: 640px;
    width: 100%;
    margin-inline: auto;
  }

  .tnd-layout {
    display: flex;
    gap: 56px;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: none;
  }

  .tnd-layout .control-group {
    max-width: none;
    margin: 0;
    width: auto;
  }

  .tnd-turns-col {
    flex: 0 0 auto;
  }

  .tnd-families-col {
    flex: 0 1 560px;
    min-width: 360px;
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

  .mode-row {
    display: flex;
    gap: 8px;
  }

  .mode-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    padding: 10px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mode-btn:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .mode-btn.selected {
    background: var(--theme-accent, #8b5cf6);
    border-color: var(--theme-accent, #8b5cf6);
    color: #fff;
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

  .source-row {
    display: flex;
    gap: 8px;
  }

  .source-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-height: 52px;
    padding: 10px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .source-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .source-btn.selected {
    background: rgba(139, 92, 246, 0.12);
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, #fff);
  }

  .source-name {
    font-size: 14px;
    font-weight: 600;
    text-transform: capitalize;
  }

  .source-stats {
    font-size: 11px;
    opacity: 0.7;
  }

  .tnd-families {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
  }

  .tnd-family-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    min-height: 124px;
    padding: 20px 14px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--accent) 8%, var(--theme-card-bg, rgba(255, 255, 255, 0.04))),
      var(--theme-card-bg, rgba(255, 255, 255, 0.04))
    );
    border: 1.5px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: 12px;
    color: var(--theme-text, #fff);
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background 0.15s ease;
  }

  .tnd-family-btn:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--accent) 50%, transparent);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 25%, transparent);
  }

  .tnd-family-btn.selected {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--accent) 24%, var(--theme-card-bg, rgba(255, 255, 255, 0.04))),
      color-mix(in srgb, var(--accent) 8%, var(--theme-card-bg, rgba(255, 255, 255, 0.04)))
    );
    border-color: color-mix(in srgb, var(--accent) 70%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);
  }

  .tnd-family-icon {
    width: 48px;
    height: 48px;
    object-fit: contain;
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.35));
    opacity: 0.55;
    transition: opacity 0.15s ease;
  }

  .tnd-family-btn:hover .tnd-family-icon,
  .tnd-family-btn.selected .tnd-family-icon {
    opacity: 1;
  }

  .tnd-family-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--accent);
  }

  .tnd-family-count {
    font-size: 11px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .tnd-summary {
    font-size: 13px;
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-align: center;
  }

  .preset-row {
    display: flex;
    gap: 8px;
  }

  .preset-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 36px;
    padding: 6px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preset-btn:hover {
    background: rgba(139, 92, 246, 0.12);
    border-color: rgba(139, 92, 246, 0.3);
    color: var(--theme-accent, #a78bfa);
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

  @media (max-width: 980px) {
    .tnd-layout {
      flex-direction: column;
      align-items: center;
    }

    .tnd-families-col {
      flex: 1 1 auto;
      width: 100%;
      max-width: 640px;
    }
  }

  @media (max-width: 640px) {
    .weight-row {
      grid-template-columns: 64px 1fr 40px 60px;
    }

    .pool-size {
      display: none;
    }

    .tnd-families {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tnd-family-btn {
      transition: none;
    }

    .tnd-family-btn:hover {
      transform: none;
    }
  }
</style>
