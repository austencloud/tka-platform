<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import {
    buildTheorySpinRatioAtlas,
    jointSpinRatioClosureHandCycles,
    makeSpinRatio,
    spinRatioKey,
    spinRatioPetals,
    spinRatioToTkaTurnFraction,
    type SpinRatio,
    type SpinStyle,
  } from "@vtg/domain";
  import {
    buildRatioStops,
    nearestStop,
    snapToStop,
    type RatioStop,
  } from "$lib/shared/shape-matrix/domain/ratio-tuner";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";
  import ShapeMatrixLiveRatioStage, {
    type LiveHand,
  } from "./ShapeMatrixLiveRatioStage.svelte";
  import ShapeMatrixRatioSlider from "./ShapeMatrixRatioSlider.svelte";
  import ShapeMatrixRatioThumbnail from "./ShapeMatrixRatioThumbnail.svelte";

  const app = getShapeMatrixAppContext();

  const stops = buildRatioStops();
  const catalog = buildTheorySpinRatioAtlas();
  const STATIONARY = makeSpinRatio(1, 0);

  const BLUE = "var(--dm-motion-blue, #3575e2)";
  const RED = "var(--dm-motion-red, #ed1c24)";

  /*
   * The URL carries where you arrived; the sliders carry where you are now.
   *
   * Keeping the continuous values out of app state is deliberate. A value
   * between two stops is a real thing to look at and a meaningless thing to
   * link to, and the shared contract is one exact `ratio=P:Q`. So the blue
   * slider writes back only when it settles on a stop, and nothing else does.
   */
  const entry = app.theoryRatio;
  const entryValue =
    entry.handCycles === 0 ? 1 : entry.propRotations / entry.handCycles;

  let leftValue = $state(entryValue);
  let rightValue = $state(entryValue);
  let leftStationary = $state(entry.handCycles === 0);
  let rightStationary = $state(entry.handCycles === 0);
  let paused = $state(false);
  let alignToken = $state(0);

  const leftLock = $derived(
    leftStationary ? null : snapToStop(stops, leftValue)
  );
  const rightLock = $derived(
    rightStationary ? null : snapToStop(stops, rightValue)
  );

  const spinSign = $derived<1 | -1>(app.theorySpin === "pro" ? 1 : -1);

  const hands = $derived<LiveHand[]>([
    {
      id: "left",
      rate: leftStationary ? 1 : leftValue,
      spinSign,
      radius: leftStationary ? 0 : 1,
      color: BLUE,
      handPhase: 6,
    },
    {
      id: "right",
      rate: rightStationary ? 1 : rightValue,
      spinSign,
      radius: rightStationary ? 0 : 1,
      color: RED,
      handPhase: 2,
    },
  ]);

  /*
   * Both hands run on one hand clock, so the pair repeats on the least common
   * multiple of their closures. Two hands that each close cleanly on their own
   * can still take six cycles together, which is the fact that makes the
   * second slider worth having rather than a mirror of the first.
   */
  const jointCycles = $derived.by(() => {
    const settled: SpinRatio[] = [];
    if (leftStationary) settled.push(STATIONARY);
    else if (leftLock) settled.push(leftLock.ratio);
    if (rightStationary) settled.push(STATIONARY);
    else if (rightLock) settled.push(rightLock.ratio);
    if (settled.length < 2) return null;
    return jointSpinRatioClosureHandCycles(settled);
  });

  const focusRatio = $derived<SpinRatio>(
    leftStationary
      ? STATIONARY
      : (leftLock?.ratio ?? nearestStop(stops, leftValue).stop.ratio)
  );

  const spinOptions = $derived.by(() => {
    if (leftStationary && rightStationary) {
      return [
        { value: "pro" as const, label: "Clockwise prop", shortLabel: "CW" },
        {
          value: "anti" as const,
          label: "Counterclockwise prop",
          shortLabel: "CCW",
        },
      ];
    }
    return [
      { value: "pro" as const, label: "Prospin", shortLabel: "Pro" },
      { value: "anti" as const, label: "Antispin", shortLabel: "Anti" },
    ];
  });

  function setLeft(next: number): void {
    leftStationary = false;
    leftValue = next;
    const stop = snapToStop(stops, next);
    if (stop) app.setTheoryRatio(stop.ratio);
  }

  function setRight(next: number): void {
    rightStationary = false;
    rightValue = next;
  }

  function selectFromIndex(ratio: SpinRatio): void {
    if (ratio.handCycles === 0) {
      leftStationary = true;
      rightStationary = true;
      app.setTheoryRatio(ratio);
      return;
    }
    const value = ratio.propRotations / ratio.handCycles;
    setLeft(value);
    setRight(value);
  }

  function isIndexed(ratio: SpinRatio): boolean {
    if (ratio.handCycles === 0) return leftStationary || rightStationary;
    const key = spinRatioKey(ratio);
    return leftLock?.key === key || rightLock?.key === key;
  }

  function formatTurn(ratio: SpinRatio): string {
    const fraction = spinRatioToTkaTurnFraction(ratio);
    if (fraction === "fl") return "Float";
    if (fraction === null) return "No finite value";
    if (fraction.numerator === 0) return "0";
    if (fraction.denominator === 1) return `${fraction.numerator}`;
    const sign = fraction.numerator < 0 ? "−" : "";
    return `${sign}${Math.abs(fraction.numerator)}/${fraction.denominator}`;
  }

  function closureLabel(): string {
    if (leftStationary && rightStationary) return "Stationary hands";
    if (jointCycles === null) return "Open path";
    return `${jointCycles} hand ${jointCycles === 1 ? "cycle" : "cycles"}`;
  }

  /*
   * What one settled hand is doing, in the two numbers that explain the
   * difference between 1:2 and 2:1: the ratio and the petal count its path
   * resolves to under the current direction relationship.
   */
  function handSummary(lock: RatioStop | null, stationary: boolean): string {
    if (stationary) return "1:0 stationary";
    if (!lock) return "between shapes";
    const petals = spinRatioPetals(lock.ratio, app.theorySpin);
    if (petals === 0) return `${lock.key} still point`;
    return `${lock.key} ${petals} ${petals === 1 ? "petal" : "petals"}`;
  }

  function indexLabel(ratio: SpinRatio): string {
    const key = spinRatioKey(ratio);
    if (ratio.handCycles === 0) return `${key}, stationary hand`;
    const cycles = ratio.handCycles;
    return `${key}, closes in ${cycles} hand ${cycles === 1 ? "cycle" : "cycles"}`;
  }
</script>

<section class="theory-atlas" aria-labelledby="theory-atlas-title">
  <div class="theory-stage-zone">
    <header class="theory-heading">
      <div>
        <span class="eyebrow">Continuous geometry</span>
        <h2 id="theory-atlas-title">Rational Ratio Atlas</h2>
      </div>
      <span class="theory-badge">Theory</span>
    </header>

    <div class="stage-card">
      <div class="stage-label" aria-live="polite">
        <strong style={`color: ${BLUE};`}
          >{leftStationary ? "1:0" : (leftLock?.key ?? "open")}</strong
        >
        <strong style={`color: ${RED};`}
          >{rightStationary ? "1:0" : (rightLock?.key ?? "open")}</strong
        >
        <span>{app.theorySpin === "pro" ? "Pro" : "Anti"}</span>
      </div>
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

    <dl class="ratio-facts">
      <div>
        <dt>Prop : hand</dt>
        <dd>{leftStationary ? "1:0" : (leftLock?.key ?? "Between")}</dd>
      </div>
      <div>
        <dt>TKA-equivalent</dt>
        <dd>{leftLock || leftStationary ? formatTurn(focusRatio) : "None"}</dd>
      </div>
      <div>
        <dt>Closed path</dt>
        <dd>{closureLabel()}</dd>
      </div>
      <div>
        <dt>Path petals</dt>
        <dd>
          {leftLock || leftStationary
            ? spinRatioPetals(focusRatio, app.theorySpin)
            : "None"}
        </dd>
      </div>
    </dl>
  </div>

  <aside class="atlas-controls" aria-label="Theory ratio controls">
    <header class="control-heading">
      <div>
        <span class="eyebrow">Tune each hand</span>
        <h3>Through ninths</h3>
      </div>
      <span class="ratio-count">{catalog.length}</span>
    </header>

    <p class="atlas-note">
      Drag either hand while it spins. The ratio sets the rate, not the
      position, so nothing jumps and the trail keeps whatever it just drew.
      Ticks mark the exact ratios, tall for the simple ones.
    </p>

    <div class="tuners">
      <ShapeMatrixRatioSlider
        {stops}
        value={leftStationary ? 1 : leftValue}
        locked={leftLock}
        label="Blue"
        color={BLUE}
        onchange={setLeft}
      />
      <ShapeMatrixRatioSlider
        {stops}
        value={rightStationary ? 1 : rightValue}
        locked={rightLock}
        label="Red"
        color={RED}
        onchange={setRight}
      />
    </div>

    <div class="spin-control">
      <span class="control-label">Direction relationship</span>
      <SegmentedControl
        options={spinOptions}
        value={app.theorySpin}
        onchange={(spin: SpinStyle) => app.setTheorySpin(spin)}
        size="md"
        color="accent"
        semantics="radiogroup"
        ariaLabel="Rotation direction relationship"
      />
    </div>

    <div class="shape-index">
      <span class="control-label">Every exact shape</span>
      <div class="index-grid">
        {#each catalog as ratio (spinRatioKey(ratio))}
          <button
            type="button"
            class="index-card"
            class:selected={isIndexed(ratio)}
            onclick={() => selectFromIndex(ratio)}
            aria-pressed={isIndexed(ratio)}
            aria-label={indexLabel(ratio)}
          >
            <span class="index-art">
              <ShapeMatrixRatioThumbnail {ratio} spin={app.theorySpin} />
            </span>
            <span class="index-key">{spinRatioKey(ratio)}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="pair-readout">
      <span class="control-label">Together</span>
      <div class="pair-chips">
        <span class="pair-chip blue"
          >{handSummary(leftLock, leftStationary)}</span
        >
        <span class="pair-chip red">{handSummary(rightLock, rightStationary)}</span
        >
        <span class="pair-chip">{closureLabel()}</span>
      </div>
    </div>

    <p class="boundary-note">
      These paths are calculated continuously. The atlas does not assign new
      Kinetic Alphabet letters.
    </p>
  </aside>
</section>

<style>
  .theory-atlas {
    container: theory-atlas / size;
    display: grid;
    grid-template-columns: minmax(26rem, 1.35fr) minmax(30rem, 1fr);
    gap: clamp(0.75rem, 1.2vw, 1.5rem);
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    padding: clamp(0.75rem, 1.25vw, 1.5rem);
    overflow: hidden;
    background:
      radial-gradient(
        circle at 28% 35%,
        color-mix(in srgb, var(--theme-accent, #f59e0b) 9%, transparent),
        transparent 34rem
      ),
      var(--theme-panel-bg, #0a0f14);
  }

  .theory-stage-zone,
  .atlas-controls {
    min-width: 0;
    min-height: 0;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
    border-radius: 16px;
    background: color-mix(
      in srgb,
      var(--theme-card-bg, #111923) 92%,
      transparent
    );
  }

  .theory-stage-zone {
    display: grid;
    grid-template-rows: auto minmax(12rem, 1fr) auto;
    gap: 0.75rem;
    padding: clamp(0.75rem, 1vw, 1.25rem);
  }

  .theory-heading,
  .control-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  h2,
  h3,
  p,
  dl,
  dd {
    margin: 0;
  }

  h2 {
    font-size: clamp(1.2rem, 1.6vw, 1.65rem);
    line-height: 1.15;
  }

  h3 {
    font-size: 1.05rem;
    line-height: 1.2;
  }

  .eyebrow,
  .control-label {
    display: block;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.62));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .eyebrow {
    margin-bottom: 0.25rem;
  }

  .theory-badge,
  .ratio-count {
    display: inline-grid;
    min-width: 2.5rem;
    min-height: 2rem;
    place-items: center;
    padding-inline: 0.6rem;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #f59e0b) 42%, transparent);
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 10%,
      transparent
    );
    color: var(--theme-text, #fff);
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }

  .stage-card {
    position: relative;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
    border-radius: 14px;
    background:
      radial-gradient(
        circle at center,
        color-mix(in srgb, var(--theme-accent, #f59e0b) 5%, transparent),
        transparent 58%
      ),
      color-mix(in srgb, var(--theme-panel-bg, #0a0f14) 92%, black);
  }

  .stage-window {
    position: absolute;
    inset: 0;
    padding: clamp(1rem, 3cqw, 2.5rem);
  }

  .stage-label {
    position: absolute;
    z-index: 2;
    top: 0.75rem;
    left: 0.75rem;
    display: flex;
    align-items: baseline;
    gap: 0.55rem;
    font-variant-numeric: tabular-nums;
  }

  .stage-label strong {
    font-size: 1.1rem;
  }

  .stage-label span {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.64));
    font-size: var(--font-size-compact, 0.75rem);
  }

  .stage-actions {
    position: absolute;
    z-index: 2;
    right: 0.75rem;
    bottom: 0.75rem;
    display: flex;
    gap: 0.5rem;
  }

  .stage-action {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    min-height: var(--min-touch-target, 44px);
    padding-inline: 0.85rem;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.16));
    border-radius: 10px;
    background: color-mix(in srgb, var(--theme-panel-bg, #0a0f14) 78%, black);
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 600;
    cursor: pointer;
    transition:
      background var(--transition-fast, 120ms) ease,
      border-color var(--transition-fast, 120ms) ease;
  }

  .stage-action:hover {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 55%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 18%,
      var(--theme-panel-bg, #0a0f14)
    );
  }

  .ratio-facts {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .ratio-facts > div {
    min-width: 0;
    padding: 0.65rem 0.75rem;
    border-radius: 10px;
    background: var(--theme-panel-bg, rgb(0 0 0 / 0.2));
  }

  .ratio-facts dt {
    overflow: hidden;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.62));
    font-size: var(--font-size-compact, 0.75rem);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ratio-facts dd {
    margin-top: 0.25rem;
    overflow: hidden;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 0.875rem);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /*
   * The index row is the one that flexes. Everything else is its own height,
   * so the closing note stays on the floor of the pane instead of floating
   * halfway up it when the shapes need less room than the pane has.
   */
  .atlas-controls {
    display: grid;
    grid-template-rows: auto auto auto auto minmax(0, 1fr) auto auto;
    gap: 0.85rem;
    padding: clamp(0.75rem, 1vw, 1.25rem);
    overflow: hidden;
  }

  .atlas-note,
  .boundary-note {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.68));
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.45;
    /* A maximum, not a width: it collapses on narrow panes and keeps the
       instruction from stretching into a single wide band at 4K. */
    max-width: 62ch;
  }

  .tuners {
    display: grid;
    gap: 0.5rem;
  }

  .spin-control {
    display: grid;
    gap: 0.4rem;
  }

  /* Two short labels. Let them size to their words rather than stretching a
     two-option control into a progress bar. */
  .spin-control :global(.segmented-control) {
    width: min(100%, 15rem);
  }

  .shape-index {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 0.4rem;
    min-height: 0;
  }

  /*
   * Deliberate column counts, not auto-fill. Thirty shapes divide evenly by
   * five and ten, so every tier fills its last row; an auto-fill that happened
   * to land on nine would strand three cards on their own.
   */
  .index-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.4rem;
    /* Centred rather than top-pinned so a short index reads as a composed
       block instead of a grid with a hole under it. `safe` falls back to
       start when the set does overflow, so nothing is ever clipped away. */
    align-content: safe center;
    /*
     * A legibility floor, not a fixed size. A short pane would otherwise
     * squeeze the rows until an eight-ninths rosette is 22px of grey mush;
     * below this height the index scrolls instead, which costs a gesture and
     * keeps every shape recognisable.
     */
    grid-auto-rows: minmax(4.5rem, auto);
    min-height: 0;
    padding-right: 0.25rem;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  @container theory-atlas (min-width: 62rem) {
    .index-grid {
      grid-template-columns: repeat(10, minmax(0, 1fr));
    }
  }

  /*
   * A tall pane gets a squarer block rather than three wide bands floating in
   * dead height. 30 divides evenly by 5, 6, and 10, so every tier lands on a
   * full last row and the thumbnails grow into the room instead of the labels.
   */
  @container theory-atlas (min-width: 62rem) and (min-height: 66rem) {
    .index-grid {
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 0.55rem;
    }
  }

  .index-card {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 0.15rem;
    place-items: center;
    min-height: var(--min-touch-target, 44px);
    padding: 0.3rem;
    border: 1px solid transparent;
    border-radius: 10px;
    background: color-mix(in srgb, var(--theme-text, #fff) 4%, transparent);
    color: var(--theme-text-dim, rgb(255 255 255 / 0.58));
    cursor: pointer;
    transition:
      background var(--transition-fast, 120ms) ease,
      border-color var(--transition-fast, 120ms) ease,
      color var(--transition-fast, 120ms) ease;
  }

  .index-card:hover {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 45%,
      transparent
    );
    color: var(--theme-text, #fff);
  }

  /* Whole-surface selection rather than an edge stripe: the card tints and
     takes a full ring, so the state reads as a property of the shape. */
  .index-card.selected {
    border-color: var(--theme-accent, #f59e0b);
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 20%,
      transparent
    );
    color: var(--theme-text, #fff);
  }

  .index-art {
    display: block;
    width: 100%;
    /*
     * Square, but bounded by the row it was actually given. Deriving the
     * square from width alone lets a wide card in a short lane grow a box
     * taller than its track and paint straight over the label; the thumbnail
     * fits itself inside whatever survives the clamp.
     */
    max-height: 100%;
    min-height: 0;
    aspect-ratio: 1;
  }

  .index-key {
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    line-height: 1;
  }

  .pair-readout {
    display: grid;
    gap: 0.4rem;
  }

  .pair-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .pair-chip {
    display: inline-flex;
    align-items: center;
    padding: 0.35rem 0.7rem;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.14));
    border-radius: 999px;
    background: var(--theme-panel-bg, rgb(0 0 0 / 0.2));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 0.875rem);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    white-space: nowrap;
  }

  .pair-chip.blue {
    border-color: color-mix(
      in srgb,
      var(--dm-motion-blue, #3575e2) 55%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--dm-motion-blue, #3575e2) 16%,
      var(--theme-panel-bg, #0a0f14)
    );
  }

  .pair-chip.red {
    border-color: color-mix(
      in srgb,
      var(--dm-motion-red, #ed1c24) 55%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--dm-motion-red, #ed1c24) 16%,
      var(--theme-panel-bg, #0a0f14)
    );
  }

  .boundary-note {
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
    border-radius: 10px;
    background: var(--theme-panel-bg, rgb(0 0 0 / 0.18));
  }

  /*
   * Stacked layout scrolls as one document. Giving the controls a fixed share
   * of a locked viewport clipped the pair readout and the boundary note off
   * the bottom with no scroller to reach them, and a nested scrolling index
   * inside a clipped box is the wrong answer on touch anyway: the atlas
   * scrolls, the index renders in full.
   */
  @container shape-matrix-app (max-width: 74.99rem) {
    .theory-atlas {
      grid-template-columns: 1fr;
      /*
       * `max-content`, not `auto`. An auto row inside a size container with a
       * definite height stops short of what the controls actually need, which
       * parks the closing note past the bottom of a box the scroller has been
       * told is only 510px tall. `max-content` asks for the real figure.
       */
      grid-template-rows: minmax(24rem, 52%) max-content;
      align-content: start;
      overflow: auto;
    }

    .theory-stage-zone,
    .atlas-controls {
      width: 100%;
    }

    .atlas-controls {
      grid-template-rows: repeat(7, auto);
      overflow: visible;
    }

    /*
     * Real height, not visible overflow: an inner 1fr against an auto-sized
     * row collapses to zero and lets the cards paint over the readout below.
     * `min-height: auto` is the load-bearing half. The desktop rule zeroes the
     * automatic minimum so the index can shrink inside its 1fr track, and a
     * zeroed automatic minimum is exactly what let this grid contribute
     * nothing at all to the auto-sized row it lives in once stacked.
     */
    .shape-index {
      grid-template-rows: auto auto;
      min-height: auto;
    }

    .index-grid {
      align-content: start;
      overflow: visible;
    }
  }

  @container shape-matrix-app (min-width: 48rem) and (max-height: 32rem) {
    .theory-atlas {
      grid-template-columns: minmax(22rem, 0.95fr) minmax(25rem, 1.05fr);
      grid-template-rows: 1fr;
      overflow: hidden;
    }

    .theory-stage-zone {
      grid-template-rows: auto minmax(10rem, 1fr);
    }

    .ratio-facts,
    .atlas-note,
    .boundary-note,
    .pair-readout {
      display: none;
    }

    /*
     * Four visible rows at their own heights, inside a pane that scrolls. A
     * 412px-tall landscape window cannot hold the tuners and thirty cards at
     * once, and asking a 1fr index row to absorb that shortfall resolves it to
     * nothing: the fixed rows have already overspent the box. Scrolling the
     * controls keeps every card reachable rather than trading the index away
     * on the one form factor that most needs a compact door back to it.
     */
    .atlas-controls {
      grid-template-rows: repeat(4, auto);
      overflow-y: auto;
    }
  }

  @container shape-matrix-app (max-width: 32rem) {
    .theory-atlas {
      align-content: start;
      grid-template-rows: 27rem max-content;
      padding: 0.5rem;
    }

    .theory-stage-zone,
    .atlas-controls {
      border-radius: 12px;
    }

    .ratio-facts {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .stage-action,
    .index-card {
      transition: none;
    }
  }
</style>
