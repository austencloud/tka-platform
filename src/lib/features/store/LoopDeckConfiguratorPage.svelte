<!-- src/lib/features/store/LoopDeckConfiguratorPage.svelte -->
<!--
  The LOOP Deck configurator: the buyer's decision funnel — Level (difficulty)
  → Length (depth) → Flavor (taste) → Prop — rendered on the generate-panel
  BENTO language. Four glass tiles: Level/Length are StepperCards (± on the
  tile, Level colored by DIFFICULTY_LEVELS); Flavor/Prop are BaseCards that
  drill into a modal picker. Same modal chrome as the deck-releaser
  (LoopBentoBoard) so the two LOOP surfaces match by construction.

  Flat $30, ONE purchasable SKU (listing "loop-deck-custom"); the config rides
  checkout metadata into the order doc. The 7 per-flavor SKUs stay in Firestore
  as cover/flavor data sources only. Collapsed advanced panel for power
  customizers, instrumented so usage decides whether it lives.

  Presentation-only redesign of v2. No change to the SKU, loopConfig metadata,
  firebase whitelist, or domain model.

  Spec: docs/superpowers/specs/2026-07-10-loop-configurator-bento-redesign-design.md
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
  import BaseCard from "$lib/features/create/generate/components/cards/BaseCard.svelte";
  import StepperCard from "$lib/features/create/generate/components/cards/StepperCard/StepperCard.svelte";
  import { getCardColors } from "$lib/shared/create/domain/card-colors";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { DIFFICULTY_LEVELS } from "$lib/shared/config/difficulty-styles";
  import { scale } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { prewarmCovers } from "./services/cover-front-renderer";
  import {
    DEFAULT_SHOP_PROP,
    shopPropImage,
    shopPropLabel,
  } from "./domain/shop-prop-options";
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
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { PropType as PropTypeEnum } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

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

  // ── reward loop: a haptic tick on every commit (spring lives in BaseCard) ──
  const haptics = getHapticFeedback();
  function buzz() {
    haptics?.trigger("selection");
  }

  // ── preset decks: one-tap entry for the buyer who won't work the dials.
  //    The full board stays below for anyone who wants to refine. ──
  interface Preset {
    id: string;
    name: string;
    sub: string;
    level: LoopLevel;
    length: LoopLength;
    flavor: LoopFlavor;
    prop: PropType;
  }
  const PRESETS: Preset[] = [
    { id: "beginner", name: "Beginner's Loop", sub: "Level 1 · 8 · Variety", level: "1", length: "8", flavor: "variety", prop: PropTypeEnum.STAFF },
    { id: "sampler", name: "The Sampler", sub: "Mix levels · 8 · Variety", level: "mix", length: "8", flavor: "variety", prop: PropTypeEnum.STAFF },
    { id: "deep", name: "Deep Cuts", sub: "Level 2 · 8 · Rotated", level: "2", length: "8", flavor: "rotated", prop: PropTypeEnum.STAFF },
  ];
  function applyPreset(p: Preset) {
    level = p.level;
    length = p.length;
    flavor = p.flavor;
    propType = p.prop;
    buzz();
  }
  const activePreset = $derived(
    PRESETS.find(
      (p) =>
        p.level === level &&
        p.length === length &&
        p.flavor === flavor &&
        p.prop === propType
    )?.id ?? null
  );

  // ── generate-panel bento palette + LOOP/prop tile gradients (shared with the
  //    deck-releaser LoopBentoBoard so the surfaces match). ──
  const cc = getCardColors(BackgroundType.COSMIC);
  // LOOP identity gold, brightened off the drab olive so the hero tile reads warm.
  const LOOP_COLOR = "linear-gradient(135deg, #d9c24a 0%, #a89a2c 48%, #6f6318 100%)";
  const LOOP_SHADOW = "50deg 60% 42%";
  const PROP_TILE_COLOR = "linear-gradient(135deg, #a855f7 0%, #9333ea 50%, #7e22ce 100%)";
  const PROP_TILE_SHADOW = "275deg 70% 50%";
  // Mix = a bit of every level: baby-blue → silver → gold.
  const MIX_LEVEL_COLOR = "linear-gradient(135deg, #7dd3fc 0%, #cbd5e1 45%, #fbbf24 100%)";
  // Alpha-gradient with a faint violet bias (not flat opacity-grey — the dark-mode
  // "cheap tell" the 2026 research flagged).
  const SECONDARY_TILE_COLOR =
    "linear-gradient(135deg, rgba(139,108,255,0.10), rgba(139,108,255,0.02))";

  const LEVEL_DESC: Record<string, string> = {
    "1": "No turns",
    "2": "Whole turns",
    "3": "Half turns",
  };

  // ── Level stepper: index over the AVAILABLE (seeded) values, so the range
  //    grows automatically as Level 3's decks seed — no code change. ──
  const levelIdx = $derived(Math.max(0, AVAILABLE_LEVELS.indexOf(level)));
  const levelLabel = (l: LoopLevel) => (l === "mix" ? "Mix" : l);
  function stepLevel(dir: number) {
    const i = Math.max(0, Math.min(AVAILABLE_LEVELS.length - 1, levelIdx + dir));
    level = AVAILABLE_LEVELS[i] as LoopLevel;
  }
  const levelTileColor = $derived(
    level === "mix"
      ? MIX_LEVEL_COLOR
      : (DIFFICULTY_LEVELS[Number(level)]?.cssBg ?? cc.level.color)
  );
  const levelTileText = $derived(
    level === "mix"
      ? "#0b1220"
      : (DIFFICULTY_LEVELS[Number(level)]?.text ?? "white")
  );
  const levelDesc = $derived(
    level === "mix" ? LEVEL_MIX_COPY : (LEVEL_DESC[level] ?? "")
  );

  // ── Length stepper: same index-over-available pattern. ──
  const lengthIdx = $derived(Math.max(0, AVAILABLE_LENGTHS.indexOf(length)));
  const lengthLabel = (l: LoopLength) => (l === "mix" ? "Mix" : l);
  function stepLength(dir: number) {
    const i = Math.max(0, Math.min(AVAILABLE_LENGTHS.length - 1, lengthIdx + dir));
    length = AVAILABLE_LENGTHS[i] as LoopLength;
  }
  const lengthDesc = $derived(
    length === "mix" ? LENGTH_MIX_COPY : `${length} steps`
  );

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
  const flavorTileValue = $derived(
    flavor === "variety"
      ? "Variety Pack"
      : (skuByFlavor.get(flavor) ? flavorName(skuByFlavor.get(flavor)!.name) : "—")
  );
  const price = $derived(
    customSku ? `$${(customSku.price / 100).toFixed(0)}` : "$30"
  );

  // ── drill-down modals ──
  let showFlavor = $state(false);
  let showProp = $state(false);
  function onWindowKey(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    if (showFlavor) showFlavor = false;
    if (showProp) showProp = false;
  }

  // Roving radiogroup for the flavor tiles (inside the modal).
  const flavorOrder = $derived<LoopFlavor[]>([
    "variety",
    ...flavorSkus
      .map((p) => flavorSlugFromComponents(p.loopComponents ?? []))
      .filter((s): s is LoopFlavor => s != null),
  ]);
  function pickFlavor(f: LoopFlavor) {
    if (!flavorsForLevel.includes(f)) return;
    flavor = f;
    buzz();
    showFlavor = false;
  }
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

<svelte:window onkeydown={onWindowKey} />

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
                  cardWidth={210}
                  maxCardWidth={340}
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

          <!-- ── preset decks: one-tap starting points (biggest UX lever per
               the 2026 research). The board below stays for refining. ── -->
          <div class="preset-row" role="group" aria-label="Starting points">
            {#each PRESETS as p (p.id)}
              <button
                type="button"
                class="preset"
                class:active={activePreset === p.id}
                aria-pressed={activePreset === p.id}
                onclick={() => applyPreset(p)}
              >
                <span class="preset-name">{p.name}</span>
                <span class="preset-sub">{p.sub}</span>
              </button>
            {/each}
          </div>

          <!-- ── primary bento board ── -->
          <div class="bento-board">
            <div class="tile-row">
              <div class="tile stepper">
                <StepperCard
                  title="Level"
                  currentValue={levelIdx}
                  minValue={0}
                  maxValue={AVAILABLE_LEVELS.length - 1}
                  formatValue={(i: number) => levelLabel(AVAILABLE_LEVELS[i] as LoopLevel)}
                  description={levelDesc}
                  color={levelTileColor}
                  textColor={levelTileText}
                  shadowColor="0deg 0% 0%"
                  gridColumnSpan={2}
                  onIncrement={() => stepLevel(1)}
                  onDecrement={() => stepLevel(-1)}
                />
              </div>
              <div class="tile stepper">
                <StepperCard
                  title="Length"
                  currentValue={lengthIdx}
                  minValue={0}
                  maxValue={AVAILABLE_LENGTHS.length - 1}
                  formatValue={(i: number) => lengthLabel(AVAILABLE_LENGTHS[i] as LoopLength)}
                  description={lengthDesc}
                  color={cc.length.color}
                  shadowColor={cc.length.shadowColor}
                  gridColumnSpan={2}
                  onIncrement={() => stepLength(1)}
                  onDecrement={() => stepLength(-1)}
                />
              </div>
            </div>

            <!-- Flavor: the identity choice — a full-width hero tile. -->
            <div class="tile-row">
              <div class="tile hero">
                <BaseCard
                  title="Flavor"
                  currentValue={flavorTileValue}
                  color={LOOP_COLOR}
                  shadowColor={LOOP_SHADOW}
                  gridColumnSpan={2}
                  onClick={() => (showFlavor = true)}
                />
              </div>
            </div>

            <!-- Prop (interactive) + Size / Bundle (fixed this beta run: tarot /
                 bundle coming soon) three across. Muted non-interactive tiles —
                 no fake-pickable disabled controls. -->
            <div class="tile-row trio">
              <div class="tile prop-tile">
                <BaseCard
                  title="Prop"
                  currentValue=""
                  color={PROP_TILE_COLOR}
                  shadowColor={PROP_TILE_SHADOW}
                  gridColumnSpan={2}
                  onClick={() => (showProp = true)}
                >
                  <div class="prop-tile-inner">
                    <span class="prop-tile-chip">
                      <img
                        class="prop-tile-img"
                        src={shopPropImage(propType)}
                        alt=""
                        draggable="false"
                      />
                    </span>
                    <span class="prop-tile-label">{shopPropLabel(propType)}</span>
                  </div>
                </BaseCard>
              </div>
              <div class="tile small">
                <BaseCard
                  title="Size"
                  currentValue={'Poker · 2.5" × 3.5"'}
                  clickable={false}
                  color={SECONDARY_TILE_COLOR}
                  shadowColor="0deg 0% 0%"
                  gridColumnSpan={2}
                />
              </div>
              <div class="tile small">
                <BaseCard
                  title="Bundle"
                  currentValue="Deck only"
                  clickable={false}
                  color={SECONDARY_TILE_COLOR}
                  shadowColor="0deg 0% 0%"
                  gridColumnSpan={2}
                />
              </div>
            </div>
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

<!-- ============ Flavor drill-down modal ============ -->
{#if showFlavor}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) showFlavor = false;
    }}
  >
    <div
      class="picker-overlay"
      transition:scale={{ start: 0.95, duration: 250, easing: quintOut }}
    >
      <div class="po-header">
        <h3>Flavor</h3>
        <button class="po-close" aria-label="Close" onclick={() => (showFlavor = false)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="po-body">
        <div class="flavor-grid" role="radiogroup" aria-label="Flavor">
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
              onclick={() => pickFlavor(f)}
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
      <button class="po-done" onclick={() => (showFlavor = false)}>Done</button>
    </div>
  </div>
{/if}

<!-- ============ Prop drill-down modal ============ -->
{#if showProp}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) showProp = false;
    }}
  >
    <div
      class="picker-overlay prop-overlay"
      transition:scale={{ start: 0.95, duration: 250, easing: quintOut }}
    >
      <div class="po-header">
        <h3>Prop</h3>
        <button class="po-close" aria-label="Close" onclick={() => (showProp = false)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="po-body">
        <PropPicker
          value={propType}
          onchange={(p) => {
            propType = p;
            buzz();
            showProp = false;
          }}
        />
      </div>
      <button class="po-done" onclick={() => (showProp = false)}>Done</button>
    </div>
  </div>
{/if}

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

  /* Wide screens: the info column is taller than the preview, so DON'T stretch
     the stage to match (that left a big void with the fan floating in it).
     Keep the box at a hero height and pin it in view as the column scrolls. */
  @media (min-width: 1200px) {
    .preview-column {
      position: sticky;
      top: 88px;
    }
    .preview-box {
      height: clamp(400px, 46vh, 480px);
    }
  }

  /* ---------- preview ---------- */
  .preview-box {
    position: relative;
    overflow: hidden;
    border-radius: 20px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    /* Nebula glow painted into the background layers (always behind content, so
       no z-index fight with the crossfade). Premium dark-mode cue, not a flat box. */
    background:
      radial-gradient(56% 48% at 50% 40%, rgba(139, 108, 255, 0.34), transparent 68%),
      radial-gradient(38% 34% at 68% 66%, rgba(84, 209, 196, 0.12), transparent 70%),
      radial-gradient(circle at 50% 38%, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015));
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

  /* ---------- preset decks ---------- */
  .preset-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .preset {
    flex: 1 1 160px;
    min-width: 140px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    min-height: var(--min-touch-target, 44px);
    padding: 11px 14px;
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    background: linear-gradient(135deg, rgba(139, 108, 255, 0.10), rgba(139, 108, 255, 0.02));
    color: var(--theme-text, #fff);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s ease, background 0.15s ease, transform 0.1s ease;
  }
  .preset:hover {
    border-color: var(--theme-border-strong, rgba(184, 166, 255, 0.5));
    background: linear-gradient(135deg, rgba(139, 108, 255, 0.16), rgba(139, 108, 255, 0.04));
  }
  .preset:active {
    transform: scale(0.98);
  }
  .preset.active {
    border-color: #b8a6ff;
    background: linear-gradient(135deg, rgba(139, 108, 255, 0.26), rgba(139, 108, 255, 0.08));
  }
  .preset:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }
  .preset-name {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
  }
  .preset-sub {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-variant-numeric: tabular-nums;
  }

  /* ---------- bento board ---------- */
  .bento-board {
    display: flex;
    flex-direction: column;
    gap: 12px;
    /* theme vars the real generate cards read for their type scale */
    --card-text-size: 22px;
    --card-text-weight: 800;
    --card-text-spacing: 0.3px;
    --card-text-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
  }
  .tile-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .tile-row > .tile {
    flex: 1 1 220px;
    min-width: 180px;
    height: 118px;
  }
  /* Flavor hero: full-width identity tile, a touch taller than the steppers. */
  .tile-row > .tile.hero {
    flex: 1 1 100%;
    height: 132px;
  }
  /* Prop + Size + Bundle three across; prop gets a little more room. */
  .tile-row.trio > .tile {
    flex: 1 1 150px;
    min-width: 132px;
    height: 100px;
  }
  .tile-row.trio > .tile.prop-tile {
    flex: 1.5 1 180px;
  }
  .tile > :global(*) {
    width: 100%;
    height: 100%;
  }
  /* Unify type scale across the cards (matches the deck-releaser board). */
  .bento-board :global(.value-number),
  .bento-board :global(.base-card .card-value) {
    font-size: 24px !important;
    line-height: 1.15 !important;
  }
  .tile.small :global(.base-card .card-value) {
    font-size: 14px !important;
    font-weight: 700 !important;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.78)) !important;
    white-space: normal !important;
  }
  .bento-board :global(.card-title) {
    font-size: var(--font-size-compact, 12px) !important;
    letter-spacing: 0.8px !important;
  }

  /* Prop tile: hide BaseCard's empty value slot, use the content slot for the
     prop image + label (like LoopBentoBoard's size tile pattern). */
  .prop-tile :global(.card-value) {
    display: none;
  }
  .prop-tile :global(.card-content) {
    margin-top: 0;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* Single centered row — a small framed image chip + the prop name. A thin
     prop (staff) reads clearly inside the chip; nothing overflows the tile. */
  .prop-tile-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
  }
  .prop-tile-chip {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.16);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  .prop-tile-img {
    width: 24px;
    height: 24px;
    object-fit: contain;
    pointer-events: none;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
  }
  .prop-tile-label {
    font-size: var(--font-size-min, 15px);
    font-weight: 800;
    text-shadow: var(--card-text-shadow);
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

  /* ---------- flavor grid (inside modal) ---------- */
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

  /* ---------- drill-down modals (match the deck-releaser LoopBentoBoard) ---------- */
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
  .picker-overlay {
    width: min(720px, 94vw);
    max-height: min(840px, 90vh);
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: linear-gradient(135deg,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 25%, #1a1a2e) 0%,
      color-mix(in srgb, var(--theme-accent, #818cf8) 15%, #1a1a2e) 50%,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 20%, #1a1a2e) 100%);
    border-radius: 18px;
    border: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
    overflow: hidden;
  }
  .picker-overlay.prop-overlay {
    width: min(560px, 94vw);
  }
  .po-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }
  .po-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #fff;
  }
  .po-close {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 8px;
  }
  .po-close svg {
    width: 20px;
    height: 20px;
  }
  .po-close:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  .po-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
  }
  .po-done {
    flex-shrink: 0;
    width: 100%;
    padding: 12px 20px;
    min-height: 44px;
    background: color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border: 2px solid var(--theme-accent);
    border-radius: 10px;
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
  }
  .po-done:hover {
    background: color-mix(in srgb, var(--theme-accent) 45%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .back-button,
    .flavor-option,
    .advanced-toggle,
    .preset {
      transition: none;
    }
  }
</style>
