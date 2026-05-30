<script lang="ts">

import { exportDeckZIP } from "$lib/features/choreo-card/services/print-zip-exporter";
import { aggregateFamilySequences } from "$lib/features/choreo-card/services/tnd-family-aggregator";

  import type { Catalog } from "../domain/models/Catalog";
  import type { CardFooter } from "../domain/models/DeckRelease";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { FamilyRatioGroup } from "../services/types";
import type { CardPair } from "../services/types";
  import { TND_ELEMENTS } from "../domain/tnd-element";
  import { computeTnDCardFooter } from "../domain/catalog-tnd-labels";
  import PrintPreviewPages from "./print-preview/PrintPreviewPages.svelte";
  import PrintPreviewToolbar from "./print-preview/PrintPreviewToolbar.svelte";
  import PrintDialog from "./print-preview/PrintDialog.svelte";
  import type { PrintPDFMode } from "../services/print-pdf-exporter";
  import CardSizeToggle from "./card-preview/CardSizeToggle.svelte";
  import type { CardSizeId } from "../domain/card-sizes";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";

  type ViewMode = 'grid' | 'print';

  interface Props {
    familyId: string;
    catalogs: Catalog[];
    includeStartPosition?: boolean;
    onSelectSequence: (sequence: SequenceData) => void;
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
    onBack: () => void;
  }

  const {
    familyId,
    catalogs,
    includeStartPosition = true,
    onSelectSequence,
    onContextMenu,
    onBack,
  }: Props = $props();

  const theme = $derived(
    TND_ELEMENTS.find((t) => t.familyId === familyId),
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
    aggregateFamilySequences(familyId, catalogs)
      .then((groups) => {
        ratioGroups = groups;
        loading = false;
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : String(err);
        loading = false;
      });
  });

  // ── Card view mode ──────────────────────────────────────────────────────
  // Map legacy 'cards' value to 'print' on read
  const storedViewMode = typeof window !== 'undefined' ? localStorage.getItem('choreoCard.deckViewMode') : null;
  const initialViewMode: ViewMode = storedViewMode === 'cards' ? 'print' : (storedViewMode as ViewMode | null) ?? 'grid';

  let viewMode = $state<ViewMode>(initialViewMode);
  let cardSize = $state<CardSizeId>(
    (typeof window !== 'undefined' ? localStorage.getItem('cardPreview.cardSize') : null) as CardSizeId ?? 'poker'
  );
  let selectedTheme = $derived(settingsService.settings.backgroundType ?? 'cosmic');

  // ── Print preview state ─────────────────────────────────────────────────
  let renderedPairs = $state<CardPair[]>([]);
  let showPrintDialog = $state(false);
  let isExporting = $state(false);
  let exportProgress = $state(0);
  let exportTotal = $state(0);
  let exportError = $state("");
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
      g.sequences.map(() => computeTnDCardFooter(familyId, g.ratio))
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

  async function handleExportPDF(mode: PrintPDFMode = 'combined') {
    if (renderedPairs.length === 0 || isExporting) return;
    isExporting = true;
    exportError = "";
    exportProgress = 0;
    exportTotal = 0;
    try {
      const { exportHomePrintPDF } = await import(
        "$lib/features/choreo-card/services/print-pdf-exporter"
      );
      const suffix = mode === "fronts" ? "_fronts" : mode === "backs" ? "_backs" : "_print";
      const blob = await exportHomePrintPDF(renderedPairs, familyLabel, cardSize, (current, total) => {
        exportProgress = current;
        exportTotal = total;
      }, mode);
      downloadBlob(blob, `${familyLabel}${suffix}.pdf`);
    } catch (e) {
      exportError = `PDF export failed: ${e instanceof Error ? e.message : e}`;
    } finally {
      isExporting = false;
      exportProgress = 0;
      exportTotal = 0;
    }
  }

  async function handleExportZIP() {
    if (renderedPairs.length === 0 || isExporting) return;
    isExporting = true;
    exportError = "";
    exportProgress = 0;
    exportTotal = 0;
    try {
      const blob = await exportDeckZIP(renderedPairs, familyLabel, (current, total) => {
        exportProgress = current;
        exportTotal = total;
      });
      downloadBlob(blob, `${familyLabel}-${cardSize}.zip`);
    } catch (e) {
      exportError = `ZIP export failed: ${e instanceof Error ? e.message : e}`;
    } finally {
      isExporting = false;
      exportProgress = 0;
      exportTotal = 0;
    }
  }
</script>

<div class="tnd-family-drilldown">
  <div class="top-bar">
    <nav class="breadcrumb" aria-label="Catalog navigation">
      <button class="crumb" onclick={onBack} type="button" aria-label="Go back to TnD">TnD</button>
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
      {renderProgress}
      {renderTotal}
      onCardSizeChange={(s) => {
        cardSize = s;
        if (typeof window !== 'undefined') localStorage.setItem('cardPreview.cardSize', s);
      }}
      onRerender={() => { rerenderKey++; }}
      onPrint={() => { showPrintDialog = true; }}
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
      <button type="button" class="back-btn" aria-label="Go back to TnD" onclick={onBack}>Back to TnD</button>
    </div>
  {:else if ratioGroups.length === 0}
    <div class="empty-state" role="status">
      <p>No sequences found for {familyLabel}</p>
      <button type="button" class="back-btn" aria-label="Go back to TnD" onclick={onBack}>Back to TnD</button>
    </div>
  {:else if viewMode === 'print'}
    <PrintPreviewPages
      sequences={allSequences}
      {cardSize}
      theme={selectedTheme}
      tndElement={theme}
      {rerenderKey}
      isLoading={loading}
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
        <PrintPreviewPages
          sequences={group.sequences}
          {cardSize}
          theme={selectedTheme}
          tndElement={theme}
          {rerenderKey}
          isLoading={false}
          {includeStartPosition}
          displayMode="grid"
          showBacks={true}
          footers={group.sequences.map(() => computeTnDCardFooter(familyId, group.ratio))}
          onCardContextMenu={onContextMenu ? (x, y, rerender) => onContextMenu(x, y, rerender) : undefined}
          onCardClick={(seq) => onSelectSequence(seq)}
        />
      </section>
    {/each}
  {/if}
</div>

{#if showPrintDialog}
  <PrintDialog
    title="Print {familyLabel}"
    subtitle="{allSequences.length} sequences"
    cardCount={allSequences.length}
    {cardSize}
    theme={selectedTheme}
    {isExporting}
    exportProgress={exportProgress}
    exportTotal={exportTotal}
    exportError={exportError}
    onExportPDF={handleExportPDF}
    onExportZIP={handleExportZIP}
    onCardSizeChange={(s) => {
      cardSize = s;
      if (typeof window !== 'undefined') localStorage.setItem('cardPreview.cardSize', s);
    }}
    onClose={() => { if (!isExporting) showPrintDialog = false; }}
  />
{/if}

<style>
  .tnd-family-drilldown {
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
</style>
