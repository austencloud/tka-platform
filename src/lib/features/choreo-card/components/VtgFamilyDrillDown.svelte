<script lang="ts">

import { exportDeckZIP } from "$lib/features/choreo-card/services/print-zip-exporter";
import { aggregateFamilySequences } from "$lib/features/choreo-card/services/vtg-family-aggregator";

  import type { Deck } from "../domain/models/Deck";
  import type { CardFooter } from "../domain/models/DeckRelease";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { FamilyRatioGroup } from "../services/types";
import type { CardPair } from "../services/types";
  import { VTG_ELEMENTAL_THEMES } from "../domain/elemental-theme";
  import { computeVtgCardFooter } from "../domain/deck-vtg-labels";
  import ChoreoCard from "./ChoreoCard.svelte";
  import PrintPreviewPages from "./print-preview/PrintPreviewPages.svelte";
  import PrintPreviewToolbar from "./print-preview/PrintPreviewToolbar.svelte";
  import CardSizeToggle from "./card-preview/CardSizeToggle.svelte";
  import type { CardSizeId } from "../domain/card-sizes";

  type ViewMode = 'grid' | 'print';

  interface Props {
    familyId: string;
    decks: Deck[];
    handPointsVisible?: boolean;
    showGrid?: boolean;
    showTKA?: boolean;
    showWord?: boolean;
    includeStartPosition?: boolean;
    onSelectSequence: (sequence: SequenceData) => void;
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
    onBack: () => void;
  }

  const {
    familyId,
    decks,
    handPointsVisible = true,
    showGrid = true,
    showTKA = true,
    showWord = true,
    includeStartPosition = true,
    onSelectSequence,
    onContextMenu,
    onBack,
  }: Props = $props();

  const theme = $derived(
    VTG_ELEMENTAL_THEMES.find((t) => t.familyId === familyId),
  );
  const familyLabel = $derived(
    theme
      ? `${theme.familyId.split("-").map((w) => (w[0]?.toUpperCase() ?? "") + w.slice(1)).join("-")} (${theme.element[0]?.toUpperCase()}${theme.element.slice(1)})`
      : familyId,
  );

  let ratioGroups = $state<FamilyRatioGroup[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    loading = true;
    error = null;
    aggregateFamilySequences(familyId, decks)
      .then((groups) => {
        ratioGroups = groups;
        loading = false;
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : String(err);
        loading = false;
      });
  });

  function detectOrientation(node: HTMLElement) {
    const check = () => {
      const img = node.querySelector("img") as HTMLImageElement | null;
      if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
        const aspect = img.naturalWidth / img.naturalHeight;
        if (aspect > 1.3) {
          node.classList.add("landscape");
        } else {
          node.classList.remove("landscape");
        }
      }
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(node, { childList: true, subtree: true });
    node.addEventListener("load", check, true);
    return {
      destroy() {
        observer.disconnect();
        node.removeEventListener("load", check, true);
      },
    };
  }

  // ── Card view mode ──────────────────────────────────────────────────────
  // Map legacy 'cards' value to 'print' on read
  const storedViewMode = typeof window !== 'undefined' ? localStorage.getItem('choreoCard.deckViewMode') : null;
  const initialViewMode: ViewMode = storedViewMode === 'cards' ? 'print' : (storedViewMode as ViewMode | null) ?? 'grid';

  let viewMode = $state<ViewMode>(initialViewMode);
  let cardSize = $state<CardSizeId>(
    (typeof window !== 'undefined' ? localStorage.getItem('cardPreview.cardSize') : null) as CardSizeId ?? 'poker'
  );
  let selectedTheme = $state<string>(
    typeof window !== 'undefined' ? localStorage.getItem('cardPreview.theme') ?? 'cosmic' : 'cosmic'
  );

  // ── Print preview state ─────────────────────────────────────────────────
  let renderedPairs = $state<CardPair[]>([]);
  let isExporting = $state(false);
  let isRendering = $state(false);
  let renderProgress = $state(0);
  let renderTotal = $state(0);
  let rerenderKey = $state(0);

  function setViewMode(mode: ViewMode) {
    viewMode = mode;
    if (typeof window !== 'undefined') localStorage.setItem('choreoCard.deckViewMode', mode);
  }

  // Flatten all sequences across ratio groups for print view
  let allSequences = $derived(ratioGroups.flatMap(g => g.sequences));

  const allFooters = $derived<CardFooter[]>(
    ratioGroups.flatMap(g =>
      g.sequences.map(() => computeVtgCardFooter(familyId, g.ratio))
    )
  );

  function turnsLabel(turns: number): string {
    if (turns === 0) return "0 turns";
    if (turns === 1) return "1 turn";
    return `${turns} turns`;
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportPDF() {
    if (renderedPairs.length === 0 || isExporting) return;
    isExporting = true;
    try {
      // Lazy-load print-pdf-exporter - it pulls pdf-lib (~400KB + CSP-violating
      // runtime codegen). Only loaded when the user actually exports.
      const { exportHomePrintPDF } = await import(
        "$lib/features/choreo-card/services/print-pdf-exporter"
      );
      const blob = await exportHomePrintPDF(renderedPairs, familyLabel, cardSize);
      downloadBlob(blob, `${familyLabel}-${cardSize}.pdf`);
    } finally {
      isExporting = false;
    }
  }

  async function handleExportZIP() {
    if (renderedPairs.length === 0 || isExporting) return;
    isExporting = true;
    try {
      const blob = await exportDeckZIP(renderedPairs, familyLabel);
      downloadBlob(blob, `${familyLabel}-${cardSize}.zip`);
    } finally {
      isExporting = false;
    }
  }
</script>

<div class="vtg-family-drilldown">
  <div class="top-bar">
    <nav class="breadcrumb" aria-label="Deck navigation">
      <button class="crumb" onclick={onBack} type="button" aria-label="Go back to VTG">VTG</button>
      <span class="crumb-sep" aria-hidden="true">›</span>
      <span class="crumb current">{familyLabel}</span>
    </nav>
    <div class="top-bar-actions">
      <div class="view-toggle" role="radiogroup" aria-label="View mode">
        <button
          class="action-chip"
          class:active={viewMode === 'grid'}
          onclick={() => setViewMode('grid')}
          type="button"
          role="radio"
          aria-checked={viewMode === 'grid'}
          aria-label="Grid view"
        >
          <i class="fas fa-th" aria-hidden="true"></i> Grid
        </button>
        <button
          class="action-chip"
          class:active={viewMode === 'print'}
          onclick={() => setViewMode('print')}
          type="button"
          role="radio"
          aria-checked={viewMode === 'print'}
          aria-label="Print Preview view"
        >
          <i class="fas fa-print" aria-hidden="true"></i> Print Preview
        </button>
      </div>
      {#if viewMode === 'grid'}
        <CardSizeToggle selected={cardSize} onchange={(s) => {
          cardSize = s;
          if (typeof window !== 'undefined') localStorage.setItem('cardPreview.cardSize', s);
        }} />
      {/if}
    </div>
  </div>

  {#if viewMode === 'print'}
    <PrintPreviewToolbar
      {cardSize}
      totalCards={renderedPairs.length}
      {isRendering}
      {isExporting}
      {renderProgress}
      {renderTotal}
      onCardSizeChange={(s) => {
        cardSize = s;
        if (typeof window !== 'undefined') localStorage.setItem('cardPreview.cardSize', s);
      }}
      onExportPDF={handleExportPDF}
      onExportZIP={handleExportZIP}
      onRerender={() => { rerenderKey++; }}
    />
  {/if}

  {#if loading}
    <div class="loading" role="status" aria-live="polite">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      Loading sequences...
    </div>
  {:else if error}
    <div class="error-state" role="alert">
      <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
      <p>{error}</p>
      <button type="button" class="back-btn" aria-label="Go back to VTG" onclick={onBack}>Back to VTG</button>
    </div>
  {:else if ratioGroups.length === 0}
    <div class="empty-state" role="status">
      <p>No sequences found for {familyLabel}</p>
      <button type="button" class="back-btn" aria-label="Go back to VTG" onclick={onBack}>Back to VTG</button>
    </div>
  {:else if viewMode === 'print'}
    <PrintPreviewPages
      sequences={allSequences}
      {cardSize}
      theme={selectedTheme}
      {rerenderKey}
      isLoading={loading}
      {handPointsVisible}
      {showGrid}
      {showTKA}
      {showWord}
      {includeStartPosition}
      footers={allFooters}
      onCardContextMenu={onContextMenu ? (x, y, rerender) => onContextMenu(x, y, rerender) : undefined}
      onPairsReady={(pairs) => { renderedPairs = pairs; }}
      onRenderStateChange={(state) => {
        isRendering = state.isRendering;
        renderProgress = state.progress;
        renderTotal = state.total;
      }}
    />
  {:else}
    {#each ratioGroups as group (group.ratio)}
      <section class="ratio-section">
        <h3 class="ratio-header" style="--accent: {theme?.accentColor ?? '#fff'};">
          {group.ratio}
          <span class="turns-note">{turnsLabel(group.turns)}</span>
        </h3>
        <div class="sequence-grid">
          {#each group.sequences as sequence (sequence.id ?? sequence.word)}
            <div class="playing-card" use:detectOrientation>
              <ChoreoCard
                {sequence}
                printMode={true}
                {handPointsVisible}
                {showGrid}
                {showTKA}
                {showWord}
                {includeStartPosition}
                onSelect={() => onSelectSequence(sequence)}
                {onContextMenu}
              />
            </div>
          {/each}
        </div>
      </section>
    {/each}
  {/if}
</div>

<style>
  .vtg-family-drilldown {
    width: 100%;
  }

  .top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 0 16px;
    flex-wrap: wrap;
    gap: 12px;
  }

  .top-bar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .view-toggle {
    display: flex;
  }

  .action-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 6px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font: inherit;
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 0.15s;
  }

  .view-toggle .action-chip:first-child { border-radius: 8px 0 0 8px; }
  .view-toggle .action-chip:last-child { border-radius: 0 8px 8px 0; }

  .action-chip.active {
    background: var(--theme-accent, #4a9eff);
    color: var(--theme-text, #fff);
    border-color: var(--theme-accent, #4a9eff);
  }

  .action-chip:hover:not(.active) {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #fff);
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-min, 14px);
  }

  .crumb {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 8px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font: inherit;
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }

  .crumb:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #fff);
    text-decoration: none;
  }

  .crumb:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .crumb.current {
    color: var(--theme-text, #fff);
    cursor: default;
    font-weight: 600;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .crumb.current:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, #fff);
  }

  .crumb-sep {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.25));
    font-size: 14px;
    padding: 0 2px;
  }

  .loading,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px 16px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
  }

  .back-btn {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    padding: 8px 16px;
    cursor: pointer;
    font-size: var(--font-size-min, 14px);
  }

  .ratio-section {
    margin-bottom: 24px;
  }

  .ratio-header {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    margin: 0 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .turns-note {
    font-weight: 400;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    margin-left: 8px;
    font-size: var(--font-size-compact, 12px);
  }

  .sequence-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
  }

  .playing-card {
    aspect-ratio: 5 / 7;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: var(--shadow-card, 0 4px 20px rgba(0, 0, 0, 0.3), 0 1px 4px rgba(0, 0, 0, 0.15));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--print-bg, #ffffff);
  }

  .playing-card :global(> button) {
    width: 100%;
    height: 100%;
    border-radius: 0;
  }

  @media (max-width: 480px) {
    .sequence-grid {
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 8px;
    }
  }
</style>
