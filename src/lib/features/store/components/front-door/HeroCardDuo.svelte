<!-- src/lib/features/store/components/front-door/HeroCardDuo.svelte -->
<!--
  The hero's card: front and back of the SAME card, held up together.

  Front is the baked print render — the only render that carries the card's real,
  scannable QR. Back is a live CardBack fed `card.sequence`, the very sequence
  that front was printed from, so the two faces can never disagree. Nothing here
  is generated at runtime: the sequence arrives with the catalog the page already
  loads, which is also why the hero never hits the generator's reachability
  failure the homepage's per-visit demo has to guard against.

  The pair tilts away from each other so it reads as an object someone is
  holding rather than two thumbnails, and the back's drawn mandala is the thing
  that catches the eye — a printed figure on the left, the same figure being
  traced on the right.

  Both slots are the card's real 5:7 proportion and sized from one `--card-h`.
  The slots render before the catalog does, so the hero's height is settled at
  first paint and neither the baked front nor the player moves anything when it
  lands (no-layout-shift.md).

  THE SCAN IS PRESSED, NOT PLAYED. The cue used to loop every eight seconds,
  which read as an advert running at you rather than a card you picked up. It
  now has one trigger, sitting directly under the pair because it acts on the
  pair — not another call to action stacked in the copy column beside "See the
  catalog". Under reduced motion the button is not rendered at all: it exists
  only to start motion. (hero-scan-timeline.svelte.ts owns the pass itself.)

  THE SECOND PRESS DEALS. Scanning the same card twice shows the same thing
  twice, so once a card has been scanned the button stops offering a replay and
  starts offering a new card. Austen: "instead of just saying scan again on the
  same sequence which doesn't really reveal anything the second time ... how
  about ... the button changes to give you a different card ... and then it
  plays the scan animation as soon as the card gets shuffled."

  So a press deals: the pair flicks out, the next card takes its place, the pair
  drops back in, and the scan runs itself once on the new card. That auto-run is
  the ONE thing that starts without a press, and it is still the direct
  consequence of one — nothing loops.

  The deal is transform and opacity on the two absolutely-positioned card faces,
  never a remount. Remounting the back would tear down and rebuild the whole
  animation engine (loop, orchestrator, canvas) on every shuffle; passing the
  new sequence down reloads it in place instead. Nothing outside the two fixed
  slots can move, because nothing outside them is touched.
-->
<script lang="ts">
  import { page } from "$app/state";
  import type { HeroCoverEntry } from "./front-door-catalog";
  import ShopEntryArt from "../ShopEntryArt.svelte";
  import HeroCardBackLive from "./HeroCardBackLive.svelte";
  import HeroScanCue from "./HeroScanCue.svelte";
  import ActionButton from "$lib/shared/components/selection/ActionButton.svelte";
  import {
    createHeroScanTimeline,
    type ScanCueVariant,
  } from "./hero-scan-timeline.svelte";
  import { computeFrontQrCellRect } from "../../services/card-front-regions";
  import {
    layoutRectWithin,
    observeLayout,
    type LayoutRect,
  } from "./hero-layout-measure";

  interface Props {
    /** Empty until the catalog's cover cards land. The slots hold their shape. */
    pool: readonly HeroCoverEntry[];
  }
  let { pool }: Props = $props();

  // ── the deck this hero deals from ───────────────────────────────────────
  // Shuffle without replacement: walk a shuffled order, and reshuffle only when
  // it runs out, so no card repeats until every other one has been dealt. The
  // reshuffle keeps the just-seen card off the front, or the boundary between
  // two rounds would be the one repeat the whole scheme exists to prevent.
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

  // The FIRST card is not shuffled: heroCoverPool already sorts baked covers
  // first, and a baked cover is the only render carrying a real scannable QR.
  // The hero opens on the best card it has, then deals at random from there.
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

  // Dev comparison switch: `?cue=pulse` on /shop swaps the phone cue for the
  // quieter ring. The phone variant ships as the default; the query param is
  // for judging them side by side without a rebuild.
  const cue = $derived<ScanCueVariant>(
    page.url.searchParams.get("cue") === "pulse" ? "pulse" : "phone"
  );

  const timeline = createHeroScanTimeline();
  $effect(() => {
    timeline.start();
    return () => timeline.stop();
  });

  // The three labels this button can show. A one-card catalog has nothing to
  // deal, so it keeps offering the replay instead of promising a card that
  // isn't there. The ghost sizer holds whichever of the reachable labels is
  // longest, so no swap can change the width.
  const SCAN_LABEL = "Scan the code";
  const DEAL_LABEL = "Deal another card";
  const RESCAN_LABEL = "Scan again";
  const afterScanLabel = $derived(canDeal ? DEAL_LABEL : RESCAN_LABEL);
  const actionLabel = $derived(timeline.scanned ? afterScanLabel : SCAN_LABEL);
  const sizerLabel = $derived(
    [SCAN_LABEL, afterScanLabel].reduce((a, b) => (b.length > a.length ? b : a))
  );

  // ── dealing ─────────────────────────────────────────────────────────────
  // Out, swap, in, scan. The two halves are timed to the CSS below; the swap
  // happens at the bottom of the out-beat, where both faces are invisible, so
  // the change of card is never seen as a cut.
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
      // The new card has to be on screen before the phone comes down over it.
      setTimeout(() => timeline.scan(), DEAL_OUT_MS + DEAL_IN_MS)
    );
  }

  // ── the QR cell, located rather than guessed ────────────────────────────
  // A phone reads the code, not the card, so the sweep covers the code's cell
  // and nothing else. That cell is wherever the step grid leaves a hole — the
  // bottom of the left column at 8 and 12 steps, the end of the top row
  // otherwise — so it is derived from the same layout math the bake used
  // (computeFrontQrCellRect gives it as % of a trimmed card front), then
  // placed by measuring where that trimmed card actually sits inside the slot.
  // The fan pads and auto-scales its card, so the card box is NOT the slot.
  let frontSlotEl = $state<HTMLDivElement | null>(null);
  let cardBoxInSlot = $state<LayoutRect | null>(null);

  const qrOnCard = $derived(
    card ? computeFrontQrCellRect(card.sequence?.steps?.length ?? 8) : null
  );

  /** The QR cell as % of the front SLOT — the box the scan cue overlays. */
  const qrCell = $derived.by<LayoutRect | null>(() => {
    const box = cardBoxInSlot;
    const onCard = qrOnCard;
    const slot = frontSlotEl;
    if (!box || !onCard || !slot || !box.w || !box.h) return null;
    const sw = slot.offsetWidth;
    const sh = slot.offsetHeight;
    if (!sw || !sh) return null;
    return {
      x: ((box.x + (onCard.x / 100) * box.w) / sw) * 100,
      y: ((box.y + (onCard.y / 100) * box.h) / sh) * 100,
      w: ((onCard.w / 100) * box.w / sw) * 100,
      h: ((onCard.h / 100) * box.h / sh) * 100,
    };
  });

  // Re-armed per card. `observeLayout`'s arrival watch retires after its first
  // success, which is right for one card and wrong for a deck: a deal replaces
  // the fan's card box, and without re-arming the rect would still describe the
  // card that just left.
  $effect(() => {
    const slot = frontSlotEl;
    void card;
    if (!slot) return;
    return observeLayout(slot, () => {
      const box = slot.querySelector<HTMLElement>("[data-card-box]");
      const next = box ? layoutRectWithin(box, slot) : null;
      const prev = cardBoxInSlot;
      const same =
        next !== null &&
        prev !== null &&
        next.x === prev.x &&
        next.y === prev.y &&
        next.w === prev.w &&
        next.h === prev.h;
      if (!same) cardBoxInSlot = next;
      return next !== null && next.w > 0;
    });
  });
</script>

<div class="pair">
  <div class="duo" class:dealing>
    <div class="slot front" bind:this={frontSlotEl}>
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
        {#if timeline.available}
          <HeroScanCue
            {cue}
            phase={timeline.phase}
            cycle={timeline.cycle}
            {qrCell}
          />
        {/if}
      {/if}
    </div>

    <div class="slot back">
      {#if card}
        <div class="card-frame">
          <HeroCardBackLive
            sequence={card.sequence}
            drawActive={timeline.drawActive}
            cycle={timeline.cycle}
            live={timeline.available}
          />
        </div>
      {/if}
    </div>
  </div>

  <!-- The trigger. Two buttons share one grid cell: a hidden one permanently
       holding the LONGER label sizes the cell, and the live one stretches to
       it, so "Scan the code" → "Scan again" cannot resize anything
       (no-layout-shift.md's ghost-sizer, using the real primitive so the
       reserved width carries the button's own metrics rather than a guess). -->
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
          ariaDisabled={timeline.running || dealing}
          onclick={press}
        />
      </span>
    </div>
  {/if}
</div>

<style>
  /* Cards, then the control that acts on them. The gap rides `--card-h` so the
     button sits the same distance from the pair at every size instead of
     drifting away from it at 4K. */
  /* One height drives both cards AND the gap under them, so it is declared on
     the wrapper both of them read. The `cqw` term keeps the pair inside its
     column (the rotations widen each card's bounding box by ~12%), the `svh`
     term keeps it inside a short landscape screen, and the `rem` ceiling rides
     the root ramp so 4K gets a bigger card rather than more empty rail. */
  .pair {
    --card-h: min(56svh, 36rem, calc(100cqw / 2.25 * 1.4));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(0.5rem, calc(var(--card-h) * 0.05), 2rem);
    width: 100%;
  }

  .duo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    /* Room for the tilted corners, which sit outside the layout box. */
    padding-block: calc(var(--card-h) * 0.07);
  }

  /* Wide but short — a folded Fold in landscape, a laptop in a small window.
     The cards alone already fill the height here, so the trigger has to be
     paid for out of the card's budget or it lands below the fold, and a
     control nobody can see is the same as no control. */
  @media (min-width: 48rem) and (max-height: 40rem) {
    .pair {
      --card-h: min(38svh, 36rem, calc(100cqw / 2.25 * 1.4));
    }
  }

  .slot {
    position: relative;
    flex: 0 0 auto;
    height: var(--card-h);
    aspect-ratio: 5 / 7;
    border-radius: 0.75rem;
    filter: drop-shadow(0 1.25rem 2.5rem rgba(0, 0, 0, 0.55));
  }

  /* Before the catalog lands the slots are the shape of the cards, faintly, so
     the hero reads as "a card goes here" rather than as a gap. */
  .slot:empty {
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    filter: none;
  }

  /* Opposing tilts, leaning into each other. The printed front sits on top —
     it is the one with the code on it. */
  .slot.front {
    z-index: 2;
    transform: rotate(-5deg) translateX(4%);
  }
  .slot.back {
    z-index: 1;
    transform: rotate(5deg) translateX(-4%);
  }

  /* Phones do not have room for two cards side by side — at 375 that is a pair
     of 140px thumbnails, and a card you cannot read is not a card. So the pair
     stacks instead: the back card on top of the stack with its drawn mandala
     clear, the printed front overlapping up from below, each about four fifths
     of the width. Same object, held at a different angle. */
  @media (max-width: 34rem) {
    .pair {
      --card-h: min(46svh, calc(78cqw * 1.4));
    }
    .duo {
      flex-direction: column;
    }
    .slot.back {
      order: 1;
      z-index: 1;
      transform: rotate(-4deg) translateX(-6%);
    }
    .slot.front {
      order: 2;
      z-index: 2;
      transform: rotate(4deg) translateX(6%);
      margin-top: calc(var(--card-h) * -0.34);
    }
  }

  .art {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }

  /* The deal. Both faces are absolutely positioned inside their fixed slot, so
     lifting and fading them moves nothing else on the page — the slots keep
     their boxes and the button below never shifts. Out is quicker than in: a
     card leaves the hand faster than it settles. */
  .art,
  .card-frame {
    transition:
      transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
      opacity 260ms ease;
  }
  .duo.dealing .art,
  .duo.dealing .card-frame {
    transform: translateY(-7%) scale(0.93);
    opacity: 0;
    transition:
      transform 190ms cubic-bezier(0.5, 0, 0.75, 0),
      opacity 190ms ease-in;
  }

  @media (prefers-reduced-motion: reduce) {
    .art,
    .card-frame,
    .duo.dealing .art,
    .duo.dealing .card-frame {
      transition: none;
    }
  }

  /* CardBack's own frame declares `container-type: inline-size` AND sizes its
     border padding in `cqi`. A container's own properties resolve against the
     NEXT container up, so without a query container right here the card's
     border is measured against the page and eats a third of the card. This
     wrapper is that container: one card wide, so the border is a border. */
  .card-frame {
    position: absolute;
    inset: 0;
    border-radius: 0.75rem;
    overflow: hidden;
    container-type: inline-size;
  }

  /* Ghost-sizer stack: the hidden copy holds the longest label and sets the
     width; the live button overlays it in the same cell. */
  .scan-trigger {
    display: inline-grid;
    flex: 0 0 auto;
  }
  .scan-trigger > .sizer,
  .scan-trigger > .live {
    grid-area: 1 / 1;
    display: block;
  }
  .scan-trigger > .sizer {
    visibility: hidden;
  }

  /* The pass is playing — the button stays in place and legible (it is still
     the thing that just did something), but reads as unavailable. It keeps its
     place in the tab order via aria-disabled rather than `disabled`, so a
     keyboard user does not lose focus mid-pass. */
  .scan-trigger > .live {
    transition: opacity 240ms ease;
  }
  .scan-trigger.busy > .live {
    opacity: 0.55;
  }

  @media (prefers-reduced-motion: reduce) {
    .scan-trigger > .live {
      transition: none;
    }
  }
</style>
