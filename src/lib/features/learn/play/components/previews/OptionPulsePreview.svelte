<!--
  Picture This — hub preview. Inverse rhythm of Name That Pictograph:
  the question is a REAL TKA letter (real webfont glyph, accent-lit), the
  answers are four REAL pictographs (PictographContainer, same CSV data the
  game quizzes from) in a 2×2 answer grid, with the selection ring hopping
  tiles until it settles on one. Pure CSS motion — [data-paused] and
  reduced-motion behave like every other preview.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { loadPreviewPictographs } from "./preview-pictographs";

  let { accent }: { accent: string } = $props();

  /* Four distinct real pictographs; the first is "the answer" the ring
     settles on (its letter is the big question glyph). */
  const LETTERS = ["B", "D", "J", "P"];
  let pictos = $state<PictographData[]>([]);

  onMount(() => {
    loadPreviewPictographs(LETTERS).then((loaded) => {
      pictos = loaded;
    });
  });

  const answerPicto = $derived(pictos[0] ?? null);
</script>

<div class="stage" style="--accent: {accent}" aria-hidden="true">
  {#if answerPicto}
    <span class="question tka-font">{String(answerPicto.letter)}</span>
    <div class="options">
      {#each pictos as picto, i (String(picto.letter))}
        <div class="tile" style="--tile: {i}">
          <PictographContainer
            pictographData={picto}
            disableTransitions
            showTKA={false}
            showReversals={false}
            showNonRadialPoints={false}
            showTnD={false}
            showElemental={false}
            showPositions={false}
            showHandPoints={false}
          />
          <span class="ring" class:target={i === 0}></span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .stage {
    position: absolute;
    inset: 0;
    container-type: size;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8cqi;
  }

  .question {
    font-family: "TKA Letters", var(--font-sans, sans-serif);
    font-feature-settings: "liga" 1, "dlig" 1;
    font-size: 46cqh;
    line-height: 1;
    color: var(--accent);
    text-shadow: 0 0 22px color-mix(in srgb, var(--accent) 55%, transparent);
  }

  .options {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4cqh;
    height: 82cqh;
    aspect-ratio: 1;
  }

  .tile {
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(10, 10, 15, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  /* The hop: each tile's ring lights up in sequence; the target tile gets a
     longer settle at the end of the loop. */
  .ring {
    position: absolute;
    inset: 0;
    border: 2px solid var(--accent);
    border-radius: 8px;
    opacity: 0;
    animation: ring-hop 6s linear infinite;
    animation-delay: calc(var(--tile) * 1s);
  }

  .ring.target {
    animation: ring-settle 6s linear infinite;
    animation-delay: 0s;
  }

  @keyframes ring-hop {
    0% { opacity: 0; }
    8% { opacity: 1; }
    16% { opacity: 0; }
    100% { opacity: 0; }
  }

  /* Target tile: quick pass early (its hop slot), then the settled win. */
  @keyframes ring-settle {
    0% { opacity: 0; }
    8% { opacity: 1; }
    16% { opacity: 0; }
    66% { opacity: 0; }
    74% { opacity: 1; }
    92% { opacity: 1; }
    100% { opacity: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ring {
      animation: none;
    }

    .ring.target {
      opacity: 1;
    }
  }
</style>
