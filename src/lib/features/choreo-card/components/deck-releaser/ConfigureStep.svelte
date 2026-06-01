<script lang="ts">
  import type { StepCountWeight } from "../../domain/models/DeckRelease";
  import type { CatalogSourceSummary, TnDFamilyOption, TnDTurnPatternOption } from "../../services/deck-composer";
  import TnDTurnMatrix from "../TnDTurnMatrix.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import TnDFamilyCards from "./TnDFamilyCards.svelte";
  import TransformPanel from "./TransformPanel.svelte";
  import LoopBentoBoard from "./LoopBentoBoard.svelte";
  import { loopDrawCounts } from "../../services/deck-composer";
  import type { ResolvedReversalPattern } from "../../domain/reversal-transform";
  import type { VariationConfig, StartOriMode } from "../../services/deck-variation";

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
    /** Rebuild the LOOP pool from current dials (loop type / level / slice). */
    onRebuildPool: () => void;
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
    onRebuildPool,
  }: Props = $props();

  // Per-family card projection mirrors buildTnDCards' enumeration: each family's
  // entries already span the selected grid modes (a (seed × grid) pair per entry,
  // from getTnDFamilyOptions), so grid is NOT a separate multiplier here — only
  // turn patterns × start-orientation registers multiply on top of the entries.
  const familyMultiplier = $derived(
    selectedTurnPatternCount * Math.max(1, startOriModes.size),
  );

  // LOOP enable gate: at least one step-count weight is non-zero.
  const totalWeight = $derived(weights.reduce((s, w) => s + w.weight, 0));

  const canDraw = $derived(
    deckMode === "tnd" ? tndCardCount > 0 : totalWeight > 0
  );

  // LOOP target = final deck size; orientation/grid axes fan a smaller base back
  // up to it (loopDrawCounts), so the label shows the true emitted count.
  const loopEffective = $derived(
    loopDrawCounts(totalCards, startOriModes.size, gridModes.size).effective
  );

  const drawLabel = $derived(
    deckMode === "tnd"
      ? `Draw ${tndCardCount} TnD Cards`
      : `Draw ${loopEffective} Cards`
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
    <LoopBentoBoard
      {weights}
      {totalCards}
      {sourceSummaries}
      {selectedSliceTypes}
      {variationConfig}
      {startOriModes}
      {gridModes}
      {reversalPattern}
      {onWeightChange}
      {onTotalCardsChange}
      {onSliceTypeToggle}
      {onVariationConfigChange}
      {onToggleStartOriMode}
      {onToggleGridMode}
      {onReversalChange}
      {onRebuildPool}
    />
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

  /* TnD board: Families | hero Turn-Pattern matrix | Transform rail.
     The LOOP board is its own component (LoopComposeBoard). */
  .board {
    display: grid;
    gap: 24px;
    align-items: start;
    width: 100%;
  }

  .tnd-board {
    grid-template-columns: minmax(240px, 0.82fr) minmax(0, 1.4fr) minmax(320px, 0.95fr);
    grid-template-areas: "families matrix transform";
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

  .draw-btn {
    width: 100%;
    max-width: 760px;
    margin-inline: auto;
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

  /* TnD board: below the 3-up threshold, stack hero matrix → families →
     transform in one column (stretch no longer needed). The LOOP board owns
     its own responsive collapse in LoopComposeBoard. */
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
    .board {
      grid-template-columns: 1fr;
    }

    .top-bar {
      max-width: none;
    }
  }
</style>
