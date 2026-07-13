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
<script lang="ts" module>
  /* Deal timing, exported so hosts can sequence follow-up flourishes (the
     configurator's shimmer + ready-chip fire after the re-deal settles). */
  export const DEAL_MS = 620;
  export const DEAL_STAGGER = 70;
  export const GATHER_MS = 240;
</script>

<script lang="ts">
  import type { CoverCard } from "../domain/models/product";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { renderCoverFront } from "../services/cover-front-renderer";
  import { DEFAULT_SHOP_PROP, bakedCoverUrl } from "../domain/shop-prop-options";

  interface Props {
    cards: readonly CoverCard[];
    /** QR attribution, same as the print path. */
    deckId?: string;
    deckName?: string;
    /** Prop the cards render with (the buyer's pick). Defaults to staves. */
    propType?: PropType;
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
    /** Deal-in choreography: cards mount as a stacked pile and sweep into the
        fan with a staggered spring (opt-in — grid/hero fans stay static). */
    deal?: boolean;
    /** Bump to re-deal: cards gather back to the pile, then deal out again.
        The payoff flourish on the configurator's Buy click. */
    dealNonce?: number;
  }
  let {
    cards,
    deckId,
    deckName,
    propType = DEFAULT_SHOP_PROP,
    cardWidth = 122,
    maxCardWidth,
    maxCards = 6,
    exactCount,
    interactive = true,
    deal = false,
    dealNonce = 0,
  }: Props = $props();

  let boxW = $state(0);

  // Fit-based layout: cards ALWAYS share the measured box (sized against the
  // hover-open span, overlap 0.18 → each extra card shows 82%, plus ~5% tilt
  // slack), so a fan can never spill its container — the old minimum-width
  // floor overflowed the 390px configurator. Card count drops (min 3) while a
  // card would fall below cardWidth; at 3 cards they shrink instead.
  // exactCount skips the count reduction and always shrinks to fit.
  // Non-interactive fans have no hover spread, so they size against the REST
  // overlap (0.48 pitch) instead — touch layouts get ~20% bigger cards.
  const spreadPitch = $derived(interactive ? 0.82 : 0.48);
  // Tilt slack: at ±12° a 5:7 card's rotated bounding box is ~27% wider than
  // the card (w·cos12° + 1.4w·sin12°). Short rest-pitch fans carry few cards,
  // so that overhang is a big fraction of the total span and 1.05 let the
  // outer corners clip on the stage's overflow edge. Wide interactive fans
  // amortize it across 6 cards — 1.05 stays right there.
  const tiltSlack = $derived(interactive ? 1.05 : 1.18);
  const fitW = (n: number) => boxW / ((1 + spreadPitch * (n - 1)) * tiltSlack);
  const count = $derived.by(() => {
    const avail = cards.length;
    if (exactCount) return Math.max(1, Math.min(exactCount, avail));
    let n = Math.max(1, Math.min(maxCards, avail));
    while (n > 3 && boxW && fitW(n) < cardWidth) n--;
    return n;
  });
  const shown = $derived(cards.slice(0, count));
  const tilt = (i: number, n: number) => (n <= 1 ? 0 : -12 + (24 * i) / (n - 1));

  // ── deal choreography (only when `deal`) ─────────────────────────────────
  // Timing lives outside the DURATION scale on purpose: this is a one-shot
  // flourish (approved "Spring" personality from the payoff prototype), not a
  // standard UI transition. Gather is quick and unison; the deal is a
  // staggered overshoot spring.
  const DEAL_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
  const GATHER_EASE = "cubic-bezier(0.45, 0, 0.65, 0.4)";
  // Fixed per-slot jitter so the pile reads physical, not procedural.
  const PILE_JITTER = [-1.6, 1.1, -0.7, 1.8, -1.2, 0.5];

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let dealt = $state(!deal);
  $effect(() => {
    if (!deal) return;
    if (reducedMotion) {
      dealt = true;
      return;
    }
    const isRedeal = dealNonce > 0;
    dealt = false;
    // First mount: one settled frame in the pile, then deal. Re-deal (nonce
    // bump): gather animates back first, then the cards sweep out again.
    const t = setTimeout(() => (dealt = true), isRedeal ? GATHER_MS + 40 : 60);
    return () => clearTimeout(t);
  });

  // Flex pitch between card lefts is cardW minus the 52% overlap; translating
  // each slot by its pitch-distance from the middle collapses the fan into
  // one centered pile.
  const pileDx = (i: number, n: number) => -(i - (n - 1) / 2) * (cardW * 0.48);
  const slotTransform = (i: number, n: number) =>
    dealt
      ? `rotate(${tilt(i, n)}deg)`
      : `translate(${pileDx(i, n)}px, 10px) rotate(${PILE_JITTER[i % PILE_JITTER.length]}deg)`;

  const maxW = $derived(maxCardWidth ?? Math.round(cardWidth * 1.8));
  const cardW = $derived(
    shown.length && boxW ? Math.round(Math.min(maxW, fitW(shown.length))) : cardWidth
  );

  // key -> object URL, filled as the print renders land. Keyed per (card,
  // prop) so a prop swap keeps earlier props warm for an instant swap back.
  // Session-cached in the service, so revisits paint instantly.
  let urls = $state<Record<string, string>>({});
  const cardKey = (c: CoverCard) =>
    `${c.sequence?.id ?? c.sequence?.word ?? JSON.stringify(c).slice(0, 40)}|${propType}`;

  $effect(() => {
    const prop = propType;
    for (const c of shown) {
      const k = cardKey(c);
      if (urls[k]) continue;
      // Baked covers load straight from Storage — no print pipeline.
      const baked = bakedCoverUrl(c, prop);
      if (baked) {
        urls[k] = baked;
        continue;
      }
      renderCoverFront(c, { deckId, deckName, propType: prop })
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
  class:dealing={deal && !reducedMotion}
  bind:clientWidth={boxW}
  inert
  aria-hidden="true"
  style:--overlap="{-Math.round(cardW * 0.52)}px"
  style:--overlap-open="{-Math.round(cardW * 0.18)}px"
>
  <!-- Key carries the slot index: catalog sequence ids repeat across flavor
       catalogs, so a sampled variety hand can hold two cards with the same
       sequence id (each_key_duplicate crash without this). -->
  {#each shown as card, i (`${cardKey(card)}|${i}`)}
    <div class="fan-slot">
      <div
        class="fan-tilt"
        style:transform={slotTransform(i, shown.length)}
        style:transition-duration={deal ? `${dealt ? DEAL_MS : GATHER_MS}ms` : undefined}
        style:transition-timing-function={deal ? (dealt ? DEAL_EASE : GATHER_EASE) : undefined}
        style:transition-delay={deal && dealt ? `${i * DEAL_STAGGER}ms` : undefined}
      >
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
  /* Deal-in: the inline styles above drive per-card duration/ease/stagger;
     the property registration lives here so non-dealing fans never animate. */
  .fan.dealing .fan-tilt {
    transition-property: transform;
    will-change: transform;
  }

  /* Trimmed-card box: the render is the full MPC canvas WITH bleed
     (822×1122, 36px bleed → 750×1050 cut, exactly 5:7). object-fit: cover
     only trims the tiny aspect difference (~2.5%), which left the hatched
     bleed frame visible and the corners looking chopped. Overscan the image
     by the exact bleed fractions instead — the guillotine cut, for real:
     822/750 = 109.6% wide, 1122/1050 = 106.857% tall, offset by one bleed. */
  .card-box {
    position: relative;
    aspect-ratio: 5 / 7;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
    background: #f4f4f4;
  }

  .card-img {
    position: absolute;
    width: 109.6%;
    height: 106.857%;
    left: -4.8%;
    top: -3.4286%;
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
