<!-- src/lib/features/store/StorePage.svelte -->
<script lang="ts">
  import { getMerchCheckoutCreator } from "$lib/features/store/get-merch-checkout-creator";
  import { getProductLoader } from "$lib/features/store/get-product-loader";
  import { createStoreState } from "./state/store-state.svelte";
  import { setStoreContext } from "./context/store-context";
  import ProductCard from "./components/ProductCard.svelte";
  import DeckFanCover from "./components/DeckFanCover.svelte";
  import LoopChips from "./components/LoopChips.svelte";
  import { prewarmCovers } from "./services/cover-front-renderer";
  import type { ProductType } from "./domain/models/product";

  // showDrafts: the admin "play with it" view loads every product including
  // drafts and sold-out. Public buyers get active-only.
  let { showDrafts = false }: { showDrafts?: boolean } = $props();

  const state = createStoreState(getProductLoader(), getMerchCheckoutCreator());

  setStoreContext({ state });

  // Prime synchronously (cache-first) so a back-navigation paints the grid on the
  // first frame — the view-transition reverse morph needs the target cards present
  // at the moment SvelteKit snapshots the new page. The first visit still fetches.
  state.loadProducts(showDrafts);

  // Backing SKUs of the configurable listings. Each family surfaces as ONE tile
  // (a configurator entry), never as a wall of near-identical products.
  const deckSkus = $derived(
    state.products.filter((p) => p.listing === "loop-deck" && p.status === "active")
  );
  const tndSkus = $derived(
    state.products.filter((p) => p.listing === "tnd-trilogy" && p.status === "active")
  );
  const deckPrice = $derived(
    deckSkus.length ? `$${(Math.min(...deckSkus.map((p) => p.price)) / 100).toFixed(0)}` : "$25"
  );
  const tndPrice = $derived(
    tndSkus.length ? `$${(Math.min(...tndSkus.map((p) => p.price)) / 100).toFixed(0)}` : "$30"
  );
  // Hero fan: the first cover of each LOOP flavor — a varied hand, one card per family.
  const heroCards = $derived(
    deckSkus
      .map((p) => p.coverCards?.[0])
      .filter((c): c is NonNullable<typeof c> => c != null)
  );
  const tileCards = $derived(deckSkus[0]?.coverCards ?? []);
  // TnD tile fan: one card per element family from the trilogy's first volume.
  const tndTileCards = $derived(tndSkus[0]?.coverCards ?? []);
  const allComponents = $derived([
    ...new Set(deckSkus.flatMap((p) => p.loopComponents ?? [])),
  ]);

  // ONE worker seed for the whole page's covers (union signature), so every fan
  // composes with arrow/prop/glyph assets present instead of bare grids.
  $effect(() => {
    const all = state.products.flatMap((p) => p.coverCards ?? []);
    if (all.length) prewarmCovers(all);
  });

  // Product type -> section for everything that is NOT part of a listing.
  const SECTIONS: { type: ProductType; label: string }[] = [
    { type: "physical-deck", label: "More Decks" },
    { type: "sampler-pack", label: "Sampler Packs" },
    { type: "guide", label: "Guides" },
    { type: "material", label: "Props & Materials" },
    { type: "digital", label: "Digital" },
  ];

  const groups = $derived(
    SECTIONS.map((s) => ({
      ...s,
      items: state.products.filter((p) => p.type === s.type && !p.listing),
    })).filter((g) => g.items.length > 0)
  );
</script>

<div class="store-page">
  <main class="store-content">
    <!-- ============ HERO: the product IS the art ============ -->
    <section class="hero">
      <div class="hero-fan" aria-hidden="true">
        {#if heroCards.length}
          <DeckFanCover cards={heroCards} deckName="TKA Shop" cardWidth={148} maxCardWidth={250} />
        {/if}
      </div>
      <h1>Choreography you can shuffle</h1>
      <p class="hero-subtitle">
        Real flow sequences, printed as playing cards. Every card holds a complete
        eight-count LOOP: read it, drill it, run it forever.
      </p>
      <a class="hero-cta" href="/shop/loop-deck">
        Build your deck <i class="fas fa-arrow-right" aria-hidden="true"></i>
      </a>
    </section>

    {#if state.error}
      <div class="error">{state.error}</div>
    {:else}
      <!-- ============ THE TWO DECK LINES ============ -->
      {#if deckSkus.length > 0 || tndSkus.length > 0}
        <section class="deck-listing" id="deck">
          {#if deckSkus.length > 0}
            <a class="deck-tile" href="/shop/loop-deck">
              <div class="deck-fan-box">
                <DeckFanCover
                  cards={tileCards}
                  deckId={deckSkus[0]?.deckId}
                  deckName="LOOP Deck"
                  cardWidth={132}
                  maxCardWidth={235}
                />
              </div>
              <div class="deck-info">
                <span class="eyebrow">The deck</span>
                <h2>LOOP Deck</h2>
                <p class="deck-meta">
                  {deckSkus.length} flavors · 54 cards each · poker size
                </p>
                <LoopChips components={allComponents} />
                <p class="deck-desc">
                  Pick a transformation family. Each deck is a curated 54-card slice
                  of it, every sequence ending exactly where it began.
                </p>
                <div class="deck-buy-row">
                  <span class="deck-price">{deckPrice}</span>
                  <span class="deck-cta">
                    Build your deck <i class="fas fa-arrow-right" aria-hidden="true"></i>
                  </span>
                </div>
              </div>
            </a>
          {/if}

          {#if tndSkus.length > 0}
            <a class="deck-tile" href="/shop/tnd-trilogy">
              <div class="deck-fan-box">
                <!-- Always all six element families in the fan. -->
                <DeckFanCover
                  cards={tndTileCards}
                  deckName="Timing & Direction"
                  cardWidth={110}
                  maxCardWidth={235}
                  exactCount={Math.min(6, tndTileCards.length)}
                />
              </div>
              <div class="deck-info">
                <span class="eyebrow">The trilogy</span>
                <h2>Timing &amp; Direction</h2>
                <p class="deck-meta">
                  {tndSkus.length} volumes · color-coded by element · poker size
                </p>
                <span class="element-swatches" aria-hidden="true">
                  {#each tndTileCards.slice(0, 6) as card (card.footerCenter ?? card.accentColor)}
                    {#if card.accentColor}
                      <span class="swatch" style:--c={card.accentColor}></span>
                    {/if}
                  {/each}
                </span>
                <p class="deck-desc">
                  The teaching line: base motions, then one-turn, then half-turn
                  variations. Every card wears its timing and direction family's
                  element color.
                </p>
                <div class="deck-buy-row">
                  <span class="deck-price">{tndPrice}</span>
                  <span class="deck-cta">
                    Pick a volume <i class="fas fa-arrow-right" aria-hidden="true"></i>
                  </span>
                </div>
              </div>
            </a>
          {/if}
        </section>
      {/if}

      <!-- ============ INFO BANDS ============
           Stacked strips on normal screens; on ultrawide they compose into ONE
           side-by-side band (how / box / story), so the width carries density
           instead of stretched one-line cards. -->
      <div class="info-bands">
      <section class="band">
        <h2 class="section-title">How it works</h2>
        <div class="steps-grid">
          <div class="step">
            <i class="fas fa-layer-group" aria-hidden="true"></i>
            <h3>Draw a card</h3>
            <p>Shuffle, draw, and you've got your next eight counts. 54 sequences per deck means practice never repeats itself.</p>
          </div>
          <div class="step">
            <i class="fas fa-book-open" aria-hidden="true"></i>
            <h3>Read the pattern</h3>
            <p>Each card is TKA notation: a grid, two colors, one path per hand. Learn to read it once and every card opens up.</p>
          </div>
          <div class="step">
            <i class="fas fa-play" aria-hidden="true"></i>
            <h3>Watch it move</h3>
            <p>The same decks live in the app's deck browser. Pull up any sequence and watch it animated before you drill it.</p>
          </div>
        </div>
      </section>

      <!-- ============ WHAT'S IN THE BOX ============ -->
      <section class="band">
        <h2 class="section-title">What's in the box</h2>
        <ul class="box-list">
          <li><i class="fas fa-clone" aria-hidden="true"></i> 54 sequence cards, poker size (2.5" × 3.5")</li>
          <li><i class="fas fa-circle-info" aria-hidden="true"></i> 1 explainer card: what this deck is and where it sits in the full system</li>
          <li><i class="fas fa-file-lines" aria-hidden="true"></i> Free laminated quick-reference sheet</li>
          <li><i class="fas fa-box-open" aria-hidden="true"></i> Foldable deck box</li>
        </ul>
      </section>

      <!-- ============ BETA RUN STORY ============ -->
      <section class="band story">
        <h2 class="section-title">First run, made by hand</h2>
        <div class="story-card">
          <i class="fas fa-scissors" aria-hidden="true"></i>
          <p>
            Every beta deck is printed, guillotine-cut, and packed in Chicago by the
            person who built the system. Small batches, shipped fast. When the beta
            run sells through, the finished edition goes to professional printing.
          </p>
        </div>
      </section>
      </div>

      <!-- ============ EVERYTHING ELSE ============ -->
      {#if state.isLoading}
        <div class="loading">Loading products...</div>
      {:else}
        {#each groups as group (group.type)}
          <section class="product-section">
            <h2 class="section-title">{group.label}</h2>
            <div class="product-grid">
              {#each group.items as product, i (product.id)}
                <ProductCard {product} index={i} />
              {/each}
            </div>
          </section>
        {/each}
      {/if}
    {/if}
  </main>
</div>

<style>
  .store-page {
    min-height: 100vh;
    padding-top: 64px; /* clear the fixed SiteHeader */
    /* Transparent so the /shop cosmic BackgroundHost shows through. */
    background: transparent;
    color: var(--theme-text, #ffffff);
  }

  .store-content {
    /* Fill big screens intelligently: a wide fluid band (up to 2400px) instead of
       a 1200px column that miniaturized the grid on 4K. */
    max-width: min(2400px, 94vw);
    margin: 0 auto;
    padding: 40px clamp(24px, 4vw, 64px) 80px;
  }

  /* ---------- hero ---------- */
  .hero {
    text-align: center;
    margin-bottom: 72px;
  }

  /* Reserved box: the fan streams in without shoving the headline (no-layout-shift).
     Scales with the viewport so the auto-scaled fan has room on 4K. */
  .hero-fan {
    min-height: clamp(250px, 15.5vw, 410px);
    display: grid;
    place-items: center;
    margin-bottom: 8px;
  }

  .hero h1 {
    font-size: clamp(2.2rem, 3.2vw, 4.2rem);
    font-weight: 800;
    letter-spacing: -0.02em;
    margin: 0 0 14px;
  }

  .hero-subtitle {
    font-size: clamp(1rem, 1.2vw, 1.35rem);
    line-height: 1.6;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.66));
    max-width: 68ch;
    margin: 0 auto 26px;
  }

  .hero-cta {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: var(--min-touch-target, 44px);
    padding: 14px 30px;
    border-radius: 999px;
    background: linear-gradient(135deg, #6f8cff, #8b6cff);
    color: #fff;
    font-size: var(--font-size-md, 1rem);
    font-weight: 700;
    text-decoration: none;
    transition: filter 0.18s ease, transform 0.18s ease;
  }
  .hero-cta:hover {
    filter: brightness(1.08);
    transform: translateY(-2px);
  }

  /* ---------- the deck-line listings ---------- */
  .deck-listing {
    margin-bottom: 72px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 28px;
  }

  /* Two lines sit side by side once there's room for both. */
  @media (min-width: 1500px) {
    .deck-listing {
      grid-template-columns: repeat(auto-fit, minmax(680px, 1fr));
    }
  }

  .element-swatches {
    display: inline-flex;
    gap: 6px;
  }
  .swatch {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--c);
    border: 1px solid rgba(255, 255, 255, 0.35);
  }

  .deck-tile {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: clamp(20px, 3vw, 48px);
    align-items: center;
    padding: clamp(20px, 3vw, 40px);
    border-radius: 24px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: inherit;
    text-decoration: none;
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s;
  }
  .deck-tile:hover {
    transform: translateY(-4px);
    border-color: var(--theme-border-strong, rgba(255, 255, 255, 0.3));
  }

  .deck-fan-box {
    min-height: clamp(240px, 15vw, 420px);
    display: grid;
    place-items: center;
    border-radius: 16px;
    background: radial-gradient(
      circle at 50% 42%,
      rgba(255, 255, 255, 0.05),
      rgba(255, 255, 255, 0.015)
    );
  }

  .deck-info {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  .eyebrow {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #b8a6ff;
  }

  .deck-info h2 {
    font-size: clamp(1.6rem, 2.4vw, 2.2rem);
    font-weight: 800;
    margin: 0;
  }

  .deck-meta {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  .deck-desc {
    font-size: var(--font-size-min, 14px);
    line-height: 1.6;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.75));
    margin: 0;
    max-width: 46ch;
  }

  .deck-buy-row {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-top: 6px;
  }

  .deck-price {
    font-size: 1.8rem;
    font-weight: 800;
    color: var(--theme-accent, #60a5fa);
    font-variant-numeric: tabular-nums;
  }

  .deck-cta {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 10px 22px;
    border-radius: 999px;
    background: linear-gradient(135deg, #6f8cff, #8b6cff);
    color: #fff;
    font-weight: 700;
    font-size: var(--font-size-min, 14px);
  }

  @media (max-width: 820px) {
    .deck-tile {
      grid-template-columns: 1fr;
    }
  }

  /* ---------- bands ---------- */
  .band {
    margin-bottom: 72px;
  }

  .section-title {
    font-size: var(--font-size-lg, 18px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    margin: 0 0 20px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .steps-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 24px;
  }

  .step {
    padding: 24px;
    border-radius: 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
  }
  .step i {
    font-size: 1.4rem;
    color: #8b6cff;
  }
  .step h3 {
    font-size: var(--font-size-md, 1rem);
    font-weight: 700;
    margin: 12px 0 8px;
  }
  .step p {
    font-size: var(--font-size-min, 14px);
    line-height: 1.6;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.66));
    margin: 0;
  }

  .box-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 14px;
  }
  .box-list li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 18px;
    border-radius: 14px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    font-size: var(--font-size-min, 14px);
  }
  .box-list i {
    color: #8b6cff;
    flex: 0 0 auto;
  }

  .story-card {
    padding: 24px;
    border-radius: 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    max-width: 78ch;
  }
  .story-card i {
    font-size: 1.4rem;
    color: #8b6cff;
    margin-bottom: 12px;
    display: block;
  }
  .story-card p {
    font-size: var(--font-size-min, 14px);
    line-height: 1.7;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.75));
    margin: 0;
  }

  /* ---------- ultrawide composition (4K+) ----------
     Don't stretch the strips: recompose them. The three info bands sit
     side-by-side as columns, each internally stacked, so a 4K viewport shows
     one dense band instead of three sparse full-width ones. */
  @media (min-width: 1800px) {
    .info-bands {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 28px;
      align-items: start;
      margin-bottom: 72px;
    }
    .info-bands .band {
      margin-bottom: 0;
    }
    .info-bands .steps-grid {
      grid-template-columns: 1fr;
      gap: 14px;
    }
    .info-bands .box-list {
      grid-template-columns: 1fr;
    }
    .info-bands .story-card {
      max-width: none;
    }
  }

  /* ---------- remaining sections ---------- */
  .product-section {
    margin-bottom: 56px;
  }

  .product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 28px;
  }

  .loading, .error {
    text-align: center;
    padding: 48px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .error {
    color: var(--semantic-error, #ef4444);
  }

  @media (prefers-reduced-motion: reduce) {
    .hero-cta,
    .deck-tile {
      transition: none;
    }
    .hero-cta:hover,
    .deck-tile:hover {
      transform: none;
    }
  }
</style>
