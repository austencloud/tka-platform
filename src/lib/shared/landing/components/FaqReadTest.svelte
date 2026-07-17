<script lang="ts">
  /**
   * The FAQ's flagship proof: instead of asserting "pictographs are readable
   * without training," let the visitor read one. The prompt TEACHES the one
   * convention needed (arrows run from a dot to their arrowhead) before it
   * asks anything, the answer buttons use plain screen words (Top / Right /
   * Left), and the feedback introduces the spinner term afterwards — the test
   * teaches, it never quizzes on unexplained jargon. The correct answer comes
   * straight from the pictograph's own motion data (see faq-pictographs.ts);
   * nothing here is hand-authored domain trivia.
   *
   * Rendered as TWO cooperating parts so the host can compose them into its
   * grid (FaqInterview's editorial tier puts the pictograph in the voice
   * column and the quiz in the answer column; stacked tiers put the figure
   * directly above the quiz):
   *
   *   <FaqReadTest part="figure" />  — just the framed pictograph
   *   <FaqReadTest part="quiz" />    — prompt, options, feedback
   *
   * Both parts await the same module-cached getReadTestQuestion(), so they
   * always describe the same beat. Dynamic-imported by the FAQ host; costs
   * the landing bundle nothing.
   */
  import { onMount } from "svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { GridMode, type GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import {
    COMPASS_NAMES,
    SCREEN_WORDS,
    getReadTestQuestion,
    type ReadTestQuestion,
  } from "../faq/faq-pictographs";

  let { part = "quiz" }: { part?: "figure" | "quiz" } = $props();

  let question = $state<ReadTestQuestion | null>(null);
  let settled = $state(false);
  let picked = $state<GridLocation | null>(null);

  const isCorrect = $derived(question !== null && picked === question.correct);

  onMount(async () => {
    question = await getReadTestQuestion();
    settled = true;
  });
</script>

{#if !settled || question}
  {#if part === "figure"}
    <!-- Fixed square frame, reserved before the pictograph resolves. -->
    <div class="frame">
      {#if question}
        <PictographContainer
          pictographData={question.pictograph}
          gridMode={GridMode.DIAMOND}
          showGrid={true}
          showTKA={true}
          showReversals={false}
          showPositions={false}
          showHandPoints={true}
          darkMode={true}
          disableTransitions={true}
        />
      {/if}
    </div>
  {:else}
    <div class="quiz">
      <p class="prompt">
        Each arrow runs from a dot to its arrowhead. Follow the blue one: where does it land?
      </p>
      <div class="options">
        {#if question}
          {#each question.options as option (option)}
            <button
              type="button"
              class="option"
              class:correct={picked !== null && option === question.correct}
              class:incorrect={picked === option && option !== question.correct}
              class:dimmed={picked !== null && option !== question.correct && picked !== option}
              disabled={picked !== null}
              onclick={() => (picked = option)}
            >
              {SCREEN_WORDS[option]}
            </button>
          {/each}
        {/if}
      </div>
      <!-- Always rendered so the verdict arriving never reflows what's below. -->
      <p class="feedback" role="status">
        {#if picked !== null && question}
          {isCorrect
            ? `Yes: ${COMPASS_NAMES[question.correct]}, in spinner terms. You just read your first beat of notation.`
            : `Follow the blue arrow to its tip: it lands at the ${SCREEN_WORDS[question.correct]?.toLowerCase()} point. Spinners call it ${COMPASS_NAMES[question.correct]}.`}
        {/if}
      </p>
    </div>
  {/if}
{/if}

<style>
  .frame {
    width: 180px;
    aspect-ratio: 1;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 12px;
    overflow: hidden;
  }

  .quiz {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .prompt {
    margin: 0;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    font-size: 0.95rem;
    line-height: 1.5;
    max-width: 52ch;
  }

  /* Equal-width segments capped at a hand-sized width so the buttons never
     smear across a wide answer column. */
  .options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    width: 100%;
    max-width: 420px;
  }

  .option {
    min-height: 44px;
    padding: 0 12px;
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, #ffffff);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      background var(--duration-normal, 0.2s) ease,
      border-color var(--duration-normal, 0.2s) ease;
  }

  .option:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--theme-accent-strong, #818cf8) 60%, transparent);
    background: color-mix(in srgb, var(--theme-accent-strong, #818cf8) 12%, transparent);
  }

  .option:disabled {
    cursor: default;
  }

  .option.correct {
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success, #22c55e) 60%, transparent);
  }

  .option.incorrect {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 60%, transparent);
  }

  .option.dimmed {
    opacity: 0.4;
  }

  /* Space for two lines is reserved up front — the verdict appearing must not
     shove the door below it (no-layout-shift). */
  .feedback {
    margin: 0;
    min-height: 2.9em;
    font-size: 0.9rem;
    line-height: 1.45;
    max-width: 52ch;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }

  /* Phone tier: the figure is centered by the host; quiz text centers to
     match, options span the full width as thumb targets. */
  @media (max-width: 600px) {
    .frame {
      width: 200px;
    }

    .prompt,
    .feedback {
      text-align: center;
      max-width: none;
    }

    .options {
      max-width: none;
    }

    .option {
      min-height: 48px;
    }
  }

  /* 4K tier: scale the artifact and the targets, not just the whitespace. */
  @media (min-width: 2200px) {
    .frame {
      width: 230px;
    }

    .prompt {
      font-size: 1.08rem;
    }

    .options {
      max-width: 480px;
    }

    .option {
      min-height: 52px;
      font-size: 1rem;
    }

    .feedback {
      font-size: 1rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .option {
      transition: none;
    }
  }
</style>
