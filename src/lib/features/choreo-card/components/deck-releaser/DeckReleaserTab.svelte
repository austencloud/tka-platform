<script lang="ts">
  import { onMount } from "svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import {
    loadCatalogs,
    loadSequencesByIds,
  } from "../../services/catalog-loader";
  import type {
    DeckRelease,
    DeckRecipe,
  } from "../../domain/models/DeckRelease";
  import {
    getNextDeckNumber,
    releaseDeck,
    getAllReleases,
    updateDeckMeta,
    deleteDeck,
  } from "../../services/deck-release-store";
  import ConfigureStep from "./ConfigureStep.svelte";
  import ReviewStep from "./ReviewStep.svelte";
  import ReleaseHistoryPanel from "./ReleaseHistoryPanel.svelte";
  import GeneratedArchivePanel from "./GeneratedArchivePanel.svelte";
  import {
    archiveDeck,
    listArchivedDecks,
    getArchivedDeck,
    deleteArchivedDeck,
  } from "../../services/deck-archive-store";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import PrintPanel from "../print-preview/PrintPanel.svelte";
  import DeckReleaseNameModal from "./DeckReleaseNameModal.svelte";
  import { createDeckReleaserState } from "./state/deck-releaser-state.svelte";
  import { createDeckPrintState } from "./state/deck-print-state.svelte";
  import { createDeckArchiveState } from "./state/deck-archive-state.svelte";
  import { createDeckReleaseState } from "./state/deck-release-state.svelte";
  import { createDeckProductionState } from "./state/deck-production-state.svelte";
  import { isGalleryRelease, isLoopRelease } from "./deck-release-model";
  import { setDeckReleaserContext } from "./context/deck-releaser-context";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { mintSeed, nextReferenceNumber } from "../../services/deck-recipe";
  import { generationOrchestrator } from "$lib/shared/create/services/generation-orchestrator";
  import { startPositionManager } from "$lib/shared/create/services/start-position-manager";
  import { loadDiamondEdges } from "../../services/pictograph-letter-lookup";
  import { prewarmCardPool } from "$lib/shared/render/services/card-pool-prewarm";
  import { warmCardBackCaches } from "../../services/card-back/warm-card-back-caches";

  interface Props {
    onContextMenu?: (
      x: number,
      y: number,
      rerender: () => void,
      sequence?: import("$lib/shared/foundation/domain/models/sequence-data").SequenceData
    ) => void;
  }

  let { onContextMenu }: Props = $props();

  const storage = typeof window === "undefined" ? null : window.localStorage;
  const rs = createDeckReleaserState({
    storage,
    getBluePropType: () => settingsService.settings.bluePropType,
    getRedPropType: () => settingsService.settings.redPropType,
    mintSeed,
    nextReferenceNumber,
  });
  setDeckReleaserContext({ state: rs });

  const print = createDeckPrintState(rs, {
    storage,
    download(blob, filename) {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    },
    async renderInsertCardPair(options) {
      const { renderInsertCardPair } =
        await import("../../services/PrintCardRenderer");
      return renderInsertCardPair(options);
    },
    async getOrBuildPrintPDF(...args) {
      const { getOrBuildPrintPDF } =
        await import("../../services/print-pdf-cache");
      return getOrBuildPrintPDF(...args);
    },
    async prepareSerializedPrintRun(options) {
      const { prepareSerializedPrintRun } =
        await import("../../services/serialized-print-run");
      return prepareSerializedPrintRun(options);
    },
    async exportHomePrintPDF(...args) {
      const { exportHomePrintPDF } =
        await import("../../services/print-pdf-exporter");
      return exportHomePrintPDF(...args);
    },
    async printPdfBlob(blob) {
      const { printPdfBlob } = await import("../../services/print-blob");
      printPdfBlob(blob);
    },
    async exportDeckZIP(...args) {
      const { exportDeckZIP } =
        await import("../../services/print-zip-exporter");
      return exportDeckZIP(...args);
    },
  });

  const archive = createDeckArchiveState(rs, {
    list: listArchivedDecks,
    load: getArchivedDeck,
    save: archiveDeck,
    delete: deleteArchivedDeck,
    getWords: () => print.metadata.keywords,
    nowIso: () => new Date().toISOString(),
  });

  const releaseHistory = createDeckReleaseState(rs, {
    getAll: getAllReleases,
    getNextNumber: getNextDeckNumber,
    create: releaseDeck,
    updateMetadata: updateDeckMeta,
    delete: deleteDeck,
  });

  const production = createDeckProductionState(rs, {
    loadCatalogs,
    loadSequencesByIds,
    loadDiamondEdges,
    async queryGalleryDeck(...args) {
      const { queryGalleryDeck } =
        await import("../../services/gallery-deck-source");
      return queryGalleryDeck(...args);
    },
    async resolveGalleryCards(...args) {
      const { resolveGalleryCards } =
        await import("../../services/gallery-deck-source");
      return resolveGalleryCards(...args);
    },
    generateSequence: (options) =>
      generationOrchestrator.generateSequence(options),
    getStartPositionVariations: (gridMode, blueOrientation, redOrientation) =>
      startPositionManager.getAllStartPositionVariations(
        gridMode,
        blueOrientation,
        redOrientation
      ),
    prewarmCardPool,
    warmCardBackCaches,
    loadArchivedDeck: archive.load,
    getReleasedSequenceIds: () => releaseHistory.releasedSequenceIds,
    info: (message) => toast.info(message),
    success: (message) => toast.success(message),
    error: (message) => toast.error(message),
  });

  // Captured synchronously at component init, BEFORE any $effect runs. The
  // auto-persist effect below would otherwise fire first and overwrite the saved
  // viewingDeckNumber with null (viewingRelease isn't restored until onMount),
  // wiping the very value the restore needs to reopen a released deck.
  const initialViewingDeckNumber = rs.savedViewingDeckNumber;
  // Persist is gated until the mount-time restore finishes, so the effect can
  // never clobber the saved session before restore reads it.
  let persistReady = $state(false);

  // Decks that follow the live prop setting (no pinned canonical prop): TnD +
  // Gallery, composed or released. Drives the in-deck prop switcher + prop unpin.
  const deckFollowsLiveProp = $derived(
    rs.viewingRelease
      ? !isLoopRelease(rs.viewingRelease)
      : rs.deckMode !== "loop"
  );
  // Gallery deck currently on screen (drives the Refresh-from-gallery action).
  const viewingGallery = $derived(
    rs.viewingRelease
      ? isGalleryRelease(rs.viewingRelease)
      : rs.deckMode === "gallery"
  );
  let showNameModal = $state(false);

  /** If the composed deck matches an existing release, bounce into it and return
   *  true; the caller skips the fresh-review path. */
  async function bounceIfDuplicate(): Promise<boolean> {
    const match = releaseHistory.findDuplicate(rs.cards);
    if (!match) return false;
    toast.info(
      `This deck already exists as Deck #${String(match.deckNumber).padStart(3, "0")}`
    );
    await handleSelectRelease(match);
    return true;
  }

  // Auto-persist every configure-step modification. Because persist() runs inside
  // the effect, it reactively tracks every field it serializes (dials, weights,
  // selections, draft) — so any change to the catalog config is saved without
  // each handler having to remember to call persist().
  $effect(() => {
    if (!persistReady) return;
    rs.persist();
  });

  type SidebarMode = "browse" | "print";
  // Persist the Browse/Print sidebar tab across refresh / re-open, same lifetime
  // as the print dials. localStorage, not session.
  const SIDEBAR_MODE_KEY = "deckReleaser.sidebarMode";
  function loadSidebarMode(): SidebarMode {
    if (typeof window === "undefined") return "browse";
    try {
      const raw = localStorage.getItem(SIDEBAR_MODE_KEY);
      return raw === "print" || raw === "browse" ? raw : "browse";
    } catch {
      return "browse";
    }
  }
  let sidebarMode = $state<SidebarMode>(loadSidebarMode());

  $effect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(SIDEBAR_MODE_KEY, sidebarMode);
    } catch {
      /* quota / private mode — non-fatal */
    }
  });

  async function handleOpenArchivedDeck(refNumber: number): Promise<void> {
    if (!(await archive.open(refNumber))) {
      toast.info("Couldn't load that archived deck.");
    }
  }

  async function handleDeleteRelease(deckNumber: number) {
    const error = await releaseHistory.remove(deckNumber);
    if (!error) {
      toast.success(`Deck #${String(deckNumber).padStart(3, "0")} deleted`);
      return;
    }
    const message = error instanceof Error ? error.message : "Delete failed";
    const isPermission =
      message.includes("permission") || message.includes("PERMISSION_DENIED");
    toast.error(
      isPermission
        ? "Admin access required to delete decks."
        : `Delete failed: ${message}`
    );
  }

  onMount(async () => {
    const savedDeckNumber = initialViewingDeckNumber;
    void archive.refresh();
    const releasesReady = releaseHistory.load().catch(() => undefined);
    await production.initialize(releasesReady);
    await releaseHistory.loadNextNumber();
    restoreViewedRelease(savedDeckNumber);
    await production.restoreDraft(savedDeckNumber);
    persistReady = true;
  });

  function restoreViewedRelease(deckNumber: number | null) {
    if (!deckNumber || rs.viewingRelease) return;
    const match = releaseHistory.releases.find(
      (release) => release.deckNumber === deckNumber
    );
    if (match) handleSelectRelease(match);
  }

  // The session state restored rs.cards from localStorage, but sequences (heavy
  // SequenceData) are never stored — re-derive them here so the deck renders after
  // an HMR re-eval / refresh / tab reopen. No-op when viewing a release or when a
  // draw already populated sequences this session.
  async function handleDraw() {
    const gen = ++rs.drawGeneration;
    // Fresh draw = a new, not-yet-named deck. Clear any leftover name.
    rs.name = "";
    rs.seed = mintSeed();
    rs.bumpReference();
    if (rs.deckMode === "loop") {
      const ok = await production.generateLiveDeck(gen);
      if (!ok || gen !== rs.drawGeneration) return;
    } else if (rs.deckMode === "gallery") {
      const ok = await production.composeGalleryDeck(gen);
      if (!ok || gen !== rs.drawGeneration) return;
    } else {
      rs.cards = production.composeFullDeck();
      if (await bounceIfDuplicate()) return;
      await production.loadSelectedSequences(gen);
      if (gen !== rs.drawGeneration) return;
    }
    archive.archiveCurrent();
    rs.step = "review";
    rs.persist();
  }

  async function handleRedraw() {
    const gen = ++rs.drawGeneration;
    rs.name = ""; // fresh draw = not-yet-named; title falls back to the deck number
    rs.reroll();
    rs.bumpReference();
    if (rs.deckMode === "loop") {
      const ok = await production.generateLiveDeck(gen);
      if (!ok || gen !== rs.drawGeneration) return;
    } else {
      rs.cards = production.composeFullDeck();
      if (await bounceIfDuplicate()) return;
      await production.loadSelectedSequences(gen);
      if (gen !== rs.drawGeneration) return;
    }
    archive.archiveCurrent();
    rs.persist();
  }

  /** Re-run the gallery filter against the live library and replace the on-screen
   *  deck with the current matches. Works while composing (uses live filters) or
   *  viewing a released gallery deck (uses the release's stamped filters). */
  async function handleRefreshGallery() {
    const wasViewingRelease = rs.viewingRelease != null;
    if (await production.refreshGallery()) {
      if (!wasViewingRelease) archive.archiveCurrent();
    }
  }

  function handleRemoveCard(sequence: SequenceData): void {
    if (production.remove(sequence)) archive.archiveCurrent();
  }

  function openReleaseModal() {
    showNameModal = true;
  }

  async function handleConfirmRelease(name: string, description: string) {
    try {
      await releaseHistory.create(name, description);
      showNameModal = false;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Release failed";
      const isPermission =
        message.includes("permission") || message.includes("PERMISSION_DENIED");
      toast.error(
        isPermission
          ? "Admin access required to release decks."
          : `Release failed: ${message}`
      );
    }
  }

  async function handleRenameDeck(name: string) {
    const error = await releaseHistory.rename(name);
    if (error) {
      const message = error instanceof Error ? error.message : "Rename failed";
      toast.error(`Couldn't save deck name: ${message}`);
    }
  }

  function handleStartNew() {
    rs.reset();
  }

  function handleReuseRecipe(recipe: DeckRecipe) {
    rs.loadRecipe(recipe);
    toast.success("Recipe loaded. Tweak or press Draw for a fresh deck.");
  }

  async function handleSelectRelease(release: DeckRelease) {
    releaseHistory.activate(release);
    const gen = ++rs.drawGeneration;
    await production.loadSelectedSequences(gen);
  }
</script>

<div class="deck-releaser">
  <div class="releaser-main">
    {#if rs.step === "configure"}
      <ConfigureStep
        deckMode={rs.deckMode}
        weights={rs.weights}
        totalCards={rs.totalCards}
        notes={rs.notes}
        sourceSummaries={rs.sourceSummaries}
        selectedSliceTypes={rs.selectedSliceTypes}
        tndFamilies={rs.tndFamilies}
        selectedTnDFamilies={rs.selectedTnDFamilies}
        tndTurnPatterns={rs.tndTurnPatterns}
        selectedTnDTurnPatterns={rs.selectedTnDTurnPatterns}
        tndCardCount={production.tndCardCount}
        selectedTurnPatternCount={rs.selectedTnDTurnPatterns.size}
        isLoading={rs.isLoadingPools}
        onModeChange={production.handleModeChange}
        onWeightChange={production.handleWeightChange}
        onTotalCardsChange={(t) => {
          rs.totalCards = t;
        }}
        onNotesChange={(n) => {
          rs.notes = n;
        }}
        onSliceTypeToggle={production.handleSliceTypeToggle}
        onTnDFamilyToggle={production.handleTnDFamilyToggle}
        onSelectAllFamilies={production.selectAllFamilies}
        onClearFamilies={production.clearFamilies}
        onTnDTurnPatternToggle={production.handleTnDTurnPatternToggle}
        onTnDTurnPatternsSet={production.setTnDTurnPatterns}
        onDraw={handleDraw}
        variationConfig={rs.variationConfig}
        onVariationConfigChange={(c) => {
          rs.variationConfig = c;
        }}
        startOriModes={rs.selectedStartOriModes}
        onToggleStartOriMode={(m) => rs.toggleStartOriMode(m)}
        gridModes={rs.selectedGridModes}
        onToggleGridMode={(m) => rs.toggleGridMode(m)}
        reversalPattern={rs.reversalPattern}
        onReversalChange={(p) => {
          rs.reversalPattern = p;
          rs.persist();
        }}
        isGenerating={rs.isLoadingSequences}
        genProgress={rs.drawProgress}
      />
    {:else if rs.step === "review"}
      <ReviewStep
        cards={rs.cards}
        sequences={rs.sequences}
        theme={rs.theme}
        bluePropType={rs.bluePropType}
        redPropType={rs.redPropType}
        nextDeckNumber={rs.nextDeckNumber}
        refNumber={print.deckRefNumber}
        deckName={rs.name}
        deckSummary={print.metadata.deckSummary}
        isReleasing={rs.isReleasing}
        readOnly={rs.viewingRelease !== null}
        brokenLoopCount={rs.brokenLoopCount}
        showRedraw={rs.deckMode === "loop"}
        showPropSwitcher={deckFollowsLiveProp}
        showRefresh={viewingGallery}
        footers={print.footers}
        {onContextMenu}
        cardSize={print.cardSize}
        copies={print.copies}
        groupByElement={print.groupByElement}
        groupByLetter={print.groupByLetter}
        getAiSummary={print.getAiSummary}
        sortedSequences={print.sortedSequences}
        sortedFooters={print.sortedFooters}
        tndElements={print.tndElements}
        copiesPresets={print.copiesPresets}
        copiesAnnotate={print.copiesAnnotate}
        isRendering={print.isRendering}
        renderProgress={print.renderProgress}
        renderTotal={print.renderTotal}
        rerenderKey={print.rerenderKey}
        sideFilter={print.previewSideFilter}
        onCardSizeChange={print.changeCardSize}
        onCopiesChange={(value) => {
          print.copies = value;
        }}
        onGroupByElementChange={(value) => {
          print.groupByElement = value;
        }}
        onGroupByLetterChange={(value) => {
          print.groupByLetter = value;
        }}
        onRerender={print.requestRerender}
        onPairsReady={(pairs) => {
          print.renderedPairs = pairs;
        }}
        onRenderStateChange={print.setRenderState}
        onSwapCard={production.swap}
        onRemoveCard={handleRemoveCard}
        allowRemove={rs.deckMode === "loop"}
        onRedraw={handleRedraw}
        onRefresh={handleRefreshGallery}
        onRelease={openReleaseModal}
        onRename={rs.viewingRelease !== null ? handleRenameDeck : undefined}
        onBack={() => {
          rs.viewingRelease = null;
          rs.themeOverride = null;
          rs.bluePropOverride = null;
          rs.redPropOverride = null;
          rs.step = "configure";
          rs.persist();
        }}
      />
    {:else if rs.step === "released"}
      <div class="released-step">
        <div class="released-card">
          <div class="released-icon">
            <i class="fas fa-check-circle" aria-hidden="true"></i>
          </div>
          <h2 class="released-title">
            Deck #{String(rs.releasedNumber).padStart(3, "0")} Released
          </h2>
          <p class="released-notes">{rs.name}</p>
          {#if rs.description}
            <p class="released-description">{rs.description}</p>
          {/if}
          <p class="released-detail">
            {rs.cards.length} cards saved to Firebase
          </p>
          <div class="released-actions">
            <button type="button" class="new-deck-btn" onclick={handleStartNew}>
              <i class="fas fa-plus" aria-hidden="true"></i>
              Compose Another Deck
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <div class="releaser-sidebar" class:print-mode={sidebarMode === "print"}>
    <div class="sidebar-switch">
      <SegmentedControl
        options={[
          { value: "browse", label: "Browse" },
          { value: "print", label: "Print" },
        ]}
        value={sidebarMode}
        onchange={(v) => {
          sidebarMode = v;
        }}
        color="accent"
        size="sm"
      />
    </div>

    {#if sidebarMode === "browse"}
      <div class="sidebar-body">
        <GeneratedArchivePanel
          decks={archive.decks}
          isLoading={archive.isLoading}
          activeRefNumber={rs.viewingRelease === null && rs.step === "review"
            ? rs.referenceNumber
            : null}
          onOpen={handleOpenArchivedDeck}
          onDelete={archive.remove}
        />
        <ReleaseHistoryPanel
          title="Timing &amp; Direction Decks"
          releases={releaseHistory.tndReleases}
          isLoading={releaseHistory.isLoading}
          activeDeckNumber={rs.viewingRelease?.deckNumber ?? null}
          onSelectRelease={handleSelectRelease}
          onDeleteRelease={handleDeleteRelease}
          onReuseRecipe={handleReuseRecipe}
        />
        {#if releaseHistory.galleryReleases.length > 0}
          <ReleaseHistoryPanel
            title="Gallery Decks"
            releases={releaseHistory.galleryReleases}
            isLoading={releaseHistory.isLoading}
            activeDeckNumber={rs.viewingRelease?.deckNumber ?? null}
            onSelectRelease={handleSelectRelease}
            onDeleteRelease={handleDeleteRelease}
            onReuseRecipe={handleReuseRecipe}
          />
        {/if}
        {#if releaseHistory.loopReleases.length > 0}
          <ReleaseHistoryPanel
            title="Released Decks"
            releases={releaseHistory.loopReleases}
            isLoading={releaseHistory.isLoading}
            activeDeckNumber={rs.viewingRelease?.deckNumber ?? null}
            onSelectRelease={handleSelectRelease}
            onDeleteRelease={handleDeleteRelease}
            onReuseRecipe={handleReuseRecipe}
          />
        {/if}
      </div>
      {#if rs.step === "review" && rs.viewingRelease === null}
        <div class="sidebar-footer">
          <button
            type="button"
            class="release-btn"
            onclick={openReleaseModal}
            disabled={rs.isReleasing || print.isRendering}
          >
            {#if rs.isReleasing}
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Releasing…
            {:else}
              <i class="fas fa-stamp" aria-hidden="true"></i>
              Release Deck #{String(rs.nextDeckNumber).padStart(3, "0")}
            {/if}
          </button>
        </div>
      {/if}
    {:else}
      <div class="sidebar-body">
        {#if rs.step === "review" && rs.cards.length > 0}
          <PrintPanel
            cardCount={rs.cards.length}
            tndElements={print.tndElements}
            cardSize={print.cardSize}
            copies={print.copies}
            groupByElement={print.groupByElement}
            theme={rs.theme}
            selectedSide={print.selectedSide}
            onSideChange={(side) => {
              print.selectedSide = side;
            }}
            isExporting={print.isExporting}
            isPrinting={print.isPrinting}
            isRendering={print.isRendering}
            exportProgress={print.exportProgress}
            exportTotal={print.exportTotal}
            exportError={print.exportError}
            onPrint={print.print}
            onExportPDF={print.exportPDF}
            onExportZIP={print.exportZIP}
            onExportBoth={print.exportFrontsAndBacks}
          />
        {:else}
          <div class="sidebar-empty">
            <i class="fas fa-print" aria-hidden="true"></i>
            <span>Compose or open a deck to print.</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<DeckReleaseNameModal
  bind:open={showNameModal}
  deckNumber={rs.nextDeckNumber}
  initialName={rs.name}
  initialDescription={rs.description}
  isReleasing={rs.isReleasing}
  onConfirm={handleConfirmRelease}
  onCancel={() => {
    if (!rs.isReleasing) showNameModal = false;
  }}
/>

<style>
  .deck-releaser {
    display: flex;
    height: 100%;
    min-height: 0;
  }

  .releaser-main {
    flex: 1;
    min-width: 0;
    overflow: auto;
  }

  .releaser-sidebar {
    width: clamp(300px, 22vw, 440px);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .sidebar-switch {
    padding: 12px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    flex-shrink: 0;
  }

  .sidebar-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  /* Browse = two stacked sections (Generated · Released), each scrolls its own list. */
  .sidebar-body > :global(.archive-panel),
  .sidebar-body > :global(.release-history) {
    flex: 1 1 0;
    min-height: 0;
  }
  .sidebar-body > :global(.archive-panel) {
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .sidebar-footer {
    padding: 12px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    flex-shrink: 0;
  }

  .sidebar-footer .release-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 44px;
    padding: 10px 16px;
    background: var(--semantic-success, #10b981);
    border: none;
    border-radius: 10px;
    color: var(--theme-text, #fff);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.15s;
  }

  .sidebar-footer .release-btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  .sidebar-footer .release-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sidebar-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 48px 20px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    font-size: 13px;
    text-align: center;
  }

  .sidebar-empty i {
    font-size: 24px;
  }

  .released-step {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    padding: 32px;
  }

  .released-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    max-width: 400px;
    padding: 40px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    text-align: center;
  }

  .released-icon {
    font-size: 48px;
    color: var(--semantic-success, #10b981);
  }

  .released-title {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: var(--theme-text, #fff);
  }

  .released-detail {
    margin: 0;
    font-size: 14px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .released-notes {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--theme-accent, #a78bfa);
  }

  .released-description {
    margin: 0;
    font-size: 14px;
    line-height: 1.4;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .released-actions {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }

  .new-deck-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 10px 24px;
    background: var(--theme-accent, #8b5cf6);
    border: none;
    border-radius: 10px;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  .new-deck-btn:hover {
    filter: brightness(1.1);
  }

  @media (max-width: 900px) {
    .deck-releaser {
      flex-direction: column;
    }

    .releaser-sidebar {
      width: 100%;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
      border-left: none;
      max-height: 320px;
    }
    .releaser-sidebar.print-mode {
      max-height: none;
    }
  }
</style>
