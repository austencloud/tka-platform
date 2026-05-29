<script lang="ts">
  import { onMount } from "svelte";
  import {
    loadCatalogs,
    loadSequencesByIds,
  } from "$lib/features/choreo-card/services/catalog-loader";
  import {
    loadDiamondEdges,
    type CsvEdge,
  } from "$lib/features/choreo-card/services/pictograph-letter-lookup";
  import {
    buildSequencePool,
    getAvailableWeights,
    composeDeck,
  } from "$lib/features/choreo-card/services/deck-composer";
  import type { DeckReleaseCard } from "$lib/features/choreo-card/domain/models/DeckRelease";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import {
    applyVariation,
    BOOK_PATTERNS,
    type VariationConfig,
    type VariantResult,
  } from "$lib/features/choreo-card/services/deck-variation";
  import PrintPreviewPages from "$lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";

  let loading = $state(true);
  let error = $state("");
  let edges: CsvEdge[] = [];

  let baseCards = $state<DeckReleaseCard[]>([]);
  let baseSequences = $state<SequenceData[]>([]);
  let results = $state<VariantResult[]>([]);
  let rerenderKey = $state(0);

  // Only book / long-book / alternating offered for now. Turns disabled (looked bad).
  const OFFERED = BOOK_PATTERNS.filter((p) =>
    ["book", "long-book", "alternating"].includes(p.id),
  );

  // Variation config (slider is 0-100, converted to 0-1)
  let reversalFrequency = $state(40);
  let enabled = $state<Set<string>>(new Set(OFFERED.map((p) => p.id)));
  let totalCards = $state(12);
  let showOriginals = $state(false);

  function config(): VariationConfig {
    return {
      reversalFrequency: reversalFrequency / 100,
      enabledReversals: [...enabled],
      turnFrequency: 0,
      maxTurns: 1,
    };
  }

  function recompute() {
    if (baseSequences.length === 0) return;
    const cfg = config();
    results = baseSequences.map((seq) => applyVariation(seq, cfg, edges));
    rerenderKey++;
  }

  function toggleBook(id: string) {
    const next = new Set(enabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    enabled = next;
    recompute();
  }

  function applyPreset(name: "clean" | "sprinkle" | "spicy") {
    if (name === "clean") reversalFrequency = 0;
    else if (name === "sprinkle") reversalFrequency = 30;
    else reversalFrequency = 70;
    recompute();
  }

  async function loadDeck() {
    loading = true;
    error = "";
    try {
      const catalogs = await loadCatalogs();
      edges = await loadDiamondEdges();
      const pool = buildSequencePool(catalogs, { sliceTypes: new Set(["quartered"]) });
      const weights = getAvailableWeights(pool);
      baseCards = composeDeck(pool, weights, totalCards);

      const byCatalog = new Map<string, string[]>();
      for (const c of baseCards) {
        const ids = byCatalog.get(c.sourceCatalogId) ?? [];
        ids.push(c.sequenceId);
        byCatalog.set(c.sourceCatalogId, ids);
      }
      const all: SequenceData[] = [];
      for (const [cid, ids] of byCatalog) {
        all.push(...(await loadSequencesByIds(cid, ids)));
      }
      const seqMap = new Map(all.map((s) => [s.id, s]));
      baseSequences = baseCards
        .map((c) => seqMap.get(c.sequenceId))
        .filter((s): s is SequenceData => s != null);
      recompute();
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }

  onMount(loadDeck);

  const displaySequences = $derived(
    showOriginals ? baseSequences : results.map((r) => r.sequence),
  );
  const footers = $derived(baseCards.map((c) => c.footer));

  const stats = $derived.by(() => {
    let reversed = 0;
    for (const r of results) {
      if (r.variation.reversalPatternId) reversed++;
    }
    return { reversed, total: results.length };
  });
</script>

<svelte:head><title>Deck Variation Lab</title></svelte:head>

<div class="page">
  <aside class="controls">
    <h1>Deck Variation Lab</h1>
    <p class="sub">Draw-time reversals + turns on real LOOP cards.</p>

    <div class="group">
      <span class="label">Presets</span>
      <div class="row">
        <button type="button" class="chip" onclick={() => applyPreset("clean")}>Clean</button>
        <button type="button" class="chip" onclick={() => applyPreset("sprinkle")}>Sprinkle</button>
        <button type="button" class="chip" onclick={() => applyPreset("spicy")}>Spicy</button>
      </div>
    </div>

    <div class="group">
      <span class="label">Reversal frequency · {reversalFrequency}%</span>
      <input type="range" min="0" max="100" bind:value={reversalFrequency} oninput={recompute} />
    </div>

    <div class="group">
      <span class="label">Book patterns</span>
      <div class="row wrap">
        {#each OFFERED as p (p.id)}
          <button
            type="button"
            class="chip"
            class:active={enabled.has(p.id)}
            aria-pressed={enabled.has(p.id)}
            title={p.description}
            onclick={() => toggleBook(p.id)}
          >
            {p.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="group">
      <span class="label">View</span>
      <div class="row">
        <button
          type="button"
          class="chip"
          class:active={!showOriginals}
          aria-pressed={!showOriginals}
          onclick={() => { showOriginals = false; }}
        >Variants</button>
        <button
          type="button"
          class="chip"
          class:active={showOriginals}
          aria-pressed={showOriginals}
          onclick={() => { showOriginals = true; }}
        >Originals</button>
      </div>
    </div>

    <div class="group">
      <button type="button" class="reroll" onclick={recompute}>↻ Reroll variations</button>
      <button type="button" class="reroll ghost" onclick={loadDeck}>⤓ Redraw deck</button>
    </div>

    {#if results.length > 0}
      <div class="stats">{stats.reversed}/{stats.total} reversed</div>
    {/if}

    <div class="meta">
      {#each results as r, i (i)}
        {@const v = r.variation}
        <div class="meta-row">
          <span class="idx">{i + 1}</span>
          <span class="word">
            <TKAWordGlyph word={r.sequence.word || baseCards[i]?.word || ""} height={22} darkMode />
          </span>
          {#if v.reversalLabel}<span class="tag rev">{v.reversalLabel}</span>
          {:else}<span class="tag plain">plain</span>{/if}
        </div>
      {/each}
    </div>
  </aside>

  <main class="preview">
    {#if loading}
      <div class="status">Loading catalogs + sequences…</div>
    {:else if error}
      <div class="status err">{error}</div>
    {:else if displaySequences.length === 0}
      <div class="status">No LOOP sequences in pool.</div>
    {:else}
      <PrintPreviewPages
        sequences={displaySequences}
        cardSize="poker"
        theme="cosmic"
        isLoading={false}
        deckMode={true}
        displayMode="grid"
        {footers}
        {rerenderKey}
        showGrid={true}
        showTKA={true}
        showWord={true}
        includeStartPosition={true}
        handPointsVisible={true}
      />
    {/if}
  </main>
</div>

<style>
  .page {
    display: flex;
    width: 100vw;
    height: 100vh;
    background: #0f1117;
    color: #e0e0e0;
    font-family: system-ui, -apple-system, sans-serif;
    overflow: hidden;
  }

  .controls {
    width: 340px;
    flex-shrink: 0;
    padding: 20px;
    overflow-y: auto;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    background: #16181f;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  h1 { font-size: 18px; font-weight: 700; color: #fff; margin: 0; }
  .sub { margin: 0; font-size: 12px; color: rgba(255, 255, 255, 0.5); }

  .group { display: flex; flex-direction: column; gap: 8px; }
  .label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.5);
  }
  .row { display: flex; gap: 6px; }
  .row.wrap { flex-wrap: wrap; }

  input[type="range"] { width: 100%; accent-color: #8b5cf6; }

  .chip {
    min-height: 36px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .chip:hover { background: rgba(139, 92, 246, 0.12); color: #fff; }
  .chip.active {
    background: rgba(139, 92, 246, 0.22);
    border-color: #8b5cf6;
    color: #fff;
  }

  .reroll {
    width: 100%;
    min-height: 44px;
    padding: 10px;
    background: #8b5cf6;
    border: none;
    border-radius: 10px;
    color: #fff;
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.15s ease;
  }
  .reroll:hover { filter: brightness(1.1); }
  .reroll.ghost {
    margin-top: 8px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .stats { font-size: 12px; color: rgba(255, 255, 255, 0.6); }

  .meta { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
  .meta-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 34px;
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
  }
  .idx {
    width: 20px;
    flex-shrink: 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.4);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .word { flex: 1; display: flex; align-items: center; min-width: 0; overflow: hidden; }
  .tag { flex-shrink: 0; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
  .tag.rev { background: rgba(96, 165, 250, 0.18); color: #60a5fa; }
  .tag.plain { background: rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.4); }

  .preview { flex: 1; min-width: 0; overflow: auto; padding: 20px; }
  .status {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
  }
  .status.err { color: #f87171; }
</style>
