<!-- src/lib/features/store/components/front-door/ShopFrontDoorHero.svelte -->
<!--
  The teaching hero. Someone landing here has probably never seen a card that
  does anything, so the first screen holds up one real card and says what
  happens when you point a phone at it — then hands off to the catalog.

  The card is a real printed front pulled from the catalog, not an illustration.
  When the baked cover exists it carries the card's real, scannable QR; when it
  doesn't, the card shows without one. There is no drawn-on QR.
-->
<script lang="ts">
  import type { CoverCard, Product } from "../../domain/models/product";
  import ShopEntryArt from "./ShopEntryArt.svelte";

  interface Props {
    /** The single card the hero holds up. Null while the catalog is empty. */
    card: CoverCard | null;
    /** The product that card belongs to (QR attribution + art fallbacks). */
    product: Product | null;
    /** Fragment id of the catalog the scroll button targets. */
    catalogId: string;
  }

  let { card, product, catalogId }: Props = $props();
</script>

<section class="hero">
  <!-- The launchpad's Choreo Cards tile morphs into this block. The name moved
       here when /shop/choreography-cards retired and the tile started pointing
       at the catalog; without a participant on this end the tile morph would
       degrade to a cut (tests/unit/landing-route-morph.test.ts holds the pair). -->
  <div class="copy" style:view-transition-name="launchpad-choreo-cards">
    <p class="kicker">The Kinetic Alphabet <span aria-hidden="true">·</span> Printed line</p>
    <h1>Every card is a <em>sequence.</em></h1>
    <p class="lede">Scan it and it moves.</p>
    <ol class="steps">
      <li><b>1</b><span>Draw a card. Eight counts of choreography, printed.</span></li>
      <li><b>2</b><span>Point your phone at the code in the corner.</span></li>
      <li><b>3</b><span>The sequence opens in the app and plays.</span></li>
    </ol>
    <a class="scroll-cta" href="#{catalogId}">
      See the catalog
      <i class="fas fa-arrow-down" aria-hidden="true"></i>
    </a>
  </div>

  <div class="card-stage">
    {#if card && product}
      <ShopEntryArt
        cards={[card]}
        {product}
        deckName={product.name}
        cardWidth={180}
        maxCardWidth={822}
        exactCount={1}
      />
    {/if}
  </div>
</section>

<style>
  .hero {
    /* Around 60% of the viewport: enough to hold the idea on its own, not so
       much that the catalog never appears. */
    min-height: 60svh;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: clamp(2rem, 4vw, 4.5rem);
    align-items: center;
    padding: clamp(2.5rem, 5vh, 5rem) 0 clamp(2rem, 4vh, 3.5rem);
  }

  @media (min-width: 48rem) {
    .hero {
      grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
    }
  }

  .copy {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: clamp(1rem, 1.6vw, 1.75rem);
    min-width: 0;
  }

  .kicker {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  h1 {
    margin: 0;
    font-family: var(--page-title-font, "Fraunces", Georgia, serif);
    font-style: italic;
    font-weight: 700;
    font-variation-settings: "opsz" 144, "wght" 700, "SOFT" 0, "WONK" 1;
    font-size: clamp(2.4rem, 5vw, 4.75rem);
    line-height: 1;
    letter-spacing: -0.02em;
    text-wrap: balance;
  }
  h1 em {
    color: #ff7ab8;
    font-style: italic;
  }

  .lede {
    margin: 0;
    font-size: clamp(1.05rem, 1.4vw, 1.6rem);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.78));
  }

  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.65rem;
  }
  .steps li {
    display: flex;
    gap: 0.8rem;
    align-items: baseline;
    font-size: var(--font-size-min, 14px);
    line-height: 1.55;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.66));
  }
  .steps b {
    font-family: var(--page-title-font, "Fraunces", Georgia, serif);
    font-style: italic;
    font-weight: 700;
    font-size: 1.15rem;
    color: #7ee0ff;
    min-width: 1.4ch;
  }

  .scroll-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0 1.6rem;
    border-radius: 999px;
    border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.2));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: inherit;
    text-decoration: none;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    transition: background 0.2s, border-color 0.2s;
  }
  .scroll-cta:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.12));
    border-color: var(--theme-border-strong, rgba(255, 255, 255, 0.35));
  }
  .scroll-cta:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  /* Reserved stage: the printed card resolves from Storage after first paint,
     and a fixed stage means the hero doesn't jump when it arrives. */
  .card-stage {
    /* The card sizes to this box, and the box is in rem so it grows with the
       root ramp on a big screen instead of sitting there at laptop size. The
       822px cap on the fan is the print render's own width — past that the
       image would be upscaled. */
    width: min(100%, 26rem);
    justify-self: center;
    min-height: clamp(18rem, 30vw, 34rem);
    display: grid;
    place-items: center;
    padding: clamp(1rem, 2vw, 2.5rem);
    background: radial-gradient(
      circle at 50% 45%,
      rgba(126, 224, 255, 0.16),
      rgba(126, 224, 255, 0) 68%
    );
    filter: drop-shadow(0 1.75rem 3.5rem rgba(0, 0, 0, 0.6));
  }

  @media (prefers-reduced-motion: reduce) {
    .scroll-cta {
      transition: none;
    }
  }
</style>
