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
  import DeckFanCover, {
    DEAL_MS as FAN_DEAL_MS,
    DEAL_STAGGER as FAN_DEAL_STAGGER,
    GATHER_MS as FAN_GATHER_MS,
  } from "./components/DeckFanCover.svelte";
  import LoopChips from "./components/LoopChips.svelte";
  import BuyButton from "./components/BuyButton.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import BaseCard from "$lib/features/create/generate/components/cards/BaseCard.svelte";
  import StepperCard from "$lib/features/create/generate/components/cards/StepperCard/StepperCard.svelte";
  import LOOPExpandedOverlay from "$lib/features/create/generate/components/cards/LOOPExpandedOverlay.svelte";
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
  import { scale } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { prewarmCovers } from "./services/cover-front-renderer";
  import {
    DEFAULT_SHOP_PROP,
    SHOP_PROP_OPTIONS,
    shopPropImage,
    shopPropLabel,
  } from "./domain/shop-prop-options";
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
    type LoopLevel,
    type LoopLength,
    type LoopFlavor,
    type LoopConfig,
  } from "./domain/loop-config";
  import TurnIntensityCard from "$lib/features/create/generate/components/cards/TurnIntensityCard.svelte";
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
  // Level change can strand the flavor (kept as a guard; every flavor is
  // currently generable at every level).
  $effect(() => {
    if (!flavorsForLevel.includes(flavor)) flavor = "variety";
  });

  // ── flavor ⇄ LOOP overlay bridge: the picker IS the generate panel's
  //    LOOPExpandedOverlay; it speaks LOOPType, checkout speaks flavor slugs.
  const currentLoopType = $derived(
    flavor === "variety"
      ? LOOPType.ROTATED
      : generateLOOPType(new Set(flavor.split("-") as unknown as LOOPComponent[]))
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
    // The buy button sits below the stage on narrow layouts — bring the
    // flourish into view so the payoff isn't playing off-screen.
    if (window.innerWidth < 1200)
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
  // Each preset wears its level's color — the one-tap row should out-shine the
  // board it configures, not read as an afterthought above it.
  function presetBg(p: Preset): string {
    if (p.level === "mix") return MIX_LEVEL_COLOR;
    return DIFFICULTY_LEVELS[Number(p.level)]?.cssBg ?? SECONDARY_TILE_COLOR;
  }
  function presetText(p: Preset): string {
    if (p.level === "mix") return "#0b1220";
    return DIFFICULTY_LEVELS[Number(p.level)]?.text ?? "white";
  }
  function applyPreset(p: Preset) {
    level = p.level;
    length = p.length;
    flavor = p.flavor;
    propType = p.prop;
    turnIntensity = DEFAULT_MAX_TURNS;
    buzz();
  }
  const activePreset = $derived(
    PRESETS.find(
      (p) =>
        p.level === level &&
        p.length === length &&
        p.flavor === flavor &&
        p.prop === propType &&
        turnIntensity === DEFAULT_MAX_TURNS
    )?.id ?? null
  );

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
    if (level === "mix") level = dir > 0 ? "3" : "1";
    else level = String(Math.max(1, Math.min(3, Number(level) + dir))) as LoopLevel;
    buzz();
  }
  const LENGTH_STEPS = AVAILABLE_LENGTHS.map(Number);
  const lengthNum = $derived(length === "mix" ? 8 : Number(length));
  function stepLength(dir: number) {
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
    turnIntensity = v;
    buzz();
  }

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
    const custom: NonNullable<LoopConfig["custom"]> = {};
    // Max turns rides on every Level 2+ order — fulfillment never guesses.
    if (level !== "1") custom.maxTurns = turnIntensity;
    if (customTouched) {
      if (level === "mix") custom.levelBalance = levelBalance;
      if (flavor === "variety" && excluded.size > 0)
        custom.excludeFlavors = [...excluded];
    }
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
  // Level-aware hand sampled from the real catalogs — the fan must DEMONSTRATE
  // the dials (Deep Cuts shows actual Level 2 rotated sequences, not the
  // level-blind SKU covers). SKU covers stay as the instant fallback while the
  // catalog sample loads or if it fails.
  let previewCards = $state<CoverCard[] | null>(null);
  let previewToken = 0;
  $effect(() => {
    if (flavorSkus.length === 0) return;
    const dials = { level, length, flavor, excluded, skuByFlavor };
    const token = ++previewToken;
    previewCards = null; // fall back to SKU covers while the sample loads
    loopPreviewCards(dials).then((cards) => {
      if (token === previewToken && cards?.length) previewCards = cards;
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
      flavor === "variety"
        ? VARIETY_COPY
        : (selectedSku?.description ??
            generateExplanationText(currentLoopComponents))
    )
  );

  $effect(() => {
    const all = flavorSkus.flatMap((p) => p.coverCards ?? []);
    if (all.length) prewarmCovers(all, propType);
  });

  const flavorName = (name: string) => name.replace(/\s*LOOP Deck$/i, "");
  const flavorTileValue = $derived(flavorLabel(flavor));
  const price = $derived(
    customSku ? `$${(customSku.price / 100).toFixed(0)}` : "$30"
  );

  // ── drill-down modal (flavor only — prop picks inline) ──
  let showFlavor = $state(false);
  function onWindowKey(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    if (showFlavor) showFlavor = false;
  }

  // SKU-backed flavor slugs (drives the advanced panel's exclude chips).
  const flavorOrder = $derived<LoopFlavor[]>([
    "variety",
    ...flavorSkus
      .map((p) => flavorSlugFromComponents(p.loopComponents ?? []))
      .filter((s): s is LoopFlavor => s != null),
  ]);

  function pickLoopType(lt: LOOPType) {
    flavor = flavorForLoopType(lt) ?? "variety";
    buzz();
    showFlavor = false;
  }
  function pickVariety() {
    flavor = "variety";
    buzz();
    showFlavor = false;
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
          <div
            class="preview-box"
            class:payoff-active={payoffShown}
            bind:this={previewBoxEl}
            bind:clientWidth={previewW}
            bind:clientHeight={previewH}
          >
            <!-- fill mode: the stage is the sized box, so config swaps can
                 never resize it (crossfade-primitive routing). -->
            <Crossfade key={`${level}|${length}|${flavor}|${propType}|${excluded.size}`} fill>
              <div class="preview-inner">
                <!-- Non-interactive on purpose: the fan sizes against the rest
                     overlap instead of reserving hover-spread width, which buys
                     ~20% bigger cards. maxCardWidth caps against the stage
                     height so a tall card can never clip the fixed box. -->
                <DeckFanCover
                  cards={fanCards}
                  deckId={selectedSku?.deckId}
                  deckName={selectedSku?.name ?? "Variety Pack"}
                  {propType}
                  cardWidth={narrowPreview ? 150 : 210}
                  maxCardWidth={previewMaxCardW}
                  exactCount={flavor === "variety"
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
                style:--preset-bg={presetBg(p)}
                style:--preset-text={presetText(p)}
                onclick={() => applyPreset(p)}
              >
                <span class="preset-name">{p.name}</span>
                <span class="preset-sub">{p.sub}</span>
              </button>
            {/each}
          </div>

          <!-- ── primary bento board ── -->
          <div class="bento-board">
            <!-- Level / Length: the generate panel's colored StepperCards
                 (LoopBentoBoard blueprint — Level wears DIFFICULTY colors). -->
            <div class="tile-row">
              <div class="tile">
                <StepperCard
                  title="Level"
                  currentValue={levelNum}
                  minValue={1}
                  maxValue={3}
                  formatValue={(v: number) => (level === "mix" ? "Mix" : String(v))}
                  description={levelDesc}
                  color={levelTileColor}
                  textColor={levelTileText}
                  shadowColor="0deg 0% 0%"
                  gridColumnSpan={2}
                  onIncrement={() => stepLevel(1)}
                  onDecrement={() => stepLevel(-1)}
                />
              </div>
              <div class="tile">
                <StepperCard
                  title="Length"
                  currentValue={lengthNum}
                  minValue={8}
                  maxValue={16}
                  formatValue={(v: number) => (length === "mix" ? "Mix" : String(v))}
                  description={lengthDesc}
                  color={cc.length.color}
                  shadowColor={cc.length.shadowColor}
                  gridColumnSpan={2}
                  onIncrement={() => stepLength(1)}
                  onDecrement={() => stepLength(-1)}
                />
              </div>
              <!-- Max turns exists only once turns exist (Level 2+): the tile
                   morphs in from the right, exactly like the deck releaser's. -->
              <div class="tile turns" class:collapsed={!showTurns} aria-hidden={!showTurns}>
                <TurnIntensityCard
                  currentIntensity={turnIntensity}
                  allowedValues={[...turnAllowed]}
                  onIntensityChange={setTurns}
                  shadowColor="140deg 70% 45%"
                  gridColumnSpan={2}
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

            <!-- Prop: a real bento tile (BaseCard shell, size-tile content-slot
                 pattern) holding the exactly-one image chips — one tap, no modal. -->
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
                  <div class="prop-row" role="radiogroup" aria-label="Prop">
                    {#each SHOP_PROP_OPTIONS as p (p)}
                      <button
                        type="button"
                        class="prop-chip"
                        class:selected={propType === p}
                        role="radio"
                        aria-checked={propType === p}
                        onclick={() => {
                          propType = p;
                          buzz();
                        }}
                      >
                        <span class="prop-chip-frame">
                          <img src={shopPropImage(p)} alt="" draggable="false" />
                        </span>
                        <span class="prop-chip-label">{shopPropLabel(p)}</span>
                      </button>
                    {/each}
                  </div>
                </BaseCard>
              </div>
            </div>

            <!-- Fixed specs this beta run — information, not dead buttons. -->
            <p class="spec-line">
              Poker size · 2.5" × 3.5" <span class="spec-sep">•</span> Deck only
              <span class="spec-sep">•</span> Tarot size and bundles coming soon
            </p>
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
      class="loop-col"
      transition:scale={{ start: 0.95, duration: 250, easing: quintOut }}
    >
      <!-- Variety Pack rides above the real LOOP selector: it's the curated
           blend, not a LOOP type, so it can't live inside the overlay grid. -->
      <button
        type="button"
        class="variety-cta"
        class:active={flavor === "variety"}
        onclick={pickVariety}
      >
        <span class="variety-name">Variety Pack</span>
        <span class="variety-sub">a curated blend of every flavor · the default</span>
      </button>
      <div class="loop-host">
        <LOOPExpandedOverlay
          currentType={currentLoopType}
          selectedComponents={currentLoopComponents}
          onChange={(lt: LOOPType) => pickLoopType(lt)}
          onClose={() => (showFlavor = false)}
        />
      </div>
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
    font-size: var(--font-size-compact, 12px);
    opacity: 0.78;
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
  /* Flavor hero: full-width identity tile, a touch taller than the seg panels. */
  .tile-row > .tile.hero {
    flex: 1 1 100%;
    height: 132px;
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

  /* Turn-intensity morph (deck-releaser pattern): at Level 1 the tile
     collapses to zero width; at Level 2+ it slides in. Animated flex (not an
     {#if}) so the row reflows smoothly. margin cancels the empty tile's gap. */
  .tile-row > .tile.turns {
    min-width: 0;
    overflow: hidden;
    transition:
      flex-basis 340ms cubic-bezier(0.4, 0, 0.2, 1),
      flex-grow 340ms cubic-bezier(0.4, 0, 0.2, 1),
      margin-left 340ms cubic-bezier(0.4, 0, 0.2, 1),
      opacity 240ms ease;
  }
  .tile-row > .tile.turns.collapsed {
    flex: 0 0 0;
    opacity: 0;
    pointer-events: none;
    margin-left: -12px;
  }
  @media (prefers-reduced-motion: reduce) {
    .tile-row > .tile.turns {
      transition-duration: 0.001ms;
    }
  }

  /* ---------- prop tile (BaseCard shell + image chips) ---------- */
  .tile-row > .tile.prop-shell {
    height: 128px;
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

  /* Prop chips: exactly-one image chips, selected wears the prop purple.
     One row always — chips shrink fluidly instead of wrapping out of the tile. */
  .prop-row {
    display: flex;
    flex-wrap: nowrap;
    justify-content: center;
    gap: clamp(4px, 1vw, 8px);
    width: 100%;
    min-width: 0;
  }
  .prop-chip {
    flex: 1 1 0;
    min-width: 0;
    max-width: 112px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 4px 7px;
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    color: var(--theme-text, #fff);
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease, transform 0.1s ease;
  }
  .prop-chip:hover {
    border-color: rgba(216, 180, 254, 0.55);
  }
  .prop-chip:active {
    transform: scale(0.97);
  }
  .prop-chip:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }
  .prop-chip.selected {
    border-color: #d8b4fe;
    background: linear-gradient(135deg, #a855f7 0%, #9333ea 50%, #7e22ce 100%);
    box-shadow: 0 4px 14px rgba(147, 51, 234, 0.35);
  }
  .prop-chip-frame {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.1);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
  }
  .prop-chip.selected .prop-chip-frame {
    background: rgba(255, 255, 255, 0.2);
  }
  .prop-chip-frame img {
    width: 22px;
    height: 22px;
    object-fit: contain;
    pointer-events: none;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
  }
  .prop-chip-label {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    font-weight: 700;
  }

  /* Fixed specs: reads as information, not as disabled controls. */
  .spec-line {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    text-align: center;
  }
  .spec-sep {
    margin: 0 6px;
    opacity: 0.5;
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

  /* ---------- flavor modal: variety CTA + the real LOOP overlay ---------- */
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
  .variety-cta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    min-height: 56px;
    padding: 10px 18px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    background: linear-gradient(135deg, #d9c24a 0%, #a89a2c 48%, #6f6318 100%);
    color: #fff;
    cursor: pointer;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    transition: transform 0.1s ease, box-shadow 0.15s ease, filter 0.15s ease;
  }
  .variety-cta:not(.active) {
    filter: saturate(0.8) brightness(0.88);
  }
  .variety-cta:hover {
    filter: none;
    transform: translateY(-1px);
  }
  .variety-cta.active {
    border-color: rgba(255, 255, 255, 0.85);
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.35);
  }
  .variety-cta:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }
  .variety-name {
    font-size: var(--font-size-min, 15px);
    font-weight: 800;
  }
  .variety-sub {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.85;
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
  @media (prefers-reduced-motion: reduce) {
    .back-button,
    .advanced-toggle,
    .preset {
      transition: none;
    }
  }
</style>
