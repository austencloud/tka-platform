<!-- src/lib/features/store/components/front-door/ShopFrontDoorHero.svelte -->
<!--
  The teaching hero. Someone landing here has probably never seen a card that
  does anything, so the first screen holds up one real card and says what
  happens when you point a phone at it — then hands off to the catalog.

  The card is a real printed front pulled from the catalog, not an illustration.
  When the baked cover exists it carries the card's real, scannable QR; when it
  doesn't, the card shows without one. There is no drawn-on QR.

  It is held up with its own back beside it (HeroCardDuo), and the back's mandala
  is drawn live rather than printed. That is the claim the page makes — scan it
  and it moves — shown instead of described. The hero deals from the whole
  catalog rather than holding one card, so a second look is a different card.
-->
<script lang="ts">
  import type { HeroCoverEntry } from "./front-door-catalog";
  import HeroCardDuo from "./HeroCardDuo.svelte";

  interface Props {
    /** Every card the hero can deal, best first. Empty until the catalog lands. */
    pool: readonly HeroCoverEntry[];
    /** Fragment id of the catalog the scroll button targets. */
    catalogId: string;
  }

  let { pool, catalogId }: Props = $props();
</script>

<section class="hero">
  <!-- The launchpad's Choreo Cards tile morphs into this block. The name moved
       here when /shop/choreography-cards retired and the tile started pointing
       at the catalog; without a participant on this end the tile morph would
       degrade to a cut (tests/unit/landing-route-morph.test.ts holds the pair). -->
  <div class="copy" style:view-transition-name="launchpad-choreo-cards">
    <p class="kicker"> <span aria-hidden="true"></span></p>
    <h1><em>Choreo Cards</em></h1>
    <p class="lede">The latest evolution of flow arts technology</p>
    <ol class="steps">
      <li><b>1</b><span>Draw a card, learn the sequence, and teach it to a friend.</span></li>
      <li><b>2</b><span>Scan the QR code to animate it and practice at your own pace.</span></li>
      <li><b>3</b><span>Expand your repertoire and share it with others</span></li>
    </ol>
    <a class="scroll-cta" href="#{catalogId}">
      See the catalog
      <i class="fas fa-arrow-down" aria-hidden="true"></i>
    </a>
  </div>

  <div class="card-stage">
    <HeroCardDuo {pool} />
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

  /* Two columns only once the pair of cards has room to be cards. Below this
     the duo takes the full band, which is wider than half of a tablet. */
  @media (min-width: 64rem) {
    .hero {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
    }
  }

  /* Wide but short (a folded Fold in landscape, a laptop in a small window).
     Stacked, the copy alone fills the screen and the cards never appear, which
     is the one thing this hero exists to show. Side by side they both fit. */
  @media (min-width: 48rem) and (max-height: 40rem) {
    .hero {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      min-height: 0;
      padding-block: 1.25rem;
      gap: 2rem;
    }
    /* The copy's own trims for this tier live at the foot of this stylesheet:
       the base .copy / h1 / .steps rules are declared BELOW these media blocks,
       so an override written here loses on source order. */
  }

  /* Big-screen tier (the site-wide 1680 seam). Two things go wrong up here if
     the base rules just scale: a 60svh floor on a 2160px-tall screen inflates
     the grid by ~300px past what the content needs, which strands the CTA in
     the middle of an empty band above the shelf filter; and the card, capped
     at laptop proportions, reads as a postcard on a wall. So the band is sized
     by its content and the card takes the room instead. */
  @media (min-width: 105rem) {
    .hero {
      min-height: 0;
      padding-block: clamp(2rem, 3.5vh, 4rem);
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
    /* Two even lines on a phone rather than "PRINTED" then an orphaned "LINE". */
    text-wrap: balance;
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

  /* Reserved stage: the printed front resolves from Storage after first paint
     and the back's player mounts a beat later, so the stage owns the height and
     neither arrival moves anything. `container-type` publishes its width to the
     duo, which sizes both cards from it. */
  .card-stage {
    width: 100%;
    justify-self: center;
    container-type: inline-size;
    display: grid;
    place-items: center;
    padding: clamp(0.5rem, 1.5vw, 1.5rem);
    /* The phone's entrance starts outside this box, so the stage is where it
       comes IN from. `clip` on one axis only: the pill and the card shadows
       hang below the scene and must stay visible, and clipping x is what stops
       the arriving phone from widening the document at 375. (`overflow-x: clip`
       is the one value that leaves `overflow-y: visible` alone; `hidden` would
       force the other axis to `auto` and give the page a scrollbar.) */
    overflow-x: clip;
    background: radial-gradient(
      circle at 50% 45%,
      rgba(126, 224, 255, 0.16),
      rgba(126, 224, 255, 0) 68%
    );
  }

  /* Wide but short, continued — the copy pays too. It shares the row with the
     card stage, so whichever column is taller sets the height and pushes the
     other one down. At 412px tall the display h1 alone was 96px of a 328px
     budget, and "See the catalog" landed below the fold. Three trims, no lost
     content: a smaller display size, a tighter column rhythm, closer steps.
     (This block sits after the base .copy / h1 / .steps rules on purpose.) */
  @media (min-width: 48rem) and (max-height: 40rem) {
    .copy {
      gap: 0.7rem;
    }
    h1 {
      font-size: clamp(1.9rem, 3.4vw, 2.6rem);
    }
    .steps {
      gap: 0.35rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .scroll-cta {
      transition: none;
    }
  }
</style>
