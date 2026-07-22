<!-- src/lib/features/store/StarterPackPage.svelte -->
<!--
  The Starter Pack: ONE bundle listing (product with listing === "starter-pack")
  — trilogy + curated mixed LOOP deck + the book + boxes + waterproof holder.
  Single SKU, no dials except the print-prop choice. The fan composes from the
  OTHER products' cover cards (a mixed hand: LOOP flavors + trilogy elements),
  so the pack needs no baked covers of its own.
-->
<script lang="ts">
  import "./styles/config-page.css";
  import * as singleBuyCheckoutCreator from "$lib/features/store/services/single-buy-checkout-creator";
  import { getProductLoader } from "$lib/features/store/get-product-loader";
  import { createStoreState } from "./state/store-state.svelte";
  import { setStoreContext } from "./context/store-context";
  import DeckFanCover from "./components/DeckFanCover.svelte";
  import BookCoverArt from "./components/BookCoverArt.svelte";
  import SleeveArt from "./components/SleeveArt.svelte";
  import BuyButton from "./components/BuyButton.svelte";
  import PropPicker from "./components/PropPicker.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { prewarmCovers } from "./services/cover-front-renderer";
  import { formatUsd } from "./domain/preorder-pricing";
  import { DEFAULT_SHOP_PROP } from "./domain/shop-prop-options";
  import { trackPropSelected } from "./analytics/shop-funnel";
  import { trackViewOnceLoaded } from "./analytics/shop-funnel-view.svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  // Named `store`, not `state`: a local binding called `state` collides with the
  // $state rune (svelte store_rune_conflict).
  const store = createStoreState(getProductLoader(), singleBuyCheckoutCreator);
  setStoreContext({ state: store });
  store.loadProducts(false);

  const pack = $derived(
    store.products.find(
      (p) => p.listing === "starter-pack" && p.status === "active"
    ) ?? null
  );

  // Cover pools: one card per LOOP flavor, and the trilogy's six element cards.
  // No pack-specific bake needed — everything reuses the other listings' covers.
  const loopCards = $derived(
    store.products
      .filter((p) => p.listing === "loop-deck" && p.status === "active")
      .map((p) => p.coverCards?.[0])
      .filter((c): c is NonNullable<typeof c> => c != null)
  );
  const tndCards = $derived(
    store.products.find(
      (p) => p.listing === "tnd-trilogy" && p.status === "active"
    )?.coverCards ?? []
  );
  // The pile slide's mixed hand: half LOOP, half color-coded trilogy.
  const fanCards = $derived([...loopCards.slice(0, 3), ...tndCards.slice(0, 3)]);

  // Gallery: show each thing in the box, plus the whole pile together.
  type Slide = "pile" | "loop" | "tnd" | "guide" | "holder";
  let slide = $state<Slide>("pile");
  const slideOptions: { value: Slide; label: string }[] = [
    { value: "pile", label: "The lot" },
    { value: "loop", label: "LOOP deck" },
    { value: "tnd", label: "Trilogy" },
    { value: "guide", label: "The book" },
    { value: "holder", label: "Holder" },
  ];

  let propType = $state<PropType>(DEFAULT_SHOP_PROP);

  // Funnel step 1, once the bundle SKU resolves so price/preorder are real.
  trackViewOnceLoaded("starter-pack", () => store.isLoading, () => pack);

  // ONE worker seed for every fan's covers at the picked prop (live fallback
  // only — baked covers load straight from Storage).
  $effect(() => {
    const all = [...loopCards, ...tndCards];
    if (all.length) prewarmCovers(all, propType);
  });

  const price = $derived(pack ? formatUsd(pack.price) : "$65");
</script>

<div class="config-page store-config-page">
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
            <!-- fill mode: the stage is the sized box; layers stack absolutely
                 inside it, so slide swaps can NEVER resize the stage or shove
                 the picker/description below (crossfade-primitive routing). -->
            <Crossfade key={`${slide}|${propType}`} fill>
              <div class="preview-inner">
                {#if slide === "pile"}
                  <!-- Everything together: mixed fan with the book + holder
                       stand-ins tucked beside it. -->
                  <div class="pile">
                    <div class="pile-fan">
                      <DeckFanCover
                        cards={fanCards}
                        deckName={pack.name}
                        {propType}
                        cardWidth={140}
                        maxCardWidth={250}
                        exactCount={Math.min(6, fanCards.length)}
                      />
                    </div>
                    <div class="pile-side">
                      <BookCoverArt width="clamp(96px, 7vw, 140px)" />
                      <SleeveArt width="clamp(90px, 6.5vw, 130px)" />
                    </div>
                  </div>
                {:else if slide === "loop"}
                  <DeckFanCover
                    cards={loopCards}
                    deckName="LOOP Deck"
                    {propType}
                    cardWidth={150}
                    maxCardWidth={280}
                    exactCount={Math.min(6, loopCards.length)}
                  />
                {:else if slide === "tnd"}
                  <!-- The full six-element rainbow. -->
                  <DeckFanCover
                    cards={tndCards}
                    deckName="Timing & Direction"
                    {propType}
                    cardWidth={150}
                    maxCardWidth={280}
                    exactCount={Math.min(6, tndCards.length)}
                  />
                {:else if slide === "guide"}
                  <div class="solo-art">
                    <BookCoverArt width="clamp(180px, 15vw, 250px)" />
                  </div>
                {:else}
                  <div class="solo-art">
                    <SleeveArt width="clamp(170px, 14vw, 230px)" />
                  </div>
                {/if}
              </div>
            </Crossfade>
          </div>

          <!-- Static, outside the crossfade: identical on every slide, so it
               never remounts and never moves. -->
          <p class="preview-desc">{pack.description}</p>

          <div class="slide-picker">
            <SegmentedControl
              options={slideOptions}
              value={slide}
              onchange={(s) => (slide = s)}
              color="accent"
              size="sm"
            />
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
            <PropPicker
              value={propType}
              onchange={(p) => {
                propType = p;
                trackPropSelected("starter-pack", pack?.id, p);
              }}
            />
          </div>

          <p class="price">{price}</p>

          <BuyButton listing="starter-pack" product={pack} {propType} />
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
  /* .config-page root chrome (min-height/padding-top/background/color) lives in
     the shared src/lib/features/store/styles/config-page.css, scoped under the
     .store-config-page marker class added to this root div above. */

  .config-content {
    /* Lean vertical padding so the page fits a 4K viewport unscrolled
       (matches the other configurators). */
    max-width: var(--shell-w, min(1720px, 92vw));
    margin: 0 auto;
    padding: 28px 24px 44px;
  }

  /* Shared .back-button properties live in config-page.css; margin-bottom and
     transition differ enough page-to-page (and interact with the
     prefers-reduced-motion override below) that they stay local everywhere. */
  .back-button {
    margin-bottom: 24px;
    transition: background 0.2s, border-color 0.2s;
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
      /* Stage grows to the info column's height; art centers via the layers. */
      flex: 1;
      height: auto;
      min-height: clamp(400px, 40vw, 480px);
    }
  }

  /* ---------- preview ---------- */
  /* border-radius/border/padding are byte-identical with
     LoopDeckConfiguratorPage + TnDTrilogyPage's .preview-box and live in
     config-page.css. */
  .preview-box {
    background: radial-gradient(
      circle at 50% 38%,
      rgba(255, 255, 255, 0.05),
      rgba(255, 255, 255, 0.015)
    );
    /* FIXED stage height: fill-mode crossfade layers stack absolutely inside,
       so no slide can resize the box (no-layout-shift by construction). */
    height: clamp(400px, 40vw, 480px);
  }

  /* Each layer fills the stage and centers its art vertically. Children
     STRETCH horizontally: the fan sizes its cards FROM its container width
     (bind:clientWidth), so a shrink-to-fit container (align-items: center)
     creates a measure→resize→measure oscillation. Width must flow downward. */
  .preview-inner {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: stretch;
  }

  .pile {
    width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: clamp(12px, 1.5vw, 24px);
    align-items: center;
  }
  .pile-fan {
    min-width: 0;
  }
  .pile-side {
    display: flex;
    flex-direction: column;
    gap: 18px;
    align-items: center;
  }
  @media (max-width: 640px) {
    .pile {
      grid-template-columns: 1fr;
    }
    .pile-side {
      flex-direction: row;
      justify-content: center;
    }
  }

  .solo-art {
    display: grid;
    place-items: center;
    padding: 12px 0;
  }

  .slide-picker {
    display: flex;
    justify-content: center;
    margin-top: 14px;
  }

  .preview-desc {
    font-size: var(--font-size-min, 14px);
    line-height: 1.65;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.75));
    margin: 14px auto 0;
    text-align: center;
    max-width: 56ch;
  }

  /* ---------- info ---------- */
  .info-column {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  /* Shared .eyebrow properties (font-weight/text-transform/color) live in
     config-page.css; font-size and letter-spacing vary per page. */
  .eyebrow {
    font-size: var(--font-size-compact, 12px);
    letter-spacing: 0.12em;
  }

  /* h1's font-size/font-weight/margin/letter-spacing are byte-identical with
     LoopDeckConfiguratorPage + TnDTrilogyPage and live in config-page.css. */

  .meta {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  /* .field/.field-label are byte-identical with TnDTrilogyPage and live in
     config-page.css. */

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

  /* .price, .checkout-error, .assurance (container + icon), and .loading/.error
     are byte-identical across all four configurator pages and live fully in
     config-page.css. .assurance li's font-size/color vary per page. */
  .assurance li {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.66));
  }

  @media (prefers-reduced-motion: reduce) {
    .back-button {
      transition: none;
    }
  }
</style>
