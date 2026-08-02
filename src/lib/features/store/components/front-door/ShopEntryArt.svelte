<!-- src/lib/features/store/components/front-door/ShopEntryArt.svelte -->
<!--
  The art inside a front-door art box: a fan of real printed card fronts, the
  printed guide's real cover, or the product's cover image.

  The fan and the book cover both pull in the print pipeline, which is browser
  work (canvas, workers, Firebase). /shop renders on the server for crawlers, so
  those two load through a browser-gated dynamic import and the server sends the
  text and the reserved box. The box is sized by the host, so art landing late
  moves nothing.
-->
<script lang="ts">
  import { browser } from "$app/environment";
  import type { CoverCard, Product } from "../../domain/models/product";

  interface Props {
    /** Real printed card fronts to fan. Empty falls through to the cover image. */
    cards: readonly CoverCard[];
    product: Product;
    /** QR attribution, same as the print path. */
    deckName: string;
    /** Minimum rest width of one card, px. */
    cardWidth?: number;
    maxCardWidth?: number;
    maxCards?: number;
    /** Show exactly this many cards regardless of width (1 = a single card). */
    exactCount?: number;
    /** How wide the printed guide's cover renders. Hosts whose art box is
     *  short and wide pass a height-aware value so the cover isn't cropped. */
    bookWidth?: string;
  }

  let {
    cards,
    product,
    deckName,
    cardWidth = 88,
    maxCardWidth = 150,
    maxCards = 5,
    exactCount,
    bookWidth = "clamp(6rem, 42%, 11rem)",
  }: Props = $props();
</script>

{#if cards.length && browser}
  {#await import("../DeckFanCover.svelte") then { default: DeckFanCover }}
    <DeckFanCover
      {cards}
      deckId={product.deckId}
      {deckName}
      {cardWidth}
      {maxCardWidth}
      {maxCards}
      {exactCount}
    />
  {/await}
{:else if product.type === "guide" && browser}
  {#await import("../BookCoverArt.svelte") then { default: BookCoverArt }}
    <BookCoverArt width={bookWidth} />
  {/await}
{:else if product.coverImageUrl}
  <img src={product.coverImageUrl} alt="" loading="lazy" />
{:else}
  <span class="mark" aria-hidden="true">
    <i class="fas fa-layer-group"></i>
  </span>
{/if}

<style>
  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .mark {
    font-size: 1.75rem;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.35));
  }
</style>
