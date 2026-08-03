<!-- src/lib/features/store/components/front-door/HeroCardDuo.svelte -->
<!--
  The hero's stage: a real printed card, and a phone showing what happens when
  you point one at it.

  WHAT THIS REPLACED, AND WHY. Until 2026-08-03 the payoff here was a live
  animation engine drawing the card's mandala over its printed back — the
  sequence "coming alive" in front of you. It was the prettiest thing on the
  page and it was fiction: a real scan does not draw a mandala, it opens
  `/q/<code>`. Austen: "on that phone it literally loads the exact component
  that they will literally see when they go to the literal QR code scan."

  So the drawn mandala is gone (it survives in git, and is a candidate for a
  product-page "how it works" slot where a diagram is honest). The cards are
  static print now — front prominent, back peeking out behind-left so the pair
  still reads as one physical object with two faces — and the PHONE is the
  hero's dominant object, because the phone is the claim.

  Three beats drive one press (hero-scan-timeline.svelte.ts): the phone leans in
  on its camera view, the code is recognised, the screen swipes up into the real
  scan page. Deal another card and the whole thing re-runs against that card's
  own code.
-->
<script lang="ts">
  import type { HeroCoverEntry } from "./front-door-catalog";
  import ShopEntryArt from "../ShopEntryArt.svelte";
  import CardBack from "$lib/features/choreo-card/components/card-back/CardBack.svelte";
  import HeroPhone from "./HeroPhone.svelte";
  import ActionButton from "$lib/shared/components/selection/ActionButton.svelte";
  import { createHeroScanTimeline } from "./hero-scan-timeline.svelte";
  import { computeFrontQrCellRect } from "../../services/card-front-regions";
  import {
    DEFAULT_SHOP_PROP,
    SHOP_BACK_THEME,
    bakedCoverUrl,
  } from "../../domain/shop-prop-options";
  import { getCardBackThemeVisuals } from "$lib/features/choreo-card/components/card-back/card-back-theme-visuals";
  import { hydrateSequence } from "$lib/features/choreo-card/services/catalog-loader";
  import { resolveHeroScanCode } from "./hero-scan-code";

  interface Props {
    /** Empty until the catalog's cover cards land. The stage holds its shape. */
    pool: readonly HeroCoverEntry[];
  }
  let { pool }: Props = $props();

  // ── the deck this hero deals from ───────────────────────────────────────
  // Shuffle without replacement: walk a shuffled order, and reshuffle only when
  // it runs out, so no card repeats until every other one has been dealt. The
  // reshuffle keeps the just-seen card off the front, or the boundary between
  // two rounds would be the one repeat the scheme exists to prevent.
  let order = $state<number[]>([]);
  let cursor = $state(0);

  function shuffled(count: number, avoidFirst?: number): number[] {
    const next = Array.from({ length: count }, (_, i) => i);
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j]!, next[i]!];
    }
    if (next.length > 1 && next[0] === avoidFirst) {
      [next[0], next[1]] = [next[1]!, next[0]!];
    }
    return next;
  }

  // The FIRST card is not shuffled: heroCoverPool sorts baked covers first, and
  // only a baked cover carries a real scannable QR. The hero opens on the best
  // card it has, then deals at random from there.
  $effect(() => {
    const n = pool.length;
    if (!n) {
      order = [];
      cursor = 0;
      return;
    }
    if (order.length !== n) {
      order = [0, ...shuffled(n, 0).filter((i) => i !== 0)];
      cursor = 0;
    }
  });

  const entry = $derived(pool[order[cursor] ?? 0] ?? null);
  const card = $derived(entry?.card ?? null);
  const product = $derived(entry?.product ?? null);
  const canDeal = $derived(pool.length > 1);

  // Print truth: the card is printed with staves and the deck ships with the
  // rainbow back, so neither follows the viewer's own settings.
  const printedProp = DEFAULT_SHOP_PROP;
  const printedTheme = {
    visuals: getCardBackThemeVisuals(SHOP_BACK_THEME),
    name: SHOP_BACK_THEME,
  };

  // The card's own sequence, render-ready. Catalog blobs omit motion placement
  // data, and the start-position cell draws propless without it.
  const backSequence = $derived(
    card?.sequence
      ? hydrateSequence(card.sequence as unknown as Record<string, unknown>)
      : null
  );

  /** The camera view IS the card, so the QR cell is in the card's own space. */
  const qrCell = $derived(
    card ? computeFrontQrCellRect(card.sequence?.steps?.length ?? 8) : null
  );

  /** The baked front — the render that carries the real code. */
  const coverUrl = $derived(
    card ? (bakedCoverUrl(card, printedProp) ?? null) : null
  );

  // ── the real short code, looked up and never minted ──────────────────────
  let scanCode = $state<string | null>(null);
  $effect(() => {
    const seq = backSequence;
    scanCode = null;
    if (!seq) return;
    let cancelled = false;
    void resolveHeroScanCode(seq).then((code) => {
      if (!cancelled) scanCode = code;
    });
    return () => {
      cancelled = true;
    };
  });

  const timeline = createHeroScanTimeline();
  $effect(() => {
    timeline.start();
    return () => timeline.stop();
  });

  const viewfinder = $derived(
    timeline.phase === "aim" || timeline.phase === "lock"
  );
  /** The phone has arrived; the cards have parted. Drives the whole scene. */
  const entered = $derived(timeline.onstage);
  const opened = $derived(
    timeline.phase === "opening" || timeline.phase === "open"
  );

  // Three labels. A one-card catalog has nothing to deal, so it keeps offering
  // the replay rather than promising a card that isn't there. The ghost sizer
  // holds whichever reachable label is longest, so no swap changes the width.
  const SCAN_LABEL = "Scan the code";
  const DEAL_LABEL = "Deal another card";
  const RESCAN_LABEL = "Scan again";
  const afterScanLabel = $derived(canDeal ? DEAL_LABEL : RESCAN_LABEL);
  const actionLabel = $derived(timeline.scanned ? afterScanLabel : SCAN_LABEL);
  const sizerLabel = $derived(
    [SCAN_LABEL, afterScanLabel].reduce((a, b) => (b.length > a.length ? b : a))
  );

  // ── dealing ─────────────────────────────────────────────────────────────
  // Out, swap, in, scan. The swap happens at the bottom of the out-beat, where
  // the faces are invisible, so the change of card is never seen as a cut.
  const DEAL_OUT_MS = 190;
  const DEAL_IN_MS = 260;
  let dealing = $state(false);
  let dealTimers: ReturnType<typeof setTimeout>[] = [];

  function clearDealTimers(): void {
    for (const t of dealTimers) clearTimeout(t);
    dealTimers = [];
  }
  $effect(() => () => clearDealTimers());

  function advance(): void {
    if (pool.length < 2) return;
    if (cursor + 1 < order.length) {
      cursor += 1;
    } else {
      order = shuffled(pool.length, order[cursor]);
      cursor = 0;
    }
  }

  /** The button's one job, whichever label it is wearing. */
  function press(): void {
    if (timeline.running || dealing) return;
    if (!timeline.scanned || !canDeal) {
      timeline.scan();
      return;
    }
    dealing = true;
    clearDealTimers();
    dealTimers.push(
      setTimeout(() => {
        advance();
        dealing = false;
      }, DEAL_OUT_MS),
      // The new card has to be on the stack before the phone aims at it.
      setTimeout(() => timeline.scan(), DEAL_OUT_MS + DEAL_IN_MS)
    );
  }
</script>

<div class="stage">
  <!-- One scene holds both states. The cards and the phone are absolutely
       placed inside it and move by transform only, so the box the page reserves
       is the SAME box at rest and after the entrance — the phone arriving can't
       move anything (no-layout-shift.md). -->
  <div class="scene-slot">
    <div class="scene" class:entered class:dealing>
      <!-- At rest these sit side by side, the pair filling the scene: one
           printed object shown from both sides. The entrance slides them
           together into the tighter stack the phone reads from. -->
      <div class="slot back">
        {#if backSequence}
          <div class="card-frame">
            <CardBack
              sequence={backSequence}
              themeOverride={printedTheme}
              bluePropTypeOverride={printedProp}
              redPropTypeOverride={printedProp}
            />
          </div>
        {/if}
      </div>

      <div class="slot front">
        {#if card && product}
          <div class="art">
            <ShopEntryArt
              cards={[card]}
              {product}
              deckName={product.name}
              cardWidth={140}
              maxCardWidth={822}
              exactCount={1}
            />
          </div>
        {/if}
      </div>

      <!-- Higher z than both cards: the phone enters BETWEEN the viewer and the
           pair, which is what makes it read as an object arriving in the scene
           rather than a panel appearing beside it. -->
      <div class="phone-holder">
        <HeroPhone
          code={scanCode}
          armed={timeline.armed}
          onstage={entered}
          {viewfinder}
          locked={timeline.phase === "lock"}
          {opened}
          {coverUrl}
          {qrCell}
          reducedMotion={timeline.reducedMotion}
        />
      </div>
    </div>
  </div>

  <!-- The trigger. Two buttons share one grid cell: a hidden one permanently
       holding the LONGEST label sizes the cell, and the live one stretches to
       it, so the label swap cannot resize anything (no-layout-shift.md). -->
  {#if card && timeline.available}
    <div class="scan-trigger" class:busy={timeline.running || dealing}>
      <span class="sizer" aria-hidden="true" inert>
        <ActionButton
          label={sizerLabel}
          icon="fa-qrcode"
          color="cyan"
          fullWidth
          onclick={() => {}}
        />
      </span>
      <span class="live">
        <ActionButton
          label={actionLabel}
          icon={timeline.scanned && canDeal ? "fa-shuffle" : "fa-qrcode"}
          color="cyan"
          fullWidth
          ariaDisabled={timeline.running || dealing || !scanCode}
          onclick={press}
        />
      </span>
    </div>
  {/if}
</div>

<style>
  /* Cards beside the phone, the trigger under both. One --card-h drives the
     stack; the phone is deliberately TALLER than the cards, because it is the
     object the page is about. */
  .stage {
    /* THE CARD is sized first now, and the phone follows it. Hero v2 derived the
       card from the phone because the phone was always there; the phone is an
       entrance now, so the state the page OPENS in — two cards, alone — is the
       one the geometry has to serve. The card gets the stage, and the phone
       arrives at 1.28x its height, still the taller object because it is still
       the payoff.

       1.49 is the scene's width in card-heights: two 5:7 cards side by side
       (2 x 0.714) plus a sliver of gap. 1.34 is its height: one card plus room
       for the tilt. Both states live inside that one box. */
    --card-h: min(40svh, 26rem, calc(100cqw / 1.55));
    --phone-h: calc(var(--card-h) * 1.28);
    --scene-w: calc(var(--card-h) * 1.49);
    --scene-h: calc(var(--card-h) * 1.34);
    /* The "Open this scan" pill sits below the phone rather than on its bezel
       (HeroPhone reads both). The slot reserves its height up front, so the pill
       appearing after a scan cannot shift the trigger under it. */
    --pill-gap: 0.7rem;
    --pill-h: var(--min-touch-target, 44px);
    /* The quarter-rem tail covers the phone's perspective tilt, which carries
       the pill a pixel or two past a reserve measured on the untransformed box. */
    --pill-reserve: calc(var(--pill-gap) + var(--pill-h) + 0.25rem);
    display: grid;
    grid-template-columns: minmax(0, auto);
    grid-template-areas:
      "scene"
      "action";
    justify-items: center;
    justify-content: center;
    gap: clamp(1rem, 3cqw, 3rem);
    width: 100%;
  }

  .scene-slot {
    grid-area: scene;
    /* The pill's whole slot, reserved whether or not the phone has arrived. */
    padding-bottom: var(--pill-reserve);
  }

  .scene {
    position: relative;
    width: var(--scene-w);
    height: var(--scene-h);
  }

  .scan-trigger {
    grid-area: action;
    justify-self: center;
    display: inline-grid;
  }

  /* ── the two cards ──────────────────────────────────────────────────────
     Rest: side by side, each holding its own half of the scene. Entered: they
     slide together into a tighter stack on the left, clearing the right half
     for the phone. Only `transform` changes, so neither state can reflow. */
  .slot {
    position: absolute;
    top: 50%;
    height: var(--card-h);
    aspect-ratio: 5 / 7;
    border-radius: 0.75rem;
    filter: drop-shadow(0 1.25rem 2.5rem rgba(0, 0, 0, 0.55));
    transition: transform 640ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* The printed front, on top — it is the one with the code the phone reads. */
  .slot.front {
    right: 0;
    z-index: 2;
    transform: translate(0, -50%) rotate(3deg);
  }
  .scene.entered .slot.front {
    transform: translate(calc(var(--card-h) * -0.42), -50%) rotate(-3deg);
  }

  /* The same card's other face. */
  .slot.back {
    left: 0;
    z-index: 1;
    transform: translate(0, -50%) rotate(-5deg);
  }
  .scene.entered .slot.back {
    transform: translate(calc(var(--card-h) * 0.1), -50%) rotate(-11deg);
  }

  /* ── the phone ──────────────────────────────────────────────────────────
     Parked against the scene's right edge, vertically centred, above both
     cards. HeroPhone owns the arrival itself (it has to compose the entrance
     into the same `transform` as its lean), so this only places it. */
  .phone-holder {
    position: absolute;
    right: 0;
    top: 50%;
    z-index: 3;
    translate: 0 -50%;
  }

  .art {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }

  /* CardBack's frame declares `container-type: inline-size` AND sizes its
     border padding in `cqi`. A container's own properties resolve against the
     NEXT container up, so without a query container right here the border is
     measured against the page and eats a third of the card. */
  .card-frame {
    position: absolute;
    inset: 0;
    border-radius: 0.75rem;
    overflow: hidden;
    container-type: inline-size;
  }

  /* The deal: both faces lift and fade inside their fixed slots, so nothing
     outside the stack moves. Out is quicker than in — a card leaves the hand
     faster than it settles. */
  .art,
  .card-frame {
    transition:
      transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
      opacity 260ms ease;
  }
  .scene.dealing .art,
  .scene.dealing .card-frame {
    transform: translateY(-7%) scale(0.93);
    opacity: 0;
    transition:
      transform 190ms cubic-bezier(0.5, 0, 0.75, 0),
      opacity 190ms ease-in;
  }

  .scan-trigger > .sizer,
  .scan-trigger > .live {
    grid-area: 1 / 1;
    display: block;
  }
  .scan-trigger > .sizer {
    visibility: hidden;
  }
  .scan-trigger > .live {
    transition: opacity 240ms ease;
  }
  .scan-trigger.busy > .live {
    opacity: 0.55;
  }

  /* Narrow: nothing recomposes. The scene is one box whose width is a multiple
     of --card-h, and --card-h is already bounded by `100cqw / 1.55`, so the pair
     and the phone shrink together and always fit the column. The old tier that
     stacked the phone under the cards is gone with the two-column stage. */

  /* Wide but short — a folded Fold in landscape, a laptop in a small window.
     ShopFrontDoorHero runs the copy and this stage side by side here, and the
     whole hero has to clear a viewport around 412px tall.

     16a2bef0f9 held this guarantee by paying for the trigger out of the card's
     budget (56svh -> 38svh). Hero v2 briefly lost it by renaming the driver.
     The card is the driver again, so the tier pays out of --card-h directly.

     The arithmetic at 960x412, which is what the number is picked for:
       header 65 + hero pad 20 + stage pad 14 + scene 166 + pill 55 + gap 12
       + trigger 51 = 383 <= 412. The scene is the only term that can absorb a
       short viewport; everything under it is a fixed cost. */
  @media (min-width: 48rem) and (max-height: 40rem) {
    .stage {
      --card-h: min(30svh, 15rem, calc(100cqw / 1.55));
      gap: 0.75rem;
    }
  }

  /* No choreography. The timeline already jumps straight to `open` here, so the
     cards are simply in their parted position with the phone standing on them
     the instant the button is pressed. */
  @media (prefers-reduced-motion: reduce) {
    .art,
    .card-frame,
    .slot,
    .scene.dealing .art,
    .scene.dealing .card-frame,
    .scan-trigger > .live {
      transition: none;
    }
  }
</style>
