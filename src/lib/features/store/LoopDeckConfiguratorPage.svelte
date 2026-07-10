<!-- src/lib/features/store/LoopDeckConfiguratorPage.svelte -->
<!--
  The LOOP Deck configurator v2: dial funnel in the buyer's real decision
  order — Level (difficulty) → Length (depth) → Flavor (taste) — each with a
  curated "Mix" option. Flat $30, ONE purchasable SKU (listing
  "loop-deck-custom"); the configuration rides checkout metadata into the
  order doc. The 7 per-flavor SKUs stay in Firestore as cover/flavor data
  sources only. Collapsed advanced panel for power customizers, instrumented
  so usage decides whether it lives.

  Spec: docs/superpowers/specs/2026-07-10-loop-deck-configurator-v2-design.md
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
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import { prewarmCovers } from "./services/cover-front-renderer";
  import { DEFAULT_SHOP_PROP } from "./domain/shop-prop-options";
  import {
    LOOP_LEVELS,
    LOOP_LENGTHS,
    AVAILABLE_LEVELS,
    AVAILABLE_LENGTHS,
    availableFlavors,
    flavorSlugFromComponents,
    LEVEL_MIX_COPY,
    LENGTH_MIX_COPY,
    VARIETY_COPY,
    type LoopLevel,
    type LoopLength,
    type LoopFlavor,
    type LoopConfig,
  } from "./domain/loop-config";
  import { getActivityLogger } from "$lib/shared/analytics/get-activity-logger";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  // Named `store`, not `state`: a local binding called `state` collides with the
  // $state rune (svelte store_rune_conflict).
  const store = createStoreState(getProductLoader(), getMerchCheckoutCreator());
  setStoreContext({ state: store });
  store.loadProducts(false);

  // The ONE purchasable SKU. Flat $30 regardless of dials.
  const customSku = $derived(
    store.products.find(
      (p) => p.listing === "loop-deck-custom" && p.status === "active"
    ) ?? null
  );

  // Per-flavor SKUs: cover + flavor-tile data sources (not sold individually).
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

  // ── the dials — page loads buyable untouched: 1 · 8 · Variety ──
  let level = $state<LoopLevel>("1");
  let length = $state<LoopLength>("8");
  let flavor = $state<LoopFlavor>("variety");
  let propType = $state<PropType>(DEFAULT_SHOP_PROP);

  const flavorsForLevel = $derived(availableFlavors(level));
  // Level change can strand the flavor (Level 2 = variety + rotated only).
  $effect(() => {
    if (!flavorsForLevel.includes(flavor)) flavor = "variety";
  });

  // ── advanced panel (usage decides whether this survives) ──
  let advancedOpen = $state(false);
  let levelBalance = $state<"mostly-1" | "even" | "mostly-spicy">("mostly-1");
  let excluded = $state<Set<LoopFlavor>>(new Set());
  let customTouched = $state(false);

  function openAdvanced() {
    advancedOpen = !advancedOpen;
    if (advancedOpen)
      getActivityLogger().logActivity("shop_loop_advanced_opened", "shop");
  }
  function customize(key: string, value: string) {
    customTouched = true;
    getActivityLogger().logActivity("shop_loop_advanced_customized", "shop", {
      settingKey: key,
      newValue: value,
    });
  }
  function toggleExclude(f: LoopFlavor) {
    const next = new Set(excluded);
    if (next.has(f)) next.delete(f);
    else next.add(f);
    excluded = next;
    customize("excludeFlavors", [...next].join(",") || "none");
  }

  const loopConfig = $derived.by<LoopConfig>(() => {
    const cfg: LoopConfig = { level, length, flavor };
    if (!customTouched) return cfg;
    const custom: NonNullable<LoopConfig["custom"]> = {};
    if (level === "mix") custom.levelBalance = levelBalance;
    if (flavor === "variety" && excluded.size > 0)
      custom.excludeFlavors = [...excluded];
    return Object.keys(custom).length ? { ...cfg, custom } : cfg;
  });

  // ── preview ──
  const selectedSku = $derived(
    flavor === "variety" ? null : (skuByFlavor.get(flavor) ?? null)
  );
  // Variety hand: one card per flavor (excludes honored), mixed.
  const varietyCards = $derived(
    flavorSkus
      .filter((p) => {
        const slug = flavorSlugFromComponents(p.loopComponents ?? []);
        return slug != null && !excluded.has(slug);
      })
      .map((p) => p.coverCards?.[0])
      .filter((c): c is NonNullable<typeof c> => c != null)
  );
  const fanCards = $derived(
    selectedSku ? (selectedSku.coverCards ?? []) : varietyCards
  );
  const previewDesc = $derived(
    selectedSku ? selectedSku.description : VARIETY_COPY
  );

  $effect(() => {
    const all = flavorSkus.flatMap((p) => p.coverCards ?? []);
    if (all.length) prewarmCovers(all, propType);
  });

  const flavorName = (name: string) => name.replace(/\s*LOOP Deck$/i, "");
  const price = $derived(
    customSku ? `$${(customSku.price / 100).toFixed(0)}` : "$30"
  );

  // Reserved hint slots (no-layout-shift): every dial always renders its hint
  // line; Mix selections fill it, everything else leaves it blank.
  const levelHint = $derived(level === "mix" ? LEVEL_MIX_COPY : "");
  const lengthHint = $derived(length === "mix" ? LENGTH_MIX_COPY : "");

  let size = $state<"poker" | "tarot">("poker");
  let bundle = $state<"deck" | "bundle">("deck");

  // Roving radiogroup for the flavor tiles.
  const flavorOrder = $derived<LoopFlavor[]>([
    "variety",
    ...flavorSkus
      .map((p) => flavorSlugFromComponents(p.loopComponents ?? []))
      .filter((s): s is LoopFlavor => s != null),
  ]);
  function onFlavorKeydown(e: KeyboardEvent) {
    const enabled = flavorOrder.filter((f) => flavorsForLevel.includes(f));
    const idx = enabled.indexOf(flavor);
    if (idx < 0) return;
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % enabled.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + enabled.length) % enabled.length;
    const target = next >= 0 ? enabled[next] : undefined;
    if (!target) return;
    e.preventDefault();
    flavor = target;
    document.getElementById(`flavor-${target}`)?.focus();
  }
</script>

<div class="config-page">
  <main class="config-content">
    <a href="/shop" class="back-button">
      <i class="fas fa-arrow-left" aria-hidden="true"></i> Shop
    </a>

    {#if store.error}
      <div class="error">{store.error}</div>
    {:else if store.isLoading && flavorSkus.length === 0}
      <div class="loading">Loading the deck...</div>
    {:else if flavorSkus.length > 0}
      <div class="config-layout">
        <!-- ============ preview column ============ -->
        <div class="preview-column">
          <div class="preview-box">
            <!-- fill mode: the stage is the sized box, so config swaps can
                 never resize it (crossfade-primitive routing). -->
            <Crossfade key={`${flavor}|${propType}|${excluded.size}`} fill>
              <div class="preview-inner">
                <DeckFanCover
                  cards={fanCards}
                  deckId={selectedSku?.deckId}
                  deckName={selectedSku?.name ?? "Variety Pack"}
                  {propType}
                  cardWidth={168}
                  maxCardWidth={280}
                  exactCount={flavor === "variety"
                    ? Math.min(6, fanCards.length)
                    : undefined}
                />
                <p class="preview-desc">{previewDesc}</p>
              </div>
            </Crossfade>
          </div>
        </div>

        <!-- ============ choices column ============ -->
        <div class="info-column">
          <span class="eyebrow">The deck</span>
          <h1>LOOP Deck</h1>
          <p class="meta">54 cards · every sequence loops · built to your dials</p>

          <div class="dial-row">
            <div class="field">
              <span class="field-label" id="level-label">Level</span>
              <SegmentedControl
                options={LOOP_LEVELS.map((l) => ({
                  value: l,
                  label: l === "mix" ? "Mix" : l,
                  disabled: !AVAILABLE_LEVELS.includes(l),
                }))}
                value={level}
                onchange={(v) => (level = v)}
                color="accent"
              />
              <p class="dial-hint">{levelHint}</p>
            </div>

            <div class="field">
              <span class="field-label" id="length-label">Length</span>
              <SegmentedControl
                options={LOOP_LENGTHS.map((l) => ({
                  value: l,
                  label: l === "mix" ? "Mix" : l,
                  disabled: !AVAILABLE_LENGTHS.includes(l),
                }))}
                value={length}
                onchange={(v) => (length = v)}
                color="accent"
              />
              <p class="dial-hint">{lengthHint}</p>
            </div>
          </div>

          <div class="field">
            <span class="field-label" id="flavor-label">Flavor</span>
            <div class="flavor-grid" role="radiogroup" aria-labelledby="flavor-label">
              <!-- Variety first: the default, the blend. -->
              {#each flavorOrder as f (f)}
                {@const sku = f === "variety" ? null : skuByFlavor.get(f)}
                {@const active = f === flavor}
                {@const enabled = flavorsForLevel.includes(f)}
                <button
                  type="button"
                  id="flavor-{f}"
                  class="flavor-option"
                  class:active
                  class:gated={!enabled}
                  role="radio"
                  aria-checked={active}
                  aria-disabled={!enabled}
                  tabindex={active ? 0 : -1}
                  onclick={() => enabled && (flavor = f)}
                  onkeydown={onFlavorKeydown}
                >
                  {#if f === "variety"}
                    <span class="flavor-name">Variety Pack</span>
                    <span class="flavor-sub">a curated blend of every flavor</span>
                  {:else if sku}
                    <span class="flavor-name">{flavorName(sku.name)}</span>
                    <LoopChips components={sku.loopComponents ?? []} size="sm" />
                  {/if}
                  {#if !enabled}
                    <span class="flavor-sub">not at this level yet</span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>

          <div class="field">
            <span class="field-label" id="prop-label">Prop</span>
            <PropPicker value={propType} onchange={(p) => (propType = p)} />
          </div>

          <!-- Fine-tune disclosure: collapsed by default; opening it and
               touching anything is instrumented — usage decides its future. -->
          <div class="advanced">
            <button
              type="button"
              class="advanced-toggle"
              aria-expanded={advancedOpen}
              onclick={openAdvanced}
            >
              <i
                class="fas fa-chevron-{advancedOpen ? 'up' : 'down'}"
                aria-hidden="true"
              ></i>
              Fine-tune the blend
            </button>
            {#if advancedOpen}
              <div class="advanced-panel">
                <div class="field">
                  <span class="field-label">Level balance (Level Mix)</span>
                  <SegmentedControl
                    options={[
                      { value: "mostly-1", label: "Mostly 1", disabled: level !== "mix" },
                      { value: "even", label: "Even split", disabled: level !== "mix" },
                      { value: "mostly-spicy", label: "Mostly spicy", disabled: level !== "mix" },
                    ]}
                    value={levelBalance}
                    onchange={(v) => {
                      levelBalance = v;
                      customize("levelBalance", v);
                    }}
                    color="accent"
                    size="sm"
                  />
                </div>
                <div class="field">
                  <span class="field-label">Variety grab bag</span>
                  <div class="exclude-row">
                    {#each flavorOrder.filter((f) => f !== "variety") as f (f)}
                      {@const sku = skuByFlavor.get(f)}
                      {#if sku}
                        <FilterChipBase
                          label={flavorName(sku.name)}
                          mode="toggle"
                          size="sm"
                          active={!excluded.has(f)}
                          disabled={flavor !== "variety"}
                          onclick={() => toggleExclude(f)}
                        />
                      {/if}
                    {/each}
                  </div>
                </div>
              </div>
            {/if}
          </div>

          <div class="dial-row">
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
          </div>

          <p class="price">{price}</p>

          {#if customSku}
            <BuyButton product={customSku} {propType} {loopConfig} />
          {:else if flavorSkus[0]}
            <!-- Custom SKU not seeded/active yet: honest gate via the first
                 flavor SKU's waitlist (it has no Stripe price either). -->
            <BuyButton product={flavorSkus[0]} {propType} {loopConfig} />
          {/if}
          {#if store.checkoutError}
            <p class="checkout-error" role="alert">{store.checkoutError}</p>
          {/if}

          <ul class="assurance">
            <li><i class="fas fa-box-open" aria-hidden="true"></i> Explainer card, laminated quick-reference sheet, and deck box included</li>
            <li><i class="fas fa-gift" aria-hidden="true"></i> 59 cards in a 54-card box. We count generously.</li>
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
       instead of the page pinning to a narrow column. Vertical padding stays
       lean so the whole configurator fits a 4K viewport without scrolling. */
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

  /* Wide screens: stretch the preview stage to the info column's height. */
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
      height: auto;
      min-height: clamp(360px, 36vw, 460px);
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
    /* FIXED stage height: fill-mode crossfade layers stack absolutely inside,
       so no config swap can resize the box (no-layout-shift by construction). */
    height: clamp(360px, 36vw, 460px);
  }

  /* Each layer fills the stage and centers its art vertically. Children
     STRETCH horizontally — the fan sizes its cards FROM container width, so
     shrink-to-fit here would oscillate (see starter pack fix). */
  .preview-inner {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: stretch;
    gap: 12px;
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

  .dial-row {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
  }
  .dial-row .field {
    flex: 1 1 240px;
    max-width: 420px;
  }

  /* Reserved hint slot: always present so a Mix pick never shoves the layout. */
  .dial-hint {
    margin: 0;
    line-height: 1.4;
    min-height: 1.4em;
    font-size: var(--font-size-compact, 12px);
    font-style: italic;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.55));
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
  .flavor-option:hover:not(.gated) {
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
  .flavor-option.gated {
    opacity: 0.45;
    cursor: default;
  }

  .flavor-name {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
  }
  .flavor-sub {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  /* ---------- advanced disclosure ---------- */
  .advanced {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .advanced-toggle {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 0 16px;
    border-radius: 999px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.75));
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .advanced-toggle:hover {
    border-color: var(--theme-border-strong, rgba(255, 255, 255, 0.3));
    color: var(--theme-text, #fff);
  }
  .advanced-toggle i {
    font-size: 0.75em;
  }

  .advanced-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    border-radius: 14px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.025));
  }

  .exclude-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
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
    .flavor-option,
    .advanced-toggle {
      transition: none;
    }
  }
</style>
