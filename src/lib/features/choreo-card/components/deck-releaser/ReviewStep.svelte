<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { CardFooter, DeckReleaseCard } from "../../domain/models/DeckRelease";
  import type { CardPair } from "../../services/types";
  import PrintPreviewPages from "../print-preview/PrintPreviewPages.svelte";
  import PrintPreviewToolbar from "../print-preview/PrintPreviewToolbar.svelte";
  import CardInspectModal from "../CardInspectModal.svelte";
  import type { CardSizeId } from "../../domain/card-sizes";
  import type { TnDElement } from "../../domain/tnd-element";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

  interface Props {
    cards: DeckReleaseCard[];
    sequences: SequenceData[];
    theme: string;
    bluePropType?: PropType;
    redPropType?: PropType;
    nextDeckNumber: number;
    deckName?: string;
    onSwapCard: (index: number) => void;
    onRedraw: () => void;
    onRelease: () => void;
    onBack: () => void;
    /** Provided when viewing a released deck: commit an inline name edit. */
    onRename?: (name: string) => void;
    isReleasing: boolean;
    readOnly?: boolean;
    footers?: CardFooter[];
    onContextMenu?: (x: number, y: number, rerender: () => void) => void;
    brokenLoopCount?: number;
    /** Reroll only makes sense for randomly-rolled decks (LOOP). TnD is a finite,
     *  deterministic enumeration, so the redraw button is hidden for it. */
    showRedraw?: boolean;
    cardSize: CardSizeId;
    copies: number;
    groupByElement: boolean;
    sortedSequences: SequenceData[];
    sortedFooters: CardFooter[];
    tndElements: (TnDElement | undefined)[];
    copiesPresets: number[];
    copiesAnnotate: (n: number) => { blanks: number; perfect: boolean } | null;
    isRendering: boolean;
    renderProgress: number;
    renderTotal: number;
    rerenderKey: number;
    sideFilter: "fronts" | "backs" | null;
    onCardSizeChange: (s: CardSizeId) => void;
    onCopiesChange: (n: number) => void;
    onGroupByElementChange: (on: boolean) => void;
    onRerender: () => void;
    onPairsReady: (pairs: CardPair[]) => void;
    onRenderStateChange: (s: { isRendering: boolean; progress: number; total: number }) => void;
  }

  let {
    cards,
    sequences,
    theme,
    bluePropType,
    redPropType,
    nextDeckNumber,
    deckName = "",
    onSwapCard,
    onRedraw,
    onRelease,
    onBack,
    onRename,
    isReleasing,
    readOnly = false,
    footers,
    onContextMenu,
    brokenLoopCount = 0,
    showRedraw = true,
    cardSize,
    copies,
    groupByElement,
    sortedSequences,
    sortedFooters,
    tndElements,
    copiesPresets,
    copiesAnnotate,
    isRendering,
    renderProgress,
    renderTotal,
    rerenderKey,
    sideFilter,
    onCardSizeChange,
    onCopiesChange,
    onGroupByElementChange,
    onRerender,
    onPairsReady,
    onRenderStateChange,
  }: Props = $props();

  let nameDraft = $state(deckName);
  $effect(() => { nameDraft = deckName; });

  function commitName() {
    const t = nameDraft.trim();
    if (t && t !== deckName) {
      onRename?.(t);
    } else {
      nameDraft = deckName;
    }
  }

  function handleNameKey(e: KeyboardEvent) {
    if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
    else if (e.key === "Escape") { nameDraft = deckName; (e.currentTarget as HTMLInputElement).blur(); }
  }

  let inspectedSequence = $state<SequenceData | null>(null);
  let inspectedFrontImageUrl = $state<string | null>(null);
  let inspectedRerender = $state<(() => Promise<string | null>) | null>(null);

  const distribution = $derived.by(() => {
    const dist: Record<number, number> = {};
    for (const c of cards) {
      dist[c.stepCount] = (dist[c.stepCount] ?? 0) + 1;
    }
    return Object.entries(dist)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([step, count]) => ({ step: Number(step), count }));
  });

  // One clean line: a single step length collapses to "4-step"; a mix lists
  // each length with its count.
  const stepSummary = $derived(
    distribution.length === 1
      ? `${distribution[0]!.step}-step`
      : distribution.map((d) => `${d.step}-step ×${d.count}`).join("  ·  "),
  );

  function handleCardClick(sequence: SequenceData, frontImageUrl?: string, rerender?: () => Promise<string | null>) {
    inspectedFrontImageUrl = frontImageUrl ?? null;
    inspectedRerender = rerender ?? null;
    inspectedSequence = sequence;
  }

  function handleSwapInspected() {
    if (!inspectedSequence) return;
    const idx = sequences.findIndex(s => s.id === inspectedSequence!.id);
    if (idx >= 0) {
      onSwapCard(idx);
      inspectedSequence = null;
      inspectedFrontImageUrl = null;
    }
  }
</script>

<div class="review-step">
  <div class="review-header">
    <button type="button" class="back-btn" onclick={onBack}>
      <i class="fas fa-arrow-left" aria-hidden="true"></i>
      {readOnly ? "Back to Composer" : "Back"}
    </button>

    <div class="deck-info">
      {#if onRename}
        <input
          class="deck-name-input"
          type="text"
          bind:value={nameDraft}
          onblur={commitName}
          onkeydown={handleNameKey}
          maxlength="60"
          aria-label="Deck name (click to edit)"
          title="Click to rename"
        />
      {:else}
        <h2 class="deck-number" class:placeholder={!deckName}>{deckName || "Untitled Deck"}</h2>
      {/if}
      <div class="deck-meta">
        <span class="meta-cards">{cards.length} cards</span>
        {#if stepSummary}
          <span class="meta-sep" aria-hidden="true">·</span>
          <span class="meta-steps">{stepSummary}</span>
        {/if}
        {#if brokenLoopCount > 0}
          <span class="meta-sep" aria-hidden="true">·</span>
          <span class="meta-broken" title="These cards' turns don't return the prop to its start orientation. Redraw to reroll.">
            <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
            {brokenLoopCount} break loop
          </span>
        {/if}
      </div>
    </div>

    {#if !readOnly}
      <div class="action-buttons">
        {#if showRedraw}
          <button type="button" class="redraw-btn" onclick={onRedraw} disabled={isReleasing}>
            <i class="fas fa-dice" aria-hidden="true"></i>
            Redraw
          </button>
        {/if}
        <button type="button" class="release-btn" onclick={onRelease} disabled={isReleasing || isRendering}>
          {#if isReleasing}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            Releasing...
          {:else}
            <i class="fas fa-stamp" aria-hidden="true"></i>
            Release Deck #{String(nextDeckNumber).padStart(3, "0")}
          {/if}
        </button>
      </div>
    {/if}
  </div>

  <PrintPreviewToolbar
    {cardSize}
    totalCards={cards.length}
    {isRendering}
    {renderProgress}
    {renderTotal}
    onCardSizeChange={onCardSizeChange}
    onRerender={onRerender}
    onPrint={() => {}}
    {copies}
    onCopiesChange={onCopiesChange}
    {copiesPresets}
    {copiesAnnotate}
    {groupByElement}
    onGroupByElementChange={onGroupByElementChange}
  />

  <div class="preview-area">
    <PrintPreviewPages
      sequences={sortedSequences}
      {cardSize}
      {theme}
      {bluePropType}
      {redPropType}
      {rerenderKey}
      {copies}
      {groupByElement}
      {sideFilter}
      footers={sortedFooters}
      {tndElements}
      isLoading={false}
      includeStartPosition={true}
      deckMode={true}
      displayMode="sheets"
      deckId={String(nextDeckNumber).padStart(3, "0")}
      deckName={`LOOP Deck #${nextDeckNumber}`}
      onCardClick={handleCardClick}
      onCardContextMenu={onContextMenu ? (x, y, rerender) => onContextMenu(x, y, rerender) : undefined}
      onPairsReady={onPairsReady}
      onRenderStateChange={onRenderStateChange}
    />
  </div>
</div>

{#if inspectedSequence}
  <CardInspectModal
    sequence={inspectedSequence}
    frontImageUrl={inspectedFrontImageUrl}
    includeStartPosition={true}
    onContextMenu={onContextMenu ? (x, y, _rerender) => {
      onContextMenu(x, y, () => {
        if (inspectedRerender) {
          inspectedRerender().then(newUrl => {
            if (newUrl) inspectedFrontImageUrl = newUrl;
          });
        }
      });
    } : undefined}
    onClose={() => { inspectedSequence = null; inspectedFrontImageUrl = null; inspectedRerender = null; }}
  >
    {#snippet extraActions()}
      {#if !readOnly}
        <button class="copy-btn swap-btn" onclick={handleSwapInspected} aria-label="Swap card">
          <i class="fas fa-random"></i> Swap Card
        </button>
      {/if}
    {/snippet}
  </CardInspectModal>
{/if}

<style>
  .review-step {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .review-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-wrap: wrap;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    min-height: 44px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .deck-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .deck-number {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--theme-text, #fff);
    text-align: center;
  }

  /* Unnamed draft: dim + italic so the placeholder reads as "not yet named"
     rather than an actual deck title. */
  .deck-number.placeholder {
    font-weight: 600;
    font-style: italic;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
  }

  .deck-name-input {
    display: block;
    width: 100%;
    max-width: 460px;
    margin: 0;
    padding: 4px 12px;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.01em;
    text-align: center;
    color: var(--theme-text, #fff);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 10px;
    cursor: text;
    transition: background 0.15s, border-color 0.15s;
  }

  .deck-name-input:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }

  .deck-name-input:focus {
    outline: none;
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--theme-accent, #8b5cf6);
  }

  .deck-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 13px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .meta-cards {
    font-weight: 700;
    color: var(--theme-text, rgba(255, 255, 255, 0.92));
  }

  .meta-sep {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
  }

  .meta-steps {
    font-weight: 600;
  }

  .meta-broken {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-weight: 600;
    color: #fbbf24;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .redraw-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 8px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .redraw-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }

  .redraw-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .release-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 8px 20px;
    background: #10b981;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
  }

  .release-btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .release-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .preview-area {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 16px;
  }

  .swap-btn {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.3);
    color: var(--theme-accent, #a78bfa);
  }

  .swap-btn:hover {
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(139, 92, 246, 0.5);
    color: #fff;
  }

  @media (max-width: 768px) {
    .review-header {
      flex-direction: column;
      align-items: stretch;
    }

    .action-buttons {
      justify-content: stretch;
    }

    .action-buttons button {
      flex: 1;
    }
  }
</style>
