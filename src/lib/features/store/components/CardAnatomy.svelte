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

  let { highlight = null }: { highlight?: string | null } = $props();

  let card: CoverCard | null = $state(null);

  onMount(async () => {
    try {
      const products = await loadActiveProducts();
      for (const p of products) {
        const baked = (p.coverCards ?? []).find((c) => c.imageUrl && c.sequence);
        if (baked) {
          card = baked;
          break;
        }
      }
    } catch (error) {
      console.warn("[CardAnatomy] product load failed; keeping text-only anatomy", error);
    }
  });

  // Spotlight rects in % of each card face. Front measured against the baked
  // 822x1122 print render. Back computed from CardBack.svelte's cqi layout
  // (card = 100 x 140 cqi, 2cqi border padding): corner glyph boxes are
  // 10x6cqi at 3.2cqi insets, mandala anchor is 72cqi centered in the content
  // inset, loop row bottoms at 28cqi, level badge at 18cqi, start pictograph
  // is 12x12cqi, step-count numeral is 9cqi type.
  const REGIONS: Record<string, { face: "front" | "back"; x: number; y: number; w: number; h: number }> = {
    word: { face: "front", x: 16, y: 6.7, w: 68, h: 7.6 },
    start: { face: "front", x: 11, y: 14.5, w: 26, h: 19 },
    steps: { face: "front", x: 37, y: 14.5, w: 52, h: 75 },
    mandalas: { face: "front", x: 11, y: 33.5, w: 26, h: 37 },
    qr: { face: "front", x: 12, y: 70.5, w: 24, h: 19 },
    turn: { face: "back", x: 4.2, y: 3, w: 12, h: 5.7 },
    reversal: { face: "back", x: 83.8, y: 3, w: 12, h: 5.7 },
    mandala: { face: "back", x: 16, y: 19, w: 68, h: 47.5 },
    looptype: { face: "back", x: 34, y: 69.5, w: 32, h: 9.5 },
    difficulty: { face: "back", x: 44, y: 80, w: 12, h: 6.6 },
    startpos: { face: "back", x: 4, y: 87.6, w: 14.5, h: 10 },
    stepcount: { face: "back", x: 86.5, y: 90, w: 10, h: 8 },
  };

  const activeRegion = $derived(highlight ? (REGIONS[highlight] ?? null) : null);
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
  <div class="anatomy">
    <figure class="face">
      <div class="card-box" class:dimmable={activeRegion?.face === "front"}>
        <img src={card.imageUrl} alt="Front of a real Choreo Card" loading="lazy" />
        {@render spotlight("front")}
      </div>
      <figcaption>Front</figcaption>
    </figure>

    <figure class="face">
      <div class="card-box back" class:dimmable={activeRegion?.face === "back"}>
        <CardBack sequence={card.sequence} />
        {@render spotlight("back")}
      </div>
      <figcaption>Back</figcaption>
    </figure>
  </div>
{/if}

<style>
  .anatomy {
    display: flex;
    gap: clamp(1rem, 3vw, 2.5rem);
    justify-content: center;
    flex-wrap: wrap;
  }

  .face {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    flex: 0 1 300px;
  }

  .card-box {
    position: relative;
    width: 100%;
    max-width: 320px;
    aspect-ratio: 5 / 7;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
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
  }

  figcaption {
    font-size: 0.85rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: oklch(0.65 0.02 270);
  }
</style>
