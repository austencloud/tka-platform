<script lang="ts">
  import { onMount } from "svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import type { Deck } from "../../domain/models/Deck";
  import type { DeckReleaseCard, StepCountWeight } from "../../domain/models/DeckRelease";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { loadDecks, loadSequencesByIds } from "../../services/deck-loader";
  import {
    buildSequencePool,
    getAvailableWeights,
    getDeckSourceSummaries,
    getVtgFamilyOptions,
    buildVtgCards,
    composeDeck,
    swapCard,
    prunePool,
    type DeckPoolFilter,
    type DeckSourceSummary,
    type VtgFamilyOption,
  } from "../../services/deck-composer";
  import { getNextDeckNumber, releaseDeck, getAllReleasedSequenceIds } from "../../services/deck-release-store";
  import ConfigureStep from "./ConfigureStep.svelte";
  import ReviewStep from "./ReviewStep.svelte";

  type Step = "configure" | "review" | "released";

  let step = $state<Step>("configure");
  let decks = $state<Deck[]>([]);
  let pool = $state<Map<number, { sequenceId: string; sourceDeckId: string; stepCount: number; word: string }[]>>(new Map());
  let weights = $state<StepCountWeight[]>([]);
  let totalCards = $state(52);
  let notes = $state("Fire Drums 2026");
  let theme = $state(
    typeof window !== "undefined"
      ? localStorage.getItem("cardPreview.theme") ?? "cosmic"
      : "cosmic"
  );
  let isLoadingPools = $state(true);
  let cards = $state<DeckReleaseCard[]>([]);
  let sequences = $state<SequenceData[]>([]);
  let isLoadingSequences = $state(false);
  let nextDeckNumber = $state(1);
  let isReleasing = $state(false);
  let releasedNumber = $state<number | null>(null);
  let sourceSummaries = $state<DeckSourceSummary[]>([]);
  let selectedSliceTypes = $state<Set<'halved' | 'quartered'>>(new Set(['quartered']));
  let releasedIds = $state<Set<string>>(new Set());
  let drawGeneration = 0;
  let vtgFamilies = $state<VtgFamilyOption[]>([]);
  let deckMode = $state<'loop' | 'vtg'>('loop');
  let selectedVtgFamilies = $state<Set<string>>(new Set());

  const footers = $derived(cards.map(c => c.footer));

  function rebuildPool() {
    const filter: DeckPoolFilter = { sliceTypes: selectedSliceTypes };
    pool = buildSequencePool(decks, filter);
    if (releasedIds.size > 0) {
      prunePool(pool, releasedIds, new Set([4]));
    }
    weights = getAvailableWeights(pool);
  }

  onMount(async () => {
    try {
      decks = await loadDecks();
      sourceSummaries = getDeckSourceSummaries(decks);
      vtgFamilies = getVtgFamilyOptions(decks);
      releasedIds = await getAllReleasedSequenceIds();
      rebuildPool();
    } catch (err) {
      console.warn("Failed to load deck pools:", err);
    } finally {
      isLoadingPools = false;
    }

    try {
      nextDeckNumber = await getNextDeckNumber();
    } catch {
      nextDeckNumber = 1;
    }
  });

  function handleSliceTypeToggle(sliceType: 'halved' | 'quartered') {
    const next = new Set(selectedSliceTypes);
    if (next.has(sliceType)) {
      if (next.size > 1) next.delete(sliceType);
    } else {
      next.add(sliceType);
    }
    selectedSliceTypes = next;
    rebuildPool();
  }

  function handleModeChange(mode: 'loop' | 'vtg') {
    deckMode = mode;
    if (mode === 'vtg' && selectedVtgFamilies.size === 0) {
      selectedVtgFamilies = new Set(vtgFamilies.map(f => f.familyId));
    }
  }

  function handleVtgFamilyToggle(familyId: string) {
    const next = new Set(selectedVtgFamilies);
    if (next.has(familyId)) {
      next.delete(familyId);
    } else {
      next.add(familyId);
    }
    selectedVtgFamilies = next;
  }

  const vtgCardCount = $derived(
    buildVtgCards(vtgFamilies, selectedVtgFamilies).length
  );


  function handleWeightChange(stepCount: number, weight: number) {
    weights = weights.map((w) =>
      w.stepCount === stepCount ? { ...w, weight } : w
    );
  }

  function composeFullDeck(): DeckReleaseCard[] {
    if (deckMode === 'vtg') {
      const vtgCards = buildVtgCards(vtgFamilies, selectedVtgFamilies);
      return vtgCards.map((c, i) => ({ ...c, position: i + 1 }));
    }
    return composeDeck(pool, weights, totalCards, { center: notes });
  }

  async function handleDraw() {
    const gen = ++drawGeneration;
    cards = composeFullDeck();
    await loadSelectedSequences(gen);
    if (gen !== drawGeneration) return;
    step = "review";
  }

  async function handleRedraw() {
    const gen = ++drawGeneration;
    cards = composeFullDeck();
    await loadSelectedSequences(gen);
  }

  async function loadSelectedSequences(generation: number) {
    isLoadingSequences = true;
    try {
      const byDeck = new Map<string, string[]>();
      for (const card of cards) {
        const ids = byDeck.get(card.sourceDeckId) ?? [];
        ids.push(card.sequenceId);
        byDeck.set(card.sourceDeckId, ids);
      }

      const allSeqs: SequenceData[] = [];
      for (const [deckId, seqIds] of byDeck) {
        const loaded = await loadSequencesByIds(deckId, seqIds);
        allSeqs.push(...loaded);
      }

      if (generation !== drawGeneration) return;
      const seqMap = new Map(allSeqs.map((s) => [s.id, s]));
      sequences = cards
        .map((c) => seqMap.get(c.sequenceId))
        .filter((s): s is SequenceData => s != null);
    } catch (err) {
      console.warn("Failed to load sequences:", err);
    } finally {
      isLoadingSequences = false;
    }
  }

  async function handleSwapCard(index: number) {
    const oldCard = cards[index];
    if (oldCard) {
      const bucket = pool.get(oldCard.stepCount);
      if (bucket) {
        pool.set(oldCard.stepCount, bucket.filter(e => e.sequenceId !== oldCard.sequenceId));
      }
    }

    cards = swapCard(cards, index, pool);
    const newCard = cards[index];
    if (!newCard) return;

    try {
      const loaded = await loadSequencesByIds(newCard.sourceDeckId, [newCard.sequenceId]);
      if (loaded.length > 0) {
        sequences = sequences.map((s, i) => i === index ? loaded[0]! : s);
      }
    } catch (err) {
      console.warn("Failed to load swapped sequence:", err);
    }
  }

  async function handleRelease() {
    isReleasing = true;
    try {
      const release = await releaseDeck(cards, theme, notes);
      releasedNumber = release.deckNumber;
      nextDeckNumber = release.deckNumber + 1;
      step = "released";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Release failed";
      const isPermission = msg.includes("permission") || msg.includes("PERMISSION_DENIED");
      toast.error(isPermission ? "Admin access required to release decks." : `Release failed: ${msg}`);
    } finally {
      isReleasing = false;
    }
  }

  function handleStartNew() {
    cards = [];
    sequences = [];
    releasedNumber = null;
    step = "configure";
  }
</script>

<div class="deck-releaser">
  {#if step === "configure"}
    <ConfigureStep
      {deckMode}
      {weights}
      {totalCards}
      {notes}
      {sourceSummaries}
      {selectedSliceTypes}
      {vtgFamilies}
      {selectedVtgFamilies}
      {vtgCardCount}
      isLoading={isLoadingPools}
      onModeChange={handleModeChange}
      onWeightChange={handleWeightChange}
      onTotalCardsChange={(t) => { totalCards = t; }}
      onNotesChange={(n) => { notes = n; }}
      onSliceTypeToggle={handleSliceTypeToggle}
      onVtgFamilyToggle={handleVtgFamilyToggle}
      onDraw={handleDraw}
    />
  {:else if step === "review"}
    <ReviewStep
      {cards}
      {sequences}
      {theme}
      {nextDeckNumber}
      {isReleasing}
      {footers}
      onSwapCard={handleSwapCard}
      onRedraw={handleRedraw}
      onRelease={handleRelease}
      onBack={() => { step = "configure"; }}
    />
  {:else if step === "released"}
    <div class="released-step">
      <div class="released-card">
        <div class="released-icon">
          <i class="fas fa-check-circle" aria-hidden="true"></i>
        </div>
        <h2 class="released-title">
          Deck #{String(releasedNumber).padStart(3, "0")} Released
        </h2>
        <p class="released-detail">{cards.length} cards saved to Firebase</p>
        <p class="released-notes">{notes}</p>
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

<style>
  .deck-releaser {
    height: 100%;
    overflow: auto;
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
</style>
