<script lang="ts">
  /**
   * One canonical move: the computed stage, its notation, and its source quote.
   *
   * The 2011 diagrams used to run beside this. They now live in the archive
   * view, reachable from here — see the comment on the figure below for why.
   *
   * No narration. The only prose is quoted from the source.
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
  }

  let { move, increments, cursor, compact, layers, onShowArchive }: Props =
    $props();
</script>

<div class="guide">
  <header>
    <h2>{move.title}</h2>
    <p class="spec">{move.spec}</p>
  </header>

  <!--
    One stage, computed. The 2011 diagrams used to sit beside this and drive the
    layout of every move, but they are not one visual language: two of them fill
    the swept sector, the rest accumulate a marker at every position passed, and
    one carries its own notation table baked into the crop. The stage says the
    same thing consistently for all eight, and now draws the swept sector the
    best of those diagrams used. The originals are still here, one click away and
    still sourced — they are just no longer the thing the page is built around.
  -->
  <div class="pair">
    <figure>
      <div class="box stage">
        <QftStage
          knobs={move.knobs}
          {increments}
          {cursor}
          {layers}
          pendulum={move.pendulum ?? false}
          extent={235}
        />
      </div>
      <figcaption>
        <span>computed from the published rules</span>
        <!--
          On a phone this button costs the stage about a third of its height,
          and the stage is the thing worth looking at. There it moves to the
          transport row instead, which the page owns.
        -->
        {#if !compact}
          <button type="button" class="archive-link" onclick={onShowArchive}>
            See the 2011 diagram
          </button>
        {/if}
      </figcaption>
    </figure>
  </div>

  <div class="notation">
    <QftTable {increments} activeStep={Math.floor(cursor) % 8} {compact} />
  </div>

  {#if move.quote}
    <blockquote>
      <p>{move.quote}</p>
      <cite
        >Drex, <a
          href="https://drexfactor.com/weirdscience/2011/05/18/beginners_guide_poi_qft_notation"
          rel="noreferrer">A Beginner's Guide to Prop QFT Notation</a
        ></cite
      >
    </blockquote>
  {/if}
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
    gap: clamp(0.75rem, 2vh, 1.75rem);
    /* Shared measure for both halves, so they line up whatever shape the
       original turns out to be. */
    --box-h: clamp(8rem, 30vh, 22rem);
  }

  header {
    text-align: center;
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
   * Top-aligned. The left figure carries a control the right one does not, so
   * bottom-aligning the two figures pushed the drawings themselves out of line
   * with each other — the one thing on this page that must line up.
   */
  /*
   * The figure takes whatever height is left after the title, the caption and
   * the notation — it does not guess at a fraction of the viewport. A `30vh`
   * box left the subject of the page as its smallest element: 334px of stage
   * in an 832px pane, with a band of empty sky above and below it.
   */
  .pair {
    flex: 1 1 auto;
    /*
     * A floor, because "take what is left" is the wrong answer when nothing is
     * left: on a phone showing one of the two moves that carry a quote, the
     * stage collapsed to a 90px thumbnail. Below this the pane scrolls instead
     * of crushing the thing you came to look at. It sits here rather than on
     * the box so that it grows the flex line, instead of overflowing the figure
     * and painting over the notation.
     */
    min-height: min(56vw, 34vh);
    width: 100%;
    /* Stretch, not a content-sized centred column: the figure has to be as wide
       as the pane before the box can use that width. */
    display: flex;
    flex-direction: column;
  }

  figure {
    margin: 0;
    width: 100%;
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /*
   * No aspect-ratio here: the stage's SVG letterboxes its square viewBox inside
   * whatever box it is given, so the drawing scales to min(width, height) and
   * fills the space without the box having to be square itself.
   */
  .box {
    flex: 1 1 auto;
    min-height: 0;
    width: min(100%, 92vw);
  }

  .stage {
    display: grid;
    place-items: center;
  }

  figcaption {
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
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

  .notation {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .notation > :global(*) {
    width: 100%;
    max-width: 46rem;
  }

  blockquote {
    margin: 0;
    max-width: 46rem;
    padding-left: 1rem;
    border-left: 3px solid var(--theme-accent, #8b5cf6);
  }

  blockquote p {
    margin: 0;
    font-size: clamp(0.9rem, 0.85rem + 0.2vw, 1.05rem);
    line-height: 1.5;
  }

  cite {
    display: block;
    margin-top: 0.35rem;
    font-size: 0.78rem;
    font-style: normal;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.6));
  }

  cite a {
    color: var(--theme-accent, #8b5cf6);
  }

  /*
   * Big screens use both axes. Stacking everything down the middle leaves a
   * narrow island in a tall field — a phone layout that happened to be opened
   * on a monitor.
   */
  /*
   * Wide screens: the drawings anchor the left, everything you read stacks down
   * the right. The previous arrangement centred a title band over two columns,
   * which gave the page three things of equal weight in a row and nothing to
   * start at. Here the figures are unmistakably the subject and the title opens
   * the column you read.
   *
   * The pair spans all three rows so it can take the height the viewport has,
   * rather than sitting in a band with the screen empty above and below it.
   */
  @media (min-width: 90rem) and (min-height: 45rem) {
    .guide {
      /*
       * The ceiling is deliberately far above any screen this runs on, so the
       * viewport governs and the figures keep growing with it. A 40rem cap hit
       * first at 4K and left the whole app as a small band in a large dark
       * field, which is the exact failure `.claude/rules/4k-native-layout.md`
       * exists to prevent.
       */
      --box-h: clamp(16rem, 54vh, 64rem);
      display: grid;
      /* Matched to the instrument's column, so the two modes stay registered
         across the crossfade and neither leaves dead rail at 4K. */
      grid-template-columns: auto clamp(26rem, 32vw, 46rem);
      /*
       * Empty rows top and bottom take the slack. The pair spans the whole
       * column and is taller than the three content rows, and that surplus was
       * being distributed BETWEEN them — opening a gap between the table and
       * the quote that belongs to it. Pushing it outside the group keeps the
       * three tight and still centres them against the stage.
       */
      grid-template-areas: "pair ." "pair head" "pair notation" "pair quote" "pair .";
      grid-template-rows: 1fr auto auto auto 1fr;
      align-content: center;
      justify-content: center;
      column-gap: clamp(2rem, 4vw, 5rem);
      row-gap: clamp(1rem, 2.5vh, 2rem);
    }

    header {
      grid-area: head;
      text-align: left;
      align-self: end;
    }

    h2 {
      font-size: clamp(2rem, 1.1rem + 2.2vw, 4.2rem);
      line-height: 1.02;
    }

    .spec {
      font-size: 0.95rem;
    }

    .pair {
      grid-area: pair;
      align-self: center;
      flex: none;
      width: auto;
    }

    /* Explicit height here: the pair is a grid item beside the reading column,
       so there is no leftover column height for it to fill. */
    .box {
      flex: none;
      height: var(--box-h);
      width: auto;
      aspect-ratio: 1;
    }

    .notation {
      grid-area: notation;
      align-self: start;
    }

    blockquote {
      grid-area: quote;
      align-self: start;
    }
  }

  /*
   * Wide and short — fold-open landscape, and any laptop with the window
   * squashed. There is no room to stack a title, two figures and the notation
   * down 412px, so this tier turns the page on its side: figures left, the
   * words and the notation strip right, everything smaller.
   *
   * Stacking here overflowed the app's fixed height, and since the shell hides
   * overflow the drawing ran up underneath the move chips.
   */
  @media (min-width: 44rem) and (max-height: 32rem) {
    .guide {
      --box-h: min(54vh, 11rem);
      display: grid;
      grid-template-columns: auto minmax(15rem, 26rem);
      grid-template-areas: "pair head" "pair notation";
      grid-template-rows: auto auto;
      align-content: center;
      justify-content: center;
      column-gap: clamp(1rem, 3vw, 2.5rem);
      row-gap: 0.5rem;
    }

    header {
      grid-area: head;
      text-align: left;
      align-self: end;
    }

    h2 {
      font-size: clamp(1.1rem, 0.8rem + 1.4vw, 1.9rem);
    }

    .spec {
      margin-top: 0.15rem;
      font-size: 0.75rem;
    }

    .pair {
      grid-area: pair;
      align-self: center;
      flex: none;
      width: auto;
    }

    .box {
      flex: none;
      height: var(--box-h);
      width: auto;
      aspect-ratio: 1;
    }

    .notation {
      grid-area: notation;
      align-self: start;
    }

    figcaption {
      margin-top: 0.3rem;
      gap: 0.3rem;
    }

    blockquote {
      display: none;
    }
  }

  @media (max-width: 30rem) {
    .guide {
      /*
       * Sized for one subject, and for a phone that also has to fit the
       * notation strip and the layer switches under it.
       */
      --box-h: clamp(7rem, 32vw, 15rem);
      /* Tighter than the fluid default, which overran the app box by a few
         pixels once the caption under the left figure gained its control. */
      gap: 0.4rem;
    }
  }
</style>
