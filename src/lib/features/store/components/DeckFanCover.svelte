<!--
  DeckFanCover — a fanned hand of REAL ChoreoCards (printed 5:7 light look) used
  as deck cover art in the shop grid, the /shop hero, and the configurator.
  Same treatment verified on /test/shop-covers: fixed tilts, overlap, hover
  spread + per-card lift.

  Decorative by design: ChoreoCard's root is a <button>, and covers render
  inside links/option buttons, so the whole fan is `inert` + aria-hidden. The
  host element carries the accessible label.

  Card count responds to container width (3–6), capped by maxCards.
-->
<script lang="ts">
  import ChoreoCard from "$lib/features/choreo-card/components/ChoreoCard.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  interface Props {
    sequences: readonly SequenceData[];
    /** MINIMUM rest width of one card, px. Cards auto-scale UP from here to fill
        the container (ultrawide screens get a properly big fan), capped by
        maxCardWidth. Fan height follows (5:7). */
    cardWidth?: number;
    /** Auto-scale ceiling. Defaults to 1.8x cardWidth. */
    maxCardWidth?: number;
    /** Upper bound on cards shown (width may show fewer). */
    maxCards?: number;
    /** Disable hover spread/lift (e.g. tiny tiles). */
    interactive?: boolean;
  }
  let {
    sequences,
    cardWidth = 122,
    maxCardWidth,
    maxCards = 6,
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
  const shown = $derived(sequences.slice(0, Math.max(1, Math.min(maxCards, countFor(boxW)))));
  const tilt = (i: number, n: number) => (n <= 1 ? 0 : -12 + (24 * i) / (n - 1));

  // Auto-scale: grow cards to fill the measured container. Sized against the
  // HOVER-OPEN span (overlap 0.18 → each extra card shows 82%) plus ~5% slack
  // for tilt overhang, so the spread never spills the box.
  const maxW = $derived(maxCardWidth ?? Math.round(cardWidth * 1.8));
  const cardW = $derived(
    shown.length && boxW
      ? Math.round(
          Math.min(maxW, Math.max(cardWidth, boxW / ((1 + 0.82 * (shown.length - 1)) * 1.05)))
        )
      : cardWidth
  );
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
  {#each shown as seq, i (seq.id)}
    <div class="fan-slot">
      <div class="fan-tilt" style:transform="rotate({tilt(i, shown.length)}deg)">
        <div class="card-box" style:width="{cardW}px">
          <ChoreoCard sequence={seq} cardMode showQRCodes={false} customNotesText="" />
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

  /* Real printed card: portrait poker 5:7. The card keeps its OWN border (no
     clip), and the wordcard render is contained, never stretched. */
  .card-box {
    aspect-ratio: 5 / 7;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  }
  .card-box :global(.prop-thumbnail[data-variant="wordcard"] img) {
    object-fit: contain;
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
  }
</style>
