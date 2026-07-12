<!--
Mandala Match — Play arcade port using SequenceMandala as the question stage.

A real performed sequence renders as a mandala (the tip-path bloom the
sequence viewer's Art shelf renders); the player names the word that made it.
Shares the render kit (QuizContainer, QuizPrompt, QuizWordButton,
QuizFeedbackBanner, MisconceptionHint, ScorePopAnimation) and the
markQuestionShown -> submitAnswer -> feedback -> next flow with
PerformerWordGame, but calls sequence-question-generator directly instead of
going through the question-generator dispatcher — the dispatcher only forwards
wordLength for SEQUENCE_TO_WORD questions, and this game also needs
optionCount (4 vs 6 across the level ladder) and Level 3's lookalike-distractor
mode, neither of which question-generator.ts threads through.

Level 3 ("Lookalikes") has no dedicated constraints field for lookalike mode —
it's read straight from the session's current level number, matching the plan
exactly (generateSequenceToWordQuestion(id, { ..., similarDistractors:
levelNumber === 3 })).

Mandala stage sizing: SequenceMandala takes a numeric pixel `size`, not a CSS
value, so a ResizeObserver on the aspect-ratio-locked stage box (the same
technique MandalaPane.svelte uses to fill a responsive box) drives it. The
stage box itself still reserves its footprint via CSS (aspect-ratio: 1 sized
through a local container-query context) so there's no layout shift before the
observer's first callback.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { detectSingleError } from "$lib/features/learn/services/gap-detector";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onDestroy, onMount } from "svelte";
  import { generateSequenceToWordQuestion } from "../../quiz/services/sequence-question-generator";
  import { QuizType } from "../../quiz/domain/enums/quiz-enums";
  import type { QuizQuestionData } from "../../quiz/domain/models/quiz-models";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { DetectedGap } from "../../services/types";
  import QuizContainer from "../../quiz/components/shared/QuizContainer.svelte";
  import QuizLoadingState from "../../quiz/components/shared/QuizLoadingState.svelte";
  import QuizErrorState from "../../quiz/components/shared/QuizErrorState.svelte";
  import QuizPrompt from "../../quiz/components/shared/QuizPrompt.svelte";
  import QuizWordButton from "../../quiz/components/shared/QuizWordButton.svelte";
  import QuizFeedbackBanner from "../../quiz/components/shared/QuizFeedbackBanner.svelte";
  import MisconceptionHint from "../../quiz/components/shared/MisconceptionHint.svelte";
  import ScorePopAnimation from "../../quiz/components/shared/ScorePopAnimation.svelte";
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { reducedMotion } from "$lib/shared/transitions/motion";
  import { getArcadeSession } from "../state/arcade-session-state.svelte";
  import type { QuestionConstraints } from "../domain/arcade-types";

  let { constraints }: { constraints: QuestionConstraints } = $props();

  const session = getArcadeSession();
  let hapticService: HapticFeedback;

  let scorePopTimer: ReturnType<typeof setTimeout> | null = null;
  let hapticTimer: ReturnType<typeof setTimeout> | null = null;
  let nextQuestionTimer: ReturnType<typeof setTimeout> | null = null;

  onDestroy(() => {
    if (scorePopTimer !== null) clearTimeout(scorePopTimer);
    if (hapticTimer !== null) clearTimeout(hapticTimer);
    if (nextQuestionTimer !== null) clearTimeout(nextQuestionTimer);
  });

  let questionData = $state<QuizQuestionData | null>(null);
  let selectedAnswerId = $state<string | null>(null);
  let isAnswered = $state(false);
  let showFeedback = $state(false);
  let isInitialLoading = $state(true);
  let error = $state<string | null>(null);

  // Score-pop "+1" flourish only — streak truth lives on the session; the
  // shell renders the real streak flame. No local streak state here.
  let showScorePop = $state(false);
  let currentGap = $state<DetectedGap | null>(null);

  // Fixed answer slots — count follows the level's optionCount constraint (4
  // on Levels 1, 6 on Levels 2-3).
  const answerSlots = Array.from(
    { length: constraints.optionCount ?? 4 },
    (_, i) => i
  );

  // Level 3 ("Lookalikes") is the only rung that asks for shared-letter-ranked
  // distractors. Read from the session's current level, not a constraints
  // field — the registry doesn't carry a dedicated flag for it.
  const levelNumber = $derived(
    session.phase.name === "playing" ? session.phase.level.levelNumber : 1
  );

  const bluePropType = $derived(settingsService.settings.bluePropType);
  const redPropType = $derived(settingsService.settings.redPropType);
  // Read once at mount — matches every other reduced-motion check in this
  // codebase (transitions/motion.ts), which also doesn't live-update mid-session.
  const animateMandala = !reducedMotion();

  let stageEl: HTMLDivElement | undefined = $state();
  let stageSize = $state(280);

  // Same ResizeObserver technique as MandalaPane.svelte — SequenceMandala
  // needs a numeric pixel size, so the CSS-sized (aspect-ratio: 1) stage box
  // is measured and fed back in, keeping the render pixel-accurate at any
  // viewport instead of a fixed guess.
  $effect(() => {
    if (!stageEl) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      stageSize = Math.max(120, Math.floor(Math.min(width, height)));
    });
    observer.observe(stageEl);
    return () => observer.disconnect();
  });

  let currentSequence = $derived(
    questionData?.questionContent as SequenceData | null
  );
  let correctAnswer = $derived(questionData?.correctAnswer as string);
  let isCorrectAnswer = $derived(
    selectedAnswerId
      ? (questionData?.answerOptions.find((o) => o.id === selectedAnswerId)
          ?.isCorrect ?? false)
      : false
  );

  onMount(async () => {
    hapticService = getHapticFeedback();
    await loadQuestion();
  });

  async function loadQuestion() {
    error = null;
    try {
      questionData = await generateSequenceToWordQuestion(generateQuestionId(), {
        optionCount: constraints.optionCount,
        wordLength: constraints.wordLength,
        similarDistractors: levelNumber === 3,
      });
      session.markQuestionShown();
    } catch (err) {
      console.error("Failed to load question:", err);
      error = err instanceof Error ? err.message : "Failed to load question";
    } finally {
      isInitialLoading = false;
    }
  }

  function generateQuestionId(): string {
    return `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  function handleAnswerClick(optionId: string, isCorrect: boolean) {
    if (isAnswered) return;
    hapticService?.trigger("selection");
    selectedAnswerId = optionId;
    isAnswered = true;
    showFeedback = true;

    if (isCorrect) {
      showScorePop = true;
      scorePopTimer = setTimeout(() => {
        showScorePop = false;
      }, 800);
    }

    currentGap = null;
    if (!isCorrect && questionData) {
      const selectedOption = questionData.answerOptions.find(
        (o) => o.id === optionId
      );
      const correctOption = questionData.answerOptions.find((o) => o.isCorrect);
      const gap = detectSingleError({
        isCorrect: false,
        questionData,
        selectedOptionId: optionId,
        selectedContent: selectedOption?.content ?? null,
        correctContent: correctOption?.content ?? null,
        quizType: QuizType.SEQUENCE_TO_WORD,
        answeredAt: new Date(),
      });
      if (gap) {
        currentGap = gap;
      }
    }

    hapticTimer = setTimeout(() => {
      hapticService?.trigger(isCorrect ? "success" : "error");
    }, 100);

    if (questionData) {
      const selectedOption = questionData.answerOptions.find(
        (o) => o.id === optionId
      );
      const correctOption = questionData.answerOptions.find((o) => o.isCorrect);
      session.submitAnswer({
        isCorrect,
        questionData,
        selectedOptionId: optionId,
        selectedContent: selectedOption?.content ?? null,
        correctContent: correctOption?.content ?? null,
        quizType: QuizType.SEQUENCE_TO_WORD,
        answeredAt: new Date(),
      });
    }

    // Standard pause (not blitz timing) — extra time when a misconception
    // hint is showing so the player can read it, same as the ported games.
    const feedbackDuration = currentGap ? 5000 : 1200;
    nextQuestionTimer = setTimeout(handleNextQuestion, feedbackDuration);
  }

  async function handleNextQuestion() {
    // Engine completion (fixed-count reached) ends the self-advance loop —
    // never load a question the player won't see.
    if (session.phase.name !== "playing") return;
    selectedAnswerId = null;
    isAnswered = false;
    showFeedback = false;
    currentGap = null;
    await loadQuestion();
  }

  function getButtonState(
    optionId: string,
    isCorrect: boolean
  ): "default" | "correct" | "incorrect" | "dimmed" {
    if (!isAnswered) return "default";
    if (isCorrect) return "correct";
    if (selectedAnswerId === optionId) return "incorrect";
    return "dimmed";
  }
</script>

{#if isInitialLoading}
  <QuizContainer>
    <QuizLoadingState />
  </QuizContainer>
{:else if error}
  <QuizContainer>
    <QuizErrorState {error} onRetry={loadQuestion} />
  </QuizContainer>
{:else if questionData && currentSequence}
  <QuizContainer>
    <QuizPrompt text="One mandala. One word made it. Which one?" />

    <div class="quiz-content">
      <div class="stage-column">
        <div class="mandala-stage" bind:this={stageEl}>
          <SequenceMandala
            sequence={currentSequence}
            mode="gallery"
            size={stageSize}
            animate={animateMandala}
            animatePeriod={9}
            animateMin={100}
            animateMax={180}
            animateEasing="breathe"
            animateRotation={0}
            {bluePropType}
            {redPropType}
          />
        </div>
      </div>

      <div class="answer-section">
        <div class="answer-grid">
          {#each answerSlots as slotIndex (slotIndex)}
            {@const option = questionData.answerOptions[slotIndex]}
            {#if option}
              <QuizWordButton
                word={option.content as string}
                state={getButtonState(option.id, option.isCorrect)}
                disabled={isAnswered}
                onclick={() => handleAnswerClick(option.id, option.isCorrect)}
              />
            {/if}
          {/each}
        </div>

        <ScorePopAnimation
          visible={showScorePop}
          score={1}
          streakCount={session.streak}
        />

        {#if showFeedback}
          <QuizFeedbackBanner
            isCorrect={isCorrectAnswer}
            correctMessage={`Correct! The word is "${correctAnswer}"`}
            incorrectMessage={`The correct word is "${correctAnswer}"`}
            streakCount={session.streak}
          />
          {#if currentGap}
            <MisconceptionHint gap={currentGap} />
          {/if}
        {/if}
      </div>
    </div>
  </QuizContainer>
{/if}

<style>
  .quiz-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    width: 100%;
    max-width: 420px;
    flex: 1;
    min-height: 0;
  }

  .stage-column {
    /* Local container-query context — cqh/cqw below resolve against this
       element's own box, so the stage never depends on an ancestor
       declaring container-type. */
    container-type: size;
    width: 100%;
    flex: 1;
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mandala-stage {
    position: relative;
    aspect-ratio: 1;
    inline-size: min(60cqh, 90cqw, 420px);
    min-inline-size: 160px;
    border-radius: 20px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(
      circle,
      color-mix(in srgb, var(--game-accent, var(--theme-accent)) 14%, transparent),
      transparent 70%
    );
  }

  .answer-section {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
  }

  .answer-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.625rem;
    width: 100%;
  }

  /* Desktop: horizontal split layout, mandala stage left, answers right */
  @media (min-width: 768px) {
    .quiz-content {
      flex-direction: row;
      align-items: stretch;
      max-width: 900px;
      gap: 2rem;
    }

    .stage-column {
      flex: 1;
      min-height: 360px;
    }

    .answer-section {
      flex: 0 0 300px;
      justify-content: center;
    }
  }

  @media (min-width: 1024px) {
    .quiz-content {
      max-width: 1000px;
    }

    .answer-section {
      flex: 0 0 340px;
    }

    .answer-grid {
      gap: 0.875rem;
    }
  }

  @media (min-width: 1440px) {
    .quiz-content {
      max-width: 1200px;
      gap: 3rem;
    }

    .stage-column {
      min-height: 480px;
    }

    .answer-section {
      flex: 0 0 380px;
    }

    .answer-grid {
      gap: 1rem;
    }
  }

  @media (max-width: 480px) {
    .quiz-content {
      gap: 1rem;
    }

    .answer-grid {
      gap: 0.5rem;
    }
  }
</style>
