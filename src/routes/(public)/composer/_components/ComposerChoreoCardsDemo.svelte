<!--
  ComposerChoreoCardsDemo

  A fanned hand of REAL printed Choreo Card fronts, rendered through the same
  DeckFanCover print pipeline the /shop hero and configurators use — what the
  fan shows IS what prints and ships. Cards are sourced from the live product
  catalog (loadActiveProducts → one cover per LOOP flavor, a varied hand),
  matching StorePage.svelte's heroCards and the /shop/choreography-cards page.

  Mounted via LazyMount only when the Learn section nears the viewport, so the
  deal-in flourish lands on arrival and the prerendered HTML stays lean. Until
  the covers load, a rotated skeleton fan reserves the space (no layout shift).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import DeckFanCover from "$lib/features/store/components/DeckFanCover.svelte";
  import type { CoverCard } from "$lib/features/store/domain/models/product";

  let cards = $state<CoverCard[]>([]);
  let failed = $state(false);

  onMount(() => {
    const load = async () => {
      try {
        const { loadActiveProducts } = await import(
          "$lib/features/store/services/product-loader"
        );
        const products = await loadActiveProducts();
        // One cover per LOOP flavor — a varied hand, same selection as the
        // shop hero fan (StorePage.svelte heroCards).
        const hand = products
          .filter((p) => p.listing === "loop-deck" && p.status === "active")
          .map((p) => p.coverCards?.[0])
          .filter((c): c is CoverCard => c != null);
        if (hand.length) cards = hand;
        else failed = true;
      } catch (err) {
        console.error("[ComposerChoreoCardsDemo] card fan load failed:", err);
        failed = true;
      }
    };
    // The store catalog chunk is heavy; defer to idle so the Learn prose paints
    // first, then deal the fan in.
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => void load(), { timeout: 3000 });
    } else {
      setTimeout(() => void load(), 400);
    }
  });
</script>

<div class="cards-stage">
  {#if cards.length}
    <DeckFanCover {cards} deckName="TKA Shop" cardWidth={128} maxCardWidth={210} deal />
  {:else if failed}
    <p class="quiet-note">The decks are loading. Open the shop to see the full fan.</p>
  {:else}
    <div class="sk-fan" aria-hidden="true">
      {#each [0, 1, 2, 3, 4] as i (i)}
        <div class="sk-card" style:transform="rotate({-12 + 6 * i}deg)"></div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .cards-stage {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    min-height: 250px;
  }

  .quiet-note {
    align-self: center;
    text-align: center;
    font-style: italic;
    font-size: 0.85rem;
    color: oklch(0.6 0.02 270);
  }

  /* Rotated blank cards holding the fan's space until the covers land. */
  .sk-fan {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    padding: 18px 0 10px;
  }
  .sk-card {
    width: 118px;
    aspect-ratio: 5 / 7;
    border-radius: 6px;
    transform-origin: bottom center;
    background: linear-gradient(110deg, #ececf2 40%, #f8f8fc 50%, #ececf2 60%);
    background-size: 220% 100%;
    animation: sk-shimmer 1.4s linear infinite;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  }
  .sk-card + .sk-card {
    margin-left: -61px;
  }

  @keyframes sk-shimmer {
    from {
      background-position: 130% 0;
    }
    to {
      background-position: -90% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sk-card {
      animation: none;
    }
  }
</style>
