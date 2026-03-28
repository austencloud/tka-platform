<!--
  CardPreviewTab.svelte - Top-level orchestrator for the card preview experience.

  Manages three levels of navigation:
    Level 0: SourcePicker (choose LOOPs or VTG)
    Level 1: Collection grid (LoopCollectionView or VtgCollectionView)
    Level 2: Card page layout for the selected deck
-->
<script lang="ts">
  import type { Deck } from "../../domain/models/Deck";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IDeckLoader } from "../../services/contracts/IDeckLoader";
  import type { IPrintCardRenderer } from "../../services/contracts/IPrintCardRenderer";
  import type { IPrintPDFExporter, CardPair } from "../../services/contracts/IPrintPDFExporter";
  import type { IPrintZipExporter, ZipCardPair } from "../../services/contracts/IPrintZipExporter";
  import { container } from "$lib/shared/di";
  import { createCardPreviewState, type VisibilitySettings } from "../../state/card-preview-state.svelte";
  import { setCardPreviewContext } from "../../context/card-preview-context";
  import BreadcrumbBar from "./BreadcrumbBar.svelte";
  import CardSizeToggle from "./CardSizeToggle.svelte";
  import SourcePicker from "./SourcePicker.svelte";
  import SubsetFilterBar from "./SubsetFilterBar.svelte";
  import CardPageLayout from "./CardPageLayout.svelte";
  import CardPreviewSettings from "./CardPreviewSettings.svelte";
  import LoopCollectionView from "../LoopCollectionView.svelte";
  import VtgCollectionView from "../VtgCollectionView.svelte";

  interface Props {
    decks: Deck[];
  }

  let { decks }: Props = $props();

  const deckLoader = container.items.deckLoader as IDeckLoader;
  const previewState = createCardPreviewState(deckLoader, decks);
  setCardPreviewContext({ state: previewState });

  // Visibility settings (persisted via localStorage)
  function getStoredBool(key: string, def: boolean): boolean {
    if (typeof window === 'undefined') return def;
    const v = localStorage.getItem(key);
    return v === null ? def : v === 'true';
  }

  let showGrid = $state(getStoredBool('choreoCard.showGrid', true));
  let showTKA = $state(getStoredBool('choreoCard.showTKA', true));
  let showWord = $state(getStoredBool('choreoCard.showWord', true));
  let includeStartPosition = $state(getStoredBool('choreoCard.includeStartPosition', true));
  let handPointsVisible = $state(getStoredBool('choreoCard.handPointsVisible', true));
  let selectedTheme = $state(localStorage?.getItem('cardPreview.theme') ?? 'nightSky');
  let exportFormat = $state<'pdf' | 'zip'>(
    (localStorage?.getItem('cardPreview.exportFormat') as 'pdf' | 'zip') ?? 'zip'
  );
  let settingsOpen = $state(false);
  let isExporting = $state(false);

  let visibility = $derived<VisibilitySettings>({
    showGrid,
    showTKA,
    showWord,
    includeStartPosition,
    handPointsVisible,
    theme: selectedTheme,
  });

  let renderOptions = $derived(previewState.buildRenderOptions(visibility));

  const themeOptions = [
    { id: 'nightSky', label: 'Night Sky', color: '#1a1a2e' },
    { id: 'deepOcean', label: 'Deep Ocean', color: '#0a1628' },
    { id: 'snowfall', label: 'Snowfall', color: '#e8eaf0' },
    { id: 'emberGlow', label: 'Ember Glow', color: '#2d1b1b' },
    { id: 'sakuraDrift', label: 'Sakura Drift', color: '#2d1b28' },
    { id: 'fireflyForest', label: 'Firefly Forest', color: '#1b2d1b' },
    { id: 'autumnDrift', label: 'Autumn Drift', color: '#2d251b' },
    { id: 'pride', label: 'Pride', color: 'linear-gradient(135deg, #e40303, #ff8c00, #ffed00, #008026, #004dff, #750787)' },
  ] as const;

  // Bridge state factory values into Svelte's reactive system via $derived.
  // Accessing $state through a getter on a const object may not always
  // trigger template reactivity — these wrappers guarantee it.
  let currentLevel = $derived(previewState.level);
  let currentSource = $derived(previewState.selectedSource);
  let currentDeck = $derived(previewState.selectedDeck);
  let currentBreadcrumbs = $derived(previewState.breadcrumbs);
  let currentCardSize = $derived(previewState.cardSize);
  let currentFamilyIds = $derived(previewState.selectedFamilyIds);
  let currentPositionFilter = $derived(previewState.startPositionFilter);
  let currentFilteredSequences = $derived(previewState.filteredSequences);
  let currentIsLoading = $derived(previewState.isLoading);
  let currentIsLargeDeck = $derived(previewState.isLargeDeck);

  let loopDecks = $derived(decks.filter(d => d.collection === 'LOOPs'));
  let vtgDecks = $derived(decks.filter(d => d.collection === 'VTG'));
  let collectionDecks = $derived(
    currentSource === 'loops' ? loopDecks : vtgDecks
  );

  function handleVisibilityChange(key: string, value: boolean) {
    const map: Record<string, () => void> = {
      showGrid: () => { showGrid = value; },
      showTKA: () => { showTKA = value; },
      showWord: () => { showWord = value; },
      includeStartPosition: () => { includeStartPosition = value; },
      handPointsVisible: () => { handPointsVisible = value; },
    };
    map[key]?.();
    localStorage.setItem(`choreoCard.${key}`, String(value));
  }

  function handleThemeChange(id: string) {
    selectedTheme = id;
    localStorage.setItem('cardPreview.theme', id);
  }

  function handleExportFormatChange(format: 'pdf' | 'zip') {
    exportFormat = format;
    localStorage.setItem('cardPreview.exportFormat', format);
  }

  async function handleExport() {
    if (previewState.filteredSequences.length === 0) return;
    isExporting = true;
    try {
      const printRenderer = container.items.printCardRenderer as IPrintCardRenderer;
      const opts = previewState.buildRenderOptions(visibility);

      if (exportFormat === 'pdf') {
        const pairs: CardPair[] = [];
        for (const seq of previewState.filteredSequences) {
          const front = await printRenderer.renderFront(seq, opts);
          const back = await printRenderer.renderBack(seq, opts);
          pairs.push({ front, back, label: seq.word ?? seq.id });
        }
        const pdfExporter = container.items.printPDFExporter as IPrintPDFExporter;
        const deckName = previewState.selectedDeck?.name ?? 'cards';
        const blob = await pdfExporter.exportHomePrintPDF(pairs, deckName, previewState.cardSize);
        downloadBlob(blob, `${deckName}-${previewState.cardSize}.pdf`);
      } else {
        const pairs: ZipCardPair[] = [];
        for (const seq of previewState.filteredSequences) {
          const front = await printRenderer.renderFront(seq, opts);
          const back = await printRenderer.renderBack(seq, opts);
          pairs.push({ front, back, label: seq.word ?? seq.id });
        }
        const zipExporter = container.items.printZipExporter as IPrintZipExporter;
        const deckName = previewState.selectedDeck?.name ?? 'cards';
        const blob = await zipExporter.exportDeckZIP(pairs, deckName);
        downloadBlob(blob, `${deckName}-${previewState.cardSize}.zip`);
      }
    } finally {
      isExporting = false;
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="card-preview-tab">
  <div class="top-bar">
    <div class="top-bar-left">
      <BreadcrumbBar
        segments={currentBreadcrumbs}
        onNavigate={(level) => previewState.navigateTo(level)}
      />
    </div>
    <div class="top-bar-right">
      {#if currentLevel === 2}
        <CardSizeToggle
          selected={currentCardSize}
          onchange={(size) => { previewState.cardSize = size; }}
        />
      {/if}
      <button
        class="settings-toggle"
        onclick={() => { settingsOpen = !settingsOpen; }}
        aria-label="Toggle settings"
      >
        <i class="fas fa-cog" aria-hidden="true"></i>
      </button>
    </div>
  </div>

  {#if currentLevel === 2 && currentDeck}
    <div class="filter-bar-container">
      <SubsetFilterBar
        families={currentDeck.families}
        selectedFamilyIds={currentFamilyIds}
        activePosition={currentPositionFilter}
        totalFiltered={currentFilteredSequences.length}
        totalSequences={currentDeck.totalSequences}
        isLargeDeck={currentIsLargeDeck}
        onFamilyChange={(ids) => previewState.setFamilyFilter(ids)}
        onPositionChange={(pos) => previewState.setStartPositionFilter(pos)}
      />
    </div>
  {/if}

  <div class="content-area">
    <div class="content-main">
      {#if currentLevel === 0}
        <SourcePicker {decks} onSelect={(source) => previewState.selectSource(source)} />

      {:else if currentLevel === 1 && currentSource === 'loops'}
        <LoopCollectionView
          decks={collectionDecks}
          onSelectDeck={(deck) => previewState.selectDeck(deck)}
        />

      {:else if currentLevel === 1 && currentSource === 'vtg'}
        <VtgCollectionView
          decks={collectionDecks}
          onSelectDeck={(deckId) => {
            const deck = collectionDecks.find(d => d.id === deckId);
            if (deck) previewState.selectDeck(deck);
          }}
          onSelectFamily={() => {}}
        />

      {:else if currentLevel === 2 && currentDeck}
        <CardPageLayout
          sequences={currentFilteredSequences}
          families={currentDeck.families}
          selectedFamilyIds={currentFamilyIds}
          cardSize={currentCardSize}
          {renderOptions}
          isLoading={currentIsLoading}
          isLargeDeck={currentIsLargeDeck}
          onCardClick={() => {}}
          onRenderProgress={(current, total) => {
            previewState.renderProgress = current;
            previewState.renderTotal = total;
          }}
        />
      {/if}
    </div>

    <CardPreviewSettings
      isOpen={settingsOpen}
      {showGrid}
      {showTKA}
      {showWord}
      {includeStartPosition}
      {handPointsVisible}
      {selectedTheme}
      {themeOptions}
      {exportFormat}
      cardSize={currentCardSize}
      totalCards={currentFilteredSequences.length}
      {isExporting}
      hasRenderedCards={currentFilteredSequences.length > 0 && !currentIsLoading}
      onToggle={() => { settingsOpen = false; }}
      onVisibilityChange={handleVisibilityChange}
      onThemeChange={handleThemeChange}
      onExportFormatChange={handleExportFormatChange}
      onExport={handleExport}
    />
  </div>
</div>

<style>
  .card-preview-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .top-bar-left {
    flex: 1;
    min-width: 0;
  }

  .top-bar-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .settings-toggle {
    background: none;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    padding: 6px 10px;
    cursor: pointer;
  }

  .settings-toggle:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .filter-bar-container {
    padding: 0 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    flex-shrink: 0;
  }

  .content-area {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .content-main {
    flex: 1;
    overflow-y: auto;
    min-width: 0;
  }
</style>
