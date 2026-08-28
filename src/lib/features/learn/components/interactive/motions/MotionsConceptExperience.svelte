<script lang="ts">
  import { onMount } from "svelte";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { getCodexLetterMappingRepo } from "$lib/features/learn/codex/get-codex-letter-mapping-repo";
  import {
    Letter as TkaLetter,
    type Letter,
  } from "$lib/shared/foundation/domain/models/letter";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { HandMotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/letter-query-handler";
  import type { ExperienceViewMode } from "../../../domain/types";
  import { getExperiencePersistence } from "../../../state/experience-persistence.svelte";
  import ExperienceProgressIndicator from "../ExperienceProgressIndicator.svelte";
  import {
    HAND_MOTION_LESSON,
    HAND_MOTION_QUESTIONS,
  } from "../shared/canonical-lesson-content";
  import LessonPictographStage from "../shared/LessonPictographStage.svelte";

  let {
    onComplete,
    onBack,
    viewMode = "step",
  }: {
    onComplete?: () => void;
    onBack?: () => void;
    viewMode?: ExperienceViewMode;
  } = $props();

  const haptic = getHapticFeedback();
  const persistence = getExperiencePersistence("hand-motions-intro");
  const saved = persistence.load();

  let phase = $state(Math.min(3, Math.max(1, saved.step || 1)));
  let selectedMotion = $state<HandMotionType>(
    persistence.getPhaseData<HandMotionType>("selectedMotion", "shift")
  );
  let questionIndex = $state(
    Math.min(
      HAND_MOTION_QUESTIONS.length - 1,
      persistence.getPhaseData<number>("questionIndex", 0)
    )
  );
  let selectedAnswer = $state<HandMotionType | null>(null);
  let answerState = $state<"correct" | "wrong" | null>(null);
  let pictographs = $state<Partial<Record<Letter, PictographData>>>({});
  let loading = $state(true);

  const activeMotion = $derived(
    HAND_MOTION_LESSON.find((item) => item.id === selectedMotion) ??
      HAND_MOTION_LESSON[0]
  );
  const activeQuestion = $derived(HAND_MOTION_QUESTIONS[questionIndex]);
  const questionMotion = $derived(
    HAND_MOTION_LESSON.find((item) => item.id === activeQuestion.answer) ??
      HAND_MOTION_LESSON[0]
  );
  const feedbackMotion = $derived(
    HAND_MOTION_LESSON.find((item) => item.id === selectedAnswer) ?? null
  );

  onMount(async () => {
    loading = true;
    getCodexLetterMappingRepo();
    const letters = [TkaLetter.W, TkaLetter.PHI, TkaLetter.ALPHA] as const;
    const results = await Promise.all(
      letters.map(async (letter) => ({
        letter,
        pictograph: await letterQueryHandler.getPictographByLetter(
          letter,
          GridMode.DIAMOND
        ),
      }))
    );

    pictographs = Object.fromEntries(
      results
        .filter(
          (result): result is { letter: Letter; pictograph: PictographData } =>
            Boolean(result.pictograph)
        )
        .map((result) => [result.letter, result.pictograph])
    );
    loading = false;
  });

  function chooseMotion(motion: HandMotionType) {
    selectedMotion = motion;
    persistence.savePhaseData("selectedMotion", motion);
    haptic?.trigger("selection");
  }

  function goToPhase(nextPhase: number) {
    phase = Math.min(3, Math.max(1, nextPhase));
    persistence.saveStep(phase);
    selectedAnswer = null;
    answerState = null;
    haptic?.trigger("selection");
  }

  function answerQuestion(answer: HandMotionType) {
    selectedAnswer = answer;
    answerState = answer === activeQuestion.answer ? "correct" : "wrong";
    haptic?.trigger(answerState === "correct" ? "success" : "warning");
  }

  function nextQuestion() {
    if (questionIndex < HAND_MOTION_QUESTIONS.length - 1) {
      questionIndex += 1;
      persistence.savePhaseData("questionIndex", questionIndex);
      selectedAnswer = null;
      answerState = null;
      haptic?.trigger("selection");
      return;
    }
    goToPhase(3);
  }

  function complete() {
    persistence.reset();
    haptic?.trigger("success");
    onComplete?.();
  }

  export function handleBack() {
    if (phase > 1) {
      goToPhase(phase - 1);
      return;
    }
    onBack?.();
  }
</script>

<div class="experience" class:review-mode={viewMode === "scroll"}>
  {#if phase === 1}
    <section class="lesson-grid" aria-labelledby="motions-title">
      <div class="lesson-copy">
        <p class="eyebrow">Hand paths</p>
        <h1 id="motions-title">Shift, dash, or stay put?</h1>
        <p class="lede">
          A motion name describes where the <strong>hand</strong> travels. Choose
          a path, then replay the real pictograph to see it happen.
        </p>

        <div class="motion-picker" aria-label="Choose a hand path">
          {#each HAND_MOTION_LESSON as item}
            <button
              type="button"
              class="motion-choice"
              class:active={selectedMotion === item.id}
              aria-pressed={selectedMotion === item.id}
              style:--choice-accent={item.accent}
              onclick={() => chooseMotion(item.id)}
            >
              <span class="choice-name">{item.name}</span>
              <span class="choice-cue">{item.cue}</span>
            </button>
          {/each}
        </div>

        <div class="definition" style:--choice-accent={activeMotion.accent}>
          <span
            class="definition-letter"
            aria-label="Letter {activeMotion.letter}"
          >
            {activeMotion.letter}
          </span>
          <div>
            <strong>{activeMotion.name}</strong>
            <p>{activeMotion.meaning}</p>
          </div>
        </div>

        <button
          class="primary-action"
          type="button"
          onclick={() => goToPhase(2)}
        >
          Try the path check
          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </button>
      </div>

      <div class="visual-column">
        <span class="visual-label">Canonical letter {activeMotion.letter}</span>
        <LessonPictographStage
          pictograph={pictographs[activeMotion.letter] ?? null}
          {loading}
          accent={activeMotion.accent}
        />
        <p class="visual-note">
          Watch the hand point and the prop independently. Static means the hand
          stays still, not the prop.
        </p>
      </div>
    </section>
  {:else if phase === 2}
    <section class="challenge" aria-labelledby="motion-check-title">
      <div class="challenge-header">
        <p class="eyebrow">
          Path check · {questionIndex + 1} of {HAND_MOTION_QUESTIONS.length}
        </p>
        <h1 id="motion-check-title">{activeQuestion.prompt}</h1>
        <p>Replay the pictograph, then name the hand path.</p>
      </div>

      <div class="challenge-grid">
        <div class="challenge-visual">
          <LessonPictographStage
            pictograph={pictographs[activeQuestion.letter] ?? null}
            {loading}
            accent={questionMotion.accent}
          />
        </div>

        <div class="answer-panel">
          <div class="answers" aria-label="Choose the hand path">
            {#each HAND_MOTION_LESSON as item}
              <button
                type="button"
                class="answer-button"
                class:selected={selectedAnswer === item.id}
                class:correct={answerState !== null &&
                  item.id === activeQuestion.answer}
                class:wrong={answerState === "wrong" &&
                  selectedAnswer === item.id}
                disabled={answerState === "correct"}
                style:--choice-accent={item.accent}
                onclick={() => answerQuestion(item.id)}
              >
                <span>{item.name}</span>
                <small>{item.cue}</small>
              </button>
            {/each}
          </div>

          {#if answerState === "wrong" && feedbackMotion}
            <div class="feedback wrong-feedback" role="status">
              <i class="fa-solid fa-route" aria-hidden="true"></i>
              <p>
                <strong>{feedbackMotion.name}</strong> means
                {feedbackMotion.meaning.toLowerCase()} This example is
                <strong>{questionMotion.name.toLowerCase()}</strong>.
              </p>
            </div>
          {:else if answerState === "correct"}
            <div class="feedback correct-feedback" role="status">
              <i class="fa-solid fa-check" aria-hidden="true"></i>
              <p>
                <strong>{questionMotion.name}.</strong>
                {questionMotion.meaning}
              </p>
            </div>
          {/if}

          <button
            class="primary-action"
            type="button"
            disabled={answerState !== "correct"}
            onclick={nextQuestion}
          >
            {questionIndex === HAND_MOTION_QUESTIONS.length - 1
              ? "See the pattern"
              : "Next pictograph"}
            <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </section>
  {:else}
    <section class="summary" aria-labelledby="motion-summary-title">
      <p class="eyebrow">Pattern found</p>
      <h1 id="motion-summary-title">Read the hand path first</h1>
      <p class="summary-lede">
        Every pictograph separates the hand's route from the prop's rotation.
        These three paths are the foundation.
      </p>

      <div class="summary-grid">
        {#each HAND_MOTION_LESSON as item}
          <article class="summary-card" style:--choice-accent={item.accent}>
            <span class="summary-letter">{item.letter}</span>
            <div>
              <h2>{item.name}</h2>
              <p>{item.meaning}</p>
            </div>
          </article>
        {/each}
      </div>

      <button
        class="primary-action complete-action"
        type="button"
        onclick={complete}
      >
        Complete hand paths
        <i class="fa-solid fa-check" aria-hidden="true"></i>
      </button>
    </section>
  {/if}

  <ExperienceProgressIndicator currentStep={phase} totalSteps={3} />
</div>

<style>
  .experience {
    --lesson-max: 78rem;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 1rem;
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 4.75rem clamp(1rem, 3vw, 3rem) 1rem;
    overflow: auto;
    container-type: inline-size;
  }

  .lesson-grid,
  .challenge,
  .summary {
    width: min(100%, var(--lesson-max));
    margin: auto;
  }

  .lesson-grid {
    display: grid;
    grid-template-columns: minmax(18rem, 0.88fr) minmax(20rem, 1.12fr);
    align-items: center;
    gap: clamp(2rem, 5vw, 5.5rem);
  }

  .lesson-copy,
  .visual-column,
  .challenge-header,
  .answer-panel,
  .summary {
    min-width: 0;
  }

  .lesson-copy {
    display: grid;
    align-content: center;
    gap: 1.2rem;
  }

  .eyebrow {
    margin: 0;
    color: var(--theme-accent);
    font-size: clamp(0.72rem, 0.8vw, 0.9rem);
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  h1 {
    max-width: 16ch;
    margin: 0;
    color: var(--theme-text);
    font-size: clamp(2rem, 4.3cqw, 4.6rem);
    font-weight: 850;
    letter-spacing: -0.045em;
    line-height: 0.98;
    text-wrap: balance;
  }

  .lede,
  .challenge-header > p:last-child,
  .summary-lede {
    max-width: 58ch;
    margin: 0;
    color: var(--theme-text-dim);
    font-size: clamp(1rem, 1.45cqw, 1.2rem);
    line-height: 1.55;
  }

  .lede strong {
    color: var(--theme-text);
  }

  .motion-picker {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.55rem;
  }

  .motion-choice,
  .answer-button {
    min-height: 4.5rem;
    border: 1px solid var(--theme-stroke);
    border-radius: 0.9rem;
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .motion-choice {
    display: grid;
    gap: 0.2rem;
    padding: 0.8rem;
  }

  .motion-choice:hover,
  .motion-choice.active {
    border-color: color-mix(in srgb, var(--choice-accent) 75%, white 10%);
    background: color-mix(
      in srgb,
      var(--choice-accent) 14%,
      var(--theme-card-bg)
    );
    box-shadow: inset 0 -3px 0 var(--choice-accent);
  }

  .choice-name {
    font-size: 1rem;
    font-weight: 800;
  }

  .choice-cue {
    color: var(--theme-text-dim);
    font-size: 0.76rem;
    line-height: 1.25;
  }

  .definition {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 0.9rem;
    padding: 1rem;
    border-left: 4px solid var(--choice-accent);
    border-radius: 0 0.9rem 0.9rem 0;
    background: color-mix(
      in srgb,
      var(--choice-accent) 10%,
      var(--theme-card-bg)
    );
  }

  .definition-letter,
  .summary-letter {
    display: grid;
    place-items: center;
    width: 3rem;
    aspect-ratio: 1;
    border-radius: 0.75rem;
    background: color-mix(
      in srgb,
      var(--choice-accent) 22%,
      var(--theme-panel-bg)
    );
    color: var(--theme-text);
    font-size: 1.55rem;
    font-weight: 900;
  }

  .definition strong {
    color: var(--theme-text);
    font-size: 1rem;
  }

  .definition p {
    margin: 0.2rem 0 0;
    color: var(--theme-text-dim);
    font-size: 0.9rem;
    line-height: 1.45;
  }

  .primary-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    justify-self: start;
    gap: 0.65rem;
    min-height: 3.2rem;
    padding: 0.75rem 1.2rem;
    border: 1px solid color-mix(in srgb, var(--theme-accent) 70%, white 14%);
    border-radius: 0.85rem;
    background: var(--theme-accent);
    color: #061013;
    font: inherit;
    font-weight: 850;
    cursor: pointer;
  }

  .primary-action:hover:not(:disabled) {
    filter: brightness(1.12);
    transform: translateY(-1px);
  }

  .primary-action:disabled {
    cursor: not-allowed;
    filter: saturate(0.2);
    opacity: 0.38;
  }

  button:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--theme-accent) 72%, white);
    outline-offset: 3px;
  }

  .visual-column {
    display: grid;
    justify-items: center;
    gap: 0.7rem;
  }

  .visual-label {
    color: var(--theme-text-dim);
    font-size: 0.76rem;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .visual-note {
    max-width: 46ch;
    margin: 0;
    color: var(--theme-text-dim);
    font-size: 0.82rem;
    line-height: 1.45;
    text-align: center;
  }

  .challenge {
    display: grid;
    align-content: center;
    gap: clamp(1.3rem, 3vw, 2.5rem);
  }

  .challenge-header {
    display: grid;
    justify-items: center;
    gap: 0.55rem;
    text-align: center;
  }

  .challenge-header h1 {
    max-width: 22ch;
    font-size: clamp(1.8rem, 3.6cqw, 3.5rem);
  }

  .challenge-grid {
    display: grid;
    grid-template-columns: minmax(18rem, 1fr) minmax(18rem, 0.9fr);
    align-items: center;
    gap: clamp(1.5rem, 4vw, 4rem);
  }

  .answer-panel {
    display: grid;
    gap: 1rem;
  }

  .answers {
    display: grid;
    gap: 0.65rem;
  }

  .answer-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.85rem 1rem;
  }

  .answer-button span {
    font-weight: 850;
  }

  .answer-button small {
    color: var(--theme-text-dim);
  }

  .answer-button:hover:not(:disabled),
  .answer-button.selected {
    border-color: var(--choice-accent);
    background: color-mix(
      in srgb,
      var(--choice-accent) 12%,
      var(--theme-card-bg)
    );
  }

  .answer-button.correct {
    border-color: var(--semantic-success);
    box-shadow: inset 4px 0 0 var(--semantic-success);
  }

  .answer-button.wrong {
    border-color: var(--semantic-error);
    box-shadow: inset 4px 0 0 var(--semantic-error);
  }

  .feedback {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: start;
    gap: 0.7rem;
    min-height: 4.6rem;
    padding: 0.9rem 1rem;
    border: 1px solid var(--theme-stroke);
    border-radius: 0.85rem;
    background: var(--theme-card-bg);
  }

  .feedback p {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: 0.9rem;
    line-height: 1.45;
  }

  .feedback strong {
    color: var(--theme-text);
  }

  .wrong-feedback i {
    color: var(--semantic-warning, #f0b429);
  }

  .correct-feedback i {
    color: var(--semantic-success);
  }

  .summary {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 1.25rem;
    text-align: center;
  }

  .summary h1 {
    max-width: 18ch;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.8rem;
    width: 100%;
    max-width: 64rem;
  }

  .summary-card {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: start;
    gap: 0.9rem;
    padding: 1.1rem;
    border: 1px solid
      color-mix(in srgb, var(--choice-accent) 45%, var(--theme-stroke));
    border-radius: 1rem;
    background: color-mix(
      in srgb,
      var(--choice-accent) 9%,
      var(--theme-card-bg)
    );
    text-align: left;
  }

  .summary-card h2 {
    margin: 0;
    color: var(--theme-text);
    font-size: 1.05rem;
  }

  .summary-card p {
    margin: 0.35rem 0 0;
    color: var(--theme-text-dim);
    font-size: 0.84rem;
    line-height: 1.45;
  }

  .complete-action {
    justify-self: center;
  }

  :global(.experience > .progress-indicator) {
    justify-self: center;
  }

  @container (max-width: 760px) {
    .lesson-grid,
    .challenge-grid {
      grid-template-columns: 1fr;
    }

    .lesson-grid {
      gap: 1.5rem;
    }

    .visual-column {
      order: -1;
    }

    h1 {
      font-size: clamp(2rem, 10cqw, 3.4rem);
    }

    .summary-grid {
      grid-template-columns: 1fr;
    }
  }

  @container (max-width: 480px) {
    .experience {
      padding: 4rem 0.75rem 0.75rem;
    }

    .motion-picker {
      grid-template-columns: 1fr;
    }

    .motion-choice {
      grid-template-columns: 5.2rem 1fr;
      align-items: center;
      min-height: 3.5rem;
    }

    .answer-button {
      min-height: 3.5rem;
    }
  }

  @media (max-height: 560px) and (min-width: 700px) {
    .experience {
      padding-top: 3.9rem;
    }

    .lesson-grid,
    .challenge-grid {
      align-items: start;
    }

    .lesson-copy {
      gap: 0.65rem;
    }

    h1 {
      font-size: clamp(1.7rem, 4cqw, 2.6rem);
    }

    .lede,
    .visual-note {
      font-size: 0.8rem;
    }

    .motion-choice {
      min-height: 3.5rem;
      padding: 0.55rem 0.7rem;
    }

    .definition {
      padding: 0.65rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .primary-action,
    .motion-choice,
    .answer-button {
      transition: none;
    }
  }
</style>
