<script lang="ts">

import { getPrintCardRenderer } from "$lib/features/choreo-card/getPrintCardRenderer";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { CardFooter } from "../../domain/models/DeckRelease";
  import type { CardSizeId } from "../../domain/card-sizes";
  import type { CardPair } from "../../services/types";
  import type { PrintRenderOptions } from "../../services/types";
  import type { TnDElement } from "../../domain/tnd-element";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getPageLayout, CARD_SIZES } from "../../domain/card-sizes";
  import { planPrintSlots } from "../../services/print-slot-planner";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { getCatalogLayoutPolicy } from "../../domain/catalog-layout-policy";
  import { cardCache, type RenderedCard, type CachedCard } from "./print-preview-cache";
  import { deckCardBlobCache, blobToDataUrl, canvasToBlob } from "../../services/DeckCardBlobCache";
  import { hashSequenceContent } from "$lib/shared/foundation/services/content-hasher";
  import { getShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
  import { getCompositionDispatcher } from "$lib/shared/render/get-composition-dispatcher";
  import { buildOverridePlacementBundle } from "$lib/shared/render/services/override-placement-bundle";
  import ShimmerBlock from "$lib/shared/components/loading/ShimmerBlock.svelte";

  // Render-schema version baked into every card cache key (memory + IndexedDB).
  // Bump when rendered pixels change for reasons NOT captured by the keyed
  // options below — e.g. the canonical profile changes. Rotates all keys so
  // stale persisted renders self-invalidate.
  const CARD_RENDER_SCHEMA = "v5";

  interface Props {
    sequences: SequenceData[];
    cardSize: CardSizeId;
    theme: string;
    isLoading: boolean;
    includeStartPosition?: boolean;
    tndElement?: TnDElement;
    /** Per-card TnD elements, index-aligned with sequences (overrides single tndElement) */
    tndElements?: (TnDElement | undefined)[];
    /** Per-card footer data, index-aligned with sequences */
    footers?: CardFooter[];
    /** Use deck layout policy instead of user composition settings */
    deckMode?: boolean;
    /** Bump to force a full re-render of all cards */
    rerenderKey?: number;
    /** Whole-deck copies. Each element fills whole sheets, repeated N times.
     *  Reuses cached renders — a copy costs one extra <img>, never a re-render. */
    copies?: number;
    /** When false, relax one-color-per-sheet: cards fill sheets in order, blanks
     *  only on the final sheet. Preview + PDF share this flag. Default true. */
    groupByElement?: boolean;
    /** Right-click context menu on a card cell: (x, y, rerender callback for that card, sequence) */
    onCardContextMenu?: (x: number, y: number, rerender: () => void, sequence: SequenceData) => void;
    /** Left-click a card to inspect it (includes the pre-rendered front image URL and a rerender callback) */
    onCardClick?: (sequence: SequenceData, frontImageUrl?: string, rerender?: () => Promise<string | null>) => void;
    onPairsReady?: (pairs: CardPair[]) => void;
    onRenderStateChange?: (state: { isRendering: boolean; progress: number; total: number }) => void;
    /** "sheets" = print-ready pages with fronts+backs, "grid" = flowing card grid (fronts only) */
    displayMode?: "sheets" | "grid";
    /** Grid mode only: render each card's back image stacked beneath its front */
    showBacks?: boolean;
    /** Deck ID for QR attribution tracking */
    deckId?: string;
    /** Deck name for QR attribution tracking */
    deckName?: string;
    /** Concise recipe line (deck label · loop · period · length · level · turns ·
     *  grid · prop). Printed centered in each sheet's top margin by the PDF
     *  exporter; the preview mirrors it in the same spot so screen == print. */
    deckSummary?: string;
    /**
     * Pin prop types for the render instead of reading live settings. Set when
     * viewing a released deck so cached card renders stay valid across setting
     * changes. Omit to follow the user's current settings.
     */
    bluePropType?: PropType;
    redPropType?: PropType;
    /**
     * Scope the sheet preview to one printed side. 'fronts' renders only the
     * fronts phase, 'backs' only the backs phase, null (default) renders both.
     * Lets the print panel show exactly what the selected Print button sends.
     */
    sideFilter?: "fronts" | "backs" | null;
  }

  let {
    sequences,
    cardSize,
    theme,
    isLoading,
    includeStartPosition = true,
    tndElement,
    tndElements,
    footers,
    deckMode = false,
    rerenderKey = 0,
    copies = 1,
    groupByElement = true,
    onCardContextMenu,
    onCardClick,
    onPairsReady,
    onRenderStateChange,
    displayMode = "sheets",
    showBacks = false,
    deckId,
    deckName,
    deckSummary,
    bluePropType,
    redPropType,
    sideFilter = null,
  }: Props = $props();

  // Resolve render-visual inputs: explicit overrides pin a released deck's
  // render; otherwise follow live settings. The cache key and render options
  // both read these so a pinned deck's content hash matches what was cached.
  const resolvedBlueProp = $derived(bluePropType ?? settingsService.settings.bluePropType);
  const resolvedRedProp = $derived(redPropType ?? settingsService.settings.redPropType);
  const resolvedBackground = $derived(theme ?? settingsService.settings.backgroundType ?? "");

  let renderedCards: RenderedCard[] = $state([]);
  let renderProgress = $state(0);
  // Denominator anchored to the live sequence count, never a mutable snapshot.
  // A stale render run (e.g. deck size 100 → 90) can't leave 100 lingering here.
  const renderTotal = $derived(sequences.length);
  let isRendering = $state(false);
  // Pre-render setup feedback so "0 / N" never looks frozen. "preparing" =
  // resolving short codes / cold Firestore init; "rendering" = lanes running
  // (first card still warms the worker, shown as indeterminate until progress>0).
  let renderStage = $state<"preparing" | "rendering">("rendering");
  let prepDone = $state(0);
  let prepTotal = $state(0);
  // Piece-level progress: each card's front render places one SVG pictograph per
  // beat and reports per-beat progress. We sum the per-card fractions into a
  // deck-wide "pieces placed" count so the bar advances smoothly within every
  // card (not just one tick per finished card). Driven by the render lanes below.
  let piecesDone = $state(0);
  let piecesTotal = $state(0);

  let layout = $derived(getPageLayout(cardSize));
  let sizeSpec = $derived(CARD_SIZES[cardSize]);
  let cardAspect = $derived(sizeSpec.canvasWidth / sizeSpec.canvasHeight);
  let colWidthPct = $derived((sizeSpec.widthInches / 8.5) * 100);

  let cropMarks = $derived.by(() => {
    const { cols, rows } = layout;
    const marginX = (100 - cols * colWidthPct) / 2;
    const rowHeightPct = colWidthPct * (8.5 / 11) / cardAspect;
    const marginY = (100 - rows * rowHeightPct) / 2;
    const markLen = 1.2;

    const marks: { x: number; y: number; w: number; h: number }[] = [];

    for (let col = 0; col <= cols; col++) {
      const x = marginX + col * colWidthPct;
      marks.push({ x: x, y: marginY - markLen, w: 0, h: markLen });
      marks.push({ x: x, y: 100 - marginY, w: 0, h: markLen });
    }

    for (let row = 0; row <= rows; row++) {
      const y = marginY + row * rowHeightPct;
      marks.push({ x: marginX - markLen, y, w: markLen, h: 0 });
      marks.push({ x: 100 - marginX, y, w: markLen, h: 0 });
    }

    return marks;
  });

  const BLANK_CARD: RenderedCard = { frontUrl: "", backUrl: "", label: "" };

  // Parallel render lanes. Each in-flight card holds ~2 full-size canvases, so
  // bound by core count to overlap async gaps without blowing up peak memory.
  const RENDER_CONCURRENCY = Math.min(
    8,
    Math.max(2, (typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 0) || 4),
  );

  function capitalize(s: string | null): string {
    return s ? s[0]!.toUpperCase() + s.slice(1) : "";
  }

  // Push the latest arrow-placement overrides (special/default/global/prop-geom)
  // into the warm worker pool before composing. The seeded worker bundle is set
  // once at pool init, so a Fix-Arrows save made afterward would otherwise never
  // reach the worker — the re-rendered card would show the OLD arrow position.
  // Cheap (re-seeds resolver state only, not the asset/SVG caches); call once per
  // render run, not per card.
  function refreshOverrideBundle(): void {
    try {
      getCompositionDispatcher().updateOverrideBundle(buildOverridePlacementBundle());
    } catch (err) {
      console.warn("[PrintPreview] override bundle refresh failed:", err);
    }
  }

  interface SheetSlot {
    card: RenderedCard;
    seqIndex: number | null;
    elementName: string | null;
  }

  // Strict page isolation: each element fills whole sheets (planner pads with
  // blanks), whole-block-repeated `copies` times. This is the SAME planner the
  // PDF exporter uses, so the on-screen preview is pixel-for-pixel what prints.
  // We plan over an index-carrying wrapper so click / inspect / rerender still
  // target the correct source card despite grouping, copies, and blank padding.
  let sheets = $derived.by(() => {
    const indexed = renderedCards.map((card, seqIndex) => ({ card, seqIndex }));
    const slots = planPrintSlots(indexed, tndElements ?? [], copies, layout.cardsPerPage, groupByElement);
    const pages: SheetSlot[][] = [];
    for (let i = 0; i < slots.length; i += layout.cardsPerPage) {
      pages.push(
        slots.slice(i, i + layout.cardsPerPage).map((s) => ({
          card: s.item?.card ?? BLANK_CARD,
          seqIndex: s.item?.seqIndex ?? null,
          elementName: s.elementName,
        })),
      );
    }
    return pages;
  });

  function buildRenderOptions(stepCount?: number, footer?: CardFooter, cardIndex?: number): PrintRenderOptions {
    const imageComposition = getImageCompositionManager();
    const element = (cardIndex != null ? tndElements?.[cardIndex] : undefined) ?? tndElement;
    // Render at the SELECTED card size's canvas dims. Without this the renderer
    // falls back to its MPC poker default (822×1122), so tarot cards render at
    // poker aspect and then get squished into tarot print slots — stretch, a gap
    // where the tall slot isn't filled, and crop marks that don't meet the card.
    const size = CARD_SIZES[cardSize];
    return {
      canvasWidth: size.canvasWidth,
      canvasHeight: size.canvasHeight,
      includeStartPosition,
      startPositionLayout:
        deckMode && stepCount != null
          ? getCatalogLayoutPolicy(stepCount)
          : stepCount != null
            ? imageComposition.getStartPositionLayoutForStepCount(stepCount)
            : imageComposition.startPositionLayout,
      showMandala: true,
      theme,
      tndElement: element,
      bluePropType: resolvedBlueProp,
      redPropType: resolvedRedProp,
      leftLabel: footer?.left,
      rightLabel: footer?.right,
      notes: footer?.center,
      iconPath: footer?.iconPath,
      bleedPx: 36,
      deckId,
      deckName,
    };
  }

  function canvasToDataUrl(canvas: HTMLCanvasElement): string {
    return canvas.toDataURL("image/png");
  }

  function buildCacheKey(seq: SequenceData, stepCount: number | undefined, index: number): string {
    const seqId = seq.id ?? seq.word ?? seq.name ?? "";
    const footer = footers?.[index];
    const layout = deckMode && stepCount != null
      ? getCatalogLayoutPolicy(stepCount)
      : "row";
    const optsPart = [
      CARD_RENDER_SCHEMA,
      cardSize, theme,
      (tndElements?.[index]?.familyId ?? tndElement?.familyId ?? "none"),
      resolvedBlueProp,
      resolvedRedProp,
      resolvedBackground,
      stepCount,
      footer?.left ?? "",
      footer?.center ?? "",
      footer?.right ?? "",
      layout,
      rerenderKey,
      // Content fingerprint: self-invalidates whenever the sequence's rendered
      // state changes (reversal flips, re-derived letters, recomputed
      // orientations), so the cache never serves a stale variant. Reversal
      // variants reuse the base seq id, so id alone would collide.
      hashSequenceContent(seq),
    ].join("|");
    return `${seqId}::${optsPart}`;
  }

  function seqFooter(index: number): CardFooter | undefined {
    return footers?.[index];
  }

  // Compute mirrored column for back pages (long-edge duplex flip)
  function mirroredCol(index: number, cols: number): number {
    const col = index % cols;
    return cols - 1 - col;
  }

  function rowOf(index: number, cols: number): number {
    return Math.floor(index / cols);
  }

  // Track the render generation so stale renders are discarded
  let renderGeneration = 0;

  $effect(() => {
    // Capture reactive dependencies
    const seqs = sequences;
    const _cardSize = cardSize;
    const _theme = theme;
    const _includeStartPosition = includeStartPosition;
    const _rerenderKey = rerenderKey;
    const _bgType = resolvedBackground;
    const _blueProp = resolvedBlueProp;
    const _redProp = resolvedRedProp;

    // Void unused captures to satisfy linter
    void _cardSize;
    void _theme;
    void _includeStartPosition;
    void _rerenderKey;
    void _bgType;
    void _blueProp;
    void _redProp;

    const generation = ++renderGeneration;

    if (seqs.length === 0) {
      renderedCards = [];
      renderProgress = 0;
      isRendering = false;
      return;
    }

    renderAll(seqs, generation);
  });

  async function renderAll(seqs: SequenceData[], generation: number) {
    // renderTotal is derived from `sequences` — no assignment needed here.

    // Phase 1: Hydrate in-memory cache from IndexedDB for any misses
    const missKeys: string[] = [];
    for (let idx = 0; idx < seqs.length; idx++) {
      const seq = seqs[idx]!;
      const key = buildCacheKey(seq, seq.steps?.length, idx);
      if (!cardCache.has(key)) missKeys.push(key);
    }

    if (missKeys.length > 0) {
      const idbHits = await deckCardBlobCache.getMultiple(missKeys);
      if (generation !== renderGeneration) return;

      for (const [key, entry] of idbHits) {
        const frontUrl = await blobToDataUrl(entry.frontBlob);
        const backUrl = await blobToDataUrl(entry.backBlob);
        cardCache.set(key, {
          rendered: { frontUrl, backUrl, label: entry.label },
          pair: null,
        });
      }
      if (generation !== renderGeneration) return;
    }

    // Phase 2: Fast path if every card is now in memory (from either tier)
    const allCached = seqs.every((seq, idx) => {
      return cardCache.has(buildCacheKey(seq, seq.steps?.length, idx));
    });

    if (allCached) {
      const cards: RenderedCard[] = [];
      for (let idx = 0; idx < seqs.length; idx++) {
        const seq = seqs[idx]!;
        const cached = cardCache.get(buildCacheKey(seq, seq.steps?.length, idx))!;
        cards.push(cached.rendered);
      }
      renderedCards = cards;
      renderProgress = seqs.length;
      isRendering = false;
      onRenderStateChange?.({ isRendering: false, progress: seqs.length, total: seqs.length });

      rebuildPairs(seqs, generation).then(pairs => {
        if (pairs && generation === renderGeneration) onPairsReady?.(pairs);
      }).catch(err => console.error("[PrintPreview] rebuildPairs failed:", err));
      return;
    }

    // Phase 3: Render uncached cards with bounded concurrency.
    //
    // Safe to parallelize: composeSequenceImage and Canvas2DDirectRenderer each
    // allocate a fresh canvas per call (no shared scratch context), so in-flight
    // renders can't corrupt one another. Running RENDER_CONCURRENCY lanes overlaps
    // the async gaps (asset/blob decode, raster) instead of waiting card-by-card.
    // Results are written by index so ordering is preserved despite out-of-order
    // completion; holes show as blank cells until filled.
    isRendering = true;
    renderProgress = 0;
    renderStage = "preparing";
    prepDone = 0;
    prepTotal = 0;
    renderedCards = [];
    // Sync the worker pool with any arrow overrides saved since it was seeded, so
    // freshly-edited placements render (not the stale init-time bundle).
    refreshOverrideBundle();
    // Per-card piece budgets (one piece per beat). Cached/fast cards count as
    // instantly placed; live renders fill in via per-beat progress callbacks.
    const perCardPieces = seqs.map((s) => Math.max(1, s.steps?.length ?? 1));
    const cardPieceDone = new Array(seqs.length).fill(0);
    piecesTotal = perCardPieces.reduce((a, b) => a + b, 0);
    piecesDone = 0;
    onRenderStateChange?.({ isRendering: true, progress: 0, total: seqs.length });

    const renderer = getPrintCardRenderer();

    // Pre-resolve every card's QR short code in one batched pass before the
    // render lanes fan out. Without this, each lane's first render does a
    // serial ~380ms Firestore round-trip (the cold-deck bottleneck) which
    // also pegs the main thread and freezes the Print Deck modal. Best-effort:
    // any miss falls through to per-card resolution at render time. Reports
    // chunk progress so the bar moves during the otherwise-silent cold start.
    await getShortCodeManager().resolveCodesForDeck(
      seqs,
      { bluePropType: resolvedBlueProp, redPropType: resolvedRedProp, deckId, deckName },
      (done, total) => {
        if (generation === renderGeneration) { prepDone = done; prepTotal = total; }
      },
    );
    if (generation !== renderGeneration) return;

    // Codes resolved — lanes start. First card still warms the worker, so the
    // bar stays indeterminate until renderProgress ticks past 0.
    renderStage = "rendering";

    const cards: RenderedCard[] = new Array(seqs.length);
    const pairs: (CardPair | null)[] = new Array(seqs.length).fill(null);
    let completed = 0;
    let nextIndex = 0;

    const renderOne = async (i: number): Promise<void> => {
      const seq = seqs[i]!;
      const stepCount = seq.steps?.length;
      const footer = seqFooter(i);
      const cacheKey = buildCacheKey(seq, stepCount, i);
      const cached = cardCache.get(cacheKey);

      // Surface this card's per-beat placement into the deck-wide piece count.
      // Each beat is one SVG pictograph; current/total are the beats of THIS
      // card, normalized to its budget so the global bar stays proportional
      // even if the render reports a different beat count than steps.length.
      const reportPieces = (current: number, total: number) => {
        if (generation !== renderGeneration || total <= 0) return;
        cardPieceDone[i] = Math.min(1, current / total) * perCardPieces[i]!;
        piecesDone = cardPieceDone.reduce((a, b) => a + b, 0);
      };

      try {
        if (cached) {
          cards[i] = cached.rendered;
          if (!cached.pair) cached.pair = await reconstructPair(cached.rendered);
          pairs[i] = cached.pair;
        } else {
          const options = buildRenderOptions(stepCount, footer, i);
          // Front (Canvas2D) and back (DOM screenshot, ~200ms fixed wait) are
          // independent and each allocate their own canvas/container, so render
          // them together rather than front-then-back.
          const [frontCanvas, backCanvas] = await Promise.all([
            renderer.renderFront(seq, options, (p) => reportPieces(p.current, p.total)),
            renderer.renderBack(seq, options),
          ]);

          const label = seq.word || seq.name || `Card ${i + 1}`;
          const card: RenderedCard = {
            frontUrl: canvasToDataUrl(frontCanvas),
            backUrl: canvasToDataUrl(backCanvas),
            label,
          };
          const pair: CardPair = { front: frontCanvas, back: backCanvas, label };

          cards[i] = card;
          pairs[i] = pair;
          cardCache.set(cacheKey, { rendered: card, pair });

          Promise.all([canvasToBlob(frontCanvas), canvasToBlob(backCanvas)])
            .then(([fb, bb]) => deckCardBlobCache.set(cacheKey, fb, bb, label))
            .catch(() => {});
        }
      } catch (err) {
        console.error(`[PrintPreview] Card ${i + 1} (${seq.word}) render failed:`, err);
        cards[i] = { frontUrl: "", backUrl: "", label: `⚠ ${seq.word || seq.name || `Card ${i + 1}`}` };
      }

      completed++;
      if (generation === renderGeneration) {
        // This card is done — count all its pieces (covers cache hits, which
        // never fire per-beat progress, and rounds the live count up to full).
        cardPieceDone[i] = perCardPieces[i]!;
        piecesDone = cardPieceDone.reduce((a, b) => a + b, 0);
        renderProgress = completed;
        // `cards` is a sparse array (assigned by index); Array.from visits every
        // slot — including not-yet-rendered holes — so the result is dense and
        // `{#each}` never sees an undefined entry.
        renderedCards = Array.from(cards, (c) => c ?? BLANK_CARD);
        onRenderStateChange?.({ isRendering: true, progress: completed, total: seqs.length });
      }
    };

    const lane = async (): Promise<void> => {
      while (generation === renderGeneration) {
        const i = nextIndex++;
        if (i >= seqs.length) return;
        await renderOne(i);
      }
    };

    const laneCount = Math.min(RENDER_CONCURRENCY, seqs.length);
    await Promise.all(Array.from({ length: laneCount }, () => lane()));

    if (generation !== renderGeneration) return;
    isRendering = false;
    onPairsReady?.(pairs.filter((p): p is CardPair => p !== null));
    onRenderStateChange?.({ isRendering: false, progress: seqs.length, total: seqs.length });
  }

  async function rebuildPairs(seqs: SequenceData[], generation: number): Promise<CardPair[] | null> {
    const pairs: CardPair[] = [];
    for (let idx = 0; idx < seqs.length; idx++) {
      const seq = seqs[idx]!;
      if (generation !== renderGeneration) return null;
      const cached = cardCache.get(buildCacheKey(seq, seq.steps?.length, idx));
      if (!cached) return null;
      if (cached.pair) {
        pairs.push(cached.pair);
      } else {
        const pair = await reconstructPair(cached.rendered);
        cached.pair = pair;
        pairs.push(pair);
      }
    }
    return pairs;
  }

  async function reconstructPair(rendered: RenderedCard): Promise<CardPair> {
    const [front, back] = await Promise.all([
      dataUrlToCanvas(rendered.frontUrl),
      dataUrlToCanvas(rendered.backUrl),
    ]);
    return { front, back, label: rendered.label };
  }

  function dataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.onerror = () => reject(new Error("Failed to load image from data URL"));
      img.src = dataUrl;
    });
  }

  async function rerenderCard(index: number): Promise<string | null> {
    const seq = sequences[index];
    if (!seq) return null;

    const renderer = getPrintCardRenderer();
    const stepCount = seq.steps?.length;
    const footer = seqFooter(index);
    const options = buildRenderOptions(stepCount, footer, index);

    const cacheKey = buildCacheKey(seq, stepCount, index);
    cardCache.delete(cacheKey);
    deckCardBlobCache.delete(cacheKey).catch(() => {});

    // A single-card refresh is the explicit "I just fixed this card's arrows"
    // path — push the saved overrides to the worker before recomposing.
    refreshOverrideBundle();

    const frontCanvas = await renderer.renderFront(seq, options);
    const backCanvas = await renderer.renderBack(seq, options);

    const label = seq.word || seq.name || `Card ${index + 1}`;
    const card: RenderedCard = {
      frontUrl: canvasToDataUrl(frontCanvas),
      backUrl: canvasToDataUrl(backCanvas),
      label,
    };

    cardCache.set(cacheKey, {
      rendered: card,
      pair: { front: frontCanvas, back: backCanvas, label },
    });

    Promise.all([canvasToBlob(frontCanvas), canvasToBlob(backCanvas)])
      .then(([fb, bb]) => deckCardBlobCache.set(cacheKey, fb, bb, label))
      .catch(() => {});

    renderedCards = renderedCards.map((c, i) => i === index ? card : c);
    return card.frontUrl;
  }

  function handleCardContextMenu(event: MouseEvent, cardIndex: number) {
    if (!onCardContextMenu) return;
    const seq = sequences[cardIndex];
    if (!seq) return;
    event.preventDefault();
    onCardContextMenu(
      event.clientX,
      event.clientY,
      () => rerenderCard(cardIndex),
      seq
    );
  }
</script>

<div class="pages-container">
  {#if isLoading}
    <div class="state-message" role="status" aria-live="polite">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      Loading sequences...
    </div>
  {:else if sequences.length === 0}
    <div class="state-message" role="status">
      <p>No sequences to preview</p>
    </div>
  {:else}
    {#if isRendering}
      {@const preparing = renderStage === "preparing"}
      {@const prepFraction = prepTotal > 0 ? prepDone / prepTotal : 0}
      {@const pieceFraction = piecesTotal > 0 ? piecesDone / piecesTotal : 0}
      <!-- Determinate whenever we have a real count to show: short-code resolve
           progress while preparing, then per-piece (per-beat) placement while
           rendering. Only the brief cold worker-warm before any data is shown
           stays indeterminate. -->
      {@const determinate = preparing ? prepTotal > 0 : piecesTotal > 0}
      {@const fraction = preparing ? prepFraction : pieceFraction}
      <div
        class="progress-bar-container"
        class:indeterminate={!determinate}
        role="progressbar"
        aria-valuenow={determinate ? Math.round(fraction * 100) : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-busy={!determinate}
      >
        {#if !determinate}
          <div class="progress-bar-fill indeterminate-fill"></div>
          <span class="progress-label">
            {preparing ? "Preparing renderer…" : "Warming renderer…"}
          </span>
        {:else}
          <div class="progress-bar-fill" style:width="{fraction * 100}%"></div>
          <span class="progress-label">
            {#if preparing}
              Preparing — resolving codes {prepDone} / {prepTotal}…
            {:else}
              Placing pictographs — {Math.floor(piecesDone)} / {piecesTotal} ({renderProgress} / {renderTotal} cards)
            {/if}
          </span>
        {/if}
      </div>
    {/if}

    {#if displayMode === "grid"}
      <div class="card-grid-scroll">
        {#each renderedCards as card, idx (idx)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="card-item"
            class:clickable={!!onCardClick}
            role="button"
            tabindex="0"
            onclick={() => { const seq = sequences[idx]; if (seq) onCardClick?.(seq, card.frontUrl, () => rerenderCard(idx)); }}
            onkeydown={(e) => {
              if (!onCardClick) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const seq = sequences[idx];
                if (seq) onCardClick(seq, card.frontUrl, () => rerenderCard(idx));
              }
            }}
            oncontextmenu={(e) => handleCardContextMenu(e, idx)}
          >
            <div class="card-cell" style:aspect-ratio="{cardAspect}">
              {#if card.frontUrl}
                <img src={card.frontUrl} alt="{card.label} front" />
              {:else if card.label.startsWith("⚠")}
                <div class="card-error" title={card.label}><i class="fas fa-exclamation-triangle" aria-hidden="true"></i></div>
              {:else}
                <ShimmerBlock width="100%" height="100%" borderRadius="0" delay={(idx % 6) * 120} />
              {/if}
            </div>
            {#if showBacks}
              <div class="card-cell" style:aspect-ratio="{cardAspect}">
                {#if card.backUrl}
                  <img src={card.backUrl} alt="{card.label} back" />
                {:else if card.label.startsWith("⚠")}
                  <div class="card-error" title={card.label}><i class="fas fa-exclamation-triangle" aria-hidden="true"></i></div>
                {:else}
                  <ShimmerBlock width="100%" height="100%" borderRadius="0" delay={(idx % 6) * 120 + 60} />
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="pages-scroll">
        <!-- ═══ PHASE 1: ALL FRONTS ═══ -->
        {#if sideFilter !== "backs"}
        {#each sheets as sheet, sheetIndex (sheetIndex)}
          {@const elName = capitalize(sheet[0]?.elementName ?? null)}
          <span class="page-label">Fronts{elName ? ` · ${elName}` : ""} · Sheet {sheetIndex + 1} of {sheets.length}</span>
          <div class="page">
            <div class="page-guide page-guide-top">
              {#if deckName}<span class="guide-text">{deckName}</span>{/if}
              {#if deckSummary}<span class="guide-text guide-bold guide-recipe">{deckSummary}</span>{/if}
              <span class="guide-text guide-bold">FRONTS{elName ? ` · ${elName}` : ""} · Sheet {sheetIndex + 1} of {sheets.length}</span>
            </div>
            <div
              class="page-grid"
              style:grid-template-columns="repeat({layout.cols}, {colWidthPct}%)"
            >
              {#each sheet as slot, cardIndex (cardIndex)}
                {#if !slot.card.frontUrl}
                  <div class="card-cell blank" style:aspect-ratio="{cardAspect}"></div>
                {:else}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="card-cell"
                  class:clickable={!!onCardClick && slot.seqIndex != null}
                  style:aspect-ratio="{cardAspect}"
                  role="button"
                  tabindex="0"
                  onclick={() => {
                    const idx = slot.seqIndex;
                    if (idx == null) return;
                    const seq = sequences[idx];
                    if (seq) onCardClick?.(seq, slot.card.frontUrl, () => rerenderCard(idx));
                  }}
                  onkeydown={(e) => {
                    if (!onCardClick) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      const idx = slot.seqIndex;
                      if (idx == null) return;
                      const seq = sequences[idx];
                      if (seq) onCardClick(seq, slot.card.frontUrl, () => rerenderCard(idx));
                    }
                  }}
                  oncontextmenu={(e) => { if (slot.seqIndex != null) handleCardContextMenu(e, slot.seqIndex); }}
                >
                  <img src={slot.card.frontUrl} alt="{slot.card.label} front" />
                </div>
                {/if}
              {/each}
            </div>
            <div class="page-guide page-guide-bottom">
              <span class="guide-text">FRONT SIDE</span>
              <span class="guide-text">Sheet {sheetIndex + 1} of {sheets.length}</span>
            </div>
            {#each cropMarks as mark}
              <div class="crop-mark" style="left:{mark.x}%;top:{mark.y}%;width:{mark.w || 0.1}%;height:{mark.h || 0.1}%"></div>
            {/each}
          </div>
        {/each}
        {/if}

        <!-- ═══ PHASE 2: ALL BACKS ═══ -->
        {#if sideFilter !== "fronts"}
        {#each sheets as sheet, sheetIndex (sheetIndex)}
          {@const elName = capitalize(sheet[0]?.elementName ?? null)}
          <span class="page-label">Backs{elName ? ` · ${elName}` : ""} · Sheet {sheetIndex + 1} of {sheets.length}</span>
          <div class="page">
            <div class="page-guide page-guide-top">
              {#if deckName}<span class="guide-text">{deckName}</span>{/if}
              {#if deckSummary}<span class="guide-text guide-bold guide-recipe">{deckSummary}</span>{/if}
              <span class="guide-text guide-bold">BACKS{elName ? ` · ${elName}` : ""} · Sheet {sheetIndex + 1} of {sheets.length}</span>
            </div>
            <div
              class="page-grid"
              style:grid-template-columns="repeat({layout.cols}, {colWidthPct}%)"
            >
              {#each sheet as slot, cardIndex (cardIndex)}
                {#if !slot.card.backUrl}
                  <div
                    class="card-cell blank"
                    style:aspect-ratio="{cardAspect}"
                    style:grid-column="{mirroredCol(cardIndex, layout.cols) + 1}"
                    style:grid-row="{rowOf(cardIndex, layout.cols) + 1}"
                  ></div>
                {:else}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="card-cell"
                  class:clickable={!!onCardClick && slot.seqIndex != null}
                  style:aspect-ratio="{cardAspect}"
                  style:grid-column="{mirroredCol(cardIndex, layout.cols) + 1}"
                  style:grid-row="{rowOf(cardIndex, layout.cols) + 1}"
                  role="button"
                  tabindex="0"
                  onclick={() => {
                    const idx = slot.seqIndex;
                    if (idx == null) return;
                    const seq = sequences[idx];
                    if (seq) onCardClick?.(seq, slot.card.frontUrl, () => rerenderCard(idx));
                  }}
                  onkeydown={(e) => {
                    if (!onCardClick) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      const idx = slot.seqIndex;
                      if (idx == null) return;
                      const seq = sequences[idx];
                      if (seq) onCardClick(seq, slot.card.frontUrl, () => rerenderCard(idx));
                    }
                  }}
                  oncontextmenu={(e) => { if (slot.seqIndex != null) handleCardContextMenu(e, slot.seqIndex); }}
                >
                  <img src={slot.card.backUrl} alt="{slot.card.label} back" />
                </div>
                {/if}
              {/each}
            </div>
            <div class="page-guide page-guide-bottom">
              <span class="guide-text">BACK SIDE — columns mirrored for long-edge flip</span>
              <span class="guide-text">↻ LONG EDGE</span>
            </div>
            {#each cropMarks as mark}
              <div class="crop-mark" style="left:{mark.x}%;top:{mark.y}%;width:{mark.w || 0.1}%;height:{mark.h || 0.1}%"></div>
            {/each}
          </div>
        {/each}
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .pages-container {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .card-grid-scroll {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
    padding-bottom: 24px;
  }

  .pages-scroll {
    display: flex;
    flex-direction: column;
    gap: 24px;
    align-items: center;
    padding-bottom: 24px;
  }

  .page {
    position: relative;
    background: var(--print-bg, #ffffff);
    border-radius: 4px;
    box-shadow: var(--shadow-card, 0 2px 8px rgba(0, 0, 0, 0.3));
    width: 100%;
    max-width: 800px;
    aspect-ratio: 8.5 / 11;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .page-grid {
    display: grid;
    gap: 0;
    width: 100%;
    align-content: center;
    justify-content: center;
  }

  .card-item {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .card-item.clickable {
    cursor: pointer;
  }

  .card-item.clickable .card-cell {
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .card-item.clickable:hover .card-cell {
    transform: scale(1.02);
    box-shadow: var(--shadow-card, 0 4px 20px rgba(0, 0, 0, 0.3));
  }

  .card-cell {
    overflow: hidden;
    border-radius: 0;
    background: #ffffff;
  }

  .card-error {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .card-cell.blank {
    background: transparent;
    border: 1px dashed rgba(255, 255, 255, 0.08);
  }

  .card-cell.clickable {
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .card-cell.clickable:hover {
    transform: scale(1.02);
    box-shadow: var(--shadow-card, 0 4px 20px rgba(0, 0, 0, 0.3));
  }

  .card-cell img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .page-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-align: center;
    margin-top: 8px;
  }

  .progress-bar-container {
    position: sticky;
    top: 0;
    z-index: 1;
    width: 100%;
    max-width: 800px;
    height: 28px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    margin: 0 auto 16px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .progress-bar-fill {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    background: var(--theme-accent-bg, rgba(100, 180, 255, 0.3));
    transition: width 0.2s ease;
  }

  /* Indeterminate sweep for the setup phase (code resolution + worker warm),
     where there's no card count yet — proves the deck isn't frozen. */
  .progress-bar-fill.indeterminate-fill {
    width: 35%;
    transition: none;
    animation: indeterminate-slide 1.15s ease-in-out infinite;
  }
  @keyframes indeterminate-slide {
    0% { left: -35%; }
    100% { left: 100%; }
  }
  @media (prefers-reduced-motion: reduce) {
    .progress-bar-fill.indeterminate-fill {
      animation: none;
      left: 0;
      width: 100%;
      opacity: 0.35;
    }
  }

  .progress-label {
    position: relative;
    z-index: 1;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text, #ffffff);
  }

  .state-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 300px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
  }

  /* Print guide overlays */
  .crop-mark {
    position: absolute;
    background: #999;
    pointer-events: none;
    z-index: 1;
  }

  .page-guide {
    position: absolute;
    left: 4px;
    right: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    pointer-events: none;
    z-index: 1;
  }

  .page-guide-top {
    top: 1px;
  }

  .page-guide-bottom {
    bottom: 1px;
  }

  .guide-text {
    font-size: 7px;
    color: #a6a6a6;
    font-family: Helvetica, Arial, sans-serif;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .guide-bold {
    font-weight: 600;
  }

  /* Recipe line: absolutely centered in the top margin, mirroring the PDF
     exporter (deckSummary drawn at page-center) so screen == print. Sits above
     the left deckName + right sheet label without shifting them. */
  .guide-recipe {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    max-width: 70%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
