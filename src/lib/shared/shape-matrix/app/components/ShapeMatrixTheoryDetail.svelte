<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixTheoryDetail.svelte
  The Theory surface's detail pane: the cell you picked in the grid, playing.

  It is the counterpart of the Matrix drill and it is built like one, on
  purpose: the six timing-and-direction elements across the top, the animation
  under them, the shared control dock along the bottom. The grid says which
  pair; this says what that pair DOES.

  The dock is the same component the drill mounts, reading the same animation
  scope, so Effects, Props, Effort, Playback and Display are one set of choices
  that follow you across the surface switch rather than two sets that drift. The
  ratio field is the thing the switch changes; how the ratio is played is not.

  A ratio is chosen by picking a cell, which is how the Matrix has always
  worked. There were sliders here for a while and they answered a different
  question: they let you scrub the open values BETWEEN ratios, which is a real
  thing to look at, a meaningless thing to link to, and a second way to do what
  the grid already does. -->
<script lang="ts">
  import {
    jointSpinRatioClosureHandCycles,
    spinRatioKey,
    spinRatioToTkaTurnFraction,
    type SpinRatio,
  } from "@vtg/domain";
  import { MANDALA_STANDARD_TIP_DX } from "$lib/shared/mandala/domain/mandala-constants";
  import { traceScaledPath } from "$lib/shared/notation/qft/qft-model";
  import { propReachInHandRadii } from "$lib/shared/shape-matrix/services/theory-matrix-artwork";
  import { shapeMatrixTipPoint } from "$lib/shared/shape-matrix/services/shape-matrix-flowers";
  import { tkaNamesTheoryRatio } from "$lib/shared/shape-matrix/domain/theory-ratio-band";
  import {
    isStationaryRatio,
    theoryKnobs,
    type TheoryFlower,
  } from "$lib/shared/shape-matrix/domain/theory-flower";
  import type { VtgMode } from "$lib/shared/shape-matrix/services/shape-matrix-realizations";
  import ElementChipRow from "$lib/shared/shape-matrix/components/ElementChipRow.svelte";
  import BentoPropGrid from "$lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import AnimationPanel from "$lib/shared/animation-panel/components/AnimationPanel.svelte";
  import type { ControlDockAction } from "$lib/shared/sequence-viewer/components/ControlDock.svelte";
  import { flyFade, growFade } from "$lib/shared/transitions/motion";
  import { CANVAS2D_HOSTED_EFFECTS } from "$lib/shared/effects/services/canvas2d-effect-host";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";
  import { getShapeMatrixAnimationContext } from "../context/shape-matrix-animation-context";
  import ShapeMatrixLiveRatioStage, {
    type LiveHand,
  } from "./ShapeMatrixLiveRatioStage.svelte";

  const app = getShapeMatrixAppContext();
  /*
   * Set once by the app shell and shared with the Matrix drill. Both surfaces
   * hold the same object, which is what makes a prop chosen on one the prop
   * playing on the other.
   */
  const animationState = getShapeMatrixAnimationContext();

  const BLUE = "var(--dm-motion-blue, #3575e2)";
  const RED = "var(--dm-motion-red, #ed1c24)";

  /*
   * What this stage can actually draw, plus trails. The effects roster is the
   * whole product's, and most of it needs a WebGL pass or a realized sequence
   * that a bare ratio does not have. Offering a tile that lights up and changes
   * nothing is worse than not offering it.
   */
  const THEORY_EFFECTS = ["trails", ...CANVAS2D_HOSTED_EFFECTS] as const;

  /*
   * The prop's reach, in hand-orbit radii. The tiles in the grid are already
   * drawn at it, and drawing the animation at a flat one prop length gave the
   * same flower different proportions in the two places. Theory paths come from
   * the model rather than from a realized sequence, so the grid can render
   * before the pictograph data lands; the standard staff covers that wait,
   * exactly as it does for the tiles.
   */
  const propReach = $derived(
    propReachInHandRadii(app.data?.clubTipDx ?? MANDALA_STANDARD_TIP_DX)
  );

  /*
   * Where the tracked tip sits inside the prop's own artwork. The trail follows
   * one point per prop and the drawing has to point AT that point, which is a
   * different bearing on a staff than on a fan.
   */
  const tipAngle = $derived.by(() => {
    const tip = shapeMatrixTipPoint(app.propType);
    return tip ? Math.atan2(tip.dy, tip.dx) : 0;
  });

  /*
   * One hand cycle is four beats, the four cardinal points, so the tempo the
   * dock sets is the tempo the hands travel at. 60 BPM is a second a beat.
   */
  const handPeriod = $derived((4 * 60000) / Math.max(1, animationState.bpm));

  let alignToken = $state(0);

  const pair = $derived(app.theoryPair);

  const cellKey = $derived(
    pair
      ? `${spinRatioKey(pair.left.ratio)}|${spinRatioKey(pair.right.ratio)}`
      : ""
  );

  /*
   * What a restart is FOR.
   *
   * A trail drawn half at the old ratio and half at the new one is neither
   * flower, so the shape on the canvas would stop matching the tile that was
   * picked. Every choice that changes the shape — the pairing, either exact
   * ratio, each hand's spin and start — clears the trail and returns the hands
   * to their start. Playback, tempo, effort, prop and layer choices deliberately
   * do NOT: they change how the same shape is drawn, and interrupting it to say
   * so would be noise.
   */
  const alignKey = $derived(
    pair
      ? `${app.theoryMode}|${cellKey}` +
        `|${pair.left.style}${pair.left.ori}|${pair.right.style}${pair.right.ori}`
      : app.theoryMode
  );
  let appliedAlign = $state("");
  $effect(() => {
    if (alignKey === appliedAlign) return;
    appliedAlign = alignKey;
    alignToken += 1;
  });

  function rateOf(flower: TheoryFlower): number {
    return isStationaryRatio(flower.ratio)
      ? flower.ratio.propRotations
      : flower.ratio.propRotations / flower.ratio.handCycles;
  }

  /*
   * One closed path of this hand's own, in hand cycles: the denominator of its
   * ratio, which is how many hand circles 1:9 needs before it lands back where
   * it started. That is exactly what the tile in the grid draws, so it is
   * exactly what the trail should keep. A stationary hand closes after one prop
   * rotation, which the stage counts on the same clock.
   */
  function closureCycles(flower: TheoryFlower): number {
    if (isStationaryRatio(flower.ratio)) return 1;
    return Math.max(1, flower.ratio.handCycles);
  }

  function liveHand(
    flower: TheoryFlower,
    hand: "left" | "right",
    color: string
  ): LiveHand {
    const knobs = theoryKnobs(flower, hand, app.theoryMode);
    /*
     * The mandala under the animation, from the first frame.
     *
     * It comes from the SAME knobs the stage evaluates — the paired ones, with
     * this hand's timing offset and direction in them — so the curve lies
     * exactly under the prop rather than near it. The tile beside it is the
     * unpaired shape, which is the Matrix's rule for a tile and the reason this
     * cannot just reuse the tile's geometry.
     */
    return {
      id: hand,
      rate: rateOf(flower),
      spinSign: knobs.spin === "inspin" ? 1 : -1,
      radius: knobs.radius,
      color,
      handPhase: knobs.handPhase ?? 8,
      handSign: knobs.handDirection ?? 1,
      propPhase: knobs.phase ?? 0,
      trailCycles: closureCycles(flower),
      side: hand,
      guide: traceScaledPath(knobs, { hand: 1, prop: propReach }),
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

  /*
   * Play/pause lives in the dock's trailing slot, where the Matrix drill keeps
   * it, rather than in a pair of buttons under this stage. One transport
   * control, in one place, on both surfaces.
   */
  const playbackAction = $derived<ControlDockAction>({
    icon: animationState.playing ? "fa-pause" : "fa-play",
    label: animationState.playing ? "Pause" : "Play",
    onClick: animationState.togglePlaying,
  });

  /**
   * The turn the Kinetic Alphabet gives this ratio, or "none".
   *
   * The arithmetic runs on every ratio — (P/Q − 1) / 2 answers 4:9 with −5/18 —
   * but an answer is not a turn value. The level palettes stop at a quarter
   * turn, so inside this field only Float, 1:2 and isolation are turns anyone
   * can play, and printing −5/18 under a TKA heading claimed a coverage that
   * does not exist. `tkaNamesTheoryRatio` is that boundary; past it the honest
   * readout is that there is nothing there.
   */
  function turnLabel(ratio: SpinRatio): string {
    if (!tkaNamesTheoryRatio(ratio)) return "none";
    const fraction = spinRatioToTkaTurnFraction(ratio);
    if (fraction === "fl") return "Float";
    if (fraction === null) return "none";
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

  const closure = $derived(
    jointCycles === null
      ? "Open path"
      : `${jointCycles} hand ${jointCycles === 1 ? "cycle" : "cycles"}`
  );

  /*
   * An open control panel takes the room the reading rows were using, the same
   * trade the drill makes. The stage and the facts stay: they are what the
   * controls are being pointed at.
   */
  const controlsOpen = $derived(animationState.activeSection !== null);
</script>

<aside class="theory-detail" aria-label="Selected theory pair">
  <!-- The pane owns the container; this body owns the composition, the same
       split the Matrix drill uses between its stage and its dock. A size
       container cannot answer its own query. -->
  <div class="detail-body" class:picking-props={app.propPickerOpen}>
    <!-- The same row, in the same place, as the Matrix drill's. On Theory it
         also repaints nothing in the grid: a tile is the two hands' shapes, and
         the pairing is what those two hands do to each other, which is a thing
         you watch rather than a thing you look at. -->
    {#if !controlsOpen}
      <div class="mode-picker" transition:growFade={{ axis: "y" }}>
        <ElementChipRow
          selected={app.theoryMode}
          onpick={(mode: VtgMode | null) => {
            // The row clears on a second click, which the Matrix wants and
            // Theory cannot use: the two hands are always in some pairing.
            // Re-picking the chosen element keeps it.
            if (mode) app.setTheoryMode(mode);
          }}
        />
      </div>
    {/if}

    <div class="media-stage">
      <div class="detail-flow">
        {#if !pair}
          <div class="empty">
            <strong>Pick a cell</strong>
            <small>Its two hands run here, in the pairing chosen above.</small>
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
          </header>

          <div class="stage-window">
            <ShapeMatrixLiveRatioStage
              {hands}
              {handPeriod}
              {alignToken}
              {propReach}
              {tipAngle}
              paused={!animationState.playing}
              propType={app.propType}
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
              <dt>TKA turns</dt>
              <dd>
                {turnLabel(pair.left.ratio)} / {turnLabel(pair.right.ratio)}
              </dd>
            </div>
            <div>
              <dt>Closed path</dt>
              <dd>{closure}</dd>
            </div>
          </dl>
        {/if}

        <!-- Outside the branch on purpose: it is true of the whole surface, not
             of one selected pair, and a visitor who has not picked a cell yet
             is exactly the one who needs to read it. -->
        {#if !controlsOpen}
          <p class="boundary-note" transition:growFade={{ axis: "y" }}>
            This surface stands outside the level system. Levels name turn
            values down to a quarter turn, so a ratio like 1:3 has no turn, no
            letter and no level, and VTG classifies timing and direction rather
            than the whole rational field. These paths are exact; neither
            notation covers them.
          </p>
        {/if}
      </div>

      {#if app.propPickerOpen}
        <!-- A region of the stage, never a sheet over it, exactly as in the
             drill. The animation keeps running alongside, so a prop is judged
             against the shape it traces. -->
        <div
          class="prop-catalogue"
          role="group"
          aria-label="Prop"
          in:flyFade={{ y: 10 }}
          out:flyFade={{ y: 10 }}
        >
          <div class="catalogue-head">
            <h3 class="catalogue-title">Prop</h3>
            <PanelButton onclick={app.togglePropPicker}>Done</PanelButton>
          </div>
          <div class="catalogue-body">
            <BentoPropGrid
              selectedPropType={app.propType}
              variant="inline"
              flat={true}
              onSelect={(next: PropType) => void app.setPropType(next)}
            />
          </div>
        </div>
      {/if}
    </div>

    <div class="animation-controls">
      <!-- The drill's dock, unchanged, on the drill's own scope. `sequence` is
           null because a spin ratio is not one: it has no letter, no steps and
           no word, and the panel's sequence-shaped affordances are turned off
           rather than pointed at nothing. -->
      <AnimationPanel
        isExporting={false}
        layout="bottom"
        isPlaying={animationState.playing}
        bpm={animationState.bpm}
        playbackMode={animationState.playbackMode}
        onPlaybackToggle={animationState.togglePlaying}
        onPlaybackModeChange={animationState.setPlaybackMode}
        onBpmChange={animationState.setBpm}
        showEffectsPlayback={false}
        selectedPropType={app.propType}
        onPropChange={(next: PropType) => void app.setPropType(next)}
        onPropPickerRequest={app.togglePropPicker}
        sequence={null}
        dockTrailingAction={playbackAction}
        showPathShape={false}
        showMotionVisibility={true}
        showSequenceMarks={false}
        availableEffects={THEORY_EFFECTS}
        onActiveSectionChange={animationState.setActiveSection}
        closeRequest={animationState.closeRequest}
        regionLabel="Shape animation controls"
      />
    </div>
  </div>
</aside>

<style>
  .theory-detail {
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    padding: 0.85rem;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
    border-radius: 16px;
    background: var(--theme-panel-bg, rgb(16 23 33 / 0.82));
    color: var(--theme-text, #fff);
    /* The element row's own responsive rules are written against the drill's
       container, so this pane answers to the same name and the six chips
       recompose here exactly as they do there. */
    container: shape-matrix-drill / size;
  }

  /* The drill's composition: modes, then the animation, then the dock. */
  .detail-body {
    display: grid;
    height: 100%;
    min-height: 0;
    grid-template-rows: auto minmax(0, 1fr) auto;
    grid-template-areas:
      "modes"
      "media"
      "controls";
    gap: 0.7rem;
  }

  .mode-picker {
    grid-area: modes;
    display: grid;
    gap: 0.45rem;
    min-width: 0;
  }

  /* The catalogue is a second row of the stage rather than an overlay, so the
     animation shrinks to make room and nothing is hidden behind anything. */
  .media-stage {
    grid-area: media;
    display: grid;
    min-width: 0;
    min-height: 0;
    grid-template-rows: minmax(0, 1fr) minmax(0, 0fr);
    grid-template-areas:
      "flow"
      "props";
    gap: 0.6rem;
  }

  .detail-body.picking-props .media-stage {
    grid-template-rows: minmax(0, 1fr) minmax(0, 0.85fr);
  }

  .detail-flow {
    grid-area: flow;
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    gap: 0.7rem;
    /* Vertical only. The selected chip's marker paints a pixel past its own
       box, and an `auto` horizontal axis turns that into a scrollbar. */
    overflow: hidden auto;
  }

  /* The same shape the Matrix drill's empty state has: a title and one line
     under it, centred in the pane, so switching surfaces does not switch the
     way the app talks. */
  .empty {
    display: grid;
    flex: 1 1 auto;
    min-height: 0;
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

  /* The canvas fits the SHORTER side of this box and centres, so a fixed 22rem
     cap drew a small mandala in a wide letterbox on a tall pane and left the
     column dead below the facts. Growing into the free height instead spends
     that room on the artwork. The box is sized by the flex column before the
     canvas paints, so nothing below it moves when the stage mounts or the pair
     changes. */
  .stage-window {
    position: relative;
    flex: 1 1 0;
    width: 100%;
    /* Set this floor too high on a short pane and the box cannot shrink to the
       room it was given, and the facts below it are pushed out of the flow. */
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

  /* Four facts, so the only orphan-free counts are two columns and four.
     `auto-fit` picked three at the widths this pane actually gets and stranded
     the last card alone on its own row. */
  .pair-facts {
    display: grid;
    flex: 0 0 auto;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    margin: 0;
  }

  @container shape-matrix-drill (min-width: 46rem) {
    .pair-facts {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
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

  .prop-catalogue {
    grid-area: props;
    display: grid;
    min-width: 0;
    min-height: 0;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
    border-radius: 12px;
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, #101721) 74%,
      var(--theme-card-bg, #0a0f14)
    );
  }

  .catalogue-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.4rem 0.55rem 0.3rem;
  }

  .catalogue-title {
    margin: 0;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.58));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .catalogue-body {
    min-width: 0;
    min-height: 0;
  }

  .animation-controls {
    grid-area: controls;
    min-width: 0;
    min-height: 0;
  }

  @container shape-matrix-app (max-width: 74.99rem) or (max-height: 41.99rem) {
    .theory-detail {
      border: 0;
      border-radius: 0;
    }
  }

  /* The drill's short-wide composition, for the same reason and at the same
     breakpoint: a wide, short host is height-bound, so the element rail moves
     beside the animation instead of eating the top third of the screen. The row
     is already two columns wide here on its own, which is what the rail was
     sized for. */
  @container shape-matrix-drill (min-width: 42rem) and (max-height: 24rem) {
    .detail-body {
      grid-template-columns: clamp(13rem, 30%, 17rem) minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr) auto;
      grid-template-areas:
        "modes media"
        "modes controls";
      gap: 0.8rem;
    }

    .mode-picker {
      align-self: center;
    }

    /* The stage floor is the only fixed height left in the flow, so on a pane
       this short it is what has to give. At 9rem the facts row underneath it
       was sliced through the middle of its cards, which reads as broken rather
       than as scrollable. The note below the facts scrolls, and prose running
       past a scrollbar reads correctly. */
    .stage-window {
      min-height: 8rem;
    }
  }
</style>
