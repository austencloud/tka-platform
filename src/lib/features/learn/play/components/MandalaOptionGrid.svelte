<!--
  Shared answer grid for the mandala game family (Trace the Card, Watch It
  Bloom): N real SequenceMandala tiles as answer buttons. After an answer the
  correct tile rings in the game accent, a wrong pick rings red, and the rest
  dim — same feedback grammar as the letter games' buttons.

  One ResizeObserver on the first tile sizes every mandala (tiles are equal
  grid tracks; SequenceMandala needs a numeric pixel size).
-->
<script lang="ts">
  import type { QuizAnswerOption } from "../../quiz/domain/models/quiz-models";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";

  let {
    options,
    selectedId = null,
    isAnswered = false,
    onPick,
  }: {
    options: QuizAnswerOption[];
    selectedId?: string | null;
    isAnswered?: boolean;
    onPick: (option: QuizAnswerOption) => void;
  } = $props();

  let gridEl = $state<HTMLElement | undefined>();
  let tileSize = $state(120);

  const GAP = 12; // px — must match the `gap` in CSS below
  const cols = $derived(options.length > 4 ? 3 : 2);
  const rows = $derived(Math.ceil(options.length / cols));

  /* Two-axis sizing: the tile is the largest square that fits BOTH the width
     each column gets AND the height each row gets. Width-only sizing (the old
     approach) let a 2×N square block grow taller than the viewport, so the
     answers fell below the fold on short/foldable screens. Reading the grid's
     own clientHeight (it fills a height-bounded parent) lets the tiles shrink
     to fit instead of overflowing. No feedback loop: the grid is sized by its
     parent, not by its tile content, so setting --tile doesn't resize it. */
  $effect(() => {
    if (!gridEl) return;
    const measure = () => {
      if (!gridEl) return;
      const w = gridEl.clientWidth;
      const h = gridEl.clientHeight;
      const byWidth = (w - (cols - 1) * GAP) / cols;
      const byHeight = h > 0 ? (h - (rows - 1) * GAP) / rows : Infinity;
      tileSize = Math.max(72, Math.floor(Math.min(byWidth, byHeight)));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(gridEl);
    measure();
    return () => observer.disconnect();
  });

  function tileState(option: QuizAnswerOption): "default" | "correct" | "incorrect" | "dimmed" {
    if (!isAnswered) return "default";
    if (option.isCorrect) return "correct";
    if (option.id === selectedId) return "incorrect";
    return "dimmed";
  }
</script>

<div
  class="mandala-options"
  class:six-up={options.length > 4}
  style="--cols: {cols}; --tile: {tileSize}px"
  bind:this={gridEl}
>
  {#each options as option, i (option.id)}
    <button
      type="button"
      class="tile state-{tileState(option)}"
      disabled={isAnswered}
      aria-label={`Mandala option ${i + 1}`}
      onclick={() => onPick(option)}
    >
      <span class="mandala-holder">
        <SequenceMandala
          sequence={option.content as SequenceData}
          mode="gallery"
          size={tileSize}
        />
      </span>
    </button>
  {/each}
</div>

<style>
  /* Fills a height-bounded parent and centers the sized tile block; columns
     and tile edge come from JS (two-axis fit) so the block never taller than
     the space it's given. gap here must equal GAP in the script. */
  .mandala-options {
    display: grid;
    grid-template-columns: repeat(var(--cols, 2), var(--tile, 120px));
    grid-auto-rows: var(--tile, 120px);
    gap: 12px;
    width: 100%;
    height: 100%;
    place-content: center;
  }

  .tile {
    position: relative;
    width: var(--tile, 120px);
    height: var(--tile, 120px);
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    padding: clamp(4px, 0.8vw, 10px);
    border-radius: 12px;
    background: rgba(10, 10, 15, 0.85);
    border: 2px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition:
      border-color var(--duration-normal, 200ms) ease,
      opacity var(--duration-normal, 200ms) ease,
      transform var(--duration-fast, 150ms) ease;
  }

  .tile:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--game-accent, #fbbf24) 60%, transparent);
    transform: translateY(-2px);
  }

  .tile:focus-visible {
    outline: 2px solid var(--game-accent, #fbbf24);
    outline-offset: 2px;
  }

  .tile:disabled {
    cursor: default;
  }

  .mandala-holder {
    position: absolute;
    inset: clamp(4px, 0.8vw, 10px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tile.state-correct {
    border-color: var(--game-accent, #fbbf24);
    box-shadow: 0 0 18px color-mix(in srgb, var(--game-accent, #fbbf24) 40%, transparent);
  }

  .tile.state-incorrect {
    border-color: var(--semantic-error, #ef4444);
  }

  .tile.state-dimmed {
    opacity: 0.4;
  }

  @media (prefers-reduced-motion: reduce) {
    .tile {
      transition: none;
    }

    .tile:hover:not(:disabled) {
      transform: none;
    }
  }
</style>
