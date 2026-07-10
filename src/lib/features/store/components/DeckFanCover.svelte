<!--
  DeckFanCover — a fanned hand of REAL printed card fronts, rendered through
  the print pipeline (PrintCardRenderer: canonical locked visibility, MPC
  stripe frame, accent coloring), used as deck cover art in the shop grid, the
  /shop hero, and the configurators. What the fan shows IS what prints.

  Decorative by design: covers render inside links/option buttons, so the fan
  is `inert` + aria-hidden; the host element carries the accessible label.

  Card count responds to container width (3–6), capped by maxCards. Cards
  auto-scale UP from cardWidth to fill the container (ultrawide screens get a
  properly big fan), capped by maxCardWidth.
-->
<script lang="ts">
  import type { CoverCard } from "../domain/models/product";
  import { renderCoverFront } from "../services/cover-front-renderer";

  interface Props {
    cards: readonly CoverCard[];
    /** QR attribution, same as the print path. */
    deckId?: string;
    deckName?: string;
    /** MINIMUM rest width of one card, px. */
    cardWidth?: number;
    /** Auto-scale ceiling. Defaults to 1.8x cardWidth. */
    maxCardWidth?: number;
    /** Upper bound on cards shown (width may show fewer). */
    maxCards?: number;
    /** Show EXACTLY this many cards regardless of width (e.g. the trilogy tile
        always fans all six element families). Cards scale down to fit. */
    exactCount?: number;
    /** Disable hover spread/lift (e.g. tiny tiles). */
    interactive?: boolean;
  }
  let {
    cards,
    deckId,
    deckName,
    cardWidth = 122,
    maxCardWidth,
    maxCards = 6,
    exactCount,
    interactive = true,
  }: Props = $props();

  let boxW = $state(0);

  // "3-6 depending on the size of the component" — width thresholds scale with
  // the card size so bigger cards claim more room per slot.
  function countFor(w: number): number {
    if (!w) return 4;
    const unit = cardWidth / 122;
    if (w < 340 * unit) return 3;
    if (w < 430 * unit) return 4;
    if (w < 520 * unit) return 5;
    return 6;
  }
  const shown = $derived(
    cards.slice(0, exactCount ?? Math.max(1, Math.min(maxCards, countFor(boxW))))
  );
  const tilt = (i: number, n: number) => (n <= 1 ? 0 : -12 + (24 * i) / (n - 1));

  // Auto-scale: grow cards to fill the measured container. Sized against the
  // HOVER-OPEN span (overlap 0.18 → each extra card shows 82%) plus ~5% slack
  // for tilt overhang, so the spread never spills the box. With exactCount the
  // minimum floor drops away so a forced-full fan can shrink to fit instead.
  const maxW = $derived(maxCardWidth ?? Math.round(cardWidth * 1.8));
  const cardW = $derived(
    shown.length && boxW
      ? Math.round(
          Math.min(
            maxW,
            Math.max(
              exactCount ? 72 : cardWidth,
              boxW / ((1 + 0.82 * (shown.length - 1)) * 1.05)
            )
          )
        )
      : cardWidth
  );

  // key -> object URL, filled as the print renders land. Session-cached in the
  // service, so revisits paint instantly.
  let urls = $state<Record<string, string>>({});
  const cardKey = (c: CoverCard) => c.sequence?.id ?? c.sequence?.word ?? JSON.stringify(c).slice(0, 40);

  $effect(() => {
    for (const c of shown) {
      const k = cardKey(c);
      if (urls[k]) continue;
      // Baked covers load straight from Storage — no print pipeline.
      if (c.imageUrl) {
        urls[k] = c.imageUrl;
        continue;
      }
      renderCoverFront(c, { deckId, deckName })
        .then((url) => {
          urls[k] = url;
        })
        .catch((e) => console.error("[DeckFanCover] cover render failed:", e));
    }
  });
</script>

<div
  class="fan"
  class:interactive
  bind:clientWidth={boxW}
  inert
  aria-hidden="true"
  style:--overlap="{-Math.round(cardW * 0.52)}px"
  style:--overlap-open="{-Math.round(cardW * 0.18)}px"
>
  {#each shown as card, i (cardKey(card))}
    <div class="fan-slot">
      <div class="fan-tilt" style:transform="rotate({tilt(i, shown.length)}deg)">
        <div class="card-box" style:width="{cardW}px">
          {#if urls[cardKey(card)]}
            <img class="card-img" src={urls[cardKey(card)]} alt="" draggable="false" />
          {:else}
            <div class="card-pending"></div>
          {/if}
        </div>
      </div>
    </div>
  {/each}
</div>

<style>
  .fan {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    padding: 18px 0 10px;
    width: 100%;
  }

  .fan-slot {
    transition:
      margin 0.3s cubic-bezier(0.16, 1, 0.3, 1),
      transform 0.25s ease;
  }
  .fan-slot + .fan-slot {
    margin-left: var(--overlap);
  }
  .fan.interactive:hover .fan-slot + .fan-slot {
    margin-left: var(--overlap-open);
  }
  .fan.interactive .fan-slot:hover {
    transform: translateY(-14px) scale(1.04);
    z-index: 9;
    position: relative;
  }

  .fan-tilt {
    transform-origin: bottom center;
  }

  /* Trimmed-card box: the render is the full MPC canvas WITH bleed; cover-fit
     into the 5:7 box crops the bleed the way the guillotine does, so the fan
     shows the cut card. */
  .card-box {
    aspect-ratio: 5 / 7;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
    background: #f4f4f4;
  }

  .card-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    animation: card-in 220ms ease both;
  }

  @keyframes card-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* Reserved blank card while the print render lands — same box, no shift. */
  .card-pending {
    width: 100%;
    height: 100%;
    background: linear-gradient(110deg, #ececf2 40%, #f8f8fc 50%, #ececf2 60%);
    background-size: 220% 100%;
    animation: shimmer 1.4s linear infinite;
  }

  @keyframes shimmer {
    from {
      background-position: 130% 0;
    }
    to {
      background-position: -90% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .fan-slot {
      transition: none;
    }
    .fan.interactive:hover .fan-slot + .fan-slot {
      margin-left: var(--overlap);
    }
    .fan.interactive .fan-slot:hover {
      transform: none;
    }
    .card-img {
      animation: none;
    }
    .card-pending {
      animation: none;
    }
  }
</style>
