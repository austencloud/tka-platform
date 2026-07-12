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
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import LOOPExpandedOverlay from "$lib/features/create/generate/components/cards/LOOPExpandedOverlay.svelte";
  import { LOOPType } from "$lib/features/create/generate/circular/domain/models/circular-models";
  import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import {
    parseLoopComponents,
    generateLOOPType,
  } from "$lib/shared/create/services/loop-type-utils";
  import { scale, slide } from "svelte/transition";
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

  const customSku = $derived(
    store.products.find(
      (p) => p.listing === "loop-deck-custom" && p.status === "active"
    ) ?? null
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
  //    the page never opens in an error state. ──
  let slices = $state<RecipeSlice[]>([
    { count: DECK_SIZE, flavor: "rotated", level: 1, steps: 8 },
  ]);
  let propType = $state<PropType>(DEFAULT_SHOP_PROP);

  const total = $derived(slices.reduce((n, s) => n + s.count, 0));
  const problem = $derived(recipeProblem(slices));
  const loopConfig = $derived<LoopConfig>({ recipe: slices });
  const price = $derived(
    customSku ? `$${(customSku.price / 100).toFixed(0)}` : "$30"
  );

  function addSlice() {
    if (slices.length >= MAX_RECIPE_SLICES) return;
    // Snapshot BEFORE mutating: `total` is derived and re-evaluates mid-function.
    const startTotal = total;
    if (startTotal < DECK_SIZE) {
      // Room in the deck — the new slice takes exactly the shortfall.
      slices.push({ count: DECK_SIZE - startTotal, flavor: "rotated", level: 1, steps: 8 });
    } else {
      // Full (or over): donate cards from the biggest slice so a valid
      // recipe stays valid across the add.
      const biggest = slices.reduce((a, b) => (b.count > a.count ? b : a), slices[0]!);
      const give = Math.min(6, Math.max(1, biggest.count - 1));
      biggest.count -= give;
      slices.push({ count: give, flavor: "rotated", level: 1, steps: 8 });
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
  const previewMaxCardW = $derived(
    previewH > 0 ? Math.max(150, Math.round(((previewH - 150) * 5) / 7)) : 340
  );

  const LEVEL_OPTIONS = [
    { value: "1", label: "1" },
    { value: "2", label: "2" },
    { value: "3", label: "3" },
  ];
  const STEP_OPTIONS = RECIPE_STEPS.map((s) => ({ value: String(s), label: String(s) }));
  const TURN_OPTIONS_WHOLE = ["1", "2", "3"].map((v) => ({ value: v, label: `≤${v}` }));
  const TURN_OPTIONS_HALF = ["0.5", "1", "1.5", "2", "2.5", "3"].map((v) => ({
    value: v,
    label: `≤${v}`,
  }));
</script>

<svelte:window onkeydown={onWindowKey} />

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
        <!-- hero fan -->
        <div
          class="preview-box"
          bind:clientWidth={previewW}
          bind:clientHeight={previewH}
        >
          <Crossfade key={settledFanKey} fill>
            <div class="preview-inner">
              <DeckFanCover
                cards={previewCards ?? []}
                deckName="Your recipe"
                {propType}
                cardWidth={previewW >= 1200 ? 280 : 210}
                maxCardWidth={previewMaxCardW}
                interactive={false}
                deal
              />
              <p class="preview-desc">
                Sampled live from your recipe. Every card is generated, never repeated.
              </p>
            </div>
          </Crossfade>
        </div>

        <div class="info-column">
          <div class="info-main">
            <span class="eyebrow">The Deck Architect</span>
            <h1>Build every card</h1>
            <p class="meta">
              You want every card on your terms. Good. Here's the whole machine:
              up to {MAX_RECIPE_SLICES} slices, {DECK_SIZE} cards, any recipe the
              engine can generate.
            </p>

            <!-- total meter: the one invariant, always visible -->
            <div
              class="total-meter"
              class:ok={problem === null}
              role="status"
              aria-live="polite"
            >
              <span class="total-count">{total} / {DECK_SIZE}</span>
              <span class="total-note">{problem ?? "Recipe complete. Deal it."}</span>
            </div>

            <div class="slice-list">
              {#each slices as slice, i (i)}
                <div class="slice-row" transition:slide={{ duration: 220, easing: quintOut }}>
                  <div class="slice-sample" aria-hidden="true">
                    {#if sliceCards[i]}
                      <DeckFanCover
                        cards={[sliceCards[i]]}
                        deckName={flavorLabel(slice.flavor)}
                        {propType}
                        cardWidth={96}
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
                        <SegmentedControl
                          options={LEVEL_OPTIONS}
                          value={String(slice.level)}
                          onchange={(v) => setLevel(i, Number(v))}
                          color="accent"
                          size="sm"
                        />
                      </div>
                      <div class="dial">
                        <span class="dial-label">Steps</span>
                        <SegmentedControl
                          options={STEP_OPTIONS}
                          value={String(slice.steps)}
                          onchange={(v) => setSteps(i, Number(v))}
                          color="accent"
                          size="sm"
                        />
                      </div>
                      {#if slice.level >= 2}
                        <div class="dial" transition:slide={{ duration: 200, easing: quintOut, axis: "x" }}>
                          <span class="dial-label">Turns</span>
                          <SegmentedControl
                            options={slice.level === 3 ? TURN_OPTIONS_HALF : TURN_OPTIONS_WHOLE}
                            value={String(slice.maxTurns ?? 1)}
                            onchange={(v) => setTurns(i, Number(v))}
                            color="accent"
                            size="sm"
                          />
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>

            {#if slices.length < MAX_RECIPE_SLICES}
              <button type="button" class="add-slice" onclick={addSlice}>
                <i class="fas fa-plus" aria-hidden="true"></i> Add a slice
              </button>
            {/if}

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

          <aside class="buy-rail">
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

  .preview-box {
    position: relative;
    overflow: hidden;
    border-radius: 20px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background:
      radial-gradient(56% 48% at 50% 40%, rgba(139, 108, 255, 0.34), transparent 68%),
      radial-gradient(38% 34% at 68% 66%, rgba(84, 209, 196, 0.12), transparent 70%),
      radial-gradient(circle at 50% 38%, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015));
    padding: clamp(16px, 2.5vw, 32px);
    height: clamp(300px, 34vh, 540px);
  }
  .preview-inner {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: stretch;
    gap: 12px;
  }
  .preview-desc {
    font-size: var(--font-size-base, 16px);
    line-height: 1.65;
    color: rgba(255, 255, 255, 0.88);
    margin: 0;
    text-align: center;
    padding: 0 16px;
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
  @media (min-width: 1360px) {
    .buy-rail {
      margin-top: 92px;
    }
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
    font-size: 15px;
    color: rgba(255, 255, 255, 0.82);
    margin: 0;
    max-width: 62ch;
  }

  /* ---------- total meter ---------- */
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

  /* ---------- slice rows ---------- */
  .slice-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .slice-row {
    display: flex;
    gap: 16px;
    align-items: center;
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
  }
  .slice-sample {
    flex: 0 0 104px;
    height: 148px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sample-skeleton {
    width: 96px;
    aspect-ratio: 5 / 7;
    border-radius: 8px;
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
  }
  .count-field {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .count-step {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: #fff;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .count-step:hover {
    border-color: rgba(216, 180, 254, 0.6);
    background: rgba(139, 108, 255, 0.14);
  }
  .count-input {
    width: 58px;
    height: 36px;
    text-align: center;
    font-size: 16px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: #fff;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 10px;
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
  }
  .flavor-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    padding: 0 16px;
    border-radius: 999px;
    border: 1px solid rgba(217, 194, 74, 0.5);
    background: linear-gradient(135deg, rgba(217, 194, 74, 0.22), rgba(168, 154, 44, 0.12));
    color: #f4e9a8;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .flavor-btn:hover {
    border-color: rgba(232, 211, 92, 0.85);
  }
  .flavor-btn i {
    font-size: 0.75em;
    opacity: 0.8;
  }
  .remove-btn {
    margin-left: auto;
    width: 36px;
    height: 36px;
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

  @media (max-width: 720px) {
    .slice-row {
      flex-direction: column;
      align-items: stretch;
    }
    .slice-sample {
      flex-basis: auto;
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
