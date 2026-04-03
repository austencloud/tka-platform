<!--
  PrintPrepView.svelte - Print Preparation Tab (Orchestrator)

  Renders all cards in a loaded deck at standard poker card specifications
  (2.5" x 3.5" at 300 DPI with bleed) and exports as PDF or ZIP of PNGs.
  Composes sidebar, card grid, and detail modal as child components.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { Deck, DeckFamily } from "../domain/models/Deck";
  import type { IPrintCardRenderer, PrintRenderOptions } from "../services/contracts/IPrintCardRenderer";
  import type { IPrintPDFExporter, CardPair } from "../services/contracts/IPrintPDFExporter";
  import type { IPrintZipExporter } from "../services/contracts/IPrintZipExporter";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import { simplifyRepeatedWord } from "$lib/features/create/shared/workspace-panel/shared/utils/word-simplifier";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState, ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import PrintPrepSidebar from "./print-prep/PrintPrepSidebar.svelte";
  import PrintPrepCardGrid from "./print-prep/PrintPrepCardGrid.svelte";
  import PrintPrepDetailModal from "./print-prep/PrintPrepDetailModal.svelte";

  interface Props {
    deck: Deck | null;
    deckSequences: SequenceData[];
    onSwitchToDecks: () => void;
  }

  let { deck, deckSequences, onSwitchToDecks }: Props = $props();

  // ── Persisted settings ──────────────────────────────────────────────
  let includeInfoCards = $state(loadBool("printPrep.includeInfoCards", true));
  let showBleedOverlay = $state(loadBool("printPrep.showBleed", false));
  let selectedTheme = $state(loadString("printPrep.theme", "nightSky"));

  // ── Visibility settings (shared with other choreo card tabs via localStorage) ──
  let showGrid = $state(loadBool("choreoCard.showGrid", true));
  let showTKA = $state(loadBool("choreoCard.showTKA", true));
  let showWord = $state(loadBool("choreoCard.showWord", true));
  let includeStartPosition = $state(loadBool("choreoCard.includeStartPosition", true));
  let handPointsVisible = $state(loadBool("choreoCard.handPointsVisible", true));

  // Read startPositionLayout from the shared composition manager
  const imageComposition = getImageCompositionManager();

  /** Build render options from current settings, resolving per-step-count layout */
  function buildRenderOptions(stepCount?: number): PrintRenderOptions {
    return {
      showGrid,
      showTKA,
      showWord,
      showQRCode: true,
      includeStartPosition,
      startPositionLayout: stepCount != null
        ? imageComposition.getStartPositionLayoutForStepCount(stepCount)
        : imageComposition.startPositionLayout,
      handPointsVisible,
      theme: selectedTheme,
      bluePropType: settingsService.settings.bluePropType as PropType,
      redPropType: settingsService.settings.redPropType as PropType,
    };
  }

  // Track prop type for reactive re-rendering
  let lastBlueProp = $state(settingsService.settings.bluePropType);
  let lastRedProp = $state(settingsService.settings.redPropType);

  // Auto-rerender all cards in-place when prop type changes (no DOM teardown)
  $effect(() => {
    const currentBlue = settingsService.settings.bluePropType;
    const currentRed = settingsService.settings.redPropType;
    if (
      (currentBlue !== lastBlueProp || currentRed !== lastRedProp) &&
      printRenderer && renderedPairs.length > 0
    ) {
      lastBlueProp = currentBlue;
      lastRedProp = currentRed;
      rerenderAllInPlace();
    }
  });

  /** Re-render every card's images in-place without tearing down the grid */
  async function rerenderAllInPlace() {
    if (!printRenderer) return;

    // Mark all cards as re-rendering
    rerenderingCards = new Set(renderedPairs.map((_, i) => i));

    for (let i = 0; i < renderedPairs.length; i++) {
      const pair = renderedPairs[i]!;
      const options = buildRenderOptions(pair.sequence.steps?.length ?? 0);
      try {
        const front = await printRenderer.renderFront(pair.sequence, options);
        const back = await printRenderer.renderBack(pair.sequence, options);
        renderedPairs[i] = {
          ...pair,
          front,
          back,
          frontSrc: front.toDataURL("image/png"),
          backSrc: back.toDataURL("image/png"),
        };
      } catch (err) {
        console.error(`Failed to rerender card ${i}:`, err);
      }
      // Remove from loading set as each card completes
      const next = new Set(rerenderingCards);
      next.delete(i);
      rerenderingCards = next;
    }
  }

  // ── Render state ────────────────────────────────────────────────────
  // Store data URL strings (not canvases) so Svelte can detect changes for <img> reactivity
  let renderedPairs = $state<Array<{
    frontSrc: string;
    backSrc: string;
    front: HTMLCanvasElement;
    back: HTMLCanvasElement;
    label: string;
    familyId: string;
    sequence: SequenceData;
  }>>([]);
  let infoCardPair = $state<{ frontSrc: string; backSrc: string; front: HTMLCanvasElement; back: HTMLCanvasElement } | null>(null);
  let isRendering = $state(false);
  let renderProgress = $state(0);
  let renderTotal = $state(0);
  /** Tracks which card indices are currently re-rendering (for loading overlays) */
  let rerenderingCards = $state(new Set<number>());

  // ── Export state ────────────────────────────────────────────────────
  let isExporting = $state(false);
  let exportProgress = $state(0);
  let exportTotal = $state(0);
  let exportFormat = $state<"pdf" | "zip">("zip");

  // ── Detail view (click to zoom) ────────────────────────────────────
  let detailIndex = $state<number | null>(null);
  const detailPair = $derived(detailIndex !== null ? renderedPairs[detailIndex] ?? null : null);

  function openDetail(index: number) {
    detailIndex = index;
  }

  function closeDetail() {
    detailIndex = null;
  }

  function detailPrev() {
    if (detailIndex !== null && detailIndex > 0) detailIndex--;
  }

  function detailNext() {
    if (detailIndex !== null && detailIndex < renderedPairs.length - 1) detailIndex++;
  }

  // ── Context menu ───────────────────────────────────────────────────
  let contextMenuState: ContextMenuState = $state({ open: false });
  let contextMenuTarget: { index: number } | null = $state(null);

  function openContextMenu(e: MouseEvent, pairIndex: number) {
    e.preventDefault();
    contextMenuTarget = { index: pairIndex };
    contextMenuState = { open: true, x: e.clientX, y: e.clientY };
  }

  function closeContextMenu() {
    contextMenuState = { open: false };
    contextMenuTarget = null;
  }

  const contextMenuItems: ContextMenuEntry[] = $derived([
    {
      id: "rerender",
      label: "Rerender",
      icon: "fas fa-sync-alt",
      action: () => {
        if (contextMenuTarget !== null) rerenderCard(contextMenuTarget.index);
        closeContextMenu();
      },
    },
    {
      id: "rerender-all",
      label: "Rerender all",
      icon: "fas fa-redo",
      action: () => {
        rerenderAllInPlace();
        closeContextMenu();
      },
    },
  ]);

  async function rerenderCard(index: number) {
    if (!printRenderer) return;
    const pair = renderedPairs[index];
    if (!pair) return;

    rerenderingCards = new Set([...rerenderingCards, index]);
    const options = buildRenderOptions(pair.sequence.steps?.length ?? 0);

    try {
      const front = await printRenderer.renderFront(pair.sequence, options);
      const back = await printRenderer.renderBack(pair.sequence, options);
      renderedPairs[index] = {
        ...pair,
        front,
        back,
        frontSrc: front.toDataURL("image/png"),
        backSrc: back.toDataURL("image/png"),
      };
    } catch (err) {
      console.error(`Failed to rerender card ${index}:`, err);
    }

    const next = new Set(rerenderingCards);
    next.delete(index);
    rerenderingCards = next;
  }

  // ── Services ────────────────────────────────────────────────────────
  let printRenderer: IPrintCardRenderer | null = $state(null);
  let pdfExporter: IPrintPDFExporter | null = $state(null);
  let zipExporter: IPrintZipExporter | null = $state(null);

  // ── Theme options ───────────────────────────────────────────────────
  const THEME_OPTIONS = [
    { id: "nightSky", label: "Night Sky", color: "#4338ca" },
    { id: "deepOcean", label: "Deep Ocean", color: "#0891b2" },
    { id: "snowfall", label: "Snowfall", color: "#3b82f6" },
    { id: "emberGlow", label: "Ember Glow", color: "#ea580c" },
    { id: "sakuraDrift", label: "Sakura", color: "#db2777" },
    { id: "fireflyForest", label: "Firefly Forest", color: "#22c55e" },
    { id: "autumnDrift", label: "Autumn Drift", color: "#d97706" },
    { id: "pride", label: "Pride", color: "#f43f5e" },
  ] as const;

  // ── Derived state ───────────────────────────────────────────────────
  const pairsByFamily = $derived.by(() => {
    if (!deck) return [];
    const groups: Array<{ family: DeckFamily; pairs: typeof renderedPairs }> = [];
    for (const family of deck.families ?? []) {
      const familyPairs = renderedPairs.filter((p) => p.familyId === family.id);
      if (familyPairs.length > 0) {
        groups.push({ family, pairs: familyPairs });
      }
    }
    return groups;
  });

  const totalCards = $derived(
    renderedPairs.length + (includeInfoCards && infoCardPair ? 1 : 0)
  );

  // ── Persistence helpers ─────────────────────────────────────────────
  function loadBool(key: string, defaultVal: boolean): boolean {
    if (typeof window === "undefined") return defaultVal;
    const stored = localStorage.getItem(key);
    return stored === null ? defaultVal : stored === "true";
  }

  function loadString(key: string, defaultVal: string): string {
    if (typeof window === "undefined") return defaultVal;
    return localStorage.getItem(key) ?? defaultVal;
  }

  function persistBool(key: string, value: boolean) {
    if (typeof window !== "undefined") localStorage.setItem(key, String(value));
  }

  function persistString(key: string, value: string) {
    if (typeof window !== "undefined") localStorage.setItem(key, value);
  }

  // ── Setting handlers ────────────────────────────────────────────────
  function toggleInfoCards() {
    includeInfoCards = !includeInfoCards;
    persistBool("printPrep.includeInfoCards", includeInfoCards);
  }

  function toggleBleedOverlay() {
    showBleedOverlay = !showBleedOverlay;
    persistBool("printPrep.showBleed", showBleedOverlay);
  }

  function handleThemeChange(themeId: string) {
    selectedTheme = themeId;
    persistString("printPrep.theme", themeId);
    // Re-render with new theme (in-place, no DOM teardown)
    if (renderedPairs.length > 0 && printRenderer) {
      rerenderAllInPlace();
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────
  onMount(() => {
    printRenderer = container.items.printCardRenderer as IPrintCardRenderer;
    pdfExporter = container.items.printPDFExporter as IPrintPDFExporter;
    zipExporter = container.items.printZipExporter as IPrintZipExporter;
  });

  // Re-render when deck changes (not when settings change)
  let lastDeckId: string | null = null;
  let lastSeqCount = 0;
  $effect(() => {
    const deckId = deck?.id ?? null;
    const seqCount = deckSequences.length;
    // Only trigger on actual deck/sequence changes, not settings
    if (deckId !== lastDeckId || seqCount !== lastSeqCount) {
      lastDeckId = deckId;
      lastSeqCount = seqCount;
      if (deck && seqCount > 0 && printRenderer) {
        renderAllCards();
      }
    }
  });

  // ── Rendering ───────────────────────────────────────────────────────
  async function renderAllCards() {
    if (!printRenderer || !deck) return;

    isRendering = true;
    renderedPairs = [];
    renderProgress = 0;

    // Build ordered list of sequences matching deck family order
    const orderedSequences: Array<{ seq: SequenceData; familyId: string }> = [];
    for (const family of deck.families ?? []) {
      for (const seqId of family.sequenceIds) {
        const seq = deckSequences.find((s) => s.id === seqId);
        if (seq) orderedSequences.push({ seq, familyId: family.id });
      }
    }

    renderTotal = orderedSequences.length;

    // Render info cards
    try {
      const infoFront = await printRenderer.renderInfoCardFront(selectedTheme);
      const infoBack = await printRenderer.renderInfoCardBack(selectedTheme);
      infoCardPair = {
        front: infoFront,
        back: infoBack,
        frontSrc: infoFront.toDataURL("image/png"),
        backSrc: infoBack.toDataURL("image/png"),
      };
    } catch (err) {
      console.error("Failed to render info cards:", err);
    }

    // Render sequence cards progressively
    for (let i = 0; i < orderedSequences.length; i++) {
      const { seq, familyId } = orderedSequences[i]!;
      const options = buildRenderOptions(seq.steps?.length ?? 0);
      try {
        const front = await printRenderer.renderFront(seq, options);
        const back = await printRenderer.renderBack(seq, options);
        renderedPairs = [
          ...renderedPairs,
          {
            front,
            back,
            frontSrc: front.toDataURL("image/png"),
            backSrc: back.toDataURL("image/png"),
            label: simplifyRepeatedWord(seq.word ?? seq.name ?? `Card ${i + 1}`),
            familyId,
            sequence: seq,
          },
        ];
      } catch (err) {
        console.error(`Failed to render card ${i}:`, err);
      }
      renderProgress = i + 1;
    }

    isRendering = false;
  }

  // ── Export: PDF ──────────────────────────────────────────────────────
  async function exportPDF() {
    if (!pdfExporter || !deck) return;

    isExporting = true;
    exportProgress = 0;

    const pairs: CardPair[] = buildExportPairs();
    exportTotal = pairs.length;

    try {
      const blob = await pdfExporter.exportHomePrintPDF(pairs, deck.name, 'poker', (current, total) => {
        exportProgress = current;
        exportTotal = total;
      });
      triggerDownload(blob, `${sanitizeName(deck.name)}_home_print.pdf`);
    } catch (err) {
      console.error("Failed to export PDF:", err);
    }

    isExporting = false;
  }

  // ── Export: ZIP ─────────────────────────────────────────────────────
  async function exportZIP() {
    if (!zipExporter || !deck) return;

    isExporting = true;
    exportProgress = 0;

    const pairs = buildExportPairs();
    exportTotal = pairs.length;

    try {
      const blob = await zipExporter.exportDeckZIP(pairs, deck.name, (current, total) => {
        exportProgress = current;
        exportTotal = total;
      });
      triggerDownload(blob, `${sanitizeName(deck.name)}_cards.zip`);
    } catch (err) {
      console.error("Failed to export ZIP:", err);
    }

    isExporting = false;
  }

  function handleExport() {
    if (exportFormat === "pdf") exportPDF();
    else exportZIP();
  }

  // ── Individual card download ────────────────────────────────────────
  function downloadCard(canvas: HTMLCanvasElement, filename: string) {
    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, filename);
    }, "image/png");
  }

  // ── Helpers ─────────────────────────────────────────────────────────
  function buildExportPairs(): CardPair[] {
    const pairs: CardPair[] = [];
    if (includeInfoCards && infoCardPair) {
      pairs.push({
        front: infoCardPair.front,
        back: infoCardPair.back,
        label: "How_to_Read_a_Choreo_Card",
      });
    }
    for (const pair of renderedPairs) {
      pairs.push({ front: pair.front, back: pair.back, label: pair.label });
    }
    return pairs;
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_\-\s]/g, "").replace(/\s+/g, "_");
  }
</script>

<div class="print-prep">
  {#if !deck}
    <!-- Empty state: no deck selected -->
    <div class="empty-state">
      <div class="empty-icon">
        <i class="fas fa-print" aria-hidden="true"></i>
      </div>
      <h2 class="empty-title">Print Prep</h2>
      <p class="empty-description">
        Select a deck in the Decks tab first. Each deck becomes a print-ready
        set of standard poker-size playing cards (2.5" x 3.5").
      </p>
      <button class="go-to-decks" onclick={onSwitchToDecks}>
        <i class="fas fa-layer-group" aria-hidden="true"></i>
        Go to Decks
      </button>
    </div>
  {:else}
    <div class="prep-header">
      <button class="back-button" onclick={onSwitchToDecks} type="button">
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        Back to Deck
      </button>
      <h2 class="prep-title">
        <i class="fas fa-print" aria-hidden="true"></i>
        Print Prep: {deck.name}
      </h2>
    </div>
    <div class="prep-layout">
      <PrintPrepSidebar
        {exportFormat}
        {includeInfoCards}
        {showBleedOverlay}
        {selectedTheme}
        themeOptions={THEME_OPTIONS}
        {totalCards}
        {isRendering}
        {isExporting}
        {exportProgress}
        {exportTotal}
        hasRenderedCards={renderedPairs.length > 0}
        onExportFormatChange={(format) => (exportFormat = format)}
        onExport={handleExport}
        onToggleInfoCards={toggleInfoCards}
        onToggleBleedOverlay={toggleBleedOverlay}
        onThemeChange={handleThemeChange}
      />

      <PrintPrepCardGrid
        deckName={deck.name}
        {totalCards}
        {isRendering}
        {renderProgress}
        {renderTotal}
        {includeInfoCards}
        {showBleedOverlay}
        {infoCardPair}
        {pairsByFamily}
        {renderedPairs}
        {rerenderingCards}
        deckSequenceCount={deckSequences.length}
        onOpenDetail={openDetail}
        onOpenContextMenu={openContextMenu}
        onDownloadCard={downloadCard}
        {sanitizeName}
      />
    </div>
  {/if}
</div>

{#if detailPair && detailIndex !== null}
  <PrintPrepDetailModal
    {detailPair}
    {detailIndex}
    totalCount={renderedPairs.length}
    onClose={closeDetail}
    onPrev={detailPrev}
    onNext={detailNext}
  />
{/if}

<ContextMenu menuState={contextMenuState} items={contextMenuItems} onClose={closeContextMenu} />

<style>
  .print-prep {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* ── Empty state ─────────────────────────────────────────────────── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    padding: 32px;
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    margin-bottom: 8px;
  }

  .empty-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .empty-description {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    max-width: 380px;
    line-height: 1.5;
  }

  .go-to-decks {
    margin-top: 8px;
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    background: var(--theme-accent, #6366f1);
    color: #ffffff;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
  }

  .go-to-decks:hover {
    filter: brightness(1.1);
  }

  .go-to-decks:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* ── Header ──────────────────────────────────────────────────────── */
  .prep-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    min-height: 36px;
  }

  .back-button:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
  }

  .back-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .prep-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* ── Layout ──────────────────────────────────────────────────────── */
  .prep-layout {
    display: flex;
    height: 100%;
    min-height: 0;
    gap: 0;
  }

  @media (max-width: 900px) {
    .prep-layout {
      flex-direction: column;
    }
  }
</style>
