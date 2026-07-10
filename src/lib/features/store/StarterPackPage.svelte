<!-- src/lib/features/store/StarterPackPage.svelte -->
<!--
  The Starter Pack: ONE bundle listing (product with listing === "starter-pack")
  — trilogy + curated mixed LOOP deck + the book + boxes + waterproof holder.
  Single SKU, no dials except the print-prop choice. The fan composes from the
  OTHER products' cover cards (a mixed hand: LOOP flavors + trilogy elements),
  so the pack needs no baked covers of its own.
-->
<script lang="ts">
  import { getMerchCheckoutCreator } from "$lib/features/store/get-merch-checkout-creator";
  import { getProductLoader } from "$lib/features/store/get-product-loader";
  import { createStoreState } from "./state/store-state.svelte";
  import { setStoreContext } from "./context/store-context";
  import DeckFanCover from "./components/DeckFanCover.svelte";
  import BuyButton from "./components/BuyButton.svelte";
  import PropPicker from "./components/PropPicker.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { prewarmCovers } from "./services/cover-front-renderer";
  import { DEFAULT_SHOP_PROP } from "./domain/shop-prop-options";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  // Named `store`, not `state`: a local binding called `state` collides with the
  // $state rune (svelte store_rune_conflict).
  const store = createStoreState(getProductLoader(), getMerchCheckoutCreator());
  setStoreContext({ state: store });
  store.loadProducts(false);

  const pack = $derived(
    store.products.find(
      (p) => p.listing === "starter-pack" && p.status === "active"
    ) ?? null
  );

  // Mixed hand, half LOOP flavors + half color-coded trilogy elements: the mix
  // is the message. No pack-specific bake needed.
  const fanCards = $derived.by(() => {
    const loops = store.products
      .filter((p) => p.listing === "loop-deck" && p.status === "active")
      .map((p) => p.coverCards?.[0])
      .filter((c): c is NonNullable<typeof c> => c != null);
    const tnd =
      store.products.find(
        (p) => p.listing === "tnd-trilogy" && p.status === "active"
      )?.coverCards ?? [];
    return [...loops.slice(0, 3), ...tnd.slice(0, 3)];
  });

  let propType = $state<PropType>(DEFAULT_SHOP_PROP);

  // ONE worker seed for the fan's covers at the picked prop (live fallback
  // only — baked covers load straight from Storage).
  $effect(() => {
    if (fanCards.length) prewarmCovers(fanCards, propType);
  });

  const price = $derived(pack ? `$${(pack.price / 100).toFixed(0)}` : "$65");
</script>

<div class="config-page">
  <main class="config-content">
    <a href="/shop" class="back-button">
      <i class="fas fa-arrow-left" aria-hidden="true"></i> Shop
    </a>

    {#if store.error}
      <div class="error">{store.error}</div>
    {:else if store.isLoading && !pack}
      <div class="loading">Loading the starter pack...</div>
    {:else if pack}
      <div class="config-layout">
        <!-- ============ preview column ============ -->
        <div class="preview-column">
          <div class="preview-box">
            <Crossfade key={propType}>
              <div class="preview-inner">
                <DeckFanCover
                  cards={fanCards}
                  deckName={pack.name}
                  {propType}
                  cardWidth={150}
                  maxCardWidth={280}
                  exactCount={Math.min(6, fanCards.length)}
                />
                <p class="preview-desc">{pack.description}</p>
              </div>
            </Crossfade>
          </div>
        </div>

        <!-- ============ choices column ============ -->
        <div class="info-column">
          <span class="eyebrow">Everything to start</span>
          <h1>{pack.name}</h1>
          <p class="meta">
            The whole system in one box: the teaching trilogy, a mixed LOOP
            deck, the book, and the gear to carry it.
          </p>

          {#if pack.boxContents?.length}
            <div class="field">
              <span class="field-label">What's in the box</span>
              <ul class="box-list">
                {#each pack.boxContents as item (item)}
                  <li>
                    <i class="fas fa-check" aria-hidden="true"></i>
                    {item}
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          <div class="field">
            <span class="field-label" id="prop-label">Prop</span>
            <PropPicker value={propType} onchange={(p) => (propType = p)} />
          </div>

          <p class="price">{price}</p>

          <BuyButton product={pack} {propType} />
          {#if store.checkoutError}
            <p class="checkout-error" role="alert">{store.checkoutError}</p>
          {/if}

          <ul class="assurance">
            <li><i class="fas fa-hand-holding-heart" aria-hidden="true"></i> Beta run: printed and cut by hand in Chicago, small batches</li>
          </ul>
        </div>
      </div>
    {:else}
      <div class="error">The starter pack isn't available right now.</div>
    {/if}
  </main>
</div>

<style>
  .config-page {
    min-height: 100vh;
    padding-top: 64px; /* clear the fixed SiteHeader */
    background: transparent; /* cosmic BackgroundHost shows through */
    color: var(--theme-text, #ffffff);
  }

  .config-content {
    /* Lean vertical padding so the page fits a 4K viewport unscrolled
       (matches the other configurators). */
    max-width: min(1720px, 92vw);
    margin: 0 auto;
    padding: 28px 24px 44px;
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 0 18px;
    margin-bottom: 24px;
    border-radius: 999px;
    border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.15));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
    text-decoration: none;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    transition: background 0.2s, border-color 0.2s;
  }
  .back-button:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-border-strong, rgba(255, 255, 255, 0.3));
  }

  .config-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    gap: clamp(28px, 4vw, 56px);
    align-items: start;
  }

  @media (max-width: 860px) {
    .config-layout {
      grid-template-columns: 1fr;
    }
  }

  /* Wide screens: stretch the preview stage to the info column's height and
     center the fan in it — no dead air under the preview box. */
  @media (min-width: 1400px) {
    .config-layout {
      align-items: stretch;
    }
    .preview-column {
      display: flex;
      flex-direction: column;
    }
    .preview-box {
      flex: 1;
      display: grid;
      align-content: center;
    }
  }

  /* ---------- preview ---------- */
  .preview-box {
    border-radius: 20px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: radial-gradient(
      circle at 50% 38%,
      rgba(255, 255, 255, 0.05),
      rgba(255, 255, 255, 0.015)
    );
    padding: clamp(16px, 2.5vw, 32px);
    /* Reserve for the prop swap (no-layout-shift), scaled down on phones. */
    min-height: clamp(320px, 34vw, 430px);
  }

  .preview-inner {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .preview-desc {
    font-size: var(--font-size-min, 14px);
    line-height: 1.65;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.75));
    margin: 0;
    text-align: center;
    max-width: 56ch;
    align-self: center;
  }

  /* ---------- info ---------- */
  .info-column {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .eyebrow {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #b8a6ff;
  }

  h1 {
    font-size: clamp(1.8rem, 3vw, 2.4rem);
    font-weight: 800;
    margin: 0;
    letter-spacing: -0.01em;
  }

  .meta {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .field-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .box-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 8px;
  }
  .box-list li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    font-size: var(--font-size-min, 14px);
  }
  .box-list i {
    color: #8b6cff;
    flex: 0 0 auto;
  }

  .price {
    font-size: 2rem;
    font-weight: 800;
    color: var(--theme-accent, #60a5fa);
    margin: 0;
    font-variant-numeric: tabular-nums;
  }

  .checkout-error {
    margin: 0;
    text-align: center;
    font-size: var(--font-size-sm, 14px);
    color: var(--semantic-error, #ef4444);
  }

  .assurance {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .assurance li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.66));
  }
  .assurance i {
    color: #8b6cff;
    flex: 0 0 auto;
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
    .back-button {
      transition: none;
    }
  }
</style>
