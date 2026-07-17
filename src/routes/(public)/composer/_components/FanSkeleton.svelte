<!--
  FanSkeleton

  Shimmer stand-in for the composer card fan with the EXACT footprint the
  loaded DeckFanCover produces, at every width — rendered both as the
  LazyMount placeholder (before the demo chunk arrives, including in the
  prerendered HTML) and inside ComposerChoreoCardsDemo while the catalog
  loads. Same skeleton in both states = the chunk swap is invisible and
  nothing below the fan ever moves (no-layout-shift.md).

  GEOMETRY — derived from DeckFanCover's fit math with the composer demo's
  props (cardWidth 128, maxCardWidth 280, interactive):

    cardW(n) = boxW / ((1 + 0.82·(n−1)) · 1.05)   (spreadPitch · tiltSlack)
    count n drops 6 → 5 → 4 → 3 while cardW(n) < 128
    fan height = cardW · 7/5 + 28px               (.fan padding 18px + 10px)

  Solving cardW(n) ≥ 128 for boxW gives the count bands (in container px):
    n=6: boxW ≥ 685.44   n=5: boxW ≥ 575.23   n=4: boxW ≥ 465.02   n=3: below
  DeckFanCover compares against an integer clientWidth, so it switches at
  466 / 576 / 686; the @container thresholds sit 0.25px above those so any
  fractional-width sliver rounds toward the TALLER reservation (air above
  the fan for <1px of widths, never overflow). Card widths per band are
  100cqw / ((1 + 0.82·(n−1)) · 1.05). The host's duo column can now exceed
  40rem, so maxCardWidth (280) binds once boxW ≥ 280 · 5.355 = 1499.4 —
  the final band pins the card at 280px.

  If DeckFanCover's spreadPitch/tiltSlack/padding or the demo's card props
  change, re-derive these numbers — they are that math, in CSS.

  REQUIRES an ancestor with container-type: inline-size (the page's
  .cards-fan wrapper) for the cqw units to resolve.
-->
<script lang="ts">
  let { shimmer = true }: { shimmer?: boolean } = $props();
</script>

<div class="sk-fan" class:shimmer aria-hidden="true">
  {#each [0, 1, 2, 3, 4, 5] as i (i)}
    <div class="sk-card"></div>
  {/each}
</div>

<style>
  .sk-fan {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    padding: 18px 0 10px; /* = .fan in DeckFanCover */
    width: 100%;
    /* n=3 band: cardW = 100cqw / 2.772 */
    --sk-card-w: 36.075cqw;
  }
  @container (min-width: 466.25px) {
    .sk-fan {
      /* n=4 band: cardW = 100cqw / 3.633 */
      --sk-card-w: 27.526cqw;
    }
  }
  @container (min-width: 576.25px) {
    .sk-fan {
      /* n=5 band: cardW = 100cqw / 4.494 */
      --sk-card-w: 22.252cqw;
    }
  }
  @container (min-width: 686.25px) {
    .sk-fan {
      /* n=6 band: cardW = 100cqw / 5.355 */
      --sk-card-w: 18.674cqw;
    }
  }
  @container (min-width: 1499.4px) {
    .sk-fan {
      /* maxCardWidth ceiling: fitW(6) would exceed 280px here */
      --sk-card-w: 280px;
    }
  }

  .sk-card {
    width: var(--sk-card-w);
    aspect-ratio: 5 / 7;
    border-radius: 6px;
    transform-origin: bottom center;
    background: linear-gradient(110deg, #ececf2 40%, #f8f8fc 50%, #ececf2 60%);
    background-size: 220% 100%;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  }
  .sk-fan.shimmer .sk-card {
    animation: sk-shimmer 1.4s linear infinite;
  }
  /* Rest overlap: each card after the first tucks 52% under its neighbor,
     matching DeckFanCover's --overlap. */
  .sk-card + .sk-card {
    margin-left: calc(var(--sk-card-w) * -0.52);
  }

  /* Card count + tilt fan-out per band, mirroring tilt(i, n) = -12° … +12°. */
  .sk-card:nth-child(4),
  .sk-card:nth-child(5),
  .sk-card:nth-child(6) {
    display: none;
  }
  .sk-card:nth-child(1) { transform: rotate(-12deg); }
  .sk-card:nth-child(2) { transform: rotate(0deg); }
  .sk-card:nth-child(3) { transform: rotate(12deg); }

  @container (min-width: 466.25px) {
    .sk-card:nth-child(4) { display: block; }
    .sk-card:nth-child(1) { transform: rotate(-12deg); }
    .sk-card:nth-child(2) { transform: rotate(-4deg); }
    .sk-card:nth-child(3) { transform: rotate(4deg); }
    .sk-card:nth-child(4) { transform: rotate(12deg); }
  }
  @container (min-width: 576.25px) {
    .sk-card:nth-child(5) { display: block; }
    .sk-card:nth-child(1) { transform: rotate(-12deg); }
    .sk-card:nth-child(2) { transform: rotate(-6deg); }
    .sk-card:nth-child(3) { transform: rotate(0deg); }
    .sk-card:nth-child(4) { transform: rotate(6deg); }
    .sk-card:nth-child(5) { transform: rotate(12deg); }
  }
  @container (min-width: 686.25px) {
    .sk-card:nth-child(6) { display: block; }
    .sk-card:nth-child(1) { transform: rotate(-12deg); }
    .sk-card:nth-child(2) { transform: rotate(-7.2deg); }
    .sk-card:nth-child(3) { transform: rotate(-2.4deg); }
    .sk-card:nth-child(4) { transform: rotate(2.4deg); }
    .sk-card:nth-child(5) { transform: rotate(7.2deg); }
    .sk-card:nth-child(6) { transform: rotate(12deg); }
  }

  @keyframes sk-shimmer {
    from {
      background-position: 130% 0;
    }
    to {
      background-position: -90% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sk-fan.shimmer .sk-card {
      animation: none;
    }
  }
</style>
