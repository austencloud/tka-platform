<script lang="ts">
  import { onMount } from "svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import type { Catalog } from "../../domain/models/Catalog";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { loadCatalogs, loadSequencesByIds } from "../../services/catalog-loader";
  import {
    buildSequencePool,
    getAvailableWeights,
    getCatalogSourceSummaries,
    getVtgFamilyOptions,
    getVtgTurnPatternOptions,
    buildVtgCards,
    composeDeck,
    swapCard,
    prunePool,
    type CatalogPoolFilter,
  } from "../../services/deck-composer";
  import type { DeckRelease } from "../../domain/models/DeckRelease";
  import { getNextDeckNumber, releaseDeck, getAllReleases } from "../../services/deck-release-store";
  import ConfigureStep from "./ConfigureStep.svelte";
  import ReviewStep from "./ReviewStep.svelte";
  import ReleaseHistoryPanel from "./ReleaseHistoryPanel.svelte";
  import { releaserState as rs } from "./deck-releaser-state.svelte";

  interface Props {
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
  }

  let { onContextMenu }: Props = $props();

  let catalogs = $state<Catalog[]>([]);
  let pool = $state<Map<number, { sequenceId: string; sourceCatalogId: string; stepCount: number; word: string }[]>>(new Map());
  let releasedIds = $state<Set<string>>(new Set());
  let releases = $state<DeckRelease[]>([]);
  let isLoadingReleases = $state(true);

  const ICON_UPGRADES: Record<string, string> = {
    "/images/elements/sun-v2.png": "/images/elements/sun-v4.png",
  };
  const footers = $derived(rs.cards.map(c => {
    const f = c.footer;
    if (f.iconPath && ICON_UPGRADES[f.iconPath]) {
      return { ...f, iconPath: ICON_UPGRADES[f.iconPath] };
    }
    return f;
  }));

  function rebuildPool() {
    const filter: CatalogPoolFilter = { sliceTypes: rs.selectedSliceTypes };
    pool = buildSequencePool(catalogs, filter);
    if (releasedIds.size > 0) {
      prunePool(pool, releasedIds, new Set([4]));
    }
    rs.weights = getAvailableWeights(pool);
  }

  function extractReleasedIds(rels: DeckRelease[]): Set<string> {
    const ids = new Set<string>();
    for (const r of rels) {
      for (const card of r.sequences ?? []) ids.add(card.sequenceId);
    }
    return ids;
  }

  onMount(async () => {
    const savedDeckNumber = rs.savedViewingDeckNumber;

    const releasesPromise = getAllReleases().then(r => {
      releases = r;
      releasedIds = extractReleasedIds(r);
      isLoadingReleases = false;
    }).catch(() => { isLoadingReleases = false; });

    if (rs.poolsLoaded) {
      rs.isLoadingPools = false;
      await releasesPromise;
      restoreViewedRelease(savedDeckNumber);
      return;
    }

    try {
      catalogs = await loadCatalogs();
      rs.sourceSummaries = getCatalogSourceSummaries(catalogs);
      rs.vtgFamilies = getVtgFamilyOptions(catalogs);
      rs.vtgTurnPatterns = getVtgTurnPatternOptions(catalogs);
      await releasesPromise;
      rebuildPool();
    } catch (err) {
      console.warn("Failed to load deck pools:", err);
    } finally {
      rs.isLoadingPools = false;
      rs.poolsLoaded = true;
    }

    try {
      rs.nextDeckNumber = await getNextDeckNumber();
    } catch {
      rs.nextDeckNumber = 1;
    }

    restoreViewedRelease(savedDeckNumber);
  });

  function restoreViewedRelease(deckNumber: number | null) {
    if (!deckNumber || rs.viewingRelease) return;
    const match = releases.find(r => r.deckNumber === deckNumber);
    if (match) handleSelectRelease(match);
  }

  function handleSliceTypeToggle(sliceType: 'halved' | 'quartered') {
    const next = new Set(rs.selectedSliceTypes);
    if (next.has(sliceType)) {
      if (next.size > 1) next.delete(sliceType);
    } else {
      next.add(sliceType);
    }
    rs.selectedSliceTypes = next;
    rebuildPool();
  }

  function handleModeChange(mode: 'loop' | 'vtg') {
    rs.deckMode = mode;
    if (mode === 'vtg' && rs.selectedVtgFamilies.size === 0) {
      rs.selectedVtgFamilies = new Set(rs.vtgFamilies.map(f => f.familyId));
    }
    if (mode === 'vtg' && rs.selectedVtgTurnPatterns.size === 0) {
      rs.selectedVtgTurnPatterns = new Set(rs.vtgTurnPatterns.map(tp => tp.turnPattern));
    }
  }

  function handleVtgFamilyToggle(familyId: string) {
    const next = new Set(rs.selectedVtgFamilies);
    if (next.has(familyId)) {
      next.delete(familyId);
    } else {
      next.add(familyId);
    }
    rs.selectedVtgFamilies = next;
  }

  function handleVtgTurnPatternToggle(tp: string) {
    const next = new Set(rs.selectedVtgTurnPatterns);
    if (next.has(tp)) {
      next.delete(tp);
    } else {
      next.add(tp);
    }
    rs.selectedVtgTurnPatterns = next;
  }

  const vtgCardCount = $derived(
    buildVtgCards(rs.vtgFamilies, rs.selectedVtgFamilies, rs.selectedVtgTurnPatterns).length
  );

  function handleWeightChange(stepCount: number, weight: number) {
    rs.weights = rs.weights.map((w) =>
      w.stepCount === stepCount ? { ...w, weight } : w
    );
  }

  function composeFullDeck() {
    if (rs.deckMode === 'vtg') {
      const vtgCards = buildVtgCards(rs.vtgFamilies, rs.selectedVtgFamilies, rs.selectedVtgTurnPatterns);
      return vtgCards.map((c, i) => ({ ...c, position: i + 1 }));
    }
    return composeDeck(pool, rs.weights, rs.totalCards, { center: rs.notes });
  }

  async function handleDraw() {
    const gen = ++rs.drawGeneration;
    rs.cards = composeFullDeck();
    await loadSelectedSequences(gen);
    if (gen !== rs.drawGeneration) return;
    rs.step = "review";
    rs.persist();
  }

  async function handleRedraw() {
    const gen = ++rs.drawGeneration;
    rs.cards = composeFullDeck();
    await loadSelectedSequences(gen);
  }

  async function loadSelectedSequences(generation: number) {
    rs.isLoadingSequences = true;
    try {
      const byCatalog = new Map<string, string[]>();
      for (const card of rs.cards) {
        const ids = byCatalog.get(card.sourceCatalogId) ?? [];
        ids.push(card.sequenceId);
        byCatalog.set(card.sourceCatalogId, ids);
      }

      const allSeqs: SequenceData[] = [];
      for (const [catalogId, seqIds] of byCatalog) {
        const loaded = await loadSequencesByIds(catalogId, seqIds);
        allSeqs.push(...loaded);
      }

      if (generation !== rs.drawGeneration) return;
      const seqMap = new Map(allSeqs.map((s) => [s.id, s]));
      rs.sequences = rs.cards
        .map((c) => seqMap.get(c.sequenceId))
        .filter((s): s is SequenceData => s != null);
    } catch (err) {
      console.warn("Failed to load sequences:", err);
    } finally {
      rs.isLoadingSequences = false;
    }
  }

  async function handleSwapCard(index: number) {
    const oldCard = rs.cards[index];
    if (oldCard) {
      const bucket = pool.get(oldCard.stepCount);
      if (bucket) {
        pool.set(oldCard.stepCount, bucket.filter(e => e.sequenceId !== oldCard.sequenceId));
      }
    }

    rs.cards = swapCard(rs.cards, index, pool);
    const newCard = rs.cards[index];
    if (!newCard) return;

    try {
      const loaded = await loadSequencesByIds(newCard.sourceCatalogId, [newCard.sequenceId]);
      if (loaded.length > 0) {
        rs.sequences = rs.sequences.map((s, i) => i === index ? loaded[0]! : s);
      }
    } catch (err) {
      console.warn("Failed to load swapped sequence:", err);
    }
  }

  async function handleRelease() {
    rs.isReleasing = true;
    try {
      const release = await releaseDeck(rs.cards, rs.theme, rs.notes);
      rs.releasedNumber = release.deckNumber;
      rs.nextDeckNumber = release.deckNumber + 1;
      releases = [release, ...releases];
      for (const card of release.sequences ?? []) releasedIds.add(card.sequenceId);
      rs.step = "released";
      rs.persist();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Release failed";
      const isPermission = msg.includes("permission") || msg.includes("PERMISSION_DENIED");
      toast.error(isPermission ? "Admin access required to release decks." : `Release failed: ${msg}`);
    } finally {
      rs.isReleasing = false;
    }
  }

  function handleStartNew() {
    rs.reset();
  }

  async function handleSelectRelease(release: DeckRelease) {
    rs.viewingRelease = release;
    rs.cards = release.sequences;
    rs.notes = release.notes;
    rs.nextDeckNumber = release.deckNumber;
    rs.step = "review";
    rs.persist();

    const gen = ++rs.drawGeneration;
    await loadSelectedSequences(gen);
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
        vtgFamilies={rs.vtgFamilies}
        selectedVtgFamilies={rs.selectedVtgFamilies}
        vtgTurnPatterns={rs.vtgTurnPatterns}
        selectedVtgTurnPatterns={rs.selectedVtgTurnPatterns}
        {vtgCardCount}
        isLoading={rs.isLoadingPools}
        onModeChange={handleModeChange}
        onWeightChange={handleWeightChange}
        onTotalCardsChange={(t) => { rs.totalCards = t; }}
        onNotesChange={(n) => { rs.notes = n; }}
        onSliceTypeToggle={handleSliceTypeToggle}
        onVtgFamilyToggle={handleVtgFamilyToggle}
        onVtgTurnPatternToggle={handleVtgTurnPatternToggle}
        onDraw={handleDraw}
      />
    {:else if rs.step === "review"}
      <ReviewStep
        cards={rs.cards}
        sequences={rs.sequences}
        theme={rs.theme}
        nextDeckNumber={rs.nextDeckNumber}
        isReleasing={rs.isReleasing}
        readOnly={rs.viewingRelease !== null}
        {footers}
        {onContextMenu}
        onSwapCard={handleSwapCard}
        onRedraw={handleRedraw}
        onRelease={handleRelease}
        onBack={() => { rs.viewingRelease = null; rs.step = "configure"; rs.persist(); }}
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
          <p class="released-detail">{rs.cards.length} cards saved to Firebase</p>
          <p class="released-notes">{rs.notes}</p>
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

  <div class="releaser-history">
    <ReleaseHistoryPanel
      {releases}
      isLoading={isLoadingReleases}
      activeDeckNumber={rs.viewingRelease?.deckNumber ?? null}
      onSelectRelease={handleSelectRelease}
    />
  </div>
</div>

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

  .releaser-history {
    width: 320px;
    flex-shrink: 0;
    overflow: hidden;
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
    color: #10b981;
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
    font-size: 16px;
    font-weight: 600;
    color: var(--theme-accent, #a78bfa);
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

    .releaser-history {
      width: 100%;
      max-height: 280px;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    }
  }
</style>
