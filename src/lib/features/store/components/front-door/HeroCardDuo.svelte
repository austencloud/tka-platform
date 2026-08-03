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
  catalog". First press scans; afterwards the card is left playing and the
  button offers the pass again (hero-scan-timeline.svelte.ts owns that state
  machine). Under reduced motion the button is not rendered at all: it exists
  only to start motion.
-->
<script lang="ts">
  import { page } from "$app/state";
  import type { CoverCard, Product } from "../../domain/models/product";
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
    /** Null until the catalog's cover cards land. The slots hold their shape. */
    card: CoverCard | null;
    product: Product | null;
  }
  let { card, product }: Props = $props();

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

  // "Scan the code" is the longer of the two, so it is what the ghost sizer
  // below holds — the button never changes width when the label swaps.
  const SCAN_LABEL = "Scan the code";
  const RESCAN_LABEL = "Scan again";
  const scanLabel = $derived(timeline.scanned ? RESCAN_LABEL : SCAN_LABEL);

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

  $effect(() => {
    const slot = frontSlotEl;
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
  <div class="duo">
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
    <div class="scan-trigger" class:busy={timeline.running}>
      <span class="sizer" aria-hidden="true" inert>
        <ActionButton
          label={SCAN_LABEL}
          icon="fa-qrcode"
          color="cyan"
          fullWidth
          onclick={() => {}}
        />
      </span>
      <span class="live">
        <ActionButton
          label={scanLabel}
          icon="fa-qrcode"
          color="cyan"
          fullWidth
          ariaDisabled={timeline.running}
          onclick={() => timeline.scan()}
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
