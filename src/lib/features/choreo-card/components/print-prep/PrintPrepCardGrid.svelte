<!--
  PrintPrepCardGrid.svelte - Card preview grid with family sections

  Displays rendered card pairs organized by deck family, with info cards,
  progress bar, bleed overlay, download buttons, and context menu support.
-->
<script lang="ts">
  import type { DeckFamily } from "../../domain/models/Deck";
  import RenderingOverlay from "$lib/shared/components/loading/RenderingOverlay.svelte";

  interface RenderedPair {
    frontSrc: string;
    backSrc: string;
    front: HTMLCanvasElement;
    back: HTMLCanvasElement;
    label: string;
    familyId: string;
  }

  interface InfoCardPair {
    frontSrc: string;
    backSrc: string;
    front: HTMLCanvasElement;
    back: HTMLCanvasElement;
  }

  interface FamilyGroup {
    family: DeckFamily;
    pairs: RenderedPair[];
  }

  interface Props {
    deckName: string;
    totalCards: number;
    isRendering: boolean;
    renderProgress: number;
    renderTotal: number;
    includeInfoCards: boolean;
    showBleedOverlay: boolean;
    infoCardPair: InfoCardPair | null;
    pairsByFamily: FamilyGroup[];
    renderedPairs: RenderedPair[];
    rerenderingCards: Set<number>;
    deckSequenceCount: number;
    onOpenDetail: (index: number) => void;
    onOpenContextMenu: (e: MouseEvent, index: number) => void;
    onDownloadCard: (canvas: HTMLCanvasElement, filename: string) => void;
    sanitizeName: (name: string) => string;
  }

  let {
    deckName,
    totalCards,
    isRendering,
    renderProgress,
    renderTotal,
    includeInfoCards,
    showBleedOverlay,
    infoCardPair,
    pairsByFamily,
    renderedPairs,
    rerenderingCards,
    deckSequenceCount,
    onOpenDetail,
    onOpenContextMenu,
    onDownloadCard,
    sanitizeName,
  }: Props = $props();
</script>

<div class="prep-content">
  <!-- Header -->
  <div class="prep-header">
    <div class="header-info">
      <h2 class="deck-name">{deckName}</h2>
      <span class="card-count">
        {#if isRendering}
          Rendering {renderProgress}/{renderTotal}...
        {:else}
          {totalCards} card{totalCards !== 1 ? "s" : ""} ready
        {/if}
      </span>
    </div>
  </div>

  <!-- Progress bar during rendering -->
  {#if isRendering}
    <div class="progress-bar" role="progressbar" aria-valuenow={renderProgress} aria-valuemax={renderTotal}>
      <div
        class="progress-fill"
        style="width: {renderTotal > 0 ? (renderProgress / renderTotal) * 100 : 0}%"
      ></div>
    </div>
  {/if}

  <!-- Card preview grid -->
  <div class="prep-body themed-scrollbar">
    <!-- Info card pair -->
    {#if includeInfoCards && infoCardPair}
      <div class="family-section">
        <h3 class="family-label">Rules Card</h3>
        <div class="pair-grid">
          <div class="card-pair">
            <div class="card-preview" class:show-bleed={showBleedOverlay}>
              <img
                class="preview-img"
                src={infoCardPair.frontSrc}
                alt="Rules card front"
              />
              {#if showBleedOverlay}<div class="bleed-overlay" aria-hidden="true"></div>{/if}
              <span class="face-label">Front</span>
              <button
                class="download-overlay"
                onclick={(e) => { e.stopPropagation(); onDownloadCard(infoCardPair!.front, "rules_card_front.png"); }}
                title="Download front PNG"
                aria-label="Download rules card front"
              >
                <i class="fas fa-download" aria-hidden="true"></i>
              </button>
            </div>
            <div class="card-preview" class:show-bleed={showBleedOverlay}>
              <img
                class="preview-img"
                src={infoCardPair.backSrc}
                alt="Rules card back"
              />
              {#if showBleedOverlay}<div class="bleed-overlay" aria-hidden="true"></div>{/if}
              <span class="face-label">Back</span>
              <button
                class="download-overlay"
                onclick={(e) => { e.stopPropagation(); onDownloadCard(infoCardPair!.back, "rules_card_back.png"); }}
                title="Download back PNG"
                aria-label="Download rules card back"
              >
                <i class="fas fa-download" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Sequence card pairs by family -->
    {#each pairsByFamily as group}
      <div class="family-section">
        <h3 class="family-label">{group.family.label}</h3>
        <div class="pair-grid">
          {#each group.pairs as pair, pairIdx}
            {@const globalIdx = renderedPairs.indexOf(pair)}
            {@const isRerendering = rerenderingCards.has(globalIdx)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="card-pair"
              class:rerendering={isRerendering}
              onclick={() => onOpenDetail(globalIdx)}
              oncontextmenu={(e) => onOpenContextMenu(e, globalIdx)}
              role="button"
              tabindex="0"
              onkeydown={(e) => { if (e.key === "Enter") onOpenDetail(globalIdx); }}
            >
              {#if isRerendering}
                <RenderingOverlay label="Rendering" />
              {/if}
              <div class="card-preview" class:show-bleed={showBleedOverlay}>
                <img
                  class="preview-img"
                  class:dimmed={isRerendering}
                  src={pair.frontSrc}
                  alt="{pair.label} front"
                  loading="lazy"
                />
                {#if showBleedOverlay}<div class="bleed-overlay" aria-hidden="true"></div>{/if}
                <span class="face-label">Front</span>
                <button
                  class="download-overlay"
                  onclick={(e) => { e.stopPropagation(); onDownloadCard(pair.front, `${sanitizeName(pair.label)}_front.png`); }}
                  title="Download front PNG"
                  aria-label="Download {pair.label} front"
                >
                  <i class="fas fa-download" aria-hidden="true"></i>
                </button>
              </div>
              <div class="card-preview" class:show-bleed={showBleedOverlay}>
                <img
                  class="preview-img"
                  class:dimmed={isRerendering}
                  src={pair.backSrc}
                  alt="{pair.label} back"
                  loading="lazy"
                />
                {#if showBleedOverlay}<div class="bleed-overlay" aria-hidden="true"></div>{/if}
                <span class="face-label">Back</span>
                <button
                  class="download-overlay"
                  onclick={(e) => { e.stopPropagation(); onDownloadCard(pair.back, `${sanitizeName(pair.label)}_back.png`); }}
                  title="Download back PNG"
                  aria-label="Download {pair.label} back"
                >
                  <i class="fas fa-download" aria-hidden="true"></i>
                </button>
              </div>
              <span class="pair-label">{pair.label}</span>
            </div>
          {/each}
        </div>
      </div>
    {/each}

    {#if !isRendering && renderedPairs.length === 0 && deckSequenceCount > 0}
      <div class="render-empty">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        <p>Preparing cards...</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .prep-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  .prep-header {
    flex-shrink: 0;
    padding: 12px 20px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-info {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .deck-name {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .card-count {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* ── Progress bar ────────────────────────────────────────────────── */
  .progress-bar {
    position: relative;
    height: 3px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    flex-shrink: 0;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #059669, #34d399);
    transition: width 0.15s ease-out;
  }

  /* ── Card preview grid ───────────────────────────────────────────── */
  .prep-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
  }

  .family-section {
    margin-bottom: 24px;
  }

  .family-section:last-child {
    margin-bottom: 0;
  }

  .family-label {
    margin: 0 0 10px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .pair-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }

  .card-pair {
    display: flex;
    gap: 8px;
    align-items: start;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 8px;
    padding: 8px;
    position: relative;
    cursor: pointer;
  }

  .card-pair:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    background: rgba(255, 255, 255, 0.05);
  }

  .card-pair:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* ── Rerender loading state ──────────────────────────────────────── */
  .preview-img.dimmed {
    opacity: 0.3;
  }

  .card-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    position: relative;
  }

  .preview-img {
    width: 100%;
    aspect-ratio: 822 / 1122;
    object-fit: contain;
    border-radius: 4px;
    background: #0a0e1a;
  }

  .face-label {
    font-size: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .pair-label {
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    white-space: nowrap;
  }

  /* ── Bleed overlay ───────────────────────────────────────────────── */
  .bleed-overlay {
    position: absolute;
    /* 36px bleed on 822x1122 canvas = ~4.38% horizontal, ~3.21% vertical */
    top: 3.21%;
    left: 4.38%;
    right: 4.38%;
    bottom: calc(3.21% + 18px); /* account for face-label space */
    border: 1.5px dashed rgba(255, 80, 80, 0.6);
    border-radius: 2px;
    pointer-events: none;
  }

  /* ── Individual download overlay ─────────────────────────────────── */
  .download-overlay {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.6);
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .card-pair:hover .download-overlay {
    opacity: 1;
  }

  .download-overlay:hover {
    background: rgba(0, 0, 0, 0.8);
    color: #ffffff;
  }

  .download-overlay:focus-visible {
    opacity: 1;
    outline: 2px solid #059669;
    outline-offset: 2px;
  }

  /* ── Render empty state ──────────────────────────────────────────── */
  .render-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 48px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-min, 14px);
  }

  .render-empty i {
    font-size: 24px;
  }

  .render-empty p {
    margin: 0;
  }

  /* ── Responsive ──────────────────────────────────────────────────── */
  @media (max-width: 900px) {
    .pair-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 600px) {
    .prep-body {
      padding: 12px;
    }

    .prep-header {
      padding: 10px 12px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-fill {
      transition: none;
    }

    .download-overlay {
      transition: none;
    }
  }
</style>
