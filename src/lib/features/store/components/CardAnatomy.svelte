<!-- src/lib/features/store/components/CardAnatomy.svelte -->
<script lang="ts">
  /**
   * Front + back of a real Choreo Card for the marketing page.
   * Front = baked print render (Firebase Storage URL from the admin cover
   * bake, instant load). Back = live CardBack render fed the same sequence,
   * so the anatomy can never drift from the real card design.
   *
   * No markers sit on the cards. The page's legend rows drive `highlight`;
   * the matching region gets a spotlight (everything else dims) so the
   * cards stay pristine until the reader asks about a part.
   */
  import { onMount } from "svelte";
  import { loadActiveProducts } from "../services/product-loader";
  import type { CoverCard } from "../domain/models/product";
  import CardBack from "$lib/features/choreo-card/components/card-back/CardBack.svelte";

  let {
    highlight = null,
    onhighlight,
  }: { highlight?: string | null; onhighlight?: (id: string | null) => void } = $props();

  // A pool of real baked cards across every active deck (varied words,
  // mandalas, LOOP types, difficulties). Shuffle swaps the shown card; the
  // anatomy still maps because front regions are % of the fixed print layout
  // and back regions are measured off the live CardBack DOM.
  let pool: CoverCard[] = $state([]);
  let index = $state(0);
  const card = $derived(pool[index] ?? null);

  onMount(async () => {
    try {
      const products = await loadActiveProducts();
      const all: CoverCard[] = [];
      for (const p of products) {
        for (const c of p.coverCards ?? []) {
          if (c.imageUrl && c.sequence) all.push(c);
        }
      }
      pool = all;
    } catch (error) {
      console.warn("[CardAnatomy] product load failed; keeping text-only anatomy", error);
    }
  });

  function shuffle() {
    if (pool.length < 2) return;
    let next = index;
    while (next === index) next = Math.floor(Math.random() * pool.length);
    index = next;
    onhighlight?.(null); // drop any active spotlight; it re-maps on next hover
  }

  // Front spotlight rects in % of the baked 822x1122 print render.
  const FRONT_REGIONS: Record<string, { x: number; y: number; w: number; h: number }> = {
    word: { x: 16, y: 6.7, w: 68, h: 7.6 },
    start: { x: 11, y: 14.5, w: 26, h: 19 },
    steps: { x: 37, y: 14.5, w: 52, h: 75 },
    mandalas: { x: 11, y: 33.5, w: 26, h: 37 },
    qr: { x: 12, y: 70.5, w: 24, h: 19 },
  };

  // Back regions are measured off the live CardBack DOM at hover time, so
  // they track the real element positions regardless of theme border width
  // or how many LOOP icons this card shows. Multiple matches union (loop-col).
  const BACK_SELECTORS: Record<string, string> = {
    turn: ".corner.top-left",
    reversal: ".corner.top-right",
    mandala: ".mandala-anchor",
    looptype: ".loop-col",
    difficulty: ".level-badge-slot > :first-child",
    startpos: ".corner.bottom-left",
    stepcount: ".corner.bottom-right",
  };

  const PAD = 1; // % breathing room around the measured element

  let backBox: HTMLElement | null = $state(null);

  function measureBack(id: string) {
    const sel = BACK_SELECTORS[id];
    if (!sel || !backBox) return null;
    const els = backBox.querySelectorAll(sel);
    if (els.length === 0) return null;
    const b = backBox.getBoundingClientRect();
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    }
    return {
      x: ((left - b.left) / b.width) * 100 - PAD,
      y: ((top - b.top) / b.height) * 100 - PAD,
      w: ((right - left) / b.width) * 100 + 2 * PAD,
      h: ((bottom - top) / b.height) * 100 + 2 * PAD,
    };
  }

  const activeRegion = $derived.by(() => {
    if (!highlight) return null;
    const front = FRONT_REGIONS[highlight];
    if (front) return { face: "front" as const, ...front };
    const rg = measureBack(highlight);
    return rg ? { face: "back" as const, ...rg } : null;
  });

  // Reverse direction: pointing at a card part highlights it (and the page's
  // legend row via onhighlight). Same rects the spotlight uses, so the hit
  // zones and the drawn regions can't disagree.
  const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
    x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

  function pointerPct(e: PointerEvent) {
    const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: ((e.clientX - b.left) / b.width) * 100, y: ((e.clientY - b.top) / b.height) * 100 };
  }

  function frontHit(e: PointerEvent) {
    const p = pointerPct(e);
    for (const [id, rg] of Object.entries(FRONT_REGIONS)) {
      if (inRect(p.x, p.y, rg)) return onhighlight?.(id);
    }
    onhighlight?.(null);
  }

  function backHit(e: PointerEvent) {
    const p = pointerPct(e);
    for (const id of Object.keys(BACK_SELECTORS)) {
      const rg = measureBack(id);
      if (rg && inRect(p.x, p.y, rg)) return onhighlight?.(id);
    }
    onhighlight?.(null);
  }
</script>

{#snippet spotlight(face: "front" | "back")}
  {#if activeRegion && activeRegion.face === face}
    <div
      class="region"
      style="left: {activeRegion.x}%; top: {activeRegion.y}%; width: {activeRegion.w}%; height: {activeRegion.h}%"
    ></div>
  {/if}
{/snippet}

{#if card}
  <div class="anatomy-stack">
    <div class="anatomy">
    <figure class="face" class:backgrounded={activeRegion && activeRegion.face !== "front"}>
      <!-- Hover affordance only; the legend buttons are the keyboard/AT path. -->
      <div
        class="card-box"
        role="presentation"
        class:dimmable={activeRegion?.face === "front"}
        onpointermove={frontHit}
        onpointerleave={() => onhighlight?.(null)}
      >
        <img src={card.imageUrl} alt="Front of a real Choreo Card" loading="lazy" />
        {@render spotlight("front")}
      </div>
      <figcaption>Front</figcaption>
    </figure>

    <figure class="face" class:backgrounded={activeRegion && activeRegion.face !== "back"}>
      <div
        class="card-box back"
        role="presentation"
        bind:this={backBox}
        class:dimmable={activeRegion?.face === "back"}
        onpointermove={backHit}
        onpointerleave={() => onhighlight?.(null)}
      >
        <CardBack sequence={card.sequence} />
        {@render spotlight("back")}
      </div>
      <figcaption>Back</figcaption>
    </figure>
    </div>

    {#if pool.length > 1}
      <div class="shuffle-bar">
        <button type="button" class="shuffle-btn" onclick={shuffle}>
          <i class="fas fa-shuffle" aria-hidden="true"></i>
          <span>Shuffle another card</span>
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .anatomy-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .anatomy {
    display: flex;
    gap: clamp(1rem, 3vw, 2.5rem);
    justify-content: center;
    flex-wrap: wrap;
    width: 100%;
  }

  .shuffle-bar {
    display: flex;
    justify-content: center;
  }

  .shuffle-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    min-height: 44px;
    padding: 0.65rem 1.4rem;
    font: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    color: oklch(0.93 0.01 270);
    background: oklch(0.28 0.03 275 / 0.5);
    border: 1px solid oklch(0.6 0.08 275 / 0.35);
    border-radius: 999px;
    cursor: pointer;
    transition:
      background 160ms ease,
      border-color 160ms ease,
      transform 160ms ease;
  }
  .shuffle-btn:hover,
  .shuffle-btn:focus-visible {
    background: oklch(0.34 0.05 275 / 0.6);
    border-color: oklch(0.68 0.12 275 / 0.6);
  }
  .shuffle-btn:active {
    transform: translateY(1px);
  }
  .shuffle-btn:focus-visible {
    outline: 2px solid oklch(0.7 0.1 275 / 0.7);
    outline-offset: 2px;
  }
  .shuffle-btn i {
    font-size: 0.9rem;
    color: oklch(0.78 0.13 275);
  }
  @media (prefers-reduced-motion: reduce) {
    .shuffle-btn {
      transition: none;
    }
  }

  .face {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    flex: 1 1 240px;
    transition: opacity 200ms ease;
  }

  /* When the focus is on the other face, this one steps back. */
  .face.backgrounded {
    opacity: 0.45;
  }

  .card-box {
    position: relative;
    width: 100%;
    max-width: 430px;
    aspect-ratio: 5 / 7;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
    /* Hover reveals info about the part under the cursor; clicking does
       nothing. `help` is the honest affordance (pointer would imply a
       navigation that never happens). */
    cursor: help;
  }

  .card-box img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  /* CardBack fills its parent and sizes with container query units. */
  .card-box.back {
    container-type: size;
  }

  /* Spotlight: the region outline plus a huge shadow that dims the rest of
     the card (clipped by the card's overflow:hidden). */
  .region {
    position: absolute;
    border-radius: 10px;
    outline: 1.5px solid oklch(0.95 0.01 270 / 0.9);
    box-shadow: 0 0 0 200vmax oklch(0.08 0.02 270 / 0.55);
    pointer-events: none;
    animation: region-in 180ms ease both;
  }

  @keyframes region-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .region {
      animation: none;
    }
    .face {
      transition: none;
    }
  }

  figcaption {
    font-size: 0.85rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: oklch(0.65 0.02 270);
  }
</style>
