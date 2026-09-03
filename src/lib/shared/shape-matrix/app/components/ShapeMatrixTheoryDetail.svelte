<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixTheoryDetail.svelte
  The Theory surface's detail pane: the cell you picked in the grid, playing.

  It is the counterpart of the Matrix drill. The grid says which pair; this
  says what that pair DOES, with the same timing and direction the grid was
  painted under. The two rate sliders sit under the stage as live tuners:
  scrub a hand while it spins and the rate changes without the prop jumping,
  and landing on an exact ratio moves that axis of the grid. -->
<script lang="ts">
  import {
    jointSpinRatioClosureHandCycles,
    spinRatioKey,
    spinRatioToTkaTurnFraction,
    type SpinRatio,
  } from "@vtg/domain";
  import {
    buildRatioStops,
    snapToStop,
  } from "$lib/shared/shape-matrix/domain/ratio-tuner";
  import {
    isStationaryRatio,
    theoryKnobs,
    type TheoryFlower,
  } from "$lib/shared/shape-matrix/domain/theory-flower";
  import { MODE_LABEL } from "$lib/shared/shape-matrix/services/shape-matrix-realizations";
  import { FAMILY_BY_MODE } from "$lib/shared/shape-matrix/services/build-mode-realizations";
  import { TND_BY_FAMILY } from "$lib/features/choreo-card/domain/tnd-element";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";
  import ShapeMatrixLiveRatioStage, {
    type LiveHand,
  } from "./ShapeMatrixLiveRatioStage.svelte";
  import ShapeMatrixRatioSlider from "./ShapeMatrixRatioSlider.svelte";

  const app = getShapeMatrixAppContext();

  const BLUE = "var(--dm-motion-blue, #3575e2)";
  const RED = "var(--dm-motion-red, #ed1c24)";

  const stops = buildRatioStops();

  let paused = $state(false);
  let alignToken = $state(0);

  /*
   * Scrubbed rates live here, not in app state. A value between two stops is a
   * real thing to look at and a meaningless thing to link to, and the shared
   * contract is one exact ratio per axis. So a slider writes back only when it
   * settles on a stop, and the free value is forgotten when the cell changes.
   */
  let scrubbed = $state<{ left: number | null; right: number | null }>({
    left: null,
    right: null,
  });

  const pair = $derived(app.theoryPair);

  const cellKey = $derived(
    pair
      ? `${spinRatioKey(pair.left.ratio)}|${spinRatioKey(pair.right.ratio)}`
      : ""
  );
  let appliedCell = $state("");
  $effect(() => {
    if (cellKey === appliedCell) return;
    appliedCell = cellKey;
    scrubbed = { left: null, right: null };
  });

  function rateOf(flower: TheoryFlower): number {
    return isStationaryRatio(flower.ratio)
      ? flower.ratio.propRotations
      : flower.ratio.propRotations / flower.ratio.handCycles;
  }

  function liveHand(
    flower: TheoryFlower,
    hand: "left" | "right",
    color: string
  ): LiveHand {
    const knobs = theoryKnobs(flower, hand, app.theoryMode);
    return {
      id: hand,
      rate: scrubbed[hand] ?? rateOf(flower),
      spinSign: knobs.spin === "inspin" ? 1 : -1,
      radius: knobs.radius,
      color,
      handPhase: knobs.handPhase ?? 8,
      handSign: knobs.handDirection ?? 1,
      propPhase: knobs.phase ?? 0,
    };
  }

  const hands = $derived<LiveHand[]>(
    pair
      ? [liveHand(pair.left, "left", BLUE), liveHand(pair.right, "right", RED)]
      : []
  );

  const jointCycles = $derived.by(() => {
    if (!pair) return null;
    return jointSpinRatioClosureHandCycles([
      pair.left.ratio,
      pair.right.ratio,
    ]);
  });

  function tune(hand: "left" | "right", next: number): void {
    scrubbed = { ...scrubbed, [hand]: next };
    const stop = snapToStop(stops, next);
    if (stop) app.setTheoryRatioFor(hand, stop.ratio);
  }

  function turnLabel(ratio: SpinRatio): string {
    const fraction = spinRatioToTkaTurnFraction(ratio);
    if (fraction === "fl") return "Float";
    if (fraction === null) return "No finite value";
    if (fraction.numerator === 0) return "0";
    if (fraction.denominator === 1) return `${fraction.numerator}`;
    const sign = fraction.numerator < 0 ? "−" : "";
    return `${sign}${Math.abs(fraction.numerator)}/${fraction.denominator}`;
  }

  function styleLabel(flower: TheoryFlower): string {
    if (isStationaryRatio(flower.ratio)) return "stationary hand";
    if (flower.ratio.propRotations === 0) return `float ${flower.ori}`;
    return `${flower.style === "pro" ? "prospin" : "antispin"} ${flower.ori}`;
  }

  /** The element the chosen pairing carries everywhere else in the app. */
  const pairingElement = $derived(TND_BY_FAMILY[FAMILY_BY_MODE[app.theoryMode]]);

  const closure = $derived(
    jointCycles === null
      ? "Open path"
      : `${jointCycles} hand ${jointCycles === 1 ? "cycle" : "cycles"}`
  );
</script>

<aside class="theory-detail" aria-label="Selected theory pair">
  {#if !pair}
    <div class="empty">
      <strong>Pick a cell</strong>
      <small>Its two hands run here, at the pairing the grid is drawn in.</small>
    </div>
  {:else}
    <header class="pair-heading">
      <div class="pair-keys">
        <strong style={`color: ${BLUE};`}>
          {spinRatioKey(pair.left.ratio)}
        </strong>
        <span class="against">against</span>
        <strong style={`color: ${RED};`}>
          {spinRatioKey(pair.right.ratio)}
        </strong>
      </div>
      <span
        class="pairing-chip"
        style={pairingElement
          ? `--pairing-accent: ${pairingElement.accentColor};`
          : undefined}
      >
        {#if pairingElement}
          <img src={pairingElement.iconPath} alt="" />
        {/if}
        {MODE_LABEL[app.theoryMode]}
      </span>
    </header>

    <div class="stage-card">
      <div class="stage-window">
        <ShapeMatrixLiveRatioStage {hands} {paused} {alignToken} />
      </div>
      <div class="stage-actions">
        <button
          type="button"
          class="stage-action"
          onclick={() => (paused = !paused)}
          aria-pressed={paused}
        >
          <i class={paused ? "fas fa-play" : "fas fa-pause"} aria-hidden="true"
          ></i>
          <span>{paused ? "Play" : "Pause"}</span>
        </button>
        <button
          type="button"
          class="stage-action"
          onclick={() => (alignToken += 1)}
        >
          <i class="fas fa-crosshairs" aria-hidden="true"></i>
          <span>Restart</span>
        </button>
      </div>
    </div>

    <div class="tuners">
      <span class="section-label">Tune while it spins</span>
      <ShapeMatrixRatioSlider
        {stops}
        value={scrubbed.left ?? rateOf(pair.left)}
        locked={snapToStop(stops, scrubbed.left ?? rateOf(pair.left))}
        label="Blue"
        color={BLUE}
        onchange={(next) => tune("left", next)}
      />
      <ShapeMatrixRatioSlider
        {stops}
        value={scrubbed.right ?? rateOf(pair.right)}
        locked={snapToStop(stops, scrubbed.right ?? rateOf(pair.right))}
        label="Red"
        color={RED}
        onchange={(next) => tune("right", next)}
      />
    </div>

    <dl class="pair-facts">
      <div>
        <dt>Blue</dt>
        <dd>{styleLabel(pair.left)} · {pair.left.petals} petals</dd>
      </div>
      <div>
        <dt>Red</dt>
        <dd>{styleLabel(pair.right)} · {pair.right.petals} petals</dd>
      </div>
      <div>
        <dt>TKA-equivalent</dt>
        <dd>
          {turnLabel(pair.left.ratio)} / {turnLabel(pair.right.ratio)}
        </dd>
      </div>
      <div>
        <dt>Closed path</dt>
        <dd>{closure}</dd>
      </div>
    </dl>

    <p class="boundary-note">
      These paths are calculated continuously. Theory does not assign new
      Kinetic Alphabet letters.
    </p>
  {/if}
</aside>

<style>
  .theory-detail {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
    gap: 0.7rem;
    overflow-y: auto;
    padding: 0.85rem;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
    border-radius: 16px;
    background: var(--theme-panel-bg, rgb(16 23 33 / 0.82));
    color: var(--theme-text, #fff);
  }

  /* The same shape the Matrix drill's empty state has: a title and one line
     under it, centred in the pane, so switching surfaces does not switch the
     way the app talks. */
  .empty {
    display: grid;
    height: 100%;
    align-content: center;
    justify-items: center;
    gap: 0.35rem;
    text-align: center;
  }

  .empty strong {
    color: var(--theme-text, #fff);
    font-size: var(--font-size-base, 1rem);
    font-weight: 700;
  }

  .empty small {
    max-width: 26rem;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.58));
    font-size: var(--font-size-sm, 0.875rem);
  }

  .pair-heading {
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .pair-keys {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    font-size: var(--font-size-lg, 1.125rem);
    font-variant-numeric: tabular-nums;
  }

  .against {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.55));
    font-size: var(--font-size-compact, 0.75rem);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* The chip wears the element the pairing carries everywhere else, so the
     grid, the ribbon row, and this heading all name the same thing. */
  .pairing-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.6rem;
    border: 1px solid
      color-mix(in srgb, var(--pairing-accent, var(--theme-accent, #f59e0b)) 45%, transparent);
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--pairing-accent, var(--theme-accent, #f59e0b)) 16%,
      transparent
    );
    color: color-mix(
      in srgb,
      var(--pairing-accent, var(--theme-accent, #f59e0b)) 25%,
      #fff
    );
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 650;
  }

  .pairing-chip img {
    width: 1rem;
    height: 1rem;
    object-fit: contain;
  }

  /* The stage is the one part of this column that deserves the leftover
     room, so it takes it. Everything else keeps its content height. */
  .stage-card {
    display: flex;
    /* A zero basis, so the card claims exactly the room the rest of the
       column does not want. Sizing it from its content instead lets it grow
       past the leftover and push the note out of the pane. */
    flex: 1 1 0;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* The canvas fits the SHORTER side of this box and centres, so a fixed
     22rem cap drew a small mandala in a wide letterbox on a tall pane and
     left the column dead below the facts. Growing into the free height
     instead spends that room on the artwork. The box is sized by the flex
     column before the canvas paints, so nothing below it moves when the
     stage mounts or the pair changes. */
  .stage-window {
    position: relative;
    flex: 1 1 auto;
    width: 100%;
    /* The card keeps its automatic minimum, so this floor is also the card's:
       set it too high on a short pane and the card cannot shrink to the room
       it was given, and its buttons ride over the tuners below. */
    min-height: 9rem;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.09));
    border-radius: 14px;
    background: color-mix(in srgb, #000 34%, var(--theme-panel-bg, #0a0f14));
  }

  /* Taken out of flow on purpose. In flow, the canvas reports its own pixel
     buffer as an intrinsic height, that height becomes the box's minimum, and
     the box the canvas was just sized from can never shrink again. */
  .stage-window :global(canvas) {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
  }

  .stage-actions {
    display: flex;
    flex: 0 0 auto;
    gap: 0.4rem;
  }

  .stage-action {
    display: inline-flex;
    min-height: var(--min-touch-target, 44px);
    flex: 1 1 0;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.16));
    border-radius: 10px;
    background: color-mix(in srgb, var(--theme-text, #fff) 6%, transparent);
    color: var(--theme-text, #fff);
    font: inherit;
    font-size: var(--font-size-sm, 0.875rem);
    cursor: pointer;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast);
  }

  .stage-action:hover {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 60%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 15%,
      transparent
    );
  }

  .stage-action:focus-visible {
    outline: 2px solid var(--theme-accent, #f59e0b);
    outline-offset: 2px;
  }

  .tuners {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    gap: 0.55rem;
  }

  .section-label {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.52));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .pair-facts {
    display: grid;
    flex: 0 0 auto;
    grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
    gap: 0.5rem;
    margin: 0;
  }

  .pair-facts div {
    display: grid;
    gap: 0.15rem;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.08));
    border-radius: 10px;
    background: color-mix(in srgb, var(--theme-text, #fff) 3.5%, transparent);
  }

  .pair-facts dt {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.52));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 650;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .pair-facts dd {
    margin: 0;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
  }

  .boundary-note {
    margin: 0;
    flex: 0 0 auto;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.5));
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.5;
  }

  @container shape-matrix-app (max-width: 74.99rem) or (max-height: 41.99rem) {
    .theory-detail {
      border: 0;
      border-radius: 0;
    }
  }
</style>
