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
    getTnDFamilyOptions,
    getTnDTurnPatternOptions,
    buildTnDCards,
    buildTnDSeedClasses,
    composeDeck,
    swapCard,
    prunePool,
    TND_BASE_CATALOG_ID,
    type CatalogPoolFilter,
  } from "../../services/deck-composer";
  import type { DeckRelease, DeckReleaseCard } from "../../domain/models/DeckRelease";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { getNextDeckNumber, releaseDeck, getAllReleases, updateDeckMeta } from "../../services/deck-release-store";
  import ConfigureStep from "./ConfigureStep.svelte";
  import ReviewStep from "./ReviewStep.svelte";
  import ReleaseHistoryPanel from "./ReleaseHistoryPanel.svelte";
  import DeckReleaseNameModal from "./DeckReleaseNameModal.svelte";
  import { releaserState as rs } from "./deck-releaser-state.svelte";
  import { resolveDeckSequences, applyVariationDescriptor, rollVariation } from "../../services/deck-variation";
  import { loadDiamondEdges } from "../../services/pictograph-letter-lookup";

  interface Props {
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
  }

  let { onContextMenu }: Props = $props();

  let catalogs = $state<Catalog[]>([]);
  let pool = $state<Map<number, { sequenceId: string; sourceCatalogId: string; stepCount: number; word: string }[]>>(new Map());
  let releasedIds = $state<Set<string>>(new Set());
  let releases = $state<DeckRelease[]>([]);
  let isLoadingReleases = $state(true);
  let showNameModal = $state(false);

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
      // Classify each base TnD seed for both grids once (selection-independent).
      // Element is NOT rotation-invariant, so the family is derived from the
      // box-transformed geometry — never carried over from the diamond catalog.
      const baseCatalog = catalogs.find((c) => c.id === TND_BASE_CATALOG_ID);
      const baseSeedIds = baseCatalog
        ? baseCatalog.families.flatMap((f) => f.sequenceIds)
        : [];
      if (baseSeedIds.length > 0) {
        const baseSeqs = await loadSequencesByIds(TND_BASE_CATALOG_ID, baseSeedIds);
        rs.tndSeedClasses = buildTnDSeedClasses(baseSeqs);
      }
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

  function handleModeChange(mode: 'loop' | 'tnd') {
    rs.deckMode = mode;
    if (mode === 'tnd' && rs.selectedTnDFamilies.size === 0) {
      rs.selectedTnDFamilies = new Set(rs.tndFamilies.map(f => f.familyId));
    }
    if (mode === 'tnd' && rs.selectedTnDTurnPatterns.size === 0) {
      rs.selectedTnDTurnPatterns = new Set(rs.tndTurnPatterns.map(tp => tp.turnPattern));
    }
  }

  function handleTnDFamilyToggle(familyId: string) {
    const next = new Set(rs.selectedTnDFamilies);
    if (next.has(familyId)) {
      next.delete(familyId);
    } else {
      next.add(familyId);
    }
    rs.selectedTnDFamilies = next;
  }

  function handleSelectAllFamilies() {
    rs.selectedTnDFamilies = new Set(rs.tndFamilies.map((f) => f.familyId));
  }

  function handleClearFamilies() {
    rs.selectedTnDFamilies = new Set();
  }

  function handleTnDTurnPatternToggle(tp: string) {
    const next = new Set(rs.selectedTnDTurnPatterns);
    if (next.has(tp)) {
      next.delete(tp);
    } else {
      next.add(tp);
    }
    rs.selectedTnDTurnPatterns = next;
  }

  function handleSetTnDTurnPatterns(patterns: Set<string>) {
    rs.selectedTnDTurnPatterns = patterns;
  }

  // Family options are grid-aware: each base seed lands in its computed element
  // per selected grid. Recompute when the seed classes or grid selection change.
  $effect(() => {
    rs.tndFamilies = getTnDFamilyOptions(rs.tndSeedClasses, [...rs.selectedGridModes]);
  });

  const tndCardCount = $derived(
    buildTnDCards(
      rs.tndFamilies,
      rs.selectedTnDFamilies,
      rs.selectedTnDTurnPatterns,
      [...rs.selectedStartOriModes],
    ).length
  );

  const selectedFamilyBaseSeqs = $derived(
    rs.tndFamilies
      .filter((f) => rs.selectedTnDFamilies.has(f.familyId))
      .reduce((sum, f) => sum + f.sequenceCount, 0),
  );
  $effect(() => {
    rs.tndTurnPatterns = getTnDTurnPatternOptions(selectedFamilyBaseSeqs);
  });

  function handleWeightChange(stepCount: number, weight: number) {
    rs.weights = rs.weights.map((w) =>
      w.stepCount === stepCount ? { ...w, weight } : w
    );
  }

  function composeFullDeck() {
    const registers = [...rs.selectedStartOriModes];
    const grids = [...rs.selectedGridModes];
    if (rs.deckMode === 'tnd') {
      const tndCards = buildTnDCards(
        rs.tndFamilies,
        rs.selectedTnDFamilies,
        rs.selectedTnDTurnPatterns,
        registers,
      );
      // Deck-wide reversal (build-one-apply-all): stamp the strip's pattern onto
      // every card's variation. Skip when the pattern reverses nothing (all "-"),
      // so the no-reversal path stays free of needless re-derivation.
      const rev = rs.reversalPattern;
      const hasReversal = rev != null && /[PRB]/.test(rev.sequence);
      return tndCards.map((c, i) => {
        const card = { ...c, position: i + 1 };
        if (!hasReversal) return card;
        return {
          ...card,
          variation: {
            ...(card.variation ?? {}),
            reversalSequence: rev!.sequence,
            reversalPatternId: rev!.id,
          },
        };
      });
    }
    const cards = composeDeck(pool, rs.weights, rs.totalCards, { center: rs.notes });
    // Full enumeration: each composed card is emitted once per (register × grid
    // mode), sharing the same rolled reversal/turn so register/grid are pure axes.
    const out: DeckReleaseCard[] = [];
    let position = 1;
    for (const c of cards) {
      const rolled = rollVariation(c.stepCount, rs.variationConfig, Math.random);
      for (const mode of registers) {
        for (const grid of grids) {
          const variation = {
            ...(rolled ?? {}),
            ...(mode !== "radial" ? { startOriMode: mode } : {}),
            ...(grid !== "diamond" ? { gridMode: grid } : {}),
          };
          out.push(
            Object.keys(variation).length > 0
              ? { ...c, position: position++, variation }
              : { ...c, position: position++ },
          );
        }
      }
    }
    return out;
  }

  async function handleDraw() {
    const gen = ++rs.drawGeneration;
    // Fresh draw = a new, not-yet-named deck. Clear any name left over from a
    // previously composed/released deck so the header shows the placeholder, not
    // the last deck's title.
    rs.name = "";
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
      // Load each base sequence once (TnD packs many cards over few base ids).
      const byCatalog = new Map<string, string[]>();
      const seen = new Set<string>();
      for (const card of rs.cards) {
        const key = `${card.sourceCatalogId}::${card.sequenceId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const ids = byCatalog.get(card.sourceCatalogId) ?? [];
        ids.push(card.sequenceId);
        byCatalog.set(card.sourceCatalogId, ids);
      }

      const baseByKey = new Map<string, SequenceData>();
      for (const [catalogId, seqIds] of byCatalog) {
        const loaded = await loadSequencesByIds(catalogId, seqIds);
        for (const s of loaded) baseByKey.set(`${catalogId}::${s.id}`, s);
      }
      if (generation !== rs.drawGeneration) return;

      const needsVariation = rs.cards.some((c) => c.variation);
      const edges = needsVariation ? await loadDiamondEdges() : [];
      if (generation !== rs.drawGeneration) return;

      const resolved = resolveDeckSequences(rs.cards, baseByKey, edges);
      rs.sequences = resolved.map((r) => r.sequence);
      rs.brokenLoopCount = resolved.filter((r) => !r.turnLoopClosed).length;
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
        const base = loaded[0]!;
        let resolvedSeq = base;
        if (newCard.variation) {
          const edges = await loadDiamondEdges();
          resolvedSeq = applyVariationDescriptor(base, newCard.variation, edges).sequence;
        }
        rs.sequences = rs.sequences.map((s, i) => (i === index ? resolvedSeq : s));
      }
    } catch (err) {
      console.warn("Failed to load swapped sequence:", err);
    }
  }

  function openReleaseModal() {
    showNameModal = true;
  }

  async function handleConfirmRelease(name: string, description: string) {
    rs.isReleasing = true;
    try {
      const release = await releaseDeck(rs.cards, rs.theme, rs.notes, {
        name,
        description,
        bluePropType: rs.bluePropType,
        redPropType: rs.redPropType,
      });
      rs.name = name;
      rs.description = description;
      rs.releasedNumber = release.deckNumber;
      rs.nextDeckNumber = release.deckNumber + 1;
      releases = [release, ...releases];
      for (const card of release.sequences ?? []) releasedIds.add(card.sequenceId);
      showNameModal = false;
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

  async function handleRenameDeck(name: string) {
    const trimmed = name.trim();
    if (!trimmed || !rs.viewingRelease) return;
    const deckNumber = rs.viewingRelease.deckNumber;
    rs.name = trimmed;
    releases = releases.map(r => r.deckNumber === deckNumber ? { ...r, name: trimmed } : r);
    if (rs.viewingRelease) rs.viewingRelease = { ...rs.viewingRelease, name: trimmed };
    rs.persist();
    try {
      await updateDeckMeta(deckNumber, { name: trimmed });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Rename failed";
      toast.error(`Couldn't save deck name: ${msg}`);
    }
  }

  function handleStartNew() {
    rs.reset();
  }

  async function handleSelectRelease(release: DeckRelease) {
    rs.viewingRelease = release;
    rs.cards = release.sequences;
    rs.notes = release.notes;
    rs.name = release.name ?? release.notes ?? `Deck #${String(release.deckNumber).padStart(3, "0")}`;
    rs.description = release.description ?? "";
    rs.nextDeckNumber = release.deckNumber;
    // Pin render to the deck's release-time visuals so the content-hash cache
    // key matches what was stored (otherwise live setting changes force a
    // full re-render every view). Older decks have no prop snapshot → staff.
    rs.themeOverride = release.theme ?? null;
    rs.bluePropOverride = (release.bluePropType as PropType | undefined) ?? null;
    rs.redPropOverride = (release.redPropType as PropType | undefined) ?? null;
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
        tndFamilies={rs.tndFamilies}
        selectedTnDFamilies={rs.selectedTnDFamilies}
        tndTurnPatterns={rs.tndTurnPatterns}
        selectedTnDTurnPatterns={rs.selectedTnDTurnPatterns}
        {tndCardCount}
        selectedTurnPatternCount={rs.selectedTnDTurnPatterns.size}
        isLoading={rs.isLoadingPools}
        onModeChange={handleModeChange}
        onWeightChange={handleWeightChange}
        onTotalCardsChange={(t) => { rs.totalCards = t; }}
        onNotesChange={(n) => { rs.notes = n; }}
        onSliceTypeToggle={handleSliceTypeToggle}
        onTnDFamilyToggle={handleTnDFamilyToggle}
        onSelectAllFamilies={handleSelectAllFamilies}
        onClearFamilies={handleClearFamilies}
        onTnDTurnPatternToggle={handleTnDTurnPatternToggle}
        onTnDTurnPatternsSet={handleSetTnDTurnPatterns}
        onDraw={handleDraw}
        variationConfig={rs.variationConfig}
        onVariationConfigChange={(c) => { rs.variationConfig = c; }}
        startOriModes={rs.selectedStartOriModes}
        onToggleStartOriMode={(m) => rs.toggleStartOriMode(m)}
        gridModes={rs.selectedGridModes}
        onToggleGridMode={(m) => rs.toggleGridMode(m)}
        reversalPattern={rs.reversalPattern}
        onReversalChange={(p) => { rs.reversalPattern = p; rs.persist(); }}
      />
    {:else if rs.step === "review"}
      <ReviewStep
        cards={rs.cards}
        sequences={rs.sequences}
        theme={rs.theme}
        bluePropType={rs.bluePropType}
        redPropType={rs.redPropType}
        nextDeckNumber={rs.nextDeckNumber}
        deckName={rs.name}
        isReleasing={rs.isReleasing}
        readOnly={rs.viewingRelease !== null}
        brokenLoopCount={rs.brokenLoopCount}
        showRedraw={rs.deckMode === "loop"}
        {footers}
        {onContextMenu}
        onSwapCard={handleSwapCard}
        onRedraw={handleRedraw}
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
          <p class="released-detail">{rs.cards.length} cards saved to Firebase</p>
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

<DeckReleaseNameModal
  bind:open={showNameModal}
  deckNumber={rs.nextDeckNumber}
  initialName={rs.name}
  initialDescription={rs.description}
  isReleasing={rs.isReleasing}
  onConfirm={handleConfirmRelease}
  onCancel={() => { if (!rs.isReleasing) showNameModal = false; }}
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

    .releaser-history {
      width: 100%;
      max-height: 280px;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    }
  }
</style>
