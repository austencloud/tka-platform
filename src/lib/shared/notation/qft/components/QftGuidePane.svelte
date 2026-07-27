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
  import QftFrames from "./QftFrames.svelte";
  import QftStage from "./QftStage.svelte";
  import QftTable from "./QftTable.svelte";

  interface Props {
    move: GuideMove;
    increments: QftIncrement[];
    cursor: number;
    step: number;
    compact: boolean;
  }

  let { move, increments, cursor, step, compact }: Props = $props();
</script>

<div class="guide">
  <header>
    <h2>{move.title}</h2>
    <p class="spec">{move.spec}</p>
  </header>

  <div class="pair">
    <figure>
      <div class="box original" style={`--aspect: ${move.aspect}; aspect-ratio: ${move.aspect}`}>
        <QftFrames stem={move.stem} {step} alt={`${move.title}, as published in 2011`} />
      </div>
      <figcaption>Home of Poi, 2011</figcaption>
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

  .pair {
    display: grid;
    grid-template-columns: repeat(2, auto);
    justify-content: center;
    align-items: end;
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
   * Width-driven, so a wide drawing does not balloon across the row as the
   * shared height grows. The cap keeps the pair from crowding the notation.
   */
  .box.original {
    height: auto;
    width: min(calc(var(--box-h) * var(--aspect)), calc(var(--box-h) * 1.15));
  }

  .stage {
    display: grid;
    place-items: center;
  }

  figcaption {
    margin-top: 0.5rem;
    text-align: center;
    font-size: 0.75rem;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.5));
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
  @media (min-width: 90rem) and (min-height: 45rem) {
    .guide {
      --box-h: clamp(14rem, 38vh, 30rem);
      display: grid;
      grid-template-columns: auto minmax(24rem, 34rem);
      grid-template-areas: "head head" "pair notation" "pair quote";
      align-content: center;
      justify-content: center;
      column-gap: clamp(1.5rem, 3vw, 4rem);
      row-gap: 1.25rem;
    }

    header {
      grid-area: head;
    }

    .pair {
      grid-area: pair;
      align-self: center;
    }

    .notation {
      grid-area: notation;
      align-self: end;
    }

    blockquote {
      grid-area: quote;
      align-self: start;
    }
  }

  /* Wide and short — fold-open landscape. The quote yields; the pair does not. */
  @media (min-width: 44rem) and (max-height: 32rem) {
    .guide {
      --box-h: min(46vh, 11rem);
    }

    blockquote {
      display: none;
    }
  }

  @media (max-width: 30rem) {
    .guide {
      --box-h: clamp(6rem, 30vw, 10rem);
    }
  }
</style>
