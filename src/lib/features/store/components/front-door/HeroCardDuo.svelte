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
-->
<script lang="ts">
  import { page } from "$app/state";
  import type { CoverCard, Product } from "../../domain/models/product";
  import ShopEntryArt from "../ShopEntryArt.svelte";
  import HeroCardBackLive from "./HeroCardBackLive.svelte";
  import HeroScanCue from "./HeroScanCue.svelte";
  import {
    createHeroScanTimeline,
    type ScanCueVariant,
  } from "./hero-scan-timeline.svelte";

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
</script>

<div class="duo">
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
      {#if !timeline.reducedMotion}
        <HeroScanCue {cue} phase={timeline.phase} cycle={timeline.cycle} />
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
          live={!timeline.reducedMotion}
        />
      </div>
    {/if}
  </div>
</div>

<style>
  /* One height drives both cards. The `cqw` term keeps the pair inside its
     column (the rotations widen each card's bounding box by ~12%), the `svh`
     term keeps it inside a short landscape screen, and the `rem` ceiling rides
     the root ramp so 4K gets a bigger card rather than more empty rail. */
  .duo {
    --card-h: min(56svh, 36rem, calc(100cqw / 2.25 * 1.4));
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    /* Room for the tilted corners, which sit outside the layout box. */
    padding-block: calc(var(--card-h) * 0.07);
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
    .duo {
      --card-h: min(46svh, calc(78cqw * 1.4));
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
</style>
