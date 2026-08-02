<!-- src/lib/features/store/components/front-door/ShopCatalogTile.svelte -->
<!--
  One item on the shelf. Every tile in the grid is built from this, so the five
  products read as one line instead of five layouts: same art box, same kicker,
  same two lines of description, same price row.

  The status chip and the button wording come from the shared purchase-state
  resolver, so a tile can never promise a checkout the shop can't take.
-->
<script lang="ts">
  import type { CatalogEntry } from "../../domain/catalog-listings";
  import type { CoverCard } from "../../domain/models/product";
  import { formatUsd } from "../../domain/preorder-pricing";
  import { resolvePurchaseState, SALES_LIVE } from "../../domain/purchase-state";
  import ShopEntryArt from "./ShopEntryArt.svelte";

  interface Props {
    entry: CatalogEntry;
    /** Real card fronts for this entry's art box. */
    artCards: readonly CoverCard[];
  }

  let { entry, artCards }: Props = $props();

  const state = $derived(resolvePurchaseState(entry.product, SALES_LIVE));

  // What the shopper can do with this today, said plainly.
  const statusLabel = $derived(
    state === "buy" ? "In stock" : state === "preorder" ? "Pre-order" : "Not on sale yet"
  );
  const ctaLabel = $derived(
    state === "preorder" ? "Pre-order" : state === "buy" ? "View" : "See details"
  );
</script>

<a class="tile" href={entry.href}>
  <div class="art">
    <ShopEntryArt
      cards={artCards}
      product={entry.product}
      deckName={entry.name}
      bookWidth="min(42cqi, 70cqh)"
    />
  </div>
  <span class="shelf">{entry.shelf}</span>
  <h3>{entry.name}</h3>
  <p class="blurb">{entry.blurb}</p>
  <div class="foot">
    <span class="price">
      {#if entry.priceIsFrom}<span class="from">from</span>{/if}{formatUsd(entry.priceCents)}
    </span>
    <span class="status" class:live={state !== "notify"}>{statusLabel}</span>
    <span class="cta">
      {ctaLabel}
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </span>
  </div>
</a>

<style>
  .tile {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: clamp(1rem, 1.4vw, 1.6rem);
    border-radius: 1.25rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: inherit;
    text-decoration: none;
    transition:
      transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
      border-color 0.2s;
  }
  .tile:hover {
    transform: translateY(-0.25rem);
    border-color: var(--theme-border-strong, rgba(255, 255, 255, 0.3));
  }
  .tile:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  /* Fixed art box. Fans and book covers resolve after the page paints, and a
     reserved height means the row of tiles never re-flows when they land. */
  .art {
    height: clamp(11rem, 15vw, 18rem);
    /* A size container so the book cover can be measured against the box's
       HEIGHT — a wide, short art box cropped it when it only knew the width. */
    container-type: size;
    display: grid;
    place-items: center;
    border-radius: 1rem;
    overflow: hidden;
    background: radial-gradient(
      circle at 50% 42%,
      rgba(255, 255, 255, 0.055),
      rgba(255, 255, 255, 0.015)
    );
  }

  .shelf {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #b8a6ff;
  }

  h3 {
    margin: 0;
    font-family: var(--page-title-font, "Fraunces", Georgia, serif);
    font-style: italic;
    font-weight: 700;
    font-variation-settings: "opsz" 144, "wght" 700, "SOFT" 0, "WONK" 1;
    font-size: clamp(1.25rem, 1.5vw, 1.75rem);
    line-height: 1.1;
    letter-spacing: -0.015em;
  }

  .blurb {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    line-height: 1.55;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.66));
    /* Two lines, always: descriptions run from one line to five, and an
       unclamped one makes its tile taller than the tile beside it. */
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    min-height: 3.1em;
  }

  .foot {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
    margin-top: auto;
    padding-top: 0.75rem;
  }

  .price {
    font-size: clamp(1.15rem, 1.2vw, 1.45rem);
    font-weight: 800;
    color: var(--theme-accent, #60a5fa);
    /* Prices change between tiles and between shelves; fixed-width digits keep
       the row from twitching as they do. */
    font-variant-numeric: tabular-nums;
  }
  .from {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin-right: 0.35rem;
  }

  .status {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.35rem 0.6rem;
    border-radius: 999px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.66));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
  }
  .status.live {
    color: #7ee0ff;
    border-color: rgba(126, 224, 255, 0.4);
    background: rgba(126, 224, 255, 0.08);
  }

  /* Reads as the button it is, even though the whole tile is the link. */
  .cta {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0 1.1rem;
    border-radius: 999px;
    border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.18));
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    white-space: nowrap;
  }
  .tile:hover .cta {
    border-color: var(--theme-border-strong, rgba(255, 255, 255, 0.35));
  }

  /* Narrow tile: the price row runs out of width before the button does, so
     the button takes its own line instead of squeezing the price. */
  @container (max-width: 20rem) {
    .cta {
      margin-left: 0;
      width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tile,
    .tile:hover {
      transition: none;
      transform: none;
    }
  }
</style>
