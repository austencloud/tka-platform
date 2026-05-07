<script lang="ts">
  import { onMount } from "svelte";
  import { getMandalaGeometryCalculator } from "$lib/shared/mandala/getMandalaGeometryCalculator";
  import { renderMandalaSVG } from "$lib/shared/mandala/services/mandala-renderer";
  import { loadDecks, loadDeckSequencesPage, getCachedDecks } from "$lib/features/choreo-card/services/deck-loader";
  import { getStickerLabContext } from "../context/sticker-lab-context";
  import { cachePrimitivePaths } from "../state/mandala-paths-cache.svelte";
  import type { Deck } from "$lib/features/choreo-card/domain/models/Deck";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { MandalaPaths, MandalaPalette } from "$lib/shared/mandala/domain/mandala-types";
  import type { QueryDocumentSnapshot } from "firebase/firestore";

  const stickerState = getStickerLabContext();
  const calc = getMandalaGeometryCalculator();

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

  const FETCH_PAGE = 200;

  // --- Path-type classification fingerprinting ---
  // Each prop tip path is classified by its radial behavior:
  //   DASH:   sweeps from center to edge (minR < 5, range > 20)
  //   ARC:    sweeps near-center to edge (minR >= 5, range > 20)
  //   CIRCLE: constant at outer edge (range < 20, maxR > 100)
  //   DOT:    constant at center (range < 20, maxR <= 100)
  //
  // Staff props have 2 tips each, 2 props = 4 paths total (blue+red only, not purple).
  // Props always produce tip-pairs: 2 DASH, 2 ARC, or CIRCLE+DOT.
  // Fingerprint = count of each type → exactly 6 possible shapes.

  function samplePathPoints(d: string): [number, number][] {
    const pts: [number, number][] = [];
    let cx = 0, cy = 0;
    const commands = d.match(/[MC][^MC]*/g);
    if (!commands) return pts;
    for (const cmd of commands) {
      const nums = cmd.slice(1).match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
      if (cmd[0] === "M" && nums.length >= 2) {
        cx = nums[0]!; cy = nums[1]!;
        pts.push([cx, cy]);
      } else if (cmd[0] === "C" && nums.length >= 6) {
        const cp1x = nums[0]!, cp1y = nums[1]!;
        const cp2x = nums[2]!, cp2y = nums[3]!;
        const ex = nums[4]!, ey = nums[5]!;
        for (let t = 0.1; t <= 1.0; t += 0.1) {
          const u = 1 - t;
          const x = u*u*u*cx + 3*u*u*t*cp1x + 3*u*t*t*cp2x + t*t*t*ex;
          const y = u*u*u*cy + 3*u*u*t*cp1y + 3*u*t*t*cp2y + t*t*t*ey;
          pts.push([x, y]);
        }
        cx = ex; cy = ey;
      }
    }
    return pts;
  }

  type PathType = "DASH" | "ARC" | "CIRCLE" | "DOT";

  function classifyPath(d: string): PathType {
    const pts = samplePathPoints(d);
    if (pts.length < 2) return "DOT";
    const radii = pts.map(([x, y]) => Math.sqrt(x * x + y * y));
    const minR = Math.min(...radii);
    const maxR = Math.max(...radii);
    if (maxR - minR < 20) return maxR > 100 ? "CIRCLE" : "DOT";
    return minR < 5 ? "DASH" : "ARC";
  }

  function fpLabel(fp: string): string {
    const m = fp.match(/D(\d+)A(\d+)C(\d+)P(\d+)/);
    if (!m) return fp;
    const parts: string[] = [];
    if (Number(m[1]) > 0) parts.push("dash");
    if (Number(m[2]) > 0) parts.push("arc");
    if (Number(m[3]) > 0 || Number(m[4]) > 0) parts.push("circle");
    return parts.join(" + ") || "unknown";
  }

  function mandalaFingerprint(paths: MandalaPaths): string {
    let nD = 0, nA = 0, nC = 0, nP = 0;
    for (const group of [paths.blue, paths.red]) {
      for (const p of group) {
        const t = classifyPath(p.d);
        if (t === "DASH") nD++;
        else if (t === "ARC") nA++;
        else if (t === "CIRCLE") nC++;
        else nP++;
      }
    }
    return `D${nD}A${nA}C${nC}P${nP}`;
  }

  // --- Types ---
  interface ShapeGroup {
    fp: string;
    repPaths: MandalaPaths;
    repSeq: SequenceData;
    count: number;
    sequences: Array<{ seq: SequenceData }>;
  }

  type View = { kind: "decks" } | { kind: "shapes"; deck: Deck } | { kind: "variants"; deck: Deck; group: ShapeGroup };

  // --- State ---
  let decks = $state<Deck[]>([]);
  let loading = $state(true);
  let view = $state<View>({ kind: "decks" });
  let shapes = $state<ShapeGroup[]>([]);
  let scanProgress = $state("");

  const copiesMap = $derived(
    new Map(stickerState.sheet.stickers.map((s) => [s.primitiveRef.shapeHash, s.copies])),
  );

  function isQuarteredRotatedLoop(deck: Deck): boolean {
    return (
      deck.collection === "LOOPs" &&
      deck.loopType === "rotated" &&
      deck.sliceType === "quartered" &&
      (!deck.reversalPattern || deck.reversalPattern === "continuous")
    );
  }

  onMount(async () => {
    const cached = getCachedDecks();
    if (cached && cached.length > 0) {
      decks = cached.filter(isQuarteredRotatedLoop);
    }
    const fresh = await loadDecks();
    decks = fresh.filter(isQuarteredRotatedLoop);
    loading = false;
  });

  async function openDeck(deck: Deck) {
    view = { kind: "shapes", deck };
    shapes = [];
    scanProgress = "Loading...";

    const shapeMap = new Map<string, ShapeGroup>();
    let lastDoc: QueryDocumentSnapshot | null = null;
    let hasMore = true;
    let loaded = 0;

    while (hasMore) {
      const page = await loadDeckSequencesPage(deck.id, FETCH_PAGE, lastDoc ?? undefined);
      for (const seq of page.sequences) {
        if (!seq.steps || seq.steps.length === 0) continue;
        const paths = calc.calculate(seq.steps, "staff", "staff");
        const fp = mandalaFingerprint(paths);
        const existing = shapeMap.get(fp);
        if (existing) {
          existing.count++;
          existing.sequences.push({ seq });
        } else {
          shapeMap.set(fp, { fp, repPaths: paths, repSeq: seq, count: 1, sequences: [{ seq }] });
        }
      }
      loaded += page.sequences.length;
      scanProgress = `${loaded} sequences → ${shapeMap.size} shapes`;
      shapes = [...shapeMap.values()].sort((a, b) => b.count - a.count);
      lastDoc = page.lastDoc;
      hasMore = page.sequences.length === FETCH_PAGE;
      await new Promise((r) => setTimeout(r, 0));
    }
    scanProgress = "";
  }

  function openVariants(group: ShapeGroup, deck: Deck) {
    view = { kind: "variants", deck, group };
  }

  function addToSheet(seq: SequenceData, paths: MandalaPaths) {
    cachePrimitivePaths(seq.id, paths);
    stickerState.addPrimitive({
      shapeHash: seq.id,
      ultraHash: seq.id,
      sourceLoop: {
        sequenceId: seq.id,
        word: seq.word ?? seq.id,
        loopType: "rotated",
      },
      displayName: seq.word ?? seq.id,
    });
  }

  // --- SVG rendering ---
  const svgCache = new Map<string, string>();

  function renderMono(paths: MandalaPaths, key: string): string {
    const cached = svgCache.get(key);
    if (cached) return cached;
    const svg = renderMandalaSVG(paths, {
      size: 300,
      style: "stroke",
      showGridDots: false,
      show: "both",
      strokeWidth: 2.5,
      transparentBackground: true,
      palette: MONO_PALETTE,
    });
    svgCache.set(key, svg);
    return svg;
  }

  function renderColor(seq: SequenceData): { svg: string; paths: MandalaPaths } | null {
    const key = `c_${seq.id}`;
    const cached = svgCache.get(key);
    if (cached) {
      const paths = calc.calculate(seq.steps, "staff", "staff");
      return { svg: cached, paths };
    }
    if (!seq.steps || seq.steps.length === 0) return null;
    const paths = calc.calculate(seq.steps, "staff", "staff");
    const svg = renderMandalaSVG(paths, {
      size: 300,
      style: "stroke",
      showGridDots: false,
      show: "both",
      strokeWidth: 2.5,
      transparentBackground: true,
      palette: COLOR_PALETTE,
    });
    svgCache.set(key, svg);
    return { svg, paths };
  }

  function deckLabel(deck: Deck): string {
    return deck.name ?? `${deck.turnPattern ?? ""}`.replace("uniform-", "").replace("t", " Turn");
  }
</script>

<div class="shape-browser">
  {#if view.kind === "variants"}
    <header class="sb-header">
      <button class="back-btn" onclick={() => view = { kind: "shapes", deck: view.kind === "variants" ? view.deck : decks[0]! }}>
        <i class="fas fa-arrow-left" aria-hidden="true"></i> Shapes
      </button>
      <span class="deck-title">{fpLabel(view.group.fp)} — {view.group.count} color variants</span>
    </header>

    <div class="shape-grid">
      {#each view.group.sequences as entry, i (i)}
        {@const result = renderColor(entry.seq)}
        {#if result}
          {@const copies = copiesMap.get(entry.seq.id) ?? 0}
          <button
            class="shape-tile"
            class:on-sheet={copies > 0}
            onclick={() => addToSheet(entry.seq, result.paths)}
            aria-label="{entry.seq.word ?? entry.seq.id} — {copies > 0 ? `${copies} on sheet` : 'Add to sheet'}"
          >
            <div class="tile-art">
              {@html result.svg}
            </div>
            <span class="tile-word">{entry.seq.word ?? entry.seq.id}</span>
            {#if copies > 0}
              <span class="tile-badge">{copies}</span>
            {/if}
          </button>
        {/if}
      {/each}
    </div>

  {:else if view.kind === "shapes"}
    <header class="sb-header">
      <button class="back-btn" onclick={() => { view = { kind: "decks" }; shapes = []; }}>
        <i class="fas fa-arrow-left" aria-hidden="true"></i> Decks
      </button>
      <span class="deck-title">{deckLabel(view.deck)}</span>
      {#if scanProgress}
        <span class="stat-pill dim">
          <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
          {scanProgress}
        </span>
      {/if}
    </header>

    <div class="section-shapes">
      {#each shapes as group (group.fp)}
        <button
          class="shape-tile"
          onclick={() => { if (view.kind === "shapes") openVariants(group, view.deck); }}
          aria-label="{group.count} variant{group.count === 1 ? '' : 's'}"
        >
          <div class="tile-art">
            {@html renderMono(group.repPaths, group.fp)}
          </div>
          <span class="tile-word">{fpLabel(group.fp)}</span>
          {#if group.count > 1}
            <span class="shape-count">{group.count}</span>
          {/if}
        </button>
      {/each}

      {#if shapes.length === 0 && !scanProgress}
        <div class="empty-state">
          <p>No sequences in this deck</p>
        </div>
      {/if}
    </div>

  {:else}
    <header class="sb-header">
      <span class="deck-title">Mandala Shapes</span>
      {#if loading}
        <span class="stat-pill dim">
          <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
          Loading decks...
        </span>
      {:else}
        <span class="stat-pill">{decks.length} decks</span>
      {/if}
    </header>

    <div class="deck-list">
      {#each decks as deck (deck.id)}
        <button class="deck-row" onclick={() => openDeck(deck)}>
          <span class="deck-row-name">{deckLabel(deck)}</span>
          <i class="fas fa-chevron-right deck-row-arrow" aria-hidden="true"></i>
        </button>
      {/each}

      {#if !loading && decks.length === 0}
        <div class="empty-state">
          <p>No quartered rotated LOOP decks found</p>
        </div>
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

  .deck-title {
    flex: 1;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--theme-text, white);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stat-pill {
    font-size: 0.65rem;
    font-variant-numeric: tabular-nums;
    padding: 2px 7px;
    border-radius: 4px;
    background: rgba(168, 85, 246, 0.12);
    color: #c4b5fd;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .stat-pill.dim {
    background: rgba(255, 255, 255, 0.04);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
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
    flex-shrink: 0;
  }

  .back-btn:hover {
    background: rgba(168, 85, 246, 0.18);
    border-color: rgba(168, 85, 246, 0.4);
  }

  /* --- Deck list --- */
  .deck-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 0;
    scrollbar-width: thin;
    scrollbar-color: rgba(168, 85, 246, 0.15) transparent;
  }

  .deck-row {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 0.65rem 0.75rem;
    border: none;
    background: transparent;
    color: var(--theme-text, white);
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 0.15s;
    text-align: left;
  }

  .deck-row:hover {
    background: rgba(168, 85, 246, 0.08);
  }

  .deck-row-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .deck-row-arrow {
    font-size: 0.6rem;
    opacity: 0.3;
    flex-shrink: 0;
  }

  /* --- Shape tiles --- */
  .section-shapes {
    flex: 1;
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    padding: 0.75rem;
    overflow-y: auto;
    align-content: start;
    scrollbar-width: thin;
    scrollbar-color: rgba(168, 85, 246, 0.15) transparent;
  }

  .shape-tile {
    position: relative;
    display: grid;
    grid-template-rows: 1fr auto;
    gap: 0.25rem;
    padding: 0.5rem;
    width: 140px;
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: 10px;
    background: rgba(13, 13, 26, 0.5);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }

  .shape-tile:hover {
    border-color: rgba(168, 85, 246, 0.25);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .shape-tile.on-sheet {
    border-color: rgba(168, 85, 246, 0.4);
    background: rgba(168, 85, 246, 0.06);
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

  .shape-count {
    position: absolute;
    top: 6px;
    right: 6px;
    min-width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 6px;
    border-radius: 12px;
    background: rgba(168, 85, 246, 0.4);
    color: #e0d8ff;
    font-size: 0.65rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    border: 1px solid rgba(168, 85, 246, 0.2);
    backdrop-filter: blur(4px);
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

  .shape-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    grid-auto-rows: min-content;
    gap: 0.6rem;
    padding: 0.75rem;
    overflow-y: auto;
    align-content: start;
    scrollbar-width: thin;
    scrollbar-color: rgba(168, 85, 246, 0.15) transparent;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    opacity: 0.5;
    padding: 2rem;
  }

  .empty-state p {
    font-size: 0.8rem;
  }
</style>
