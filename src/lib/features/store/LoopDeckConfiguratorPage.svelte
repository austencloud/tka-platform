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
  as cover/flavor data sources only.

  Presentation-only redesign of v2. No change to the SKU, loopConfig metadata,
  firebase whitelist, or domain model.

  Spec: docs/superpowers/specs/2026-07-10-loop-configurator-bento-redesign-design.md
-->
<script lang="ts">
  import { getMerchCheckoutCreator } from "$lib/features/store/get-merch-checkout-creator";
  import { getProductLoader } from "$lib/features/store/get-product-loader";
  import { createStoreState } from "./state/store-state.svelte";
  import { setStoreContext } from "./context/store-context";
  import DeckFanCover, {
    DEAL_MS as FAN_DEAL_MS,
    DEAL_STAGGER as FAN_DEAL_STAGGER,
    GATHER_MS as FAN_GATHER_MS,
  } from "./components/DeckFanCover.svelte";
  import LoopChips from "./components/LoopChips.svelte";
  import BuyButton from "./components/BuyButton.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import BaseCard from "$lib/features/create/generate/components/cards/BaseCard.svelte";
  import { LOOPType } from "$lib/features/create/generate/circular/domain/models/circular-models";
  import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import {
    parseLoopComponents,
    generateLOOPType,
  } from "$lib/shared/create/services/loop-type-utils";
  import { generateExplanationText } from "$lib/features/create/generate/shared/services/loop-explanation-text-generator";
  import { getCardColors } from "$lib/shared/create/domain/card-colors";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { DIFFICULTY_LEVELS } from "$lib/shared/config/difficulty-styles";
  import { scale, slide } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { prewarmCovers } from "./services/cover-front-renderer";
  import { DEFAULT_SHOP_PROP } from "./domain/shop-prop-options";
  import ShopPropPicker from "./components/ShopPropPicker.svelte";
  import { loopPreviewCards } from "./services/loop-preview-cards";
  import type { CoverCard } from "./domain/models/product";
  import {
    AVAILABLE_LENGTHS,
    availableFlavors,
    flavorSlugFromComponents,
    flavorForLoopType,
    flavorLabel,
    LEVEL_MIX_COPY,
    LENGTH_MIX_COPY,
    VARIETY_COPY,
    TURN_VALUES_WHOLE,
    TURN_VALUES_HALF,
    DEFAULT_MAX_TURNS,
    LOOP_PACKS,
    loopPack,
    type LoopPackId,
    type LoopLevel,
    type LoopLength,
    type LoopFlavor,
    type LoopConfig,
  } from "./domain/loop-config";
  import { getActivityLogger } from "$lib/shared/analytics/get-activity-logger";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
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

  // ── the packs vs the dials: packs are RECIPES the dials can't express
  //    (multi-length, multi-level, per-slice turn caps), so the pack selection
  //    is explicit state, not derived from dial equality. Page loads buyable
  //    untouched on Mild; touching any dial drops into Custom mode. ──
  let pack = $state<LoopPackId | null>("mild");
  function leaveCustom(id: LoopPackId) {
    pack = id;
    buzz();
    getActivityLogger().logActivity("shop_loop_pack_selected", "shop", { pack: id });
  }
  function enterCustom() {
    if (pack !== null) {
      pack = null;
      getActivityLogger().logActivity("shop_loop_custom_entered", "shop");
    }
  }
  const activePack = $derived(pack ? loopPack(pack) : null);

  // ── the dials (Custom mode) — default to rotated: the only flavor with
  //    reliably great mandalas. ──
  let level = $state<LoopLevel>("1");
  let length = $state<LoopLength>("8");
  let flavor = $state<LoopFlavor>("rotated");
  let propType = $state<PropType>(DEFAULT_SHOP_PROP);

  const flavorsForLevel = $derived(availableFlavors(level));
  // Level change can strand the flavor (kept as a guard; every flavor is
  // currently generable at every level).
  $effect(() => {
    if (!flavorsForLevel.includes(flavor)) flavor = "rotated";
  });

  // ── flavor ⇄ LOOP overlay bridge: the picker IS the generate panel's
  //    LOOPExpandedOverlay; it speaks LOOPType, checkout speaks flavor slugs.
  const currentLoopType = $derived(
    flavor === "variety"
      ? LOOPType.ROTATED
      : (generateLOOPType(new Set(flavor.split("-") as unknown as LOOPComponent[])) ??
          // Every LOOP_FLAVORS slug maps to an implemented type; this guard
          // only matters if the checkout whitelist ever drifts ahead of the engine.
          LOOPType.ROTATED)
  );
  const currentLoopComponents = $derived(parseLoopComponents(currentLoopType));

  // ── reward loop: a haptic tick on every commit (spring lives in BaseCard) ──
  const haptics = getHapticFeedback();
  function buzz() {
    haptics?.trigger("selection");
  }

  // ── Buy payoff: building the checkout session costs 1–3s of network anyway,
  //    so fill the dead time with the deal-and-spread flourish (approved via
  //    the payoff prototype). Purely reactive to isCheckingOut — no change to
  //    the checkout call itself. On checkout error the flags reset clean. ──
  let dealNonce = $state(0);
  let payoffShown = $state(false);
  let shineRun = $state(false);
  let payoffTimer: ReturnType<typeof setTimeout> | undefined;
  let previewBoxEl = $state<HTMLDivElement | null>(null);
  // Narrow stage (phones): fewer, bigger cards — the forced 6-card variety fan
  // rendered thumbnail-size cards in a mostly-empty box.
  let previewW = $state(0);
  let previewH = $state(0);
  const narrowPreview = $derived(previewW > 0 && previewW < 640);
  // Card height ceiling from the fixed stage: card (5:7) + description + gaps
  // must fit inside the box, so cards grow into tall stages without clipping.
  const previewMaxCardW = $derived(
    previewH > 0 ? Math.max(150, Math.round(((previewH - 150) * 5) / 7)) : 340
  );
  let wasCheckingOut = false;
  $effect(() => {
    const checking = store.isCheckingOut;
    if (checking && !wasCheckingOut) startPayoff();
    else if (!checking && wasCheckingOut) resetPayoff();
    wasCheckingOut = checking;
  });
  function startPayoff() {
    dealNonce++;
    haptics?.trigger("success");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Vertical layout: the buy button always sits below the stage — bring the
    // flourish into view so the payoff isn't playing off-screen.
    previewBoxEl?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "center",
    });
    clearTimeout(payoffTimer);
    // Shimmer + ready-chip once the re-deal settles (gather, deal, last stagger).
    const settle = reduced ? 0 : FAN_GATHER_MS + FAN_DEAL_MS + FAN_DEAL_STAGGER * 5;
    payoffTimer = setTimeout(() => {
      shineRun = true;
      payoffShown = true;
    }, settle);
  }
  function resetPayoff() {
    clearTimeout(payoffTimer);
    payoffShown = false;
    shineRun = false;
  }
  // Dev-only: lets the flourish be exercised (and eyeballed) without creating
  // a real Stripe checkout session.
  if (import.meta.env.DEV && typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__tkaPayoff = startPayoff;
  }

  // ── pack chips: the primary product tier. Heat ramp (cool → amber → red)
  //    reads the difficulty ladder at a glance without a legend. ──
  const PACK_BG: Record<LoopPackId, string> = {
    mild: "linear-gradient(135deg, #7dd3fc 0%, #38bdf8 50%, #0ea5e9 100%)",
    medium: "linear-gradient(135deg, #fcd34d 0%, #f59e0b 50%, #d97706 100%)",
    spicy: "linear-gradient(135deg, #f87171 0%, #ef4444 45%, #b91c1c 100%)",
  };
  const PACK_TEXT: Record<LoopPackId, string> = {
    mild: "#062033",
    medium: "#2a1602",
    spicy: "#ffffff",
  };
  // The 4th chip: Custom. Violet (the app accent family) so it reads as a
  // sibling option, not a heat level.
  const CUSTOM_BG = "linear-gradient(135deg, #a78bfa 0%, #8b5cf6 50%, #6d28d9 100%)";

  // ── bento palette: LOOP/prop tile gradients (shared with the deck-releaser
  //    LoopBentoBoard so the surfaces match). ──
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

  // ── Level / Length: the generate panel's colored StepperCards, straight from
  //    the LoopBentoBoard blueprint. Steppers are honest here because the
  //    ranges are genuinely ordinal (1→3, 8→16); "mix" is never a stepper stop —
  //    it exists only via the Sampler preset / fine-tune panel, and any ±
  //    press from a mix state snaps back onto the scale. ──
  const levelNum = $derived(level === "mix" ? 2 : Number(level));
  const levelTileColor = $derived(
    level === "mix"
      ? MIX_LEVEL_COLOR
      : (DIFFICULTY_LEVELS[levelNum]?.cssBg ?? SECONDARY_TILE_COLOR)
  );
  const levelTileText = $derived(
    level === "mix" ? "#0b1220" : (DIFFICULTY_LEVELS[levelNum]?.text ?? "white")
  );
  function stepLevel(dir: number) {
    enterCustom();
    if (level === "mix") level = dir > 0 ? "3" : "1";
    else level = String(Math.max(1, Math.min(3, Number(level) + dir))) as LoopLevel;
    buzz();
  }
  const LENGTH_STEPS = AVAILABLE_LENGTHS.map(Number);
  const lengthNum = $derived(length === "mix" ? 8 : Number(length));
  function stepLength(dir: number) {
    enterCustom();
    if (length === "mix") {
      length = "8";
    } else {
      const i = LENGTH_STEPS.indexOf(Number(length));
      const next = LENGTH_STEPS[Math.max(0, Math.min(LENGTH_STEPS.length - 1, i + dir))];
      length = String(next) as LoopLength;
    }
    buzz();
  }
  const levelDesc = $derived(
    level === "mix" ? LEVEL_MIX_COPY : (LEVEL_DESC[level] ?? "")
  );
  const lengthDesc = $derived(
    length === "mix" ? LENGTH_MIX_COPY : "STEPS PER CARD"
  );

  // ── Max turns: only exists at Level 2+ (Level 1 IS no turns) — the tile
  //    morphs in exactly like the deck releaser's. Defaults to 1: the
  //    "don't go over 1 if you're new" recommendation, baked in as the
  //    default instead of a warning label. Half steps unlock at Level 3. ──
  let turnIntensity = $state(DEFAULT_MAX_TURNS);
  const showTurns = $derived(level !== "1");
  const turnAllowed = $derived(level === "3" ? TURN_VALUES_HALF : TURN_VALUES_WHOLE);
  // Dropping from L3 snaps a fractional ceiling onto the whole-turn scale.
  $effect(() => {
    if (level !== "3" && (turnIntensity * 1) % 1 !== 0)
      turnIntensity = Math.round(turnIntensity);
  });
  function setTurns(v: number) {
    enterCustom();
    turnIntensity = v;
    buzz();
  }

  // Fine-tune panel removed 2026-07-12: levelBalance/excludeFlavors couldn't
  // express what a power customizer actually wants (multi-slice recipes), and
  // the panel dragged the visual bar down. Domain + checkout still accept the
  // fields; a slice-based recipe builder is the real successor if demand shows.

  const loopConfig = $derived.by<LoopConfig>(() => {
    // Pack selected → the pack id IS the order; fulfillment resolves the
    // recipe from LOOP_PACKS. No dial fields ride along (pack XOR dials).
    if (pack) return { pack };
    const cfg: LoopConfig = { level, length, flavor };
    // Max turns rides on every Level 2+ order — fulfillment never guesses.
    if (level !== "1") return { ...cfg, custom: { maxTurns: turnIntensity } };
    return cfg;
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
        return slug != null;
      })
      .map((p) => p.coverCards?.[0])
      .filter((c): c is NonNullable<typeof c> => c != null)
  );
  // Level-aware hand sampled from the real catalogs — the fan must DEMONSTRATE
  // the dials (Deep Cuts shows actual Level 2 rotated sequences, not the
  // level-blind SKU covers). SKU covers stay as the instant fallback while the
  // catalog sample loads or if it fails.
  // Re-dealing is reserved for MAJOR changes — picking a pack (or dropping
  // out of one). Dial changes swap the card faces IN PLACE: generation starts
  // immediately on any change and commits once the dials have been still for
  // SETTLE_MS, but the fan itself never re-deals for a dial tweak.
  const SETTLE_MS = 650;
  let previewCards = $state<CoverCard[] | null>(null);
  // Drives the Crossfade remount (= the deal). Changes ONLY across pack↔pack
  // and pack↔custom transitions, never on dial or prop tweaks. Seeded with
  // the key the first settle will produce ("pack:mild") — a "boot" seed made
  // the fan deal twice on page enter: once on mount with the SKU fallback,
  // then again when the first catalog sample landed and flipped the key.
  let settledFanKey = $state(pack ? `pack:${pack}` : "custom");
  let previewToken = 0;
  let lastDialTouch = 0;
  const dialKey = $derived(
    `${pack ?? "custom"}|${level}|${length}|${flavor}|${propType}|${turnIntensity}`
  );
  $effect(() => {
    if (flavorSkus.length === 0) return;
    void dialKey; // any dial change re-runs the fetch
    const fanKey = pack ? `pack:${pack}` : "custom";
    const dials = {
      pack,
      level,
      length,
      flavor,
      maxTurns: turnIntensity,
      propType,
      excluded: new Set<LoopFlavor>(),
      skuByFlavor,
    };
    const token = ++previewToken;
    lastDialTouch = Date.now();
    loopPreviewCards(dials).then((cards) => {
      if (token !== previewToken) return; // superseded by a newer touch
      const wait = Math.max(0, SETTLE_MS - (Date.now() - lastDialTouch));
      setTimeout(() => {
        if (token !== previewToken) return;
        previewCards = cards?.length ? cards : null;
        settledFanKey = fanKey;
      }, wait);
    });
  });
  const fanCards = $derived(
    previewCards ?? (selectedSku ? (selectedSku.coverCards ?? []) : varietyCards)
  );
  // Stage caption stays short: whole sentences up to ~160 chars. The full
  // flavor copy lives in the flavor modal — the stage is for the cards.
  function stageCaption(text: string): string {
    if (text.length <= 160) return text;
    const cut = text.slice(0, 160);
    const lastSentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(": "));
    if (lastSentence > 60) return cut.slice(0, lastSentence + 1);
    return cut.slice(0, cut.lastIndexOf(" ")) + "…";
  }
  const previewDesc = $derived(
    stageCaption(
      activePack
        ? activePack.tagline
        : flavor === "variety"
          ? VARIETY_COPY
          : (selectedSku?.description ??
              generateExplanationText(currentLoopComponents))
    )
  );

  $effect(() => {
    const all = flavorSkus.flatMap((p) => p.coverCards ?? []);
    if (all.length) prewarmCovers(all, propType);
  });

  const flavorTileValue = $derived(flavorLabel(flavor));
  const price = $derived(
    customSku ? `$${(customSku.price / 100).toFixed(0)}` : "$30"
  );

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
          <div
            class="preview-box"
            class:payoff-active={payoffShown}
            bind:this={previewBoxEl}
            bind:clientWidth={previewW}
            bind:clientHeight={previewH}
          >
            <!-- fill mode: the stage is the sized box, so config swaps can
                 never resize it (crossfade-primitive routing). -->
            <!-- Keyed on pack identity only: picking a pack (or leaving one)
                 re-deals; dial tweaks swap the card faces in place. -->
            <Crossfade key={settledFanKey} fill>
              <div class="preview-inner">
                <!-- Non-interactive on purpose: the fan sizes against the rest
                     overlap instead of reserving hover-spread width, which buys
                     ~20% bigger cards. maxCardWidth caps against the stage
                     height so a tall card can never clip the fixed box. -->
                <DeckFanCover
                  cards={fanCards}
                  deckId={selectedSku?.deckId}
                  deckName={activePack
                    ? `${activePack.name} pack`
                    : (selectedSku?.name ?? "LOOP Deck")}
                  {propType}
                  cardWidth={narrowPreview ? 150 : previewW >= 1200 ? 280 : 210}
                  maxCardWidth={previewMaxCardW}
                  exactCount={!activePack && flavor === "variety"
                    ? Math.min(narrowPreview ? 4 : 5, fanCards.length)
                    : undefined}
                  interactive={false}
                  deal
                  {dealNonce}
                />
                <p class="preview-desc">{previewDesc}</p>
              </div>
            </Crossfade>
            <!-- Buy payoff overlays: one foil sweep + the ready chip, both
                 absolutely stacked so nothing in the stage reflows. -->
            <div class="payoff-shine" class:run={shineRun} aria-hidden="true"></div>
            {#if payoffShown}
              <div
                class="payoff-chip"
                transition:scale={{ duration: 300, easing: quintOut, start: 0.85 }}
              >
                Your deck is ready · 54 cards · {price}
              </div>
            {/if}
          </div>
        </div>

        <!-- ============ choices band: controls left, buy rail right on wide
             screens — the whole page fits one viewport instead of scrolling
             past a narrow single column. ============ -->
        <div class="info-column">
          <div class="info-main">
          <span class="eyebrow">The deck</span>
          <h1>LOOP Deck</h1>
          <p class="meta">54 cards · every sequence loops · pick a pack or go custom</p>

          <!-- ── one visible 4-way choice: three packs + Custom. Custom is a
               real chip, not an invisible fallback state — a newcomer reads
               "which of these four is checked" at a glance. ── -->
          <div class="preset-row" role="group" aria-label="Deck options">
            {#each LOOP_PACKS as p (p.id)}
              <button
                type="button"
                class="preset"
                class:active={pack === p.id}
                aria-pressed={pack === p.id}
                style:--preset-bg={PACK_BG[p.id]}
                style:--preset-text={PACK_TEXT[p.id]}
                onclick={() => leaveCustom(p.id)}
              >
                <span class="preset-name">{p.name}</span>
                <span class="preset-sub">{p.sub}</span>
                {#if pack === p.id}
                  <i class="fas fa-check-circle preset-check" aria-hidden="true"></i>
                {/if}
              </button>
            {/each}
            <!-- Custom hands off to the Deck Architect — its slice builder
                 outgrew the inline dials, so the listing stays a dead-simple
                 pack-and-prop choice. -->
            <a
              class="preset"
              href="/shop/loop-deck/architect"
              style:--preset-bg={CUSTOM_BG}
              style:--preset-text="#ffffff"
            >
              <span class="preset-name">Custom</span>
              <span class="preset-sub">open the Deck Architect</span>
              <i class="fas fa-arrow-right preset-check" aria-hidden="true"></i>
            </a>
          </div>
          <!-- Composition line: names the selected option and its recipe.
               Reserved height so pack↔custom swaps never shove the board. -->
          <p class="composition-line" class:custom={!activePack}>
            {activePack
              ? `${activePack.name}: ${activePack.composition}`
              : "Custom: the dials below drive your order."}
          </p>

          <!-- ── the bento board. Custom dials moved to the Deck Architect —
               a pack buyer sees three packs and a prop, nothing else. ── -->
          <div class="bento-board">
            <!-- Prop: always visible, pack or custom — picking your prop is
                 giving us your order, not customizing the recipe. -->
            <div class="tile-row">
              <div class="tile prop-shell">
                <BaseCard
                  title="Prop"
                  currentValue=""
                  clickable={false}
                  color={SECONDARY_TILE_COLOR}
                  shadowColor="0deg 0% 0%"
                  gridColumnSpan={2}
                >
                  <ShopPropPicker
                    value={propType}
                    onchange={(p) => {
                      propType = p;
                      buzz();
                    }}
                  />
                </BaseCard>
              </div>
            </div>

          </div>

          </div>

          <aside class="buy-rail">
          <p class="price">{price}</p>
          <!-- Fixed specs this beta run — information, not dead buttons. -->
          <p class="spec-line">
            Poker size · 2.5" × 3.5" <span class="spec-sep">•</span> Deck only
            <span class="spec-sep">•</span> Tarot size and bundles coming soon
          </p>

          {#if customSku}
            <BuyButton
              product={customSku}
              {propType}
              {loopConfig}
              label="Preorder now"
              waitlistText="Preorders open soon. Leave an email and you'll hear the moment they do."
            />
          {:else if flavorSkus[0]}
            <!-- Custom SKU not seeded/active yet: honest gate via the first
                 flavor SKU's waitlist (it has no Stripe price either). -->
            <BuyButton
              product={flavorSkus[0]}
              {propType}
              {loopConfig}
              label="Preorder now"
              waitlistText="Preorders open soon. Leave an email and you'll hear the moment they do."
            />
          {/if}
          {#if store.checkoutError}
            <p class="checkout-error" role="alert">{store.checkoutError}</p>
          {/if}

          <ul class="assurance">
            <li><i class="fas fa-calendar-check" aria-hidden="true"></i> Preorder now. Decks ship October 1.</li>
            <li><i class="fas fa-box-open" aria-hidden="true"></i> Explainer card, laminated quick-reference sheet, and deck box included</li>
            <li><i class="fas fa-hand-holding-heart" aria-hidden="true"></i> Printed and cut by hand in Chicago, small batches</li>
          </ul>
          </aside>
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
    padding: 12px 24px 20px;
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

  /* Vertical hero layout: the fan is the star, centered and full-band up
     top; the controls sit in a centered column beneath it. Kills the 4K
     side-by-side problems — clipped cards on the left, dead space under the
     fan, and a stage narrower than the screen deserves. */
  .config-layout {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(16px, 2.2vh, 28px);
  }
  .preview-column {
    width: 100%;
  }
  /* Full-band controls: no max-width choke. Wide screens split into the
     controls (left) and a buy rail (right) so hero + everything below fits
     one viewport without scrolling. */
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
  /* The rail is a purchase CARD, not loose text floating in dead space:
     one bounded surface holds price → specs → buy → assurances, so the
     right column reads as a unit with its own header (the price). */
  .buy-rail {
    padding: 22px 24px;
    border-radius: 18px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    align-self: start;
  }
  @media (min-width: 1360px) {
    /* The rail's price+buy block lines up with the board, not the H1. */
    .buy-rail {
      margin-top: 92px;
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
       so no config swap can resize the box (no-layout-shift by construction).
       Hero-scaled but budgeted: stage + controls band must share one viewport. */
    height: clamp(340px, 38vh, 600px);
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
    font-size: var(--font-size-base, 16px);
    line-height: 1.65;
    color: rgba(255, 255, 255, 0.88);
    margin: 0;
    text-align: center;
    /* No width choke: with a whole band of room, a short caption stays on one
       line instead of wrapping mid-phrase. Padding is the only guard. */
    padding: 0 16px;
    align-self: center;
    transition: opacity 250ms ease;
  }
  /* While the ready chip is up it owns the stage: the description fades but
     keeps its space (visibility trick, no layout shift). */
  .preview-box.payoff-active .preview-desc {
    opacity: 0;
  }

  /* ---------- buy payoff (shine sweep + ready chip) ---------- */
  .payoff-shine {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(
      115deg,
      transparent 42%,
      rgba(255, 255, 255, 0.13) 50%,
      transparent 58%
    );
    transform: translateX(-120%);
    opacity: 0;
    z-index: 2;
  }
  .payoff-shine.run {
    animation: payoff-sweep 950ms ease-out forwards;
  }
  @keyframes payoff-sweep {
    from {
      opacity: 1;
      transform: translateX(-120%);
    }
    to {
      opacity: 0;
      transform: translateX(120%);
    }
  }

  .payoff-chip {
    position: absolute;
    left: 50%;
    bottom: clamp(14px, 3vw, 26px);
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    padding: 10px 20px;
    border-radius: 999px;
    font-weight: 700;
    font-size: var(--font-size-min, 14px);
    color: #171204;
    background: linear-gradient(135deg, #e8d35c 0%, #d9c24a 45%, #a89a2c 100%);
    box-shadow: 0 4px 18px rgba(217, 194, 74, 0.3);
    white-space: nowrap;
    z-index: 3;
  }

  @media (prefers-reduced-motion: reduce) {
    .payoff-shine {
      display: none;
    }
  }

  /* ---------- info ---------- */
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
  }

  /* ---------- preset decks ---------- */
  .preset-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .preset {
    position: relative;
    flex: 1 1 160px;
    /* The Custom chip is an <a> now — keep it visually identical to the
       pack buttons. */
    text-decoration: none;
    min-width: 140px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    min-height: 56px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    /* Each preset wears its level color — the one-tap row is the headline act. */
    background: var(--preset-bg, linear-gradient(135deg, rgba(139, 108, 255, 0.10), rgba(139, 108, 255, 0.02)));
    color: var(--preset-text, var(--theme-text, #fff));
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease, filter 0.15s ease;
  }
  .preset:hover {
    border-color: rgba(255, 255, 255, 0.55);
    filter: none;
    transform: translateY(-1px);
  }
  .preset:active {
    transform: scale(0.98);
  }
  /* Inactive presets sit back a step; the active one is at full color with a
     ring — selection reads at a glance without any of them going grey. */
  .preset:not(.active) {
    filter: saturate(0.72) brightness(0.82);
  }
  .preset:not(.active):hover {
    filter: none;
  }
  .preset.active {
    border-color: rgba(255, 255, 255, 0.85);
    box-shadow:
      0 0 0 2px rgba(255, 255, 255, 0.35),
      0 6px 18px rgba(0, 0, 0, 0.4);
  }
  .preset:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }
  .preset-name {
    font-size: var(--font-size-min, 14px);
    font-weight: 800;
    letter-spacing: 0.1px;
  }
  .preset-sub {
    font-size: 13px;
    opacity: 0.92;
    font-variant-numeric: tabular-nums;
  }
  /* The "you are here" mark — selection must survive a squint. */
  .preset-check {
    position: absolute;
    top: 9px;
    right: 11px;
    font-size: 15px;
  }

  /* The recipe line under the chips. Always rendered (pack recipe OR the
     custom-mode note) so pack↔custom swaps never shove the board below. */
  .composition-line {
    margin: 8px 0 0;
    min-height: 1.4em;
    font-size: var(--font-size-min, 14px);
    font-variant-numeric: tabular-nums;
    color: rgba(255, 255, 255, 0.85);
  }
  .composition-line.custom {
    opacity: 0.85;
  }

  /* ---------- bento board ---------- */
  .bento-board {
    display: flex;
    flex-direction: column;
    gap: 12px;
    transition: opacity 0.25s ease;
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
  .bento-board :global(.card-title) {
    font-size: var(--font-size-compact, 12px) !important;
    letter-spacing: 0.8px !important;
  }


  /* ---------- prop tile (BaseCard shell + image chips) ---------- */
  .tile-row > .tile.prop-shell {
    height: 132px; /* room for the 42px prop art + label inside the shell */
  }
  .prop-shell :global(.card-value) {
    display: none;
  }
  .prop-shell :global(.card-content) {
    margin-top: 0;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }


  /* Fixed specs: reads as information, not as disabled controls. */
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
    font-size: 15px;
    color: rgba(255, 255, 255, 0.85);
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
    .preset,
    .bento-board {
      transition: none;
    }
  }
</style>
