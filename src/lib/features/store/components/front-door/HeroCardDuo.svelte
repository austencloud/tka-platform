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

  // ── the real short code, looked up, never minted, verified against the art ─
  // The cover goes in with the sequence: the lookup answers what code this
  // catalog entry has, the printed QR answers what the card on screen actually
  // opens, and a card whose two answers disagree gets no phone (hero-scan-code).
  let scanCode = $state<string | null>(null);
  $effect(() => {
    const seq = backSequence;
    const cover = coverUrl;
    scanCode = null;
    if (!seq) return;
    let cancelled = false;
    void resolveHeroScanCode(seq, cover).then((code) => {
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
  // A deal used to be a fade: both faces dipped inside their fixed slots and
  // came back holding a different card. Honest, and inert — the phone stood
  // there through it as if nothing had happened. Austen (2026-08-04): "when I
  // click deal another card I'd love there to be a fancy animation where the
  // current contents all slightly move, all three of them, and then another
  // card is dealt with its own animation."
  //
  // So the deal is a flourish in three beats, and every object on stage is in
  // it:
  //
  //   lift  150  the stack fans open and rises; the phone eases back, tips
  //              away and shrinks a little to make room. This is the beat that
  //              says something is about to happen — all three objects move.
  //   out   180  the top card sweeps off up-left with its own gesture; the
  //              back face follows 60ms behind it, so the pair leaves as a
  //              stack rather than as one flat plane.
  //   (swap)     40ms of held-invisible while the new card's faces render, so
  //              CardBack's re-render never lands on a visible frame.
  //   in    300  the new card is DEALT: it arrives from low and right — out
  //              from behind the phone, where a dealer's hand would be —
  //              arcing up into the stack. Back lands first, front 80ms later,
  //              on top. The fan closes and the phone returns underneath it.
  //
  // The scan fires 80ms before the last face lands, so the beat reads as one
  // continuous flourish instead of two things that took turns.
  //
  // Everything moves by transform/opacity inside the absolutely-placed scene:
  // no beat of this can move anything outside the stage box.
  const LIFT_MS = 150;
  const OUT_MS = 180;
  /** The back face leaves after the front — a stack, not a plane. */
  const OUT_STAGGER_MS = 60;
  /** Held invisible while the new faces render. */
  const SWAP_HOLD_MS = 40;
  const IN_MS = 300;
  /** The front lands last, on top, the way a dealt card does. */
  const IN_STAGGER_MS = 80;
  /** The scan starts just before the last face settles. */
  const SCAN_LEAD_MS = 80;

  const OUT_AT = LIFT_MS;
  const SWAP_AT = OUT_AT + OUT_STAGGER_MS + OUT_MS;
  const IN_AT = SWAP_AT + SWAP_HOLD_MS;
  const IN_END = IN_AT + IN_STAGGER_MS + IN_MS;
  const SCAN_AT = IN_END - SCAN_LEAD_MS;
  /** Tail past the last keyframe: dropping the class ON its final frame races
   *  the animation, and the snap would be visible. */
  const SETTLE_AT = IN_END + 50;

  type DealStage = "lift" | "out" | "in";
  let dealStage = $state<DealStage | null>(null);
  /** A deal is in flight. The one guard against overlapping deals. */
  const dealing = $derived(dealStage !== null);
  /** The stack is fanned and the phone is standing back. */
  const parting = $derived(dealStage === "lift" || dealStage === "out");
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
    // The busy guard. `dealing` covers the whole flourish and `timeline.running`
    // covers the scan that follows it, so a double-press can never start a
    // second deal over the top of the first.
    if (timeline.running || dealing) return;
    if (!timeline.scanned || !canDeal) {
      timeline.scan();
      return;
    }
    clearDealTimers();
    if (timeline.reducedMotion) {
      // No flourish to run: the new card is simply the card, with its page on
      // the phone. `timeline.scan()` is already instant under reduced motion.
      advance();
      timeline.scan();
      return;
    }
    dealStage = "lift";
    dealTimers.push(
      setTimeout(() => (dealStage = "out"), OUT_AT),
      // Swapped while both faces are held invisible by the out-beat's fill, so
      // the change of card is never seen as a cut and CardBack's re-render
      // happens off-screen.
      setTimeout(advance, SWAP_AT),
      setTimeout(() => (dealStage = "in"), IN_AT),
      // The new card is on the stack; the phone can aim at it.
      setTimeout(() => timeline.scan(), SCAN_AT),
      setTimeout(() => (dealStage = null), SETTLE_AT)
    );
  }
</script>

<div class="stage">
  <!-- One scene holds both states. The cards and the phone are absolutely
       placed inside it and move by transform only, so the box the page reserves
       is the SAME box at rest and after the entrance — the phone arriving can't
       move anything (no-layout-shift.md). -->
  <div class="scene-slot">
    <div
      class="scene"
      class:entered
      class:dealing
      class:parting
      class:deal-out={dealStage === "out"}
      class:deal-in={dealStage === "in"}
    >
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
    /* The deal's tempo, declared once here and read by the keyframe rules
       below. The same four numbers run the JS timeline in the script block —
       they are a pair, and a change to one is a change to both. */
    --deal-out-ms: 180ms;
    --deal-out-stagger: 60ms;
    --deal-in-ms: 300ms;
    --deal-in-stagger: 80ms;
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

  /* THE FAN. The first beat of a deal: the stack rises and opens, the two
     faces swinging apart around the pile. It is the SLOT that moves here, not
     the face inside it — the face has its own gesture (the out/in keyframes
     below), and keeping the two on separate elements is what lets the stack
     still be fanning while the top card is already leaving it. */
  .scene.entered.parting .slot.front {
    transform: translate(calc(var(--card-h) * -0.45), -56%) rotate(1deg);
  }
  .scene.entered.parting .slot.back {
    transform: translate(calc(var(--card-h) * 0.13), -44%) rotate(-18deg);
  }
  /* The entrance is a 640ms arrival; a deal is a flourish. Same property, two
     tempos, so the deal borrows the slot for its own. */
  .scene.dealing .slot {
    transition-duration: 240ms;
  }

  /* ── the phone ──────────────────────────────────────────────────────────
     Parked against the scene's right edge, vertically centred, above both
     cards. HeroPhone owns the arrival and the lean — it has to compose them
     into one `transform` — so this holder owns everything the SCENE does to
     the phone, using the individual transform properties, which compose on top
     of the component's own `transform` without either having to know about the
     other. */
  .phone-holder {
    position: absolute;
    right: 0;
    top: 50%;
    z-index: 3;
    translate: 0 -50%;
    transition:
      translate 280ms cubic-bezier(0.22, 1, 0.36, 1),
      rotate 280ms cubic-bezier(0.22, 1, 0.36, 1),
      scale 280ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  /* Making room. It eases back and out, tips away from the stack, and shrinks
     — the three cues that read as "stepped back" rather than "slid sideways".
     Then it comes back in under the landing card. */
  .scene.parting .phone-holder {
    translate: 4% -52%;
    rotate: 3deg;
    scale: 0.93;
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

  /* ── the faces' own gestures ────────────────────────────────────────────
     Keyframes rather than transitions, because a deal is not a round trip: the
     card that leaves and the card that arrives start in different places, and
     an animation carries its own start pose. `both` fill is load-bearing —
     it is what holds the outgoing faces invisible across the swap, so the new
     card's render never lands on a visible frame.

     Out is faster than in and eased out-hard: a card leaves the hand quicker
     than it settles. */
  .scene.deal-out .art {
    animation: deal-out-front var(--deal-out-ms) cubic-bezier(0.5, 0, 0.75, 0) both;
  }
  .scene.deal-out .card-frame {
    animation: deal-out-back var(--deal-out-ms) cubic-bezier(0.5, 0, 0.75, 0)
      var(--deal-out-stagger) both;
  }
  /* Back first, front on top of it — the order a card is actually dealt in. The
     easing overshoots by a hair: a dealt card arrives with a little more speed
     than it needs and settles back, and without that it glides into place like
     a panel rather than landing like a card. */
  .scene.deal-in .card-frame {
    animation: deal-in-back var(--deal-in-ms) cubic-bezier(0.32, 1.34, 0.52, 1) both;
  }
  .scene.deal-in .art {
    animation: deal-in-front var(--deal-in-ms) cubic-bezier(0.32, 1.34, 0.52, 1)
      var(--deal-in-stagger) both;
  }

  /* Swept off the top, up and to the left, away from where the next one comes
     from. */
  @keyframes deal-out-front {
    from {
      transform: none;
      opacity: 1;
    }
    to {
      transform: translate(-16%, -22%) rotate(-13deg) scale(0.94);
      opacity: 0;
    }
  }
  @keyframes deal-out-back {
    from {
      transform: none;
      opacity: 1;
    }
    to {
      transform: translate(-11%, -16%) rotate(-9deg) scale(0.95);
      opacity: 0;
    }
  }

  /* DEALT: in from low and right, which on this stage is out from behind the
     phone — the phone is standing exactly where a dealer's hand would be, and
     it has just stepped back to let the card past. The card is opaque well
     before it clears the phone, so it emerges rather than materialises. */
  @keyframes deal-in-back {
    from {
      transform: translate(44%, 26%) rotate(12deg) scale(0.9);
      opacity: 0;
    }
    55% {
      opacity: 1;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }
  @keyframes deal-in-front {
    from {
      transform: translate(40%, 22%) rotate(10deg) scale(0.91);
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
    to {
      transform: none;
      opacity: 1;
    }
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

  /* No choreography. The timeline already jumps straight to `open` here, and
     `press()` swaps the card outright rather than running the flourish — so the
     cards are simply in their parted position with the phone standing on them
     the instant the button is pressed, and the next press simply shows a
     different card. The rules below are the backstop for a motion preference
     that changes mid-flourish. */
  @media (prefers-reduced-motion: reduce) {
    .slot,
    .phone-holder,
    .scan-trigger > .live {
      transition: none;
    }
    .scene.deal-out .art,
    .scene.deal-out .card-frame,
    .scene.deal-in .art,
    .scene.deal-in .card-frame {
      animation: none;
    }
  }
</style>
