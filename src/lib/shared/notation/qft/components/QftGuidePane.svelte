<script lang="ts">
  /**
   * One canonical move: the restored animation beside the computed stage.
   *
   * Both halves run off the same `step`, so they cannot drift. A browser gives
   * no control over GIF playback, which is why the original is rendered frame by
   * frame rather than left to its own clock.
   *
   * No narration. The only prose is quoted from the source.
   */
  import type { QftIncrement } from "../qft-model";
  import type { GuideMove } from "../qft-guide";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import QftFrames from "./QftFrames.svelte";
  import QftStage from "./QftStage.svelte";
  import QftTable from "./QftTable.svelte";

  interface Props {
    move: GuideMove;
    increments: QftIncrement[];
    cursor: number;
    step: number;
    compact: boolean;
    asPublished: boolean;
    onRendering: (asPublished: boolean) => void;
  }

  let { move, increments, cursor, step, compact, asPublished, onRendering }: Props = $props();

  /*
   * States what each option does to the artifact, and nothing about which is
   * better. The page composes by default because that is how it reads as one
   * thing; the published card is one click away because the page's claim is
   * restoration and a recoloured artifact cannot be the only version on offer.
   */
  const RENDERING = [
    { value: "composed", label: "Composed" },
    { value: "published", label: "As published" }
  ];
</script>

<div class="guide">
  <header>
    <h2>{move.title}</h2>
    <p class="spec">{move.spec}</p>
  </header>

  <div class="pair">
    <figure>
      <div class="box original" style={`--aspect: ${move.aspect}`}>
        <QftFrames
          stem={move.stem}
          {step}
          {asPublished}
          alt={`${move.title}, as published in 2011`}
        />
      </div>
      <figcaption>
        <span>Home of Poi, 2011</span>
        <div class="fit">
          <SegmentedControl
            options={RENDERING}
            value={asPublished ? "published" : "composed"}
            onchange={(v) => onRendering(v === "published")}
            size="sm"
            ariaLabel="Rendering of the restored frames"
          />
        </div>
      </figcaption>
    </figure>

    <figure>
      <div class="box stage">
        <QftStage knobs={move.knobs} {increments} {cursor} pendulum={move.pendulum ?? false} />
      </div>
      <figcaption>computed from the same rules</figcaption>
    </figure>
  </div>

  <div class="notation">
    <QftTable {increments} activeStep={step} {compact} />
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
    justify-content: center;
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
  .pair {
    display: grid;
    grid-template-columns: repeat(2, auto);
    justify-content: center;
    align-items: start;
    gap: clamp(0.75rem, 2.5vw, 2.5rem);
  }

  figure {
    margin: 0;
  }

  .box {
    height: var(--box-h);
    aspect-ratio: 1;
  }

  /*
   * Both boxes are exactly --box-h tall, so the two drawings share a top and a
   * bottom edge whatever shape the original turns out to be. Width follows the
   * frame's real proportions — the crops are deliberately not squared — capped
   * so a wide drawing cannot balloon across the row and crowd the notation.
   */
  .box.original {
    aspect-ratio: auto;
    width: calc(var(--box-h) * min(var(--aspect), 1.15));
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
    gap: 0.45rem;
    text-align: center;
    font-size: 0.75rem;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.5));
  }

  /*
   * SegmentedControl is width: 100% internally, which would stretch two short
   * labels across the whole figure. Shrink-wrap it to its own content.
   */
  .fit {
    display: inline-flex;
  }

  /* Two short labels, one line each. "As published" was wrapping mid-phrase. */
  .fit :global(button) {
    white-space: nowrap;
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
      grid-template-columns: auto minmax(26rem, 38rem);
      grid-template-areas: "pair head" "pair notation" "pair quote";
      /*
       * All three rows content-sized. A 1fr tail row looks fine on the moves
       * that carry a quote and leaves a hole a third of the page tall on the
       * six that do not.
       */
      grid-template-rows: auto auto auto;
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
      --box-h: min(40vh, 9rem);
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
      --box-h: clamp(6rem, 30vw, 10rem);
      /* Tighter than the fluid default, which overran the app box by a few
         pixels once the caption under the left figure gained its control. */
      gap: 0.6rem;
    }
  }
</style>
