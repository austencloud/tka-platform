<script lang="ts">
  import { onMount } from "svelte";
  import { getMandalaGeometryCalculator } from "$lib/shared/mandala/getMandalaGeometryCalculator";
  import { renderMandalaSVG } from "$lib/shared/mandala/services/mandala-renderer";
  import { loadDecks, loadDeckSequences } from "$lib/features/choreo-card/services/deck-loader";
  import { getStickerLabContext } from "../context/sticker-lab-context";
  import { cachePrimitivePaths } from "../state/mandala-paths-cache.svelte";
  import {
    loadCachedShapes,
    saveShapeGroups,
    getProcessedDeckIds,
    markDecksProcessed,
    type StoredShapeGroup,
    type StoredShapeEntry,
  } from "../services/implementations/ShapeCatalogStore";
  import type { Deck } from "$lib/features/choreo-card/domain/models/Deck";
  import type { MandalaPaths, MandalaPalette } from "$lib/shared/mandala/domain/mandala-types";
  import type { DeckResultMessage } from "../workers/shape-fingerprint.worker";

  const stickerState = getStickerLabContext();

  const MONO_PALETTE: MandalaPalette = {
    blueStroke: "#c0b8e8",
    blueFill: "rgba(192, 184, 232, 0.1)",
    redStroke: "#c0b8e8",
    redFill: "rgba(192, 184, 232, 0.1)",
    purpleStroke: "#c0b8e8",
    purpleFill: "rgba(192, 184, 232, 0.1)",
  };

  const COLOR_PALETTE: MandalaPalette = {
    blueStroke: "#3b82f6",
    blueFill: "rgba(59, 130, 246, 0.08)",
    redStroke: "#ef4444",
    redFill: "rgba(239, 68, 68, 0.08)",
    purpleStroke: "#a855f6",
    purpleFill: "rgba(168, 85, 246, 0.08)",
  };

  const PAGE_SIZE = 60;

  let decksProcessed = $state(0);
  let decksTotal = $state(0);
  let processing = $state(false);
  let visibleCount = $state(PAGE_SIZE);
  let cachedHit = $state(false);

  interface ShapeGroup {
    fingerprint: string;
    entries: StoredShapeEntry[];
    repPaths: MandalaPaths;
  }

  let shapeMap = $state<Map<string, ShapeGroup>>(new Map());
  let expandedShape: string | null = $state(null);

  interface VariantEntry {
    ref: StoredShapeEntry;
    paths: MandalaPaths;
  }
  let expandedVariants: VariantEntry[] = $state([]);
  let loadingVariants = $state(false);

  const shapeCatalog = $derived(
    [...shapeMap.values()].sort((a, b) => b.entries.length - a.entries.length),
  );

  const visibleShapes = $derived(shapeCatalog.slice(0, visibleCount));
  const hasMore = $derived(visibleCount < shapeCatalog.length);

  const copiesMap = $derived(
    new Map(stickerState.sheet.stickers.map((s) => [s.primitiveRef.shapeHash, s.copies])),
  );

  // --- Worker management ---
  let worker: Worker | null = null;
  let destroyed = false;

  function createWorker(): Worker {
    return new Worker(
      new URL("../workers/shape-fingerprint.worker.ts", import.meta.url),
      { type: "module" },
    );
  }

  // --- Load from IndexedDB first, then process new decks in worker ---
  async function initialize() {
    const cached = await loadCachedShapes();
    if (cached.length > 0) {
      cachedHit = true;
      const map = new Map<string, ShapeGroup>();
      for (const g of cached) {
        map.set(g.fingerprint, {
          fingerprint: g.fingerprint,
          entries: g.entries,
          repPaths: g.repPaths,
        });
      }
      shapeMap = map;
    }

    const [decks, processedIds] = await Promise.all([loadDecks(), getProcessedDeckIds()]);
    const unprocessed = decks.filter((d) => !processedIds.has(d.id));

    if (unprocessed.length === 0) return;

    processing = true;
    decksTotal = unprocessed.length;
    decksProcessed = 0;

    worker = createWorker();
    const localMap = new Map(shapeMap);

    worker.onmessage = (e: MessageEvent<DeckResultMessage>) => {
      if (destroyed) return;
      const msg = e.data;

      const newGroups: StoredShapeGroup[] = [];
      for (const entry of msg.entries) {
        const ref: StoredShapeEntry = {
          id: entry.id,
          word: entry.word,
          deckId: entry.deckId,
          deckName: entry.deckName,
          loopType: entry.loopType,
        };
        const existing = localMap.get(entry.fingerprint);
        if (existing) {
          existing.entries.push(ref);
        } else {
          const group: ShapeGroup = {
            fingerprint: entry.fingerprint,
            entries: [ref],
            repPaths: entry.paths!,
          };
          localMap.set(entry.fingerprint, group);
          newGroups.push({
            fingerprint: group.fingerprint,
            entries: group.entries,
            repPaths: group.repPaths,
          });
        }
      }

      decksProcessed++;
      shapeMap = new Map(localMap);

      if (newGroups.length > 0) {
        void saveShapeGroups(newGroups);
      }
      void markDecksProcessed([msg.deckId]);

      if (decksProcessed >= decksTotal) {
        processing = false;
        worker?.terminate();
        worker = null;
        const totalSeq = [...localMap.values()].reduce((n, g) => n + g.entries.length, 0);
        console.log(
          `[ShapeBrowser] Done: ${totalSeq} sequences → ${localMap.size} unique shapes (${((1 - localMap.size / totalSeq) * 100).toFixed(1)}% reduction)`,
        );
      } else {
        sendNextDeck();
      }
    };

    let deckIdx = 0;
    const deckList = unprocessed;

    async function sendNextDeck() {
      if (destroyed || deckIdx >= deckList.length) return;
      const deck = deckList[deckIdx++]!;
      const sequences = await loadDeckSequences(deck.id);
      if (destroyed) return;

      worker?.postMessage({
        type: "process-deck",
        deckId: deck.id,
        deckName: deck.name,
        loopType: deck.loopType,
        sequences: sequences
          .filter((s) => s.steps && s.steps.length > 0)
          .map((s) => ({ id: s.id, word: s.word, steps: s.steps })),
      });
    }

    sendNextDeck();
  }

  onMount(() => {
    void initialize();
    return () => {
      destroyed = true;
      worker?.terminate();
      worker = null;
    };
  });

  // --- Infinite scroll ---
  let sentinel: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && visibleCount < shapeCatalog.length) {
          visibleCount = Math.min(visibleCount + PAGE_SIZE, shapeCatalog.length);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });

  // --- Variant drill-down ---
  async function openVariants(group: ShapeGroup) {
    expandedShape = group.fingerprint;

    if (group.entries.length === 1) {
      expandedVariants = [{ ref: group.entries[0]!, paths: group.repPaths }];
      return;
    }

    loadingVariants = true;
    expandedVariants = [];

    const calc = getMandalaGeometryCalculator();
    const byDeck = new Map<string, StoredShapeEntry[]>();
    for (const ref of group.entries) {
      const arr = byDeck.get(ref.deckId) ?? [];
      arr.push(ref);
      byDeck.set(ref.deckId, arr);
    }

    const results: VariantEntry[] = [];
    for (const [deckId, refs] of byDeck) {
      const ids = refs.map((r) => r.id);
      const { loadSequencesByIds } = await import("$lib/features/choreo-card/services/deck-loader");
      const seqs = await loadSequencesByIds(deckId, ids);
      const seqMap = new Map(seqs.map((s) => [s.id, s]));
      for (const ref of refs) {
        const seq = seqMap.get(ref.id);
        if (!seq?.steps) continue;
        const paths = calc.calculate(seq.steps, "staff", "staff");
        results.push({ ref, paths });
      }
    }

    expandedVariants = results;
    loadingVariants = false;
  }

  function closeVariants() {
    expandedShape = null;
    expandedVariants = [];
  }

  // --- Actions ---
  function addToSheet(ref: StoredShapeEntry, paths: MandalaPaths) {
    cachePrimitivePaths(ref.id, paths);
    stickerState.addPrimitive({
      shapeHash: ref.id,
      ultraHash: ref.id,
      sourceLoop: {
        sequenceId: ref.id,
        word: ref.word,
        loopType: ref.loopType,
      },
      displayName: ref.word,
    });
  }

  // --- SVG rendering (cached) ---
  const svgCache = new Map<string, string>();

  function renderMono(paths: MandalaPaths, fp: string): string {
    const cached = svgCache.get(fp);
    if (cached) return cached;
    const svg = renderMandalaSVG(paths, {
      size: 200,
      style: "stroke",
      showGridDots: false,
      show: "both",
      strokeWidth: 2,
      transparentBackground: true,
      palette: MONO_PALETTE,
    });
    svgCache.set(fp, svg);
    return svg;
  }

  function renderColor(paths: MandalaPaths, id: string): string {
    const key = `c_${id}`;
    const cached = svgCache.get(key);
    if (cached) return cached;
    const svg = renderMandalaSVG(paths, {
      size: 200,
      style: "stroke",
      showGridDots: false,
      show: "both",
      strokeWidth: 2,
      transparentBackground: true,
      palette: COLOR_PALETTE,
    });
    svgCache.set(key, svg);
    return svg;
  }
</script>

<div class="shape-browser">
  <header class="sb-header">
    <div class="sb-stats">
      {#if shapeMap.size > 0}
        <span class="stat-pill">{shapeMap.size} shapes</span>
      {/if}
      {#if processing}
        <span class="stat-pill dim">{decksProcessed}/{decksTotal} decks</span>
      {:else if shapeMap.size > 0}
        <span class="stat-pill done">Ready</span>
      {/if}
    </div>
    {#if processing}
      <div class="progress-bar">
        <div class="progress-fill" style="width: {decksTotal > 0 ? (decksProcessed / decksTotal) * 100 : 0}%"></div>
      </div>
    {/if}
  </header>

  {#if expandedShape}
    {@const group = shapeMap.get(expandedShape)}
    <div class="variant-header">
      <button class="back-btn" onclick={closeVariants}>
        <i class="fas fa-arrow-left" aria-hidden="true"></i> All Shapes
      </button>
      <span class="variant-count">{group?.entries.length ?? 0} color variants</span>
    </div>
    {#if loadingVariants}
      <div class="empty-state">
        <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
        <p>Loading variants...</p>
      </div>
    {:else}
      <div class="variant-grid">
        {#each expandedVariants as variant (variant.ref.id)}
          {@const copies = copiesMap.get(variant.ref.id) ?? 0}
          <button
            class="variant-tile"
            class:on-sheet={copies > 0}
            onclick={() => addToSheet(variant.ref, variant.paths)}
            aria-label="{variant.ref.word} — {copies > 0 ? `${copies} on sheet` : 'Add to sheet'}"
          >
            <div class="tile-art">
              {@html renderColor(variant.paths, variant.ref.id)}
            </div>
            <span class="tile-word">{variant.ref.word}</span>
            <span class="tile-deck">{variant.ref.deckName}</span>
            {#if copies > 0}
              <span class="tile-badge">{copies}</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  {:else if shapeMap.size === 0 && !cachedHit}
    <div class="empty-state">
      <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
      <p>Discovering shapes across all decks...</p>
    </div>
  {:else}
    <div class="shape-grid">
      {#each visibleShapes as group (group.fingerprint)}
        <button
          class="shape-tile"
          onclick={() => {
            if (group.entries.length === 1) {
              addToSheet(group.entries[0]!, group.repPaths);
            } else {
              openVariants(group);
            }
          }}
          aria-label="{group.entries.length} variant{group.entries.length === 1 ? '' : 's'}"
        >
          <div class="tile-art">
            {@html renderMono(group.repPaths, group.fingerprint)}
          </div>
          {#if group.entries.length > 1}
            <span class="shape-count">{group.entries.length}</span>
          {/if}
        </button>
      {/each}
      {#if hasMore}
        <div bind:this={sentinel} class="scroll-sentinel"></div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .shape-browser {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .sb-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .sb-stats {
    display: flex;
    gap: 0.35rem;
    flex: 1;
    flex-wrap: wrap;
  }

  .stat-pill {
    font-size: 0.65rem;
    font-variant-numeric: tabular-nums;
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(168, 85, 246, 0.12);
    color: #c4b5fd;
    white-space: nowrap;
  }

  .stat-pill.dim {
    background: rgba(255, 255, 255, 0.04);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .stat-pill.done {
    background: rgba(34, 197, 94, 0.12);
    color: rgba(34, 197, 94, 0.8);
  }

  .progress-bar {
    width: 120px;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
    flex-shrink: 0;
  }

  .progress-fill {
    height: 100%;
    background: #a855f6;
    border-radius: 2px;
    transition: width 0.2s;
  }

  .shape-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.5rem;
    padding: 0.75rem;
    overflow-y: auto;
    align-content: start;
    scrollbar-width: thin;
    scrollbar-color: rgba(168, 85, 246, 0.15) transparent;
  }

  .scroll-sentinel {
    height: 1px;
    grid-column: 1 / -1;
  }

  .shape-tile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.4rem;
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 10px;
    background: rgba(13, 13, 26, 0.5);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .shape-tile:hover {
    border-color: rgba(168, 85, 246, 0.25);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .tile-art {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
  }

  .tile-art :global(svg) {
    width: 100%;
    height: 100%;
  }

  .shape-count {
    position: absolute;
    top: 6px;
    right: 6px;
    min-width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
    border-radius: 11px;
    background: rgba(168, 85, 246, 0.4);
    color: #e0d8ff;
    font-size: 0.6rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    border: 1px solid rgba(168, 85, 246, 0.2);
    backdrop-filter: blur(4px);
  }

  .variant-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.04));
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 5px 12px;
    border: 1px solid rgba(168, 85, 246, 0.2);
    border-radius: 6px;
    background: rgba(168, 85, 246, 0.08);
    color: #c4b5fd;
    font-size: 0.7rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .back-btn:hover {
    background: rgba(168, 85, 246, 0.18);
    border-color: rgba(168, 85, 246, 0.4);
  }

  .variant-count {
    font-size: 0.7rem;
    opacity: 0.5;
  }

  .variant-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.6rem;
    padding: 0.75rem;
    overflow-y: auto;
    align-content: start;
    scrollbar-width: thin;
    scrollbar-color: rgba(168, 85, 246, 0.15) transparent;
  }

  .variant-tile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 10px;
    background: rgba(13, 13, 26, 0.5);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .variant-tile:hover {
    border-color: rgba(168, 85, 246, 0.25);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .variant-tile.on-sheet {
    border-color: rgba(168, 85, 246, 0.4);
    background: rgba(168, 85, 246, 0.06);
  }

  .tile-word {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.5;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tile-deck {
    font-size: 0.5rem;
    opacity: 0.25;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tile-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    min-width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
    border-radius: 10px;
    background: var(--theme-accent, #8b5cf6);
    color: white;
    font-size: 0.55rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    opacity: 0.5;
  }

  .empty-state i {
    font-size: 2rem;
  }

  .empty-state p {
    font-size: 0.8rem;
  }
</style>
