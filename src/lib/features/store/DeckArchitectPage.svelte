<!-- src/lib/features/store/DeckArchitectPage.svelte -->
<!--
  The Deck Architect: the power-user wing of the LOOP deck listing. Buyers
  who outgrow the packs and single-pool dials compose a full recipe here —
  up to MAX_RECIPE_SLICES slices of (count × flavor × level × steps × turns)
  summing to exactly DECK_SIZE cards. Flat $30, same SKU; the recipe rides
  checkout metadata as a compact string (pack XOR dials XOR recipe).

  The listing page stays anxiety-free; this page is opt-in complexity, and
  the copy congratulates the buyer for wanting it.

  Spec: docs/superpowers/specs/2026-07-12-deck-architect-design.md
-->
<script lang="ts">
  import { getMerchCheckoutCreator } from "$lib/features/store/get-merch-checkout-creator";
  import { getProductLoader } from "$lib/features/store/get-product-loader";
  import { createStoreState } from "./state/store-state.svelte";
  import { setStoreContext } from "./context/store-context";
  import DeckFanCover from "./components/DeckFanCover.svelte";
  import BuyButton from "./components/BuyButton.svelte";
  import ShopPropPicker from "./components/ShopPropPicker.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import LOOPExpandedOverlay from "$lib/features/create/generate/components/cards/LOOPExpandedOverlay.svelte";
  import { LOOPType } from "$lib/features/create/generate/circular/domain/models/circular-models";
  import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import {
    parseLoopComponents,
    generateLOOPType,
  } from "$lib/shared/create/services/loop-type-utils";
  import { LOOP_COMPONENT_MAP } from "$lib/features/create/generate/shared/domain/constants/loop-constants";
  import { fly, scale, slide } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { DEFAULT_SHOP_PROP } from "./domain/shop-prop-options";
  import {
    recipePreviewCards,
    recipeSliceCard,
  } from "./services/loop-preview-cards";
  import type { CoverCard } from "./domain/models/product";
  import {
    DECK_SIZE,
    MAX_RECIPE_SLICES,
    RECIPE_STEPS,
    recipeProblem,
    flavorSlugFromComponents,
    flavorForLoopType,
    flavorLabel,
    type RecipeSlice,
    type LoopFlavor,
    type LoopConfig,
  } from "./domain/loop-config";
  import { getActivityLogger } from "$lib/shared/analytics/get-activity-logger";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  const store = createStoreState(getProductLoader(), getMerchCheckoutCreator());
  setStoreContext({ state: store });
  store.loadProducts(false);
  getActivityLogger().logActivity("shop_loop_architect_opened", "shop");

  // Architect orders carry a premium over the $30 packs/dials deck: a bespoke
  // recipe costs more to cut and pack until fulfillment is dropshipped. The
  // page prefers a dedicated architect SKU (listing "loop-deck-architect",
  // created in Stripe and mirrored by the product-sync webhook) and falls back
  // to the shared custom SKU while that price doesn't exist yet.
  const architectSku = $derived(
    store.products.find(
      (p) => p.listing === "loop-deck-architect" && p.status === "active"
    ) ?? null
  );
  const customSku = $derived(
    architectSku ??
      store.products.find(
        (p) => p.listing === "loop-deck-custom" && p.status === "active"
      ) ??
      null
  );
  const flavorSkus = $derived(
    store.products
      .filter((p) => p.listing === "loop-deck" && p.status === "active")
      .sort((a, b) => a.sortOrder - b.sortOrder)
  );
  const skuByFlavor = $derived(
    new Map(
      flavorSkus
        .map((p) => [flavorSlugFromComponents(p.loopComponents ?? []), p] as const)
        .filter((e): e is [LoopFlavor, (typeof flavorSkus)[number]] => e[0] != null)
    )
  );

  const haptics = getHapticFeedback();
  const buzz = () => haptics?.trigger("selection");

  // ── the recipe. Seeded valid (the whole deck in one rotated L1 slice) so
  //    the page never opens in an error state. Rows carry a stable local id —
  //    index-keyed each blocks misbind rows across splices (a remove was
  //    editing the wrong slice). The id never leaves the page. ──
  type SliceRow = RecipeSlice & { id: number };
  let uid = 0;
  let slices = $state<SliceRow[]>([
    { id: ++uid, count: DECK_SIZE, flavor: "rotated", level: 1, steps: 8 },
  ]);
  let propType = $state<PropType>(DEFAULT_SHOP_PROP);

  const total = $derived(slices.reduce((n, s) => n + s.count, 0));
  const problem = $derived(recipeProblem(slices));
  const loopConfig = $derived<LoopConfig>({
    recipe: slices.map(({ id: _id, ...s }) => s),
  });
  const price = $derived(
    customSku ? `$${(customSku.price / 100).toFixed(0)}` : "$30"
  );

  function addSlice() {
    if (slices.length >= MAX_RECIPE_SLICES) return;
    // Snapshot BEFORE mutating: `total` is derived and re-evaluates mid-function.
    const startTotal = total;
    if (startTotal < DECK_SIZE) {
      // Room in the deck — the new slice takes exactly the shortfall.
      slices.push({
        id: ++uid,
        count: DECK_SIZE - startTotal,
        flavor: "rotated",
        level: 1,
        steps: 8,
      });
    } else {
      // Full (or over): donate cards from the biggest slice so a valid
      // recipe stays valid across the add.
      const biggest = slices.reduce((a, b) => (b.count > a.count ? b : a), slices[0]!);
      const give = Math.min(6, Math.max(1, biggest.count - 1));
      biggest.count -= give;
      slices.push({ id: ++uid, count: give, flavor: "rotated", level: 1, steps: 8 });
    }
    buzz();
  }
  function removeSlice(i: number) {
    slices.splice(i, 1);
    buzz();
  }
  function setCount(i: number, v: number) {
    const s = slices[i];
    if (!s) return;
    s.count = Math.max(1, Math.min(DECK_SIZE, Math.round(v) || 1));
  }
  function setLevel(i: number, level: number) {
    const s = slices[i];
    if (!s) return;
    s.level = level;
    if (level === 1) delete s.maxTurns;
    else if (s.maxTurns === undefined) s.maxTurns = 1;
    else if (level === 2 && s.maxTurns % 1 !== 0)
      s.maxTurns = Math.max(1, Math.round(s.maxTurns));
    buzz();
  }
  function setSteps(i: number, steps: number) {
    const s = slices[i];
    if (!s) return;
    s.steps = steps;
    buzz();
  }
  function setTurns(i: number, t: number) {
    const s = slices[i];
    if (!s) return;
    s.maxTurns = t;
    buzz();
  }

  // ── flavor modal (the generate panel's LOOP overlay, editing one slice) ──
  let flavorEdit = $state<number | null>(null);
  const editSlice = $derived(flavorEdit !== null ? slices[flavorEdit] : null);
  const editLoopType = $derived(
    editSlice
      ? (generateLOOPType(
          new Set(editSlice.flavor.split("-") as unknown as LOOPComponent[])
        ) ?? LOOPType.ROTATED)
      : LOOPType.ROTATED
  );
  const editComponents = $derived(parseLoopComponents(editLoopType));
  function pickFlavor(lt: LOOPType) {
    const s = flavorEdit !== null ? slices[flavorEdit] : undefined;
    if (s) {
      s.flavor = flavorForLoopType(lt) ?? "rotated";
      buzz();
    }
    flavorEdit = null;
  }
  function onWindowKey(e: KeyboardEvent) {
    if (e.key === "Escape" && flavorEdit !== null) flavorEdit = null;
  }

  // ── per-slice sample cards: one live card each, token-guarded so stale
  //    fetches never land. Cards swap in place (no remount churn). ──
  let sliceCards = $state<(CoverCard | null)[]>([]);
  let sliceToken = 0;
  const sliceKey = $derived(
    slices
      .map((s) => `${s.flavor}|${s.level}|${s.steps}|${s.maxTurns ?? ""}`)
      .join(";") + `|${propType}`
  );
  $effect(() => {
    void sliceKey;
    if (flavorSkus.length === 0) return;
    const snapshot = slices.map((s) => ({ ...s }));
    const token = ++sliceToken;
    snapshot.forEach((s, i) => {
      recipeSliceCard(s, propType, skuByFlavor.get(s.flavor), i).then((card) => {
        if (token !== sliceToken) return;
        sliceCards[i] = card;
      });
    });
    if (sliceCards.length > snapshot.length) sliceCards.length = snapshot.length;
  });

  // ── hero fan: settled-commit like the listing; re-deals only when a slice
  //    is added or removed, otherwise faces swap in place. ──
  const SETTLE_MS = 650;
  let previewCards = $state<CoverCard[] | null>(null);
  let settledFanKey = $state("boot");
  let previewToken = 0;
  let lastTouch = 0;
  $effect(() => {
    void sliceKey;
    const count = slices.length;
    if (flavorSkus.length === 0) return;
    const snapshot = slices.map((s) => ({ ...s }));
    const token = ++previewToken;
    lastTouch = Date.now();
    recipePreviewCards(snapshot, propType, skuByFlavor).then((cards) => {
      if (token !== previewToken) return;
      const wait = Math.max(0, SETTLE_MS - (Date.now() - lastTouch));
      setTimeout(() => {
        if (token !== previewToken) return;
        previewCards = cards?.length ? cards : null;
        settledFanKey = `slices:${count}`;
      }, wait);
    });
  });

  let previewW = $state(0);
  let previewH = $state(0);

  // ── mobile checkout dock: the rail lives at the page bottom on phones, so
  //    while it's off screen a fixed dock keeps the running total + Preorder
  //    in reach. IntersectionObserver hides the dock once the real rail
  //    scrolls into view — two Preorder buttons on screen reads as a glitch. ──
  let railEl = $state<HTMLElement | null>(null);
  let railInView = $state(false);
  $effect(() => {
    if (!railEl) return;
    const io = new IntersectionObserver(
      (entries) => {
        railInView = entries[0]?.isIntersecting ?? false;
      },
      { threshold: 0.2 }
    );
    io.observe(railEl);
    return () => io.disconnect();
  });
  // Phone layout: samples shrink to sidecar size (CSS pairs at 720px).
  let pageW = $state(0);
  const narrow = $derived(pageW > 0 && pageW < 720);
  const sampleCardW = $derived(narrow ? 92 : 150);
  // Rail stage is compact: card height budget = stage minus caption + gaps.
  const previewMaxCardW = $derived(
    previewH > 0 ? Math.max(110, Math.round(((previewH - 80) * 5) / 7)) : 200
  );

  // ── flavor identity: each LOOP component owns a canonical color
  //    (LOOP_COMPONENT_MAP — same hues as the picker tiles). Combos don't mix
  //    colors, they juxtapose them as gradient stops. ──
  function flavorColors(flavor: LoopFlavor): string[] {
    const cols = flavor
      .split("-")
      .map((c) => LOOP_COMPONENT_MAP.get(c as never)?.color)
      .filter((c): c is string => Boolean(c));
    return cols.length ? cols : ["#8b6cff"];
  }
  /** Low-opacity wash for the card frame. */
  function flavorWash(flavor: LoopFlavor): string {
    const stops = flavorColors(flavor).map(
      (c, i, a) => `color-mix(in srgb, ${c} 13%, transparent) ${(i / Math.max(1, a.length - 1)) * 55}%`
    );
    return stops.length > 1
      ? `linear-gradient(135deg, ${stops.join(", ")}, transparent 80%)`
      : `linear-gradient(135deg, ${stops[0]}, transparent 55%)`;
  }
  /** Vivid gradient for the flavor pill. */
  function flavorPillBg(flavor: LoopFlavor): string {
    const stops = flavorColors(flavor).map((c) => `color-mix(in srgb, ${c} 42%, transparent)`);
    return stops.length > 1
      ? `linear-gradient(135deg, ${stops.join(", ")})`
      : stops[0]!;
  }

  // ── per-slice steppers (match the count field's language) ──
  function stepSliceLevel(i: number, dir: number) {
    const s = slices[i];
    if (!s) return;
    setLevel(i, Math.max(1, Math.min(3, s.level + dir)));
  }
  function stepSliceSteps(i: number, dir: number) {
    const s = slices[i];
    if (!s) return;
    const idx = RECIPE_STEPS.indexOf(s.steps as (typeof RECIPE_STEPS)[number]);
    const next = RECIPE_STEPS[Math.max(0, Math.min(RECIPE_STEPS.length - 1, idx + dir))];
    if (next !== undefined && next !== s.steps) setSteps(i, next);
  }
  const TURN_STEPS_WHOLE = [1, 2, 3];
  const TURN_STEPS_HALF = [0.5, 1, 1.5, 2, 2.5, 3];
  function stepSliceTurns(i: number, dir: number) {
    const s = slices[i];
    if (!s) return;
    const allowed = s.level === 3 ? TURN_STEPS_HALF : TURN_STEPS_WHOLE;
    const idx = Math.max(0, allowed.indexOf(s.maxTurns ?? 1));
    const next = allowed[Math.max(0, Math.min(allowed.length - 1, idx + dir))];
    if (next !== undefined && next !== s.maxTurns) setTurns(i, next);
  }
</script>

<svelte:window onkeydown={onWindowKey} bind:innerWidth={pageW} />

<div class="architect-page">
  <main class="architect-content">
    <a href="/shop/loop-deck" class="back-button">
      <i class="fas fa-arrow-left" aria-hidden="true"></i> LOOP Deck
    </a>

    {#if store.error}
      <div class="error">{store.error}</div>
    {:else if store.isLoading && flavorSkus.length === 0}
      <div class="loading">Loading the machine...</div>
    {:else if flavorSkus.length > 0}
      <div class="layout">
        <div class="info-column">
          <div class="info-main">
            <span class="eyebrow">The Deck Architect</span>
            <h1>Build every card</h1>
            <p class="meta">
              You want every card on your terms. Good. Here's the whole machine:
              up to {MAX_RECIPE_SLICES} slices, {DECK_SIZE} cards, any recipe the
              engine can generate.
            </p>

            <!-- workbench bar: the one invariant + the one action, always visible -->
            <div class="workbench-bar">
              <div
                class="total-meter"
                class:ok={problem === null}
                role="status"
                aria-live="polite"
              >
                <span class="total-count">{total} / {DECK_SIZE}</span>
                <span class="total-note">{problem ?? "Recipe complete. Deal it."}</span>
              </div>
              {#if slices.length < MAX_RECIPE_SLICES}
                <button type="button" class="add-slice" onclick={addSlice}>
                  <i class="fas fa-plus" aria-hidden="true"></i> Add a slice
                </button>
              {/if}
            </div>

            <div class="slice-list">
              {#each slices as slice, i (slice.id)}
                {@const accent = flavorColors(slice.flavor)[0]!}
                <!-- No row transition: slide outros hung inside the grid
                     (inert ghost rows), and correctness beats choreography.
                     Each slice wears its LOOP components' canonical colors
                     (combos juxtapose as gradient stops, never mixed). -->
                <div
                  class="slice-row"
                  style:--slice-accent={accent}
                  style:--slice-wash={flavorWash(slice.flavor)}
                >
                  <div class="slice-sample" aria-hidden="true">
                    {#if sliceCards[i]}
                      <!-- maxCardWidth pins the sample: the fan sizes from its
                           container, and on narrow screens an uncapped card
                           ballooned to full page width. -->
                      <DeckFanCover
                        cards={[sliceCards[i]]}
                        deckName={flavorLabel(slice.flavor)}
                        {propType}
                        cardWidth={sampleCardW}
                        maxCardWidth={sampleCardW}
                        exactCount={1}
                        interactive={false}
                      />
                    {:else}
                      <div class="sample-skeleton"></div>
                    {/if}
                  </div>
                  <div class="slice-controls">
                    <div class="slice-top">
                      <label class="count-field">
                        <button
                          type="button"
                          class="count-step"
                          aria-label="Fewer cards"
                          onclick={() => setCount(i, slice.count - 1)}
                        >−</button>
                        <input
                          class="count-input"
                          type="number"
                          min="1"
                          max={DECK_SIZE}
                          value={slice.count}
                          aria-label="Cards in this slice"
                          oninput={(e) => setCount(i, Number(e.currentTarget.value))}
                        />
                        <button
                          type="button"
                          class="count-step"
                          aria-label="More cards"
                          onclick={() => setCount(i, slice.count + 1)}
                        >+</button>
                        <span class="count-label">cards</span>
                      </label>
                      <button
                        type="button"
                        class="flavor-btn"
                        style:background={flavorPillBg(slice.flavor)}
                        onclick={() => (flavorEdit = i)}
                      >
                        {flavorLabel(slice.flavor)}
                        <i class="fas fa-chevron-right" aria-hidden="true"></i>
                      </button>
                      {#if slices.length > 1}
                        <button
                          type="button"
                          class="remove-btn"
                          aria-label="Remove slice"
                          onclick={() => removeSlice(i)}
                        >
                          <i class="fas fa-times" aria-hidden="true"></i>
                        </button>
                      {/if}
                    </div>
                    <div class="slice-dials">
                      <div class="dial">
                        <span class="dial-label">Level</span>
                        <div class="mini-stepper">
                          <button
                            type="button"
                            class="count-step"
                            aria-label="Lower level"
                            disabled={slice.level <= 1}
                            onclick={() => stepSliceLevel(i, -1)}
                          >−</button>
                          <span class="mini-value">{slice.level}</span>
                          <button
                            type="button"
                            class="count-step"
                            aria-label="Raise level"
                            disabled={slice.level >= 3}
                            onclick={() => stepSliceLevel(i, 1)}
                          >+</button>
                        </div>
                      </div>
                      <div class="dial">
                        <span class="dial-label">Steps</span>
                        <div class="mini-stepper">
                          <button
                            type="button"
                            class="count-step"
                            aria-label="Fewer steps"
                            disabled={slice.steps <= 4}
                            onclick={() => stepSliceSteps(i, -1)}
                          >−</button>
                          <span class="mini-value">{slice.steps}</span>
                          <button
                            type="button"
                            class="count-step"
                            aria-label="More steps"
                            disabled={slice.steps >= 16}
                            onclick={() => stepSliceSteps(i, 1)}
                          >+</button>
                        </div>
                      </div>
                      {#if slice.level >= 2}
                        <!-- Axis follows the dial layout: horizontal strip on
                             desktop, stacked settings rows on phones. -->
                        <div class="dial" transition:slide={{ duration: 200, easing: quintOut, axis: narrow ? "y" : "x" }}>
                          <span class="dial-label">Max turns</span>
                          <div class="mini-stepper">
                            <button
                              type="button"
                              class="count-step"
                              aria-label="Fewer turns"
                              disabled={(slice.maxTurns ?? 1) <= (slice.level === 3 ? 0.5 : 1)}
                              onclick={() => stepSliceTurns(i, -1)}
                            >−</button>
                            <span class="mini-value">≤{slice.maxTurns ?? 1}</span>
                            <button
                              type="button"
                              class="count-step"
                              aria-label="More turns"
                              disabled={(slice.maxTurns ?? 1) >= 3}
                              onclick={() => stepSliceTurns(i, 1)}
                            >+</button>
                          </div>
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>

            <!-- prop: one per deck (v1) -->
            <div class="prop-panel">
              <span class="dial-label">Prop</span>
              <ShopPropPicker
                value={propType}
                onchange={(p) => {
                  propType = p;
                  buzz();
                }}
              />
            </div>
          </div>

          <aside class="buy-rail" bind:this={railEl}>
            <!-- Live deck preview lives IN the rail: the recipe stays visible
                 while you edit, and the purchase column never dies below the
                 buy block. Fill-mode crossfade — the stage never resizes. -->
            <div class="rail-stage" bind:clientWidth={previewW} bind:clientHeight={previewH}>
              <Crossfade key={settledFanKey} fill>
                <div class="preview-inner">
                  <DeckFanCover
                    cards={previewCards ?? []}
                    deckName="Your recipe"
                    {propType}
                    cardWidth={150}
                    maxCardWidth={previewMaxCardW}
                    interactive={false}
                    deal
                  />
                  <p class="preview-desc">Sampled live from your recipe.</p>
                </div>
              </Crossfade>
            </div>
            <p class="price">{price}</p>
            <p class="spec-line">
              Poker size · 2.5" × 3.5" <span class="spec-sep">•</span> Deck only
            </p>
            {#if problem === null}
              {#if customSku}
                <BuyButton
                  product={customSku}
                  {propType}
                  {loopConfig}
                  label="Preorder now"
                  waitlistText="Preorders open soon. Leave an email and you'll hear the moment they do."
                />
              {:else if flavorSkus[0]}
                <BuyButton
                  product={flavorSkus[0]}
                  {propType}
                  {loopConfig}
                  label="Preorder now"
                  waitlistText="Preorders open soon. Leave an email and you'll hear the moment they do."
                />
              {/if}
            {:else}
              <div class="buy-blocked" role="status">{problem}</div>
            {/if}
            {#if store.checkoutError}
              <p class="checkout-error" role="alert">{store.checkoutError}</p>
            {/if}
            <ul class="assurance">
              <li><i class="fas fa-calendar-check" aria-hidden="true"></i> Preorder now. Decks ship October 1.</li>
              <li><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> Every card generated to your recipe, one of one</li>
              <li><i class="fas fa-hand-holding-heart" aria-hidden="true"></i> Printed and cut by hand in Chicago, small batches</li>
            </ul>
          </aside>
        </div>
      </div>
    {:else}
      <div class="error">The machine isn't available right now.</div>
    {/if}
  </main>
</div>

{#if narrow && !railInView && customSku?.stripePriceId && flavorSkus.length > 0 && !store.error}
  <div class="checkout-dock" transition:fly={{ y: 72, duration: 220, easing: quintOut }}>
    <div class="dock-meter" class:ok={problem === null}>
      <span class="dock-count">{total} / {DECK_SIZE}</span>
      <span class="dock-price">{price}</span>
    </div>
    <button
      type="button"
      class="dock-buy"
      disabled={problem !== null || store.isCheckingOut}
      onclick={() => store.startCheckout(customSku.id, propType, loopConfig)}
    >
      {store.isCheckingOut ? "Opening..." : "Preorder now"}
    </button>
  </div>
{/if}

{#if flavorEdit !== null}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) flavorEdit = null;
    }}
  >
    <div
      class="loop-col"
      transition:scale={{ start: 0.95, duration: 250, easing: quintOut }}
    >
      <div class="loop-host">
        <LOOPExpandedOverlay
          currentType={editLoopType}
          selectedComponents={editComponents}
          onChange={(lt: LOOPType) => pickFlavor(lt)}
          onClose={() => (flavorEdit = null)}
        />
      </div>
    </div>
  </div>
{/if}

<style>
  .architect-page {
    min-height: 100vh;
    padding-top: 64px;
    background: transparent;
    color: var(--theme-text, #ffffff);
  }
  .architect-content {
    max-width: min(1720px, 92vw);
    margin: 0 auto;
    padding: 12px 24px 32px;
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 0 18px;
    margin-bottom: 16px;
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

  .layout {
    display: flex;
    flex-direction: column;
    gap: clamp(16px, 2.2vh, 28px);
  }

  /* The live preview is a rail panel, not a page hero — the slices are the
     show; the fan is the running receipt. */
  .rail-stage {
    position: relative;
    overflow: hidden;
    border-radius: 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background:
      radial-gradient(70% 60% at 50% 40%, rgba(139, 108, 255, 0.3), transparent 70%),
      radial-gradient(circle at 50% 38%, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015));
    padding: 14px;
    height: 280px;
  }
  .preview-inner {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: stretch;
    gap: 10px;
  }
  .preview-desc {
    font-size: var(--font-size-min, 14px);
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.88);
    margin: 0;
    text-align: center;
    align-self: center;
  }

  .info-column {
    width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
    align-items: start;
  }
  @media (min-width: 1360px) {
    .info-column {
      grid-template-columns: minmax(0, 1.6fr) minmax(360px, 1fr);
      column-gap: clamp(36px, 4vw, 72px);
    }
  }
  .info-main,
  .buy-rail {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
  }
  .buy-rail {
    padding: 22px 24px;
    border-radius: 18px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    align-self: start;
  }
  /* Rail top-aligns with the header block — no offset hack; on this page
     there's no chip row to line up against, so an offset just reads as
     floating in dead space. */

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
    font-size: 15px;
    color: rgba(255, 255, 255, 0.82);
    margin: 0;
    max-width: 62ch;
  }

  /* ---------- workbench bar (meter + add) ---------- */
  .workbench-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .workbench-bar .total-meter {
    flex: 1 1 320px;
  }
  .total-meter {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 16px;
    border-radius: 12px;
    border: 1px solid rgba(245, 158, 11, 0.45);
    background: rgba(245, 158, 11, 0.08);
  }
  .total-meter.ok {
    border-color: rgba(74, 222, 128, 0.45);
    background: rgba(74, 222, 128, 0.07);
  }
  .total-count {
    font-size: 18px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .total-note {
    font-size: var(--font-size-min, 14px);
    color: rgba(255, 255, 255, 0.85);
  }

  /* ---------- slice cards ---------- */
  /* Grid of slice cards: the recipe reads as a hand you're assembling, and
     width scales with slice count instead of leaving sparse full-width rows. */
  .slice-list {
    display: grid;
    /* auto-FIT, not auto-fill: empty tracks collapse, so one slice spans the
       whole band instead of sitting beside a reserved hole. */
    grid-template-columns: repeat(auto-fit, minmax(min(440px, 100%), 1fr));
    gap: 12px;
  }
  .slice-row {
    position: relative;
    display: flex;
    gap: 18px;
    align-items: center;
    padding: 16px 18px;
    border-radius: 16px;
    /* Flavor identity: the slice wears its flavor's accent on the frame. */
    border: 1px solid color-mix(in srgb, var(--slice-accent, #8b6cff) 45%, transparent);
    background:
      var(
        --slice-wash,
        linear-gradient(
          135deg,
          color-mix(in srgb, var(--slice-accent, #8b6cff) 9%, transparent),
          transparent 55%
        )
      ),
      var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    box-shadow: 0 4px 18px color-mix(in srgb, var(--slice-accent, #8b6cff) 14%, transparent);
  }
  /* An odd straggler in a 2-up grid spans the band instead of orphaning a hole. */
  .slice-row:last-child:nth-child(odd):not(:first-child) {
    grid-column: 1 / -1;
  }
  .slice-sample {
    flex: 0 0 160px;
    height: 226px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sample-skeleton {
    width: 150px;
    aspect-ratio: 5 / 7;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      background: rgba(255, 255, 255, 0.11);
    }
  }
  .slice-controls {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .slice-top {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    /* Clearance for the pinned remove button. */
    padding-right: 32px;
  }
  /* Steppers read as ONE control (a joined pill), not three floating boxes —
     the scattered-slab look was the main mobile quality complaint. */
  .count-field,
  .mini-stepper {
    display: inline-flex;
    align-items: center;
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: rgba(0, 0, 0, 0.25);
    overflow: hidden;
  }
  .count-step {
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    border: none;
    background: transparent;
    color: #fff;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .count-step:hover:not(:disabled) {
    background: rgba(139, 108, 255, 0.18);
  }
  .count-step:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .mini-value {
    min-width: 40px;
    text-align: center;
    font-size: 16px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .count-input {
    width: 52px;
    height: var(--min-touch-target, 44px);
    text-align: center;
    font-size: 16px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: #fff;
    background: transparent;
    border: none;
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .count-input::-webkit-outer-spin-button,
  .count-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .count-label {
    font-size: var(--font-size-min, 14px);
    color: rgba(255, 255, 255, 0.8);
    padding: 0 14px 0 4px;
  }
  .flavor-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: var(--min-touch-target, 44px);
    padding: 0 16px;
    border-radius: 999px;
    /* The pill wears the same accent as its card frame — one identity. */
    border: 1px solid color-mix(in srgb, var(--slice-accent, #d9c24a) 65%, transparent);
    background: color-mix(in srgb, var(--slice-accent, #d9c24a) 20%, transparent);
    color: #fff;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .flavor-btn:hover {
    border-color: color-mix(in srgb, var(--slice-accent, #d9c24a) 95%, white);
    background: color-mix(in srgb, var(--slice-accent, #d9c24a) 30%, transparent);
  }
  .flavor-btn i {
    font-size: 0.75em;
    opacity: 0.8;
  }
  .remove-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    border-radius: 10px;
    border: 1px solid transparent;
    background: none;
    color: rgba(255, 255, 255, 0.55);
    cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease;
  }
  .remove-btn:hover {
    color: #ff8a8a;
    border-color: rgba(255, 138, 138, 0.4);
  }
  .slice-dials {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    align-items: flex-end;
  }
  .dial {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .dial-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.75);
  }

  .add-slice {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 0 18px;
    border-radius: 999px;
    border: 1px dashed rgba(216, 180, 254, 0.5);
    background: rgba(139, 108, 255, 0.08);
    color: #d9ccff;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .add-slice:hover {
    border-color: rgba(216, 180, 254, 0.9);
    background: rgba(139, 108, 255, 0.16);
  }

  .prop-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
  }

  /* ---------- buy rail ---------- */
  .price {
    font-size: 2rem;
    font-weight: 800;
    color: var(--theme-accent, #60a5fa);
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
  .spec-line {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: rgba(255, 255, 255, 0.82);
    text-align: center;
  }
  .spec-sep {
    margin: 0 6px;
    opacity: 0.5;
  }
  .buy-blocked {
    padding: 16px;
    border-radius: 12px;
    border: 1px solid rgba(245, 158, 11, 0.45);
    background: rgba(245, 158, 11, 0.08);
    text-align: center;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
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
    font-size: 15px;
    color: rgba(255, 255, 255, 0.85);
  }
  .assurance i {
    color: #8b6cff;
    flex: 0 0 auto;
  }

  .loading,
  .error {
    text-align: center;
    padding: 48px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }
  .error {
    color: var(--semantic-error, #ef4444);
  }

  /* ---------- flavor modal ---------- */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(16px, 4vh, 48px);
    background: rgba(4, 7, 14, 0.62);
    backdrop-filter: blur(5px);
  }
  .loop-col {
    width: min(1000px, 94vw);
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .loop-host {
    position: relative;
    min-height: 0;
    overflow: hidden;
    border-radius: 18px;
  }
  .loop-host :global(.loop-expanded-overlay) {
    position: relative !important;
    inset: auto !important;
    width: 100%;
    max-height: 76vh;
  }
  .loop-host :global(.grid-container) {
    flex: 0 0 auto;
  }

  /* ---------- mobile checkout dock ---------- */
  .checkout-dock {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 60;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
    background: rgba(10, 12, 22, 0.86);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }
  .dock-meter {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 4px 12px;
    border-radius: 10px;
    border: 1px solid rgba(245, 158, 11, 0.45);
    background: rgba(245, 158, 11, 0.1);
  }
  .dock-meter.ok {
    border-color: rgba(74, 222, 128, 0.45);
    background: rgba(74, 222, 128, 0.09);
  }
  .dock-count {
    font-size: 15px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .dock-price {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    color: var(--theme-accent, #a78bfa);
  }
  .dock-buy {
    flex: 1;
    min-height: var(--min-touch-target, 44px);
    border: none;
    border-radius: 12px;
    background: var(--theme-accent-strong, #7c6cf5);
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }
  .dock-buy:disabled {
    opacity: 0.45;
    cursor: default;
  }

  /* ---------- mobile ---------- */
  @media (max-width: 720px) {
    .architect-content {
      /* Bottom padding clears the fixed checkout dock. */
      padding: 8px 14px 96px;
    }
    /* Sample stays a compact sidecar beside the count/flavor block, and the
       dials break out to full card width below — beside the sample they only
       get ~184px, which clips the steppers. display:contents lets the grid
       place slice-top and slice-dials directly. */
    .slice-row {
      display: grid;
      grid-template-columns: 96px minmax(0, 1fr);
      gap: 12px;
      padding: 12px;
      align-items: center;
    }
    .slice-sample {
      grid-row: 1;
      grid-column: 1;
      flex: none;
      /* Content-sized: a fixed 140px left dead space under the count/flavor
         block whenever the sample ran taller than the controls. */
      height: auto;
    }
    .sample-skeleton {
      width: 92px;
    }
    .slice-controls {
      display: contents;
    }
    /* At 375px the unit label + pinned remove button can't share the count
       row: the label goes (the 54/54 meter already says "cards") and the
       remove button joins the count row at the far end. Explicit grid — flex
       wrap kept orphaning the remove button onto a dead row. */
    .slice-top {
      grid-row: 1;
      grid-column: 2;
      align-self: center;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      padding-right: 0;
      align-items: center;
    }
    .count-label {
      display: none;
    }
    .count-field {
      justify-self: start;
    }
    .remove-btn {
      position: static;
      /* DOM order is count → flavor → remove; pin the remove into the count
         row's spare corner instead of letting auto-placement orphan it. */
      grid-row: 1;
      grid-column: 2;
      justify-self: end;
    }
    .flavor-btn {
      grid-column: 1 / -1;
      justify-content: space-between;
    }
    /* Dials become settings rows (label left, stepper right) across the full
       card width: two side-by-side columns clipped the + button at 375px. */
    .slice-dials {
      grid-row: 2;
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      /* Base rule's align-items:flex-end is the desktop cross-axis; in a
         column it right-shrinks every row. Rows stretch edge to edge here. */
      align-items: stretch;
      gap: 8px;
    }
    .dial {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    /* "Max turns" wrapped to two lines and shoved its stepper past the card
       edge — one nowrap line fits the row fine. */
    .dial .dial-label {
      white-space: nowrap;
    }
    .dial .mini-stepper {
      flex: 0 0 auto;
    }
    .rail-stage {
      height: 240px;
    }
    .buy-rail {
      padding: 16px;
    }
    .workbench-bar .total-meter {
      flex-basis: 100%;
    }
    .add-slice {
      flex: 1 1 100%;
      justify-content: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .back-button,
    .count-step,
    .flavor-btn,
    .add-slice {
      transition: none;
    }
    .sample-skeleton {
      animation: none;
    }
  }
</style>
