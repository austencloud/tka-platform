<!--
  /test/shop-covers — keen-eye surface (NOT shipped) for deciding the shop deck
  cover treatment and approving which loops front each deck. Renders REAL cards
  via the gallery SequencePeek (same primitive as the front-door fan). Switch the
  cover style, click candidates to keep/drop, copy the selection back to Claude.
-->
<script lang="ts">
  import { COVER_CANDIDATES } from "./candidates";
  import SequencePeek from "$lib/features/browse/gallery-home/SequencePeek.svelte";

  type Style = "fan" | "stack" | "smallfan";
  let style = $state<Style>("fan");

  const decks = Object.entries(COVER_CANDIDATES);

  // Per-deck kept sequence ids (the "approve" loop). Seed with the first 3.
  let selected = $state<Record<string, string[]>>(
    Object.fromEntries(
      decks.map(([id, d]) => [id, d.sequences.slice(0, 3).map((s) => s.id)]),
    ),
  );

  function toggle(deckId: string, id: string) {
    const cur = selected[deckId] ?? [];
    selected[deckId] = cur.includes(id)
      ? cur.filter((x) => x !== id)
      : [...cur, id];
  }
  const isSel = (deckId: string, id: string) =>
    (selected[deckId] ?? []).includes(id);

  function chosen(deckId: string) {
    const pool = COVER_CANDIDATES[deckId]?.sequences ?? [];
    const ids = selected[deckId] ?? [];
    // Keep selection order (the order you tapped = fan order).
    return ids.map((id) => pool.find((s) => s.id === id)).filter(Boolean) as any[];
  }

  // Fan tilt: symmetric spread across the kept cards.
  function tilt(i: number, n: number) {
    if (n <= 1) return 0;
    return -12 + (24 * i) / (n - 1);
  }

  const exportJson = $derived(JSON.stringify(selected, null, 2));
  let copied = $state(false);
  async function copyJson() {
    try {
      await navigator.clipboard.writeText(exportJson);
      copied = true;
      setTimeout(() => (copied = false), 1200);
    } catch {
      /* clipboard blocked; the textarea is selectable as fallback */
    }
  }
</script>

<div class="page">
  <header class="top">
    <div>
      <h1>Shop deck covers — keen-eye pick</h1>
      <p>Real cards (gallery renderer). Pick a style, click cards to keep/drop, copy the JSON back to me.</p>
    </div>
    <div class="style-switch" role="group" aria-label="Cover style">
      <button class:on={style === "fan"} onclick={() => (style = "fan")}>Fanned hand</button>
      <button class:on={style === "stack"} onclick={() => (style = "stack")}>Stacked pile</button>
      <button class:on={style === "smallfan"} onclick={() => (style = "smallfan")}>Small fan</button>
    </div>
  </header>

  <div class="decks">
    {#each decks as [deckId, deck] (deckId)}
      {@const heroes = chosen(deckId)}
      <section class="deck">
        <!-- The product tile as it would ship, in the chosen style. -->
        <div class="tile" class:landscape={style === "fan"}>
          <div class="cover">
            {#if heroes.length === 0}
              <span class="empty">pick some cards →</span>
            {:else if style === "stack"}
              <div class="stack">
                {#each heroes as seq, i (seq.id)}
                  <div class="stack-card" style:--i={i} style:z-index={i}>
                    <SequencePeek sequence={seq} width={132} height={185} />
                  </div>
                {/each}
              </div>
            {:else}
              <div class="fan" class:small={style === "smallfan"}>
                {#each heroes as seq, i (seq.id)}
                  <div class="fan-slot">
                    <SequencePeek
                      sequence={seq}
                      width={style === "smallfan" ? 96 : 128}
                      height={style === "smallfan" ? 135 : 180}
                      tilt={tilt(i, heroes.length)}
                    />
                  </div>
                {/each}
              </div>
            {/if}
          </div>
          <div class="tile-info">
            <span class="tile-name">{deck.label} LOOP Deck</span>
            <span class="tile-price">$25</span>
          </div>
        </div>

        <!-- Candidate pool: click to keep/drop. Kept cards ring accent. -->
        <div class="pool">
          <div class="pool-head">
            <span>{deck.label} — candidates</span>
            <span class="kept">{(selected[deckId] ?? []).length} kept</span>
          </div>
          <div class="pool-grid">
            {#each deck.sequences as seq, i (seq.id)}
              <button
                class="cand"
                class:sel={isSel(deckId, seq.id)}
                type="button"
                onclick={() => toggle(deckId, seq.id)}
                title={seq.word}
              >
                <SequencePeek sequence={seq} width={120} height={168} />
                <span class="cand-badge">{i + 1}</span>
                {#if isSel(deckId, seq.id)}
                  <span class="cand-check"><i class="fas fa-check"></i></span>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      </section>
    {/each}
  </div>

  <footer class="export">
    <div class="export-head">
      <span>Selection (paste back to me)</span>
      <button onclick={copyJson}>{copied ? "Copied!" : "Copy JSON"}</button>
    </div>
    <textarea readonly rows="8">{exportJson}</textarea>
  </footer>
</div>

<style>
  .page {
    min-height: 100vh;
    padding: 24px clamp(16px, 3vw, 48px) 80px;
    background:
      radial-gradient(120% 80% at 78% 12%, rgba(70, 60, 140, 0.35) 0%, transparent 55%),
      radial-gradient(130% 100% at 50% -10%, #181b3d 0%, #0c0e20 48%, #06070f 100%);
    color: #e8edf6;
    font-family: system-ui, sans-serif;
  }
  .top {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 28px;
  }
  .top h1 {
    margin: 0 0 4px;
    font-size: 1.5rem;
  }
  .top p {
    margin: 0;
    color: #9aa6b8;
    font-size: 0.9rem;
  }
  .style-switch {
    display: flex;
    gap: 6px;
    background: rgba(255, 255, 255, 0.04);
    padding: 4px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  .style-switch button {
    padding: 8px 14px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #9aa6b8;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .style-switch button.on {
    background: #6366f1;
    color: #fff;
  }

  .decks {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
    gap: 32px;
  }
  .deck {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Product tile as it would ship. */
  .tile {
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    padding: 12px;
    overflow: hidden;
  }
  .cover {
    display: grid;
    place-items: center;
    min-height: 220px;
    border-radius: 12px;
    background: radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.01));
    overflow: hidden;
  }
  .tile.landscape .cover {
    min-height: 200px;
  }
  .empty {
    color: #6b7688;
    font-size: 0.85rem;
  }
  .tile-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 6px 4px;
  }
  .tile-name {
    font-weight: 700;
  }
  .tile-price {
    font-weight: 800;
    color: #8ab4ff;
  }

  /* Fan: overlapping tilted cards; the group spreads and each lifts on hover. */
  .fan {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    padding: 20px 0;
  }
  .fan-slot {
    transition: margin 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s ease;
  }
  .fan-slot + .fan-slot {
    margin-left: -64px;
  }
  .fan.small .fan-slot + .fan-slot {
    margin-left: -52px;
  }
  .fan:hover .fan-slot + .fan-slot {
    margin-left: -24px;
  }
  .fan-slot:hover {
    transform: translateY(-14px) scale(1.04);
    z-index: 9;
    position: relative;
  }

  /* Stack: a pile with a small per-card offset — reads as a physical deck. */
  .stack {
    position: relative;
    width: 200px;
    height: 210px;
  }
  .stack-card {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%) translate(calc(var(--i) * 7px), calc(var(--i) * -5px))
      rotate(calc(var(--i) * 2.2deg));
    transition: transform 0.25s ease;
  }
  .stack:hover .stack-card {
    transform: translate(-50%, -50%) translate(calc(var(--i) * 20px), calc(var(--i) * -5px))
      rotate(calc(var(--i) * 3deg));
  }

  /* Candidate pool. */
  .pool-head {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: #9aa6b8;
    margin-bottom: 8px;
  }
  .kept {
    font-variant-numeric: tabular-nums;
  }
  .pool-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
    gap: 8px;
  }
  .cand {
    position: relative;
    padding: 3px;
    border-radius: 10px;
    border: 2px solid transparent;
    background: rgba(255, 255, 255, 0.03);
    cursor: pointer;
    display: flex;
    justify-content: center;
  }
  .cand.sel {
    border-color: #6366f1;
    background: rgba(99, 102, 241, 0.15);
  }
  .cand-badge {
    position: absolute;
    top: 4px;
    left: 4px;
    font-size: 0.7rem;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    border-radius: 6px;
    padding: 1px 5px;
    font-variant-numeric: tabular-nums;
  }
  .cand-check {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    background: #6366f1;
    color: #fff;
    border-radius: 50%;
    font-size: 0.7rem;
  }

  .export {
    margin-top: 40px;
    padding: 16px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
  }
  .export-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 0.85rem;
    color: #9aa6b8;
  }
  .export-head button {
    padding: 6px 14px;
    border-radius: 8px;
    border: none;
    background: #6366f1;
    color: #fff;
    cursor: pointer;
    font-weight: 600;
  }
  .export textarea {
    width: 100%;
    background: #06070f;
    color: #9aa6b8;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 10px;
    font-family: ui-monospace, monospace;
    font-size: 0.8rem;
    resize: vertical;
  }
</style>
