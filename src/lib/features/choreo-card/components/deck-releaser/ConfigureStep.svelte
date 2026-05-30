<script lang="ts">
  import type { StepCountWeight } from "../../domain/models/DeckRelease";
  import type { CatalogSourceSummary, TnDFamilyOption, TnDTurnPatternOption } from "../../services/deck-composer";
  import TnDTurnMatrix from "../TnDTurnMatrix.svelte";
  import TnDReversalStrip from "../TnDReversalStrip.svelte";
  import AxisCardGroup from "./AxisCardGroup.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import TnDFamilyCards from "./TnDFamilyCards.svelte";
  import TransformPanel from "./TransformPanel.svelte";
  import type { ResolvedReversalPattern } from "../../domain/reversal-transform";
  import {
    TURN_PATTERNS,
    type VariationConfig,
    type StartOriMode,
  } from "../../services/deck-variation";

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
    selectedTurnPatternCount: number;
    onModeChange: (mode: DeckMode) => void;
    onWeightChange: (stepCount: number, weight: number) => void;
    onTotalCardsChange: (total: number) => void;
    onNotesChange: (notes: string) => void;
    onSliceTypeToggle: (sliceType: 'halved' | 'quartered') => void;
    onTnDFamilyToggle: (familyId: string) => void;
    onSelectAllFamilies: () => void;
    onClearFamilies: () => void;
    onTnDTurnPatternToggle: (tp: string) => void;
    onTnDTurnPatternsSet: (patterns: Set<string>) => void;
    onDraw: () => void;
    isLoading: boolean;
    variationConfig: VariationConfig;
    onVariationConfigChange: (config: VariationConfig) => void;
    startOriModes: Set<StartOriMode>;
    onToggleStartOriMode: (mode: StartOriMode) => void;
    gridModes: Set<"diamond" | "box">;
    onToggleGridMode: (mode: "diamond" | "box") => void;
    /** Deck-wide reversal pattern (built in the strip). Absent → no reversal. */
    reversalPattern?: ResolvedReversalPattern | null;
    onReversalChange?: (pattern: ResolvedReversalPattern) => void;
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
    selectedTurnPatternCount,
    onModeChange,
    onWeightChange,
    onTotalCardsChange,
    onNotesChange,
    onSliceTypeToggle,
    onTnDFamilyToggle,
    onSelectAllFamilies,
    onClearFamilies,
    onTnDTurnPatternToggle,
    onTnDTurnPatternsSet,
    onDraw,
    isLoading,
    variationConfig,
    onVariationConfigChange,
    startOriModes,
    onToggleStartOriMode,
    gridModes,
    onToggleGridMode,
    reversalPattern = null,
    onReversalChange,
  }: Props = $props();

  // Per-family card projection mirrors buildTnDCards' enumeration: each family's
  // entries already span the selected grid modes (a (seed × grid) pair per entry,
  // from getTnDFamilyOptions), so grid is NOT a separate multiplier here — only
  // turn patterns × start-orientation registers multiply on top of the entries.
  const familyMultiplier = $derived(
    selectedTurnPatternCount * Math.max(1, startOriModes.size),
  );

  const PRESETS = [
    { id: "even", label: "Even", icon: "fa-equals", weights: { 16: 25, 12: 25, 8: 25, 4: 25 } },
    { id: "beginner", label: "Beginner", icon: "fa-seedling", weights: { 16: 10, 12: 20, 8: 30, 4: 40 } },
    { id: "advanced", label: "Advanced", icon: "fa-fire", weights: { 16: 40, 12: 30, 8: 20, 4: 10 } },
  ] as const;

  const VARIATION_PRESETS = [
    { id: "clean", label: "Clean", icon: "fa-feather", rf: 0, tf: 0 },
    { id: "sprinkle", label: "Sprinkle", icon: "fa-wand-magic-sparkles", rf: 0.3, tf: 0.4 },
    { id: "spicy", label: "Spicy", icon: "fa-pepper-hot", rf: 0.6, tf: 0.7 },
  ] as const;

  const ORI_REGISTERS = [
    { id: "radial", label: "Radial", icon: "fa-arrows-up-down", accent: "#4cc4c0" },
    { id: "nonradial", label: "Nonradial", icon: "fa-arrows-left-right", accent: "#e08a3c" },
    { id: "split", label: "Split", icon: "fa-arrows-turn-right", accent: "#b763cd" },
  ];

  const GRID_MODES = [
    { id: "diamond", label: "Diamond", icon: "fa-diamond", accent: "#5aa9e6" },
    { id: "box", label: "Box", icon: "fa-square", accent: "#e0c040" },
  ];

  function toggleTurn(id: string) {
    const next = new Set(variationConfig.enabledTurnPatterns);
    if (next.has(id)) next.delete(id); else next.add(id);
    onVariationConfigChange({ ...variationConfig, enabledTurnPatterns: [...next] });
  }

  function setTurnFreq(v: number) {
    onVariationConfigChange({ ...variationConfig, turnFrequency: v / 100 });
  }
  function applyVariationPreset(rf: number, tf: number) {
    onVariationConfigChange({ ...variationConfig, reversalFrequency: rf, turnFrequency: tf });
  }

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

  <div class="top-bar">
    <div class="mode-toggle">
      <SegmentedControl
        options={[
          { value: "loop", label: "LOOP" },
          { value: "tnd", label: "TnD" },
        ]}
        value={deckMode}
        onchange={(v) => onModeChange(v)}
        color="accent"
        size="sm"
      />
    </div>
    <div class="notes-field">
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
  </div>

  {#if deckMode === "tnd"}
    <div class="board tnd-board">
      <section class="area-families">
        <span class="area-label">Families</span>
        <TnDFamilyCards
          families={tndFamilies}
          selected={selectedTnDFamilies}
          multiplier={familyMultiplier}
          onToggle={onTnDFamilyToggle}
          onSelectAll={onSelectAllFamilies}
          onClear={onClearFamilies}
          columns={2}
        />
      </section>

      <section class="area-matrix">
        <span class="area-label">Turn Patterns</span>
        <TnDTurnMatrix
          patternOptions={tndTurnPatterns}
          selected={selectedTnDTurnPatterns}
          onToggle={onTnDTurnPatternToggle}
          onSetPatterns={onTnDTurnPatternsSet}
        />
      </section>

      <section class="area-transform">
        <TransformPanel
          {startOriModes}
          {onToggleStartOriMode}
          {gridModes}
          {onToggleGridMode}
          {reversalPattern}
          onReversalChange={(p) => onReversalChange?.(p)}
        />
      </section>
    </div>
  {:else}
    <div class="board loop-board">
      <div class="board-col axes-col">
        <AxisCardGroup
          label="Start Orientation"
          hint="Multi-select = full enumeration."
          options={ORI_REGISTERS}
          selected={startOriModes as Set<string>}
          onToggle={(id) => onToggleStartOriMode(id as StartOriMode)}
        />
        <AxisCardGroup
          label="Grid Mode"
          hint="Select both for diamond + box."
          options={GRID_MODES}
          selected={gridModes as Set<string>}
          onToggle={(id) => onToggleGridMode(id as "diamond" | "box")}
        />
        <div class="axis-block">
          <span class="control-label">Total Cards</span>
          <div class="card-count-row">
            {#each [26, 36, 52] as count (count)}
              <button
                type="button"
                class="count-btn"
                class:selected={totalCards === count}
                onclick={() => onTotalCardsChange(count)}
              >{count}</button>
            {/each}
          </div>
        </div>
        {#if sourceSummaries.length > 0}
          <div class="axis-block">
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
      </div>

      <div class="board-col loop-col">
        <div class="axis-block">
          <span class="control-label">Step Count Mix</span>
          <div class="preset-row">
            {#each PRESETS as preset (preset.id)}
              <button type="button" class="preset-btn" onclick={() => applyPreset(preset.weights)}>
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
                  type="range" min="0" max="100" value={w.weight} class="weight-slider"
                  oninput={(e) => onWeightChange(w.stepCount, parseInt((e.target as HTMLInputElement).value))}
                />
                <span class="weight-pct">{totalWeight > 0 ? Math.round((w.weight / totalWeight) * 100) : 0}%</span>
                <span class="weight-count">~{cardCount(w)} cards</span>
                <span class="pool-size">({w.available.toLocaleString()} available)</span>
              </div>
            {/each}
          </div>
        </div>

        <div class="axis-block">
          <span class="control-label">Reversal</span>
          <TnDReversalStrip
            activePatternId={reversalPattern?.id ?? null}
            onPatternChange={(p) => onReversalChange?.(p)}
          />
        </div>

        <div class="axis-block">
          <span class="control-label">Turn Variation</span>
          <div class="preset-row">
            {#each VARIATION_PRESETS as p (p.id)}
              <button type="button" class="preset-btn" onclick={() => applyVariationPreset(p.rf, p.tf)}>
                <i class="fas {p.icon}" aria-hidden="true"></i>
                {p.label}
              </button>
            {/each}
          </div>
          <div class="weight-row variation-freq">
            <span class="step-label">Turns</span>
            <input
              type="range" min="0" max="100"
              value={Math.round(variationConfig.turnFrequency * 100)}
              class="weight-slider"
              oninput={(e) => setTurnFreq(parseInt((e.target as HTMLInputElement).value))}
            />
            <span class="weight-pct">{Math.round(variationConfig.turnFrequency * 100)}%</span>
          </div>
          <div class="toggle-row">
            {#each TURN_PATTERNS as t (t.id)}
              <button
                type="button"
                class="toggle-chip"
                class:selected={variationConfig.enabledTurnPatterns.includes(t.id)}
                aria-pressed={variationConfig.enabledTurnPatterns.includes(t.id)}
                title={t.pattern}
                onclick={() => toggleTurn(t.id)}
              >{t.label}</button>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}

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
    gap: 18px;
    width: 100%;
    max-width: 1760px;
    min-height: 100%;
    margin: 0 auto;
    padding: 20px 24px;
    box-sizing: border-box;
    /* The board reflows against THIS pane's width (sidebar + released-decks rail
       eat ~600px of viewport), so layout decisions use container queries, not
       viewport media queries that misjudge the available room. */
    container-type: inline-size;
    container-name: configure;
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

  /* Slim top bar: catalog toggle + edition notes side by side. */
  .top-bar {
    display: flex;
    gap: 16px;
    align-items: flex-end;
    width: 100%;
    max-width: 760px;
  }

  .mode-toggle {
    flex: 1;
  }

  .notes-field {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Three-column control board — axes | turn matrix | families.
     Mins sum to ~948px (+gaps) so the 3-up layout holds down to ~1040px of pane
     width; below the container threshold it collapses to a single column. */
  .board {
    display: grid;
    gap: 24px;
    align-items: start;
    width: 100%;
  }

  /* TnD board: Families | hero Turn-Pattern matrix | Transform rail. */
  .tnd-board {
    grid-template-columns: minmax(240px, 0.82fr) minmax(0, 1.4fr) minmax(320px, 0.95fr);
    grid-template-areas: "families matrix transform";
  }

  .loop-board {
    grid-template-columns: minmax(340px, 0.85fr) minmax(0, 1.15fr);
  }

  .board-col {
    display: flex;
    flex-direction: column;
    gap: 18px;
    min-width: 0;
  }

  .area-matrix {
    grid-area: matrix;
  }

  /* Families + Transform stretch to the tall matrix's height so their content
     can distribute in the leftover space (cards centre, axes spread evenly). */
  .area-families {
    grid-area: families;
    display: flex;
    flex-direction: column;
    align-self: stretch;
  }
  .area-families > :global(.family-cards) {
    flex: 1 1 auto;
  }

  .area-transform {
    grid-area: transform;
    align-self: stretch;
    display: flex;
    flex-direction: column;
  }
  .area-transform > :global(.transform) {
    flex: 1 1 auto;
  }

  .area-label {
    display: block;
    margin-bottom: 14px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.07));
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .axis-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .draw-btn {
    width: 100%;
    max-width: 760px;
    margin-inline: auto;
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

  .variation-freq {
    grid-template-columns: 80px 1fr 48px;
  }

  .toggle-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .toggle-chip {
    min-height: 36px;
    padding: 6px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 999px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toggle-chip:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--theme-text, #fff);
  }

  .toggle-chip.selected {
    background: rgba(139, 92, 246, 0.18);
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, #fff);
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

  /* Medium pane: two columns. Axes (with the wide reversal strip) span the top
     row; matrix + families sit side by side beneath. Keeps the matrix legible
     instead of squeezing three columns into a cramped pane. */
  @container configure (max-width: 1180px) {
    .loop-board {
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
    }

    .axes-col {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px 24px;
      align-items: start;
    }

    /* Reversal strip spans both axis sub-columns so it keeps its width. */
    .axes-col .axis-block {
      grid-column: 1 / -1;
    }
  }

  /* TnD board: below the 3-up threshold, stack hero matrix → families →
     transform in one column (stretch no longer needed). */
  @container configure (max-width: 1080px) {
    .tnd-board {
      grid-template-columns: 1fr;
      grid-template-areas:
        "matrix"
        "families"
        "transform";
    }

    .area-families,
    .area-transform {
      align-self: auto;
    }
  }

  /* Narrow pane: single column, everything flows vertically. */
  @container configure (max-width: 840px) {
    .board,
    .loop-board {
      grid-template-columns: 1fr;
    }

    .axes-col {
      grid-template-columns: 1fr;
    }

    .top-bar {
      max-width: none;
    }
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
