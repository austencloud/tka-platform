<!--
  Watch It Bloom — a real sequence plays as a 3D animation (the game's own
  QuizPerformerStage, same as Read the Performer), and the answers are real
  mandalas (MandalaOptionGrid): pick the bloom the motion leaves behind.
  Same generator and 8-count catalog pool as the other mandala games.

  No misconception-hint pass: gap detection is letter-based, no signal here.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onDestroy, onMount } from "svelte";
  import { generateSequenceMatchQuestion } from "../../quiz/services/sequence-question-generator";
  import { QuizType } from "../../quiz/domain/enums/quiz-enums";
  import type { QuizAnswerOption, QuizQuestionData } from "../../quiz/domain/models/quiz-models";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import QuizContainer from "../../quiz/components/shared/QuizContainer.svelte";
  import QuizLoadingState from "../../quiz/components/shared/QuizLoadingState.svelte";
  import QuizErrorState from "../../quiz/components/shared/QuizErrorState.svelte";
  import QuizPrompt from "../../quiz/components/shared/QuizPrompt.svelte";
  import QuizFeedbackBanner from "../../quiz/components/shared/QuizFeedbackBanner.svelte";
  import ScorePopAnimation from "../../quiz/components/shared/ScorePopAnimation.svelte";
  import QuizPerformerStage from "../../quiz/components/shared/QuizPerformerStage.svelte";
  import MandalaOptionGrid from "../components/MandalaOptionGrid.svelte";
  import { getArcadeSession } from "../state/arcade-session-state.svelte";
  import type { QuestionConstraints } from "../domain/arcade-types";

  let { constraints }: { constraints: QuestionConstraints } = $props();

  const session = getArcadeSession();
  let hapticService: HapticFeedback;

  /* Same scene choice as Read the Performer: the user's background, cosmic
     as fallback. */
  let quizScene = $state<BackgroundType>(
    settingsService.settings.backgroundType ?? BackgroundType.COSMIC
  );

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
  let showScorePop = $state(false);

  const levelNumber = $derived(
    session.phase.name === "playing" ? session.phase.level.levelNumber : 1
  );

  let currentSequence = $derived(
    questionData?.questionContent as SequenceData | null
  );
  let correctWord = $derived(
    currentSequence ? simplifyRepeatedWord(currentSequence.word) : ""
  );
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
      questionData = await generateSequenceMatchQuestion(generateQuestionId(), {
        optionCount: constraints.optionCount,
        stepCount: constraints.stepCount,
        similarDistractors: levelNumber === 3,
        lessonType: QuizType.MOTION_TO_MANDALA,
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

  function handlePick(option: QuizAnswerOption) {
    if (isAnswered || !questionData) return;
    hapticService?.trigger("selection");
    selectedAnswerId = option.id;
    isAnswered = true;
    showFeedback = true;

    const isCorrect = option.isCorrect;
    if (isCorrect) {
      showScorePop = true;
      scorePopTimer = setTimeout(() => {
        showScorePop = false;
      }, 800);
    }

    hapticTimer = setTimeout(() => {
      hapticService?.trigger(isCorrect ? "success" : "error");
    }, 100);

    const picked = option.content as SequenceData;
    session.submitAnswer({
      isCorrect,
      questionData,
      selectedOptionId: option.id,
      selectedContent: simplifyRepeatedWord(picked.word),
      correctContent: correctWord,
      quizType: QuizType.MOTION_TO_MANDALA,
      answeredAt: new Date(),
    });

    nextQuestionTimer = setTimeout(handleNextQuestion, 1600);
  }

  async function handleNextQuestion() {
    if (session.phase.name !== "playing") return;
    selectedAnswerId = null;
    isAnswered = false;
    showFeedback = false;
    await loadQuestion();
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
    <QuizPrompt text="Watch the flow. Pick the mandala it leaves." />

    <div class="quiz-content">
      <div class="stage-column">
        <div class="performer-stage">
          <QuizPerformerStage sequence={currentSequence} backgroundType={quizScene} />
        </div>
        <ScorePopAnimation
          visible={showScorePop}
          score={1}
          streakCount={session.streak}
        />
        {#if showFeedback}
          <QuizFeedbackBanner
            isCorrect={isCorrectAnswer}
            correctMessage={`Correct! "${correctWord}" blooms like that`}
            incorrectMessage={`"${correctWord}" leaves the highlighted mandala`}
            streakCount={session.streak}
          />
        {/if}
      </div>

      <div class="options-column">
        <MandalaOptionGrid
          options={questionData.answerOptions}
          selectedId={selectedAnswerId}
          {isAnswered}
          onPick={handlePick}
        />
      </div>
    </div>
  </QuizContainer>
{/if}

<style>
  /* Portrait: stage on top, options below, both sharing the available height
     so the whole game fits without scrolling. The options column is height-
     bounded (flex + min-height:0) so MandalaOptionGrid's two-axis sizing can
     shrink its tiles to fit. */
  .quiz-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    width: 100%;
    max-width: 460px;
    flex: 1;
    min-height: 0;
  }

  .stage-column {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    flex: 0 1 auto;
    min-height: 0;
  }

  .performer-stage {
    width: 100%;
    aspect-ratio: 4 / 3;
    max-height: 40svh;
    border-radius: 16px;
    overflow: hidden;
  }

  .options-column {
    width: 100%;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    align-items: stretch;
    justify-content: center;
  }

  @media (min-width: 768px) {
    .quiz-content {
      flex-direction: row;
      align-items: stretch;
      max-width: 1050px;
      gap: 2.5rem;
    }

    .stage-column {
      flex: 1;
      justify-content: center;
    }

    .performer-stage {
      min-height: 340px;
      max-height: none;
    }

    .options-column {
      flex: 0 0 420px;
    }
  }

  @media (min-width: 1440px) {
    .quiz-content {
      max-width: 1350px;
    }

    .options-column {
      flex-basis: 520px;
    }
  }

  @media (min-width: 2560px) {
    .quiz-content {
      max-width: clamp(1350px, 55vw, 1750px);
    }

    .performer-stage {
      min-height: 480px;
    }

    .options-column {
      flex-basis: 640px;
    }
  }
</style>
