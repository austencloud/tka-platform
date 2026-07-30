<script lang="ts">
  /**
   * One canonical move: the computed stage and its notation.
   *
   * The 2011 diagrams used to run beside this. They now live in the archive
   * view, reachable from the reading column — see the comment on the stage below
   * for why.
   *
   * No narration and no pull-quotes. Every label states a fact about the knob
   * values that produce the move; the sources are credited by link, in the
   * About panel, which is attribution rather than commentary.
   */
  import type { QftIncrement } from "../qft-model";
  import type { QftLayers } from "../qft-layers";
  import type { GuideMove } from "../qft-guide";
  import QftStage from "./QftStage.svelte";
  import QftTable from "./QftTable.svelte";

  interface Props {
    move: GuideMove;
    increments: QftIncrement[];
    cursor: number;
    compact: boolean;
    layers: QftLayers;
    onShowArchive: () => void;
    /**
     * Whether this pane draws the notation table.
     *
     * False on a docked phone, where the table lives in the dock's Table tray
     * along with every other mode's. Drawing it here as well would put the
     * same eight rows on screen twice and cost the stage the height.
     */
    showNotation?: boolean;
  }

  let {
    move,
    increments,
    cursor,
    compact,
    layers,
    onShowArchive,
    showNotation = true,
  }: Props = $props();
</script>

<div class="guide" class:no-notation={!showNotation}>
  <!--
    One stage, computed. The 2011 diagrams used to sit beside this and drive the
    layout of every move, but they are not one visual language: two of them fill
    the swept sector, the rest accumulate a marker at every position passed, and
    one carries its own notation table baked into the crop. The stage says the
    same thing consistently for all eight, and now draws the swept sector the
    best of those diagrams used. The originals are still here, one click away and
    still sourced — they are just no longer the thing the page is built around.

    Nothing under it. The provenance line and the archive button both sit in the
    reading column: they are things you READ and CLICK, and hanging them off the
    bottom of the drawing left the left half of a wide screen ending in a caption
    and a button with a field of sky under them.
  -->
  <div class="pair">
    <div class="box stage">
      <QftStage
        knobs={move.knobs}
        {increments}
        {cursor}
        {layers}
        pendulum={move.pendulum ?? false}
        fit
      />
    </div>
  </div>

  <!--
    `display: contents` when the pane is a single column, so the title still
    comes before the drawing and the notation after it. A grid item only when
    there are two columns to be an item of.
  -->
  <div class="reading">
    <header>
      <h2>{move.title}</h2>
      <p class="spec">{move.spec}</p>
    </header>

    {#if showNotation}
      <div class="notation">
        <QftTable {increments} activeStep={Math.floor(cursor) % 8} {compact} />
      </div>
    {/if}

    <div class="credit">
      <span>computed from the published rules</span>
      <!--
        On a phone this button costs the stage about a third of its height, and
        the stage is the thing worth looking at. There it moves into the dock's
        Moves tray instead, which the page owns.
      -->
      {#if !compact}
        <button type="button" class="archive-link" onclick={onShowArchive}>
          See the 2011 diagram
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .guide {
    height: 100%;
    display: flex;
    flex-direction: column;
    /* `safe`, so that when the stage floor pushes the pane past the viewport
       the top stays reachable rather than being clipped away. */
    justify-content: safe center;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;
    align-items: center;
    gap: clamp(0.6rem, 1.6vh, 1.4rem);
    --box-h: clamp(8rem, 30vh, 22rem);
  }

  /* One column: the reading group dissolves so its children order themselves
     against the drawing directly. */
  .reading {
    display: contents;
  }

  header {
    order: -1;
    text-align: center;
  }

  .notation {
    order: 1;
  }

  .credit {
    order: 2;
  }

  h2 {
    margin: 0;
    font-size: clamp(1.3rem, 1rem + 1.1vw, 2.2rem);
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .spec {
    margin: 0.4rem 0 0;
    font-size: 0.85rem;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.6));
    font-variant-numeric: tabular-nums;
  }

  /*
   * The drawing takes whatever height is left after the title, the notation and
   * the credit line — it does not guess at a fraction of the viewport. A `30vh`
   * box left the subject of the page as its smallest element: 334px of stage in
   * an 832px pane, with a band of empty sky above and below it.
   */
  .pair {
    flex: 1 1 auto;
    /*
     * A floor, because "take what is left" is the wrong answer when nothing is
     * left: on a phone, once the title and the table had taken their share, the
     * stage collapsed to a 90px thumbnail. Below this the pane scrolls instead
     * of crushing the thing you came to look at.
     *
     * The third term is a ceiling ON THE FLOOR. 72vw/44vh alone demanded 519px
     * of stage in an 818px pane, which is more than was left once the title and
     * the eight-row table had theirs — so the pane scrolled and the table came
     * out three rows tall. Past this size the drawing is comfortably large and
     * can afford to give the notation the rest.
     */
    min-height: min(72vw, 44vh, 17rem);
    width: 100%;
    display: flex;
    flex-direction: column;
  }

  /*
   * No floor when the notation is not in this pane.
   *
   * The floor exists to stop the table crushing the drawing. Where the table
   * lives in the host's dock instead, there is nothing here to crush it — and
   * the floor becomes the bug: it held 270px on a 375px phone while the pane
   * had 237px to give, so the bottom 100px of the drawing was clipped behind
   * the dock. Without it the drawing simply takes the pane, whatever the pane
   * currently is.
   */
  .guide.no-notation .pair {
    min-height: 0;
  }

  /*
   * No aspect-ratio in the stacked layout: the stage's SVG letterboxes its
   * square viewBox inside whatever box it is given, so the drawing scales to
   * min(width, height) without the box having to be square itself.
   */
  .box {
    flex: 1 1 auto;
    min-height: 0;
    width: min(100%, 92vw);
    display: grid;
    place-items: center;
  }

  .credit {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem 0.9rem;
    text-align: center;
    font-size: 0.75rem;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.5));
  }

  /* A button, because it is a thing you click
     (.claude/rules/clickables-look-like-buttons.md). */
  .archive-link {
    min-height: 44px;
    padding-inline: 0.9rem;
    border-radius: 0.6rem;
    border: 1px solid var(--semantic-border, rgb(255 255 255 / 0.22));
    background: var(--semantic-surface-raised, rgb(0 0 0 / 0.24));
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.78));
    font-size: 0.82rem;
    cursor: pointer;
    transition:
      border-color 140ms ease,
      color 140ms ease;
  }

  .archive-link:hover {
    border-color: var(--semantic-border-strong, rgb(255 255 255 / 0.4));
    color: var(--semantic-text-primary, #fff);
  }

  /*
   * `flex: none`, so the notation is never the thing that gives.
   *
   * As a shrinkable flex item it lost to the stage's own min-height floor and
   * came out three rows tall with rows 4–8 clipped away — a table you cannot
   * read the end of, on a page whose subject is the table.
   */
  /* The measure QftTable's short-viewport column counts are keyed to. */
  .notation {
    flex: none;
    width: 100%;
    display: flex;
    justify-content: center;
    container-type: inline-size;
    container-name: notation;
  }

  .notation > :global(*) {
    width: 100%;
  }

  /*
   * Two columns: the drawing anchors the left and everything you read stacks
   * down the right.
   *
   * The drawing is the full height of the pane and square, so it is as large as
   * the screen allows with no vh guess anywhere — which is what stops it from
   * sitting at one fixed size in a large dark field at 4K, and equally from
   * demanding more height than a squashed window has
   * (.claude/rules/4k-native-layout.md).
   */
  /*
   * One structural block for both two-column tiers (big screens, and wide-and-
   * short), which then only differ in the three measures and the type scale.
   * Written once because the shape is the same shape — duplicating it is how the
   * two tiers would drift apart.
   */
  @media (min-width: 64rem) and (min-height: 33rem),
    (min-width: 44rem) and (max-height: 32rem) {
    .guide {
      display: grid;
      /*
       * The drawing takes the LEFTOVER width, it does not declare its own.
       *
       * Sizing the track from a square box (`auto` + `aspect-ratio: 1`) makes
       * the drawing's width a function of the pane's height, and a `1fr`-less
       * grid cannot shrink an `auto` track — so on any viewport where the two
       * do not happen to add up, the row simply ran off the right edge. With
       * `minmax(0, 1fr)` the drawing is min(leftover width, pane height) by
       * construction: as large as the screen allows, never larger.
       */
      /*
       * `minmax(0, auto)`, not `1fr`.
       *
       * As `1fr` the stage track took every pixel the reading column did not,
       * and the drawing — square, capped by the pane's HEIGHT — floated in the
       * middle of it: 370px of rail outside it and another 340px of gap between
       * it and the table at 1920. The two halves of the page were being pushed
       * apart by space that belonged on the outside. Sized to the drawing and
       * centred as a pair, that leftover becomes one margin either side.
       *
       * The `0` min is what stops it running off the edge when the pane is too
       * narrow to hold both at full size; plain `auto` cannot shrink.
       */
      grid-template-columns: minmax(0, auto) var(--read-w);
      justify-content: center;
      align-items: center;
      column-gap: var(--col-gap);
    }

    .reading {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: var(--read-gap);
      min-width: 0;
    }

    header {
      order: 0;
      text-align: left;
    }

    .pair {
      /* Stretch, so the box's `height: 100%` resolves against the pane rather
         than against its own content. */
      align-self: stretch;
      flex: none;
      min-height: 0;
      min-width: 0;
      width: auto;
    }

    /* Square, so the box IS the drawing and the track above can size to it. */
    .box {
      flex: none;
      height: 100%;
      aspect-ratio: 1;
      width: auto;
      max-width: 100%;
      min-width: 0;
    }

    .credit {
      justify-content: flex-start;
      text-align: left;
    }
  }

  @media (min-width: 64rem) and (min-height: 33rem) {
    .guide {
      /* Matched to the instrument's column, so the two modes stay registered
         across the crossfade. */
      --read-w: clamp(26rem, 32vw, 46rem);
      --col-gap: clamp(2rem, 4vw, 5rem);
      --read-gap: clamp(1rem, 2.5vh, 2rem);
    }

    h2 {
      font-size: clamp(2rem, 1.1rem + 2.2vw, 4.2rem);
      line-height: 1.02;
    }

    .spec {
      font-size: 0.95rem;
    }

    .credit {
      font-size: 0.82rem;
    }
  }

  /*
   * Wide and short — fold-open landscape, and any laptop with the window
   * squashed. There is no room to stack a title, a drawing and the notation
   * down 412px, so this tier turns the page on its side and everything shrinks
   * with the pane rather than against it.
   */
  @media (min-width: 44rem) and (max-height: 32rem) {
    .guide {
      --read-w: minmax(15rem, 26rem);
      --col-gap: clamp(1rem, 3vw, 2.5rem);
      --read-gap: 0.4rem;
    }

    h2 {
      font-size: clamp(1.1rem, 0.8rem + 1.4vw, 1.9rem);
    }

    .spec {
      margin-top: 0.15rem;
      font-size: 0.75rem;
    }

    /*
     * The pane is about 200px tall here, and the credit line was the 24px that
     * pushed the notation under the footer. The claim it makes — computed, not
     * traced — is made again in the About panel and in the archive view itself,
     * so this is the one tier that drops it rather than clipping the notation.
     */
    .credit {
      display: none;
    }
  }

  /*
   * The provenance line goes on the smallest screens.
   *
   * With the dock's table tray open, a 375px phone has 237px for the title, the
   * drawing and this line — and this line's 26px is the least of the three. It
   * says the same thing the About panel and the archive view both say, and the
   * button beside it has already moved into the Moves tray at this size.
   */
  @media (max-width: 30rem) {
    .guide.no-notation .credit {
      display: none;
    }
  }

  @media (max-width: 30rem) {
    .guide {
      /*
       * Sized for one subject, and for a phone that also has to fit the
       * notation strip under it.
       */
      --box-h: clamp(7rem, 32vw, 15rem);
      gap: 0.4rem;
    }
  }
</style>
