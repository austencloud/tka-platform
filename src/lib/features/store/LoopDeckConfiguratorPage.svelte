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
  import "./styles/config-page.css";
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
  import PreorderPriceNote from "./components/PreorderPriceNote.svelte";
  import { activePriceCents, preorderWindowOpen, formatUsd } from "./domain/preorder-pricing";
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
  import { untrack } from "svelte";
  import { scale, slide, fly } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { prewarmCovers, renderCoverFront } from "./services/cover-front-renderer";
  import { DEFAULT_SHOP_PROP, bakedCoverUrl } from "./domain/shop-prop-options";
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
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const narrowPreview = $derived(previewW > 0 && previewW < 640);
  // Card height ceiling from the fixed stage: card (5:7) + description + gaps
  // must fit inside the box, so cards grow into tall stages without clipping.
  // Height reserved for the stage caption + gaps: on phones the caption is
  // hidden, so the fan claims almost the whole stage (bigger, prettier beauty
  // shot); desktop keeps room for the descriptive line beneath the fan.
  const previewMaxCardW = $derived.by(() => {
    // Mobile stage is content-sized (hugs the fan), so capping by previewH
    // would be circular. Use a fixed ceiling; the fan is width-limited on a
    // phone anyway, so this only guards ultrawide-in-narrow edge cases.
    if (narrowPreview) return 168;
    if (previewH <= 0) return 340;
    return Math.max(110, Math.round(((previewH - 110) * 5) / 7));
  });
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
    // Match the fan's own render width (DeckFanCover uses maxCardWidth × DPR),
    // so the covers we pre-warm here land in the same cache bucket the fan asks
    // for — otherwise the fan would re-render and flash shimmer anyway. Read
    // untracked: this effect must fire on DIAL changes, not on every resize
    // (previewMaxCardW is layout-reactive).
    const renderW = Math.ceil(untrack(() => previewMaxCardW) * dpr);
    loopPreviewCards(dials).then(async (cards) => {
      if (token !== previewToken) return; // superseded by a newer touch
      // Pre-render the live covers BEFORE revealing them: the current (baked
      // fallback) hand stays on screen through generation, then we swap to a
      // fully-rendered hand in one clean deal — no 5s of shimmer mid-swap.
      if (cards?.length) {
        await Promise.all(
          cards.map((c) =>
            c.sequence && !bakedCoverUrl(c, propType)
              ? renderCoverFront(c, { propType, maxWidthPx: renderW }).catch(() => {})
              : Promise.resolve()
          )
        );
      }
      if (token !== previewToken) return; // a newer touch won while we rendered
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

  // Warm the OTHER packs' fans on idle so switching difficulty is instant.
  // Only the active pack renders on mount; without this, the first click on
  // each difficulty paid a cold 6-card render through the 3-lane throttle.
  // The rendered URLs land in the service + DeckFanCover module caches, so the
  // switch then re-deals over already-resolved covers (no shimmer). Idle-
  // scheduled so it never fights the active fan's first paint; re-runs per prop
  // (a prop switch invalidates every render). Bounded: 3 packs × 6 slots.
  const warmedProps = new Set<PropType>();
  $effect(() => {
    const prop = propType;
    if (flavorSkus.length === 0 || warmedProps.has(prop)) return;
    warmedProps.add(prop);
    // Same render width the fan will request, so warmed covers hit the cache.
    const renderW = Math.ceil(untrack(() => previewMaxCardW) * dpr);
    const kick = () => {
      for (const p of LOOP_PACKS) {
        loopPreviewCards({
          pack: p.id,
          level,
          length,
          flavor,
          maxTurns: turnIntensity,
          propType: prop,
          excluded: new Set<LoopFlavor>(),
          skuByFlavor,
        })
          .then((cards) => {
            cards?.forEach((c) => {
              if (!bakedCoverUrl(c, prop))
                void renderCoverFront(c, { propType: prop, maxWidthPx: renderW });
            });
          })
          .catch(() => {});
      }
    };
    if (typeof requestIdleCallback !== "undefined")
      requestIdleCallback(kick, { timeout: 2500 });
    else setTimeout(kick, 500);
  });

  // ── mobile checkout dock (same pattern as the Deck Architect): while the
  //    buy rail is off screen on phones, a fixed dock keeps price + Preorder
  //    in reach. IntersectionObserver hides it once the real rail shows. ──
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
  let pageW = $state(0);
  const narrow = $derived(pageW > 0 && pageW < 720);
  // Mobile stage height = the fan's width-limited card height + chrome, so the
  // stage hugs the fan instead of standing tall with dead space. The fan is
  // width-driven on a phone (3 cards must share the stage width): card width =
  // stageW / ((1 + restPitch*(n-1)) * tiltSlack) = stageW / 2.313 at n=3, cap
  // 168; card height = width * 7/5; + ~62 for fan/stage padding and tilt lift.
  const mobileStageH = $derived.by(() => {
    if (previewW <= 0) return 0;
    const cardW = Math.min(168, previewW / 2.313);
    return Math.round(cardW * 1.4) + 30;
  });

  const flavorTileValue = $derived(flavorLabel(flavor));
  // Read once — the preorder→regular boundary is a fixed instant, no ticking.
  const now = Date.now();
  const price = $derived(
    customSku ? formatUsd(activePriceCents(customSku, now)) : "$30"
  );

</script>

<svelte:window bind:innerWidth={pageW} />

<div class="config-page store-config-page">
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
            style:height={narrow && mobileStageH ? `${mobileStageH}px` : undefined}
          >
            <!-- fill mode keeps the fan at full stage WIDTH (content-sizing
                 collapses it to min-content). The stage HEIGHT is driven to
                 the fan's width-limited height on mobile (see mobileStageH),
                 so the box hugs the fan with no dead gradient above/below. -->
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
          <!-- Title lockup: eyebrow rides the h1's baseline (one line, not a
               stacked throat-clear), meta is a single thin line. The
               "pick a difficulty" instruction moves down onto the bubble row
               where it's an actual label, not a third stacked sentence. -->
          <div class="title-lockup">
            <span class="eyebrow">The deck</span>
            <h1>LOOP Deck</h1>
          </div>
          <p class="meta">54 cards · every sequence loops</p>

          <!-- ── one visible 4-way choice: three difficulty tiers + Custom.
               The big numeral is the "achievable bubble" a newcomer reads
               first (1 → 2 → 3, easy to hard); the pack name + range sit under
               it so the personality survives. Custom is the 4th bubble. ── -->
          <span class="picker-label">Pick a difficulty</span>
          <div class="preset-row" role="group" aria-label="Deck difficulty">
            {#each LOOP_PACKS as p, i (p.id)}
              <button
                type="button"
                class="preset"
                class:active={pack === p.id}
                aria-pressed={pack === p.id}
                style:--preset-bg={PACK_BG[p.id]}
                style:--preset-text={PACK_TEXT[p.id]}
                onclick={() => leaveCustom(p.id)}
              >
                <span class="preset-num" aria-hidden="true">{i + 1}</span>
                <span class="preset-body">
                  <span class="preset-name">{p.name}</span>
                  <span class="preset-sub">{p.sub}</span>
                </span>
                {#if pack === p.id}
                  <i class="fas fa-check-circle preset-check" aria-hidden="true"></i>
                {/if}
              </button>
            {/each}
            <!-- Custom hands off to the Deck Architect — its slice builder
                 outgrew the inline dials, so the listing stays a dead-simple
                 pick-a-difficulty choice. -->
            <a
              class="preset preset-custom"
              href="/shop/loop-deck/architect"
              style:--preset-bg={CUSTOM_BG}
              style:--preset-text="#ffffff"
            >
              <span class="preset-num" aria-hidden="true">
                <i class="fas fa-sliders"></i>
              </span>
              <span class="preset-body">
                <span class="preset-name">Custom</span>
                <span class="preset-sub">open the Deck Architect</span>
              </span>
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

          <aside class="buy-rail" bind:this={railEl}>
          <p class="price">{price}</p>
          {#if customSku && preorderWindowOpen(customSku, now)}
            <PreorderPriceNote product={customSku} />
          {/if}
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

{#if narrow && !railInView && customSku?.stripePriceId && flavorSkus.length > 0 && !store.error}
  <div class="checkout-dock" transition:fly={{ y: 72, duration: 220, easing: quintOut }}>
    <div class="dock-meter">
      <span class="dock-pack">{activePack ? activePack.name : "Custom"}</span>
      <span class="dock-price">{price}</span>
    </div>
    <button
      type="button"
      class="dock-buy"
      disabled={store.isCheckingOut}
      onclick={() => store.startCheckout(customSku.id, propType, loopConfig)}
    >
      {store.isCheckingOut ? "Opening..." : "Preorder now"}
    </button>
  </div>
{/if}

<style>
  /* .config-page root chrome (min-height/padding-top/background/color) lives in
     the shared src/lib/features/store/styles/config-page.css, scoped under the
     .store-config-page marker class added to this root div above. */

  .config-content {
    /* Wide fluid band: the preview fan auto-scales into the extra room on 4K
       instead of the page pinning to a narrow column. Vertical padding stays
       lean so the whole configurator fits a 4K viewport without scrolling. */
    max-width: min(1720px, 92vw);
    margin: 0 auto;
    padding: 12px 24px 20px;
  }

  /* Shared .back-button properties live in config-page.css; margin-bottom and
     transition differ enough page-to-page (and interact with the
     prefers-reduced-motion override below) that they stay local everywhere. */
  .back-button {
    margin-bottom: 24px;
    transition: background 0.2s, border-color 0.2s;
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
  /* border-radius/border/padding are byte-identical with StarterPackPage +
     TnDTrilogyPage's .preview-box and live in config-page.css. */
  .preview-box {
    position: relative;
    overflow: hidden;
    /* Nebula glow painted into the background layers (always behind content, so
       no z-index fight with the crossfade). Premium dark-mode cue, not a flat box. */
    background:
      radial-gradient(56% 48% at 50% 40%, rgba(139, 108, 255, 0.34), transparent 68%),
      radial-gradient(38% 34% at 68% 66%, rgba(84, 209, 196, 0.12), transparent 70%),
      radial-gradient(circle at 50% 38%, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015));
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
  /* Eyebrow + h1 read as one lockup: the small label sits just above the
     title instead of claiming its own stacked row of vertical space. */
  .title-lockup {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  /* Shared .eyebrow properties (font-weight/text-transform/color) live in
     config-page.css; font-size and letter-spacing vary per page. */
  .eyebrow {
    font-size: var(--font-size-compact, 12px);
    letter-spacing: 0.12em;
  }

  /* Shared h1 properties live in config-page.css; line-height is unique here. */
  h1 {
    line-height: 1.05;
  }

  .meta {
    font-size: 15px;
    color: rgba(255, 255, 255, 0.82);
    margin: 0;
  }

  /* The instruction that sits on the bubble strip — quiet label, not a third
     stacked sentence competing with the title. */
  .picker-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(184, 166, 255, 0.9);
    margin-top: 2px;
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
    flex-direction: row;
    align-items: center;
    gap: 12px;
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
  /* The achievable bubble: a big round numeral (1/2/3) that reads as the
     difficulty ladder before any word does. Custom wears a sliders glyph. */
  .preset-num {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.16);
    border: 1.5px solid rgba(255, 255, 255, 0.4);
    font-size: 20px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .preset-custom .preset-num {
    font-size: 16px;
  }
  .preset-body {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    min-width: 0;
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
    /* Long pack recipes wrap on phones — balance the break so two lines read
       as a deliberate block, not an orphaned word. */
    text-wrap: balance;
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


  /* Fixed specs: reads as information, not as disabled controls.
     .spec-line/.spec-sep are byte-identical with DeckArchitectPage and live in
     config-page.css. */

  /* .price, .checkout-error, .assurance (container + icon), and .loading/.error
     are byte-identical across all four configurator pages and live fully in
     config-page.css. .assurance li's font-size/color vary per page. */
  .assurance li {
    font-size: 15px;
    color: rgba(255, 255, 255, 0.85);
  }

  /* ---------- mobile checkout dock (same chrome as the Deck Architect) ---------- */
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
    border: 1px solid rgba(139, 108, 255, 0.45);
    background: rgba(139, 108, 255, 0.12);
  }
  .dock-pack {
    font-size: 15px;
    font-weight: 800;
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
    /* The first screen is the beauty shot + the choice, nothing else. The
       descriptive caption is prose that competes with the fan — drop it on
       mobile (the recipe line below still spells the pick out), which lets
       the fan grow to fill the whole stage and reads as pure imagery. */
    .preview-desc {
      display: none;
    }
    /* Stage padding trims on mobile; the height itself is set inline from
       mobileStageH so the box hugs the width-limited fan (no dead gradient),
       which also lifts the picker clear of the dock. */
    .preview-box {
      padding: 10px;
    }
    /* Tighter vertical rhythm so the title lockup + bubbles sit high, not
       floating in a half-screen of text. */
    .config-layout {
      gap: 12px;
    }
    .info-main {
      gap: 10px;
    }
    .back-button {
      margin-bottom: 12px;
    }
    /* Center the title lockup + label over the (centered) bubble strip. */
    .title-lockup,
    .meta,
    .picker-label {
      text-align: center;
    }
    .title-lockup {
      align-items: center;
    }
    /* Bubbles go side by side (4-across), not stacked tall — every tier is
       one tap away and reads as a ladder at a glance. The level-range sub is
       dropped here (the recipe line below already spells the pick out); the
       numeral bubble + name carry it. */
    .preset-row {
      flex-wrap: nowrap;
      gap: 8px;
    }
    .preset {
      flex: 1 1 0;
      min-width: 0;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 12px 6px;
      min-height: 92px;
    }
    .preset-body {
      align-items: center;
    }
    .preset-name {
      text-align: center;
    }
    .preset-sub {
      display: none;
    }
    .preset-num {
      width: 36px;
      height: 36px;
      font-size: 18px;
    }
    /* The check would collide with the centered stack — tuck it to the corner. */
    .preset-check {
      top: 6px;
      right: 6px;
      font-size: 13px;
    }
    /* The rail's purchase block centers on phones — a left-hung $30 in a
       full-width card reads as dead space to its right. */
    .price {
      text-align: center;
    }
    .buy-rail {
      text-align: center;
    }
    .assurance li {
      text-align: left;
    }
    .composition-line {
      text-align: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .back-button,
    .preset,
    .bento-board,
    .checkout-dock {
      transition: none;
    }
  }
</style>
