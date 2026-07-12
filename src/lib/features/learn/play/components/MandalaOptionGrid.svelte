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
  let tileSize = $state(160);

  /* Tiles are equal square tracks, so measuring the first one sizes all of
     them. Observing the grid (not a looped element) keeps the markup free of
     conditional bind gymnastics. */
  $effect(() => {
    if (!gridEl) return;
    const measure = () => {
      const tile = gridEl?.querySelector(".mandala-holder");
      if (!tile) return;
      const rect = tile.getBoundingClientRect();
      tileSize = Math.max(72, Math.floor(Math.min(rect.width, rect.height)));
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

<div class="mandala-options" class:six-up={options.length > 4} bind:this={gridEl}>
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
  .mandala-options {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: clamp(0.5rem, 1.2vw, 1rem);
    width: 100%;
  }

  .mandala-options.six-up {
    grid-template-columns: repeat(3, 1fr);
  }

  .tile {
    position: relative;
    aspect-ratio: 1;
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
