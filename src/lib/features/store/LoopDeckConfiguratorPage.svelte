<!-- src/lib/features/store/LoopDeckConfiguratorPage.svelte -->
<!--
  The LOOP Deck configurator: ONE listing over the per-flavor backing SKUs
  (products with listing === "loop-deck"). Buyer picks a flavor (exactly one
  active), sees the real cards fan + copy swap, and buys the resolved SKU.
  Size and bundle dials render today (poker / deck-only live; tarot and
  +guide visible but disabled until they exist).
-->
<script lang="ts">
  import { getMerchCheckoutCreator } from "$lib/features/store/get-merch-checkout-creator";
  import { getProductLoader } from "$lib/features/store/get-product-loader";
  import { createStoreState } from "./state/store-state.svelte";
  import { setStoreContext } from "./context/store-context";
  import DeckFanCover from "./components/DeckFanCover.svelte";
  import LoopChips from "./components/LoopChips.svelte";
  import BuyButton from "./components/BuyButton.svelte";
  import PropPicker from "./components/PropPicker.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import { prewarmCovers } from "./services/cover-front-renderer";
  import { DEFAULT_SHOP_PROP } from "./domain/shop-prop-options";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  // Named `store`, not `state`: a local binding called `state` collides with the
  // $state rune (svelte store_rune_conflict).
  const store = createStoreState(getProductLoader(), getMerchCheckoutCreator());
  setStoreContext({ state: store });
  store.loadProducts(false);

  const flavors = $derived(
    store.products
      .filter((p) => p.listing === "loop-deck" && p.status === "active")
      .sort((a, b) => a.sortOrder - b.sortOrder)
  );

  let selectedId = $state<string | null>(null);
  const selected = $derived(
    flavors.find((p) => p.id === selectedId) ?? flavors[0] ?? null
  );

  let propType = $state<PropType>(DEFAULT_SHOP_PROP);

  // ONE worker seed covering every flavor's covers for the picked prop, so
  // flavor swaps render with full arrow/prop assets (see cover-front-renderer).
  // Baked covers skip this entirely; the seed only matters for live fallbacks.
  $effect(() => {
    const all = flavors.flatMap((p) => p.coverCards ?? []);
    if (all.length) prewarmCovers(all, propType);
  });

  // Short flavor names for the picker (the SKU name repeats "LOOP Deck").
  const flavorName = (name: string) => name.replace(/\s*LOOP Deck$/i, "");

  const price = $derived(
    selected ? `$${(selected.price / 100).toFixed(0)}` : "$25"
  );

  let size = $state<"poker" | "tarot">("poker");
  let bundle = $state<"deck" | "bundle">("deck");

  // Roving radiogroup: arrows move selection, exactly one option tabbable.
  function onPickerKeydown(e: KeyboardEvent) {
    if (!selected || flavors.length === 0) return;
    const idx = flavors.findIndex((f) => f.id === selected.id);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % flavors.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + flavors.length) % flavors.length;
    const target = next >= 0 ? flavors[next] : undefined;
    if (!target) return;
    e.preventDefault();
    selectedId = target.id;
    document.getElementById(`flavor-${target.id}`)?.focus();
  }
</script>

<div class="config-page">
  <main class="config-content">
    <a href="/shop" class="back-button">
      <i class="fas fa-arrow-left" aria-hidden="true"></i> Shop
    </a>

    {#if store.error}
      <div class="error">{store.error}</div>
    {:else if store.isLoading && flavors.length === 0}
      <div class="loading">Loading the deck...</div>
    {:else if selected}
      <div class="config-layout">
        <!-- ============ preview column ============ -->
        <div class="preview-column">
          <div class="preview-box">
            <Crossfade key={`${selected.id}|${propType}`}>
              <div class="preview-inner">
                <DeckFanCover
                  cards={selected.coverCards ?? []}
                  deckId={selected.deckId}
                  deckName={selected.name}
                  {propType}
                  cardWidth={168}
                  maxCardWidth={280}
                />
                <p class="preview-desc">{selected.description}</p>
              </div>
            </Crossfade>
          </div>
        </div>

        <!-- ============ choices column ============ -->
        <div class="info-column">
          <span class="eyebrow">The deck</span>
          <h1>LOOP Deck</h1>
          <p class="meta">54 cards · eight counts each · every sequence loops</p>

          <div class="field">
            <span class="field-label" id="flavor-label">Flavor</span>
            <div class="flavor-grid" role="radiogroup" aria-labelledby="flavor-label">
              {#each flavors as flavor (flavor.id)}
                {@const active = flavor.id === selected.id}
                <button
                  type="button"
                  id="flavor-{flavor.id}"
                  class="flavor-option"
                  class:active
                  role="radio"
                  aria-checked={active}
                  tabindex={active ? 0 : -1}
                  onclick={() => (selectedId = flavor.id)}
                  onkeydown={onPickerKeydown}
                >
                  <span class="flavor-name">{flavorName(flavor.name)}</span>
                  <LoopChips components={flavor.loopComponents ?? []} size="sm" />
                </button>
              {/each}
            </div>
          </div>

          <div class="field">
            <span class="field-label" id="prop-label">Prop</span>
            <PropPicker value={propType} onchange={(p) => (propType = p)} />
          </div>

          <div class="field">
            <span class="field-label" id="size-label">Size</span>
            <SegmentedControl
              options={[
                { value: "poker", label: 'Poker · 2.5" × 3.5"' },
                { value: "tarot", label: "Tarot · coming soon", disabled: true },
              ]}
              value={size}
              onchange={(v) => (size = v)}
              color="accent"
            />
          </div>

          <div class="field">
            <span class="field-label" id="bundle-label">Bundle</span>
            <SegmentedControl
              options={[
                { value: "deck", label: "Deck only" },
                { value: "bundle", label: "+ printed guide · coming soon", disabled: true },
              ]}
              value={bundle}
              onchange={(v) => (bundle = v)}
              color="accent"
            />
          </div>

          <p class="price">{price}</p>

          <BuyButton product={selected} {propType} />
          {#if store.checkoutError}
            <p class="checkout-error" role="alert">{store.checkoutError}</p>
          {/if}

          <ul class="assurance">
            <li><i class="fas fa-box-open" aria-hidden="true"></i> Explainer card, laminated quick-reference sheet, and deck box included</li>
            <li><i class="fas fa-hand-holding-heart" aria-hidden="true"></i> Beta run: printed and cut by hand in Chicago, small batches</li>
          </ul>
        </div>
      </div>
    {:else}
      <div class="error">The deck isn't available right now.</div>
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
    /* Wide fluid band: the preview fan auto-scales into the extra room on 4K
       instead of the page pinning to a narrow column. */
    max-width: min(1720px, 92vw);
    margin: 0 auto;
    padding: 40px 24px 80px;
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
    /* Tall enough for the fan + the longest description so flavor swaps
       crossfade without resizing the box (no-layout-shift) — but scaled down
       on phones, where a flat 430px reserved dead air. */
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

  .flavor-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
  }

  .flavor-option {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 12px 14px;
    border-radius: 12px;
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    color: var(--theme-text, #fff);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .flavor-option:hover {
    border-color: var(--theme-border-strong, rgba(255, 255, 255, 0.3));
  }
  .flavor-option.active {
    border-color: #8b6cff;
    background: rgba(139, 108, 255, 0.12);
  }
  .flavor-option:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  .flavor-name {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
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
    .back-button,
    .flavor-option {
      transition: none;
    }
  }
</style>
