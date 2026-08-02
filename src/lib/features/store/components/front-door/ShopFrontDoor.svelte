<!-- src/lib/features/store/components/front-door/ShopFrontDoor.svelte -->
<!--
  /shop — the catalog front door.

  It replaced a locked "Coming soon" panel that everyone except an admin saw.
  The shop can't take money yet, so the page is honest about that in two places
  (every tile's status chip and the band near the bottom) and shows the whole
  line to everyone in between.

  Top to bottom: the hero teaches what a card does, the shelf filter narrows the
  grid, the grid is the catalog, then the two exits — leave an email, or go use
  the free Composer.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import type { Product } from "../../domain/models/product";
  import { SALES_LIVE } from "../../domain/purchase-state";
  import WaitlistForm from "../WaitlistForm.svelte";
  import ShopFrontDoorHero from "./ShopFrontDoorHero.svelte";
  import ShopShelfFilter from "./ShopShelfFilter.svelte";
  import ShopCatalogTile from "./ShopCatalogTile.svelte";
  import { deriveCatalogEntries } from "../../domain/catalog-listings";
  import { allCoverCards, heroCoverCard } from "./front-door-catalog";

  interface Props {
    /** Server-rendered catalog: everything a tile needs except the cover cards,
     *  which are too heavy to ship in the HTML. */
    products: readonly Product[];
  }

  let { products }: Props = $props();

  const CATALOG_ID = "catalog";

  // The full catalog, cover cards included, fetched once the page is up. Until
  // it lands the tiles show their text and prices from the server list and
  // their art boxes sit empty — reserved, so nothing moves when the art
  // arrives. A failed fetch simply leaves the server list in place.
  let fullProducts = $state<Product[] | null>(null);
  const catalog = $derived(fullProducts ?? products);

  onMount(async () => {
    try {
      const { getProductLoader } = await import("../../get-product-loader");
      fullProducts = await getProductLoader().loadActiveProducts();
    } catch (e) {
      console.error("[shop] catalog load failed:", e);
    }
  });

  const entries = $derived(deriveCatalogEntries(catalog));

  let shelf = $state("all");
  // A shelf can empty out between loads (a product goes draft). Fall back to
  // All rather than showing a filter that matches nothing.
  const shelves = $derived(new Set(entries.map((e) => e.shelf)));
  const activeShelf = $derived(shelf !== "all" && !shelves.has(shelf) ? "all" : shelf);
  const visible = $derived(
    activeShelf === "all" ? entries : entries.filter((e) => e.shelf === activeShelf)
  );

  // Column count is a decision, not whatever auto-fill emits. Three across is
  // the widest the tiles read well at; two when three would leave the last tile
  // alone on its own row.
  const wideColumns = $derived.by(() => {
    const n = visible.length;
    if (n <= 1) return 1;
    if (n % 3 !== 1) return 3;
    if (n % 2 !== 1) return 2;
    return 3;
  });
  const midColumns = $derived(Math.min(wideColumns, 2));

  const heroCard = $derived(heroCoverCard(catalog));
  const heroProduct = $derived(
    catalog.find((p) => p.coverCards?.some((c) => c === heroCard)) ?? null
  );

  // One worker seed for every fan on the page. Without it the print pipeline
  // composes cards with no arrow, prop, or glyph assets loaded and they come
  // out as bare grids.
  $effect(() => {
    if (!browser) return;
    const cards = allCoverCards(catalog);
    if (!cards.length) return;
    void import("../../services/cover-front-renderer")
      .then(({ prewarmCovers }) => prewarmCovers(cards))
      .catch((e) => console.error("[shop] cover prewarm failed:", e));
  });
</script>

<div class="front-door">
  <div class="band">
    <ShopFrontDoorHero card={heroCard} product={heroProduct} catalogId={CATALOG_ID} />
  </div>

  {#if entries.length > 0}
    <div class="band filter-band">
      <ShopShelfFilter
        {entries}
        value={activeShelf}
        onchange={(next) => (shelf = next)}
        controls={CATALOG_ID}
      />
    </div>
  {/if}

  <div class="band">
    <section
      class="catalog"
      id={CATALOG_ID}
      aria-label="Catalog"
      style:--cols-wide={wideColumns}
      style:--cols-mid={midColumns}
    >
      {#if entries.length === 0}
        <p class="empty">The catalog isn't loading right now. Try again in a moment.</p>
      {:else}
        <div class="grid" class:odd={visible.length % 2 === 1}>
          {#each visible as entry (entry.href)}
            <ShopCatalogTile {entry} />
          {/each}
        </div>
      {/if}
    </section>

    <section class="notify" aria-labelledby="shop-notify-title">
      <div class="notify-copy">
        <h2 id="shop-notify-title">
          {SALES_LIVE ? "New in the line" : "The shop isn't open yet"}
        </h2>
        <p>
          {SALES_LIVE
            ? "Leave an email and you'll hear when something new ships."
            : "Orders aren't running yet. Leave an email and you'll hear when they are."}
        </p>
      </div>
      <WaitlistForm source="shop-front-door" compact />
    </section>

    <section class="onward" aria-labelledby="shop-onward-title">
      <div>
        <h2 id="shop-onward-title">Not buying today?</h2>
        <p>
          Everything on the cards is free in the Composer. Build sequences, watch them
          move, share a link anyone can scan.
        </p>
      </div>
      <!-- Two ways out for a non-buyer: the tool, and the free reading path the
           retired explainer page used to point at. Both are buttons, not text
           links (clickables-look-like-buttons.md). -->
      <div class="onward-actions">
        <a class="onward-cta" href="/composer">
          Open the Composer
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
        </a>
        <a class="onward-cta secondary" href="/guide">Read the free guide</a>
      </div>
    </section>
  </div>
</div>

<style>
  .front-door {
    min-height: 100vh;
    /* px, not rem: this clears the fixed-height SiteHeader, which does not ramp. */
    padding-top: 64px;
    background: transparent; /* the cosmic background shows through */
    color: var(--theme-text, #ffffff);
  }

  /* The one content band every /shop route shares: floor 1720px, fluid, ceiling
     2600px. The header, the footer, and each product page line up with it. */
  .band {
    max-width: var(--shell-w, min(1720px, 92vw));
    margin: 0 auto;
    padding: 0 1.5rem;
    display: flex;
    flex-direction: column;
    gap: clamp(2.5rem, 4vw, 4.5rem);
  }

  /* The filter's own band carries no gap or vertical padding — it has to sit
     tight against the grid it drives. */
  .filter-band {
    gap: 0;
    position: relative;
    z-index: 20;
  }

  .catalog {
    /* Clears the sticky filter when the hero button jumps down here. */
    scroll-margin-top: 8.5rem;
    padding-top: clamp(1.5rem, 2.5vw, 2.5rem);
  }

  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: clamp(1rem, 1.8vw, 2rem);
  }

  @media (min-width: 48rem) {
    .grid {
      grid-template-columns: repeat(var(--cols-mid, 2), minmax(0, 1fr));
    }
  }

  /* Two columns and an odd number of items leaves the last one alone on its
     own row with a hole beside it. It takes the full row instead, so the grid
     ends on a deliberate wide card rather than an orphan. */
  @media (min-width: 48rem) and (max-width: 87.4375rem) {
    .grid.odd > :global(:last-child) {
      grid-column: 1 / -1;
    }
  }

  @media (min-width: 87.5rem) {
    .grid {
      grid-template-columns: repeat(var(--cols-wide, 3), minmax(0, 1fr));
    }
  }

  .empty {
    margin: 0;
    padding: 3rem 0;
    text-align: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.66));
  }

  /* Deliberately quiet: it's the fallback for people the shop can't sell to
     yet, not the point of the page. */
  .notify,
  .onward {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: clamp(1rem, 2vw, 2rem);
    padding: clamp(1.25rem, 2vw, 2rem);
    border-radius: 1.25rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .notify {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
  }

  .notify-copy {
    min-width: min(100%, 22rem);
    flex: 1 1 22rem;
  }

  .onward {
    background: linear-gradient(
      120deg,
      rgba(255, 122, 184, 0.08),
      rgba(126, 224, 255, 0.06)
    );
    border-color: var(--theme-border, rgba(255, 255, 255, 0.16));
    margin-bottom: clamp(3rem, 6vh, 6rem);
  }

  h2 {
    margin: 0 0 0.4rem;
    font-family: var(--page-title-font, "Fraunces", Georgia, serif);
    font-style: italic;
    font-weight: 700;
    font-variation-settings: "opsz" 144, "wght" 700, "SOFT" 0, "WONK" 1;
    font-size: clamp(1.35rem, 2vw, 2rem);
    letter-spacing: -0.015em;
  }

  p {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    line-height: 1.6;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.68));
    max-width: 52ch;
  }

  .onward-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .onward-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0 1.6rem;
    border-radius: 999px;
    border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.22));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.07));
    color: inherit;
    text-decoration: none;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    white-space: nowrap;
    transition: background 0.2s, border-color 0.2s;
  }
  .onward-cta:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.13));
    border-color: var(--theme-border-strong, rgba(255, 255, 255, 0.38));
  }
  .onward-cta:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  /* The second path is real, not the headline one: same shape, less weight. */
  .onward-cta.secondary {
    background: transparent;
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.78));
  }
  .onward-cta.secondary:hover {
    color: inherit;
  }

  @media (prefers-reduced-motion: reduce) {
    .onward-cta {
      transition: none;
    }
  }
</style>
