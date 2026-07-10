<!-- src/lib/features/store/components/CardAnatomy.svelte -->
<script lang="ts">
  /**
   * Annotated front + back of a real Choreo Card for the marketing page.
   * Front = baked print render (Firebase Storage URL from the admin cover
   * bake, instant load). Back = live CardBack render fed the same sequence,
   * so the anatomy can never drift from the real card design. Numbered
   * badges on each face key into the legend the page renders beside this.
   */
  import { onMount } from "svelte";
  import { loadActiveProducts } from "../services/product-loader";
  import type { CoverCard } from "../domain/models/product";
  import CardBack from "$lib/features/choreo-card/components/card-back/CardBack.svelte";

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

  // Badge anchor points, in % of the card face. Front positions follow the
  // print layout (title band, start cell, step grid, mandala column, QR).
  const frontBadges = [
    { n: 1, x: 50, y: 7 },
    { n: 2, x: 24, y: 22 },
    { n: 3, x: 72, y: 45 },
    { n: 4, x: 24, y: 48 },
    { n: 5, x: 24, y: 82 },
  ];
  // Back positions follow CardBack's four corners + center.
  const backBadges = [
    { n: 6, x: 14, y: 10 },
    { n: 7, x: 86, y: 10 },
    { n: 8, x: 50, y: 50 },
    { n: 9, x: 14, y: 88 },
    { n: 10, x: 86, y: 88 },
  ];
</script>

{#if card}
  <div class="anatomy">
    <figure class="face">
      <div class="card-box">
        <img src={card.imageUrl} alt="Front of a real Choreo Card" loading="lazy" />
        {#each frontBadges as b}
          <span class="badge" style="left: {b.x}%; top: {b.y}%">{b.n}</span>
        {/each}
      </div>
      <figcaption>Front</figcaption>
    </figure>

    <figure class="face">
      <div class="card-box back">
        <CardBack sequence={card.sequence} />
        {#each backBadges as b}
          <span class="badge" style="left: {b.x}%; top: {b.y}%">{b.n}</span>
        {/each}
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

  .badge {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: 700;
    color: #0b0b14;
    background: #fbbf24;
    border: 2px solid rgba(0, 0, 0, 0.35);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    pointer-events: none;
  }

  figcaption {
    font-size: 0.85rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: oklch(0.65 0.02 270);
  }
</style>
