<!--
	Question Generator Component

	Generates and displays quiz questions for different lesson types.
	Handles question content, answer options, and user interactions.
-->

<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  // TODO: Fix service import - temporarily commented out
  // import { QuestionGeneratorService } from "../../services/implementations";
  import type {
    QuizAnswerOption,
    QuizQuestionData,
  } from "../domain/models/quiz-models";
  import {
    QuizAnswerFormat,
    QuizQuestionFormat,
    QuizType,
  } from "../domain/enums/quiz-enums";
  // Events are now handled via callbacks in props
  import AnswerButton from "./AnswerButton.svelte";
  import AnswerPictograph from "./AnswerPictograph.svelte";
  import PictographRenderer from "./QuizPictographRenderer.svelte";

  // Services
  let hapticService: HapticFeedback;

  // Initialize haptic service
  $effect(() => {
    hapticService = getHapticFeedback();
  });

  // Type guards for type-safe access to questionData properties
  function isPictographQuestion(
    questionData: QuizQuestionData
  ): questionData is QuizQuestionData & {
    questionType: QuizQuestionFormat.PICTOGRAPH;
    questionContent: PictographData;
  } {
    return questionData.questionType === QuizQuestionFormat.PICTOGRAPH;
  }

  function isLetterQuestion(
    questionData: QuizQuestionData
  ): questionData is QuizQuestionData & {
    questionType: QuizQuestionFormat.LETTER;
    questionContent: string;
  } {
    return questionData.questionType === QuizQuestionFormat.LETTER;
  }

  function hasButtonAnswers(
    questionData: QuizQuestionData
  ): questionData is QuizQuestionData & {
    answerType: QuizAnswerFormat.BUTTON;
  } {
    return questionData.answerType === QuizAnswerFormat.BUTTON;
  }

  function hasPictographAnswers(
    questionData: QuizQuestionData
  ): questionData is QuizQuestionData & {
    answerType: QuizAnswerFormat.PICTOGRAPH;
  } {
    return questionData.answerType === QuizAnswerFormat.PICTOGRAPH;
  }

  // Helper function to get question prompt with type safety
  function getQuestionPrompt(questionData: QuizQuestionData): string {
    // For now, return a default since questionPrompt isn't in the interface
    // This could be enhanced to look up prompts based on lesson type
    return "Choose the correct answer:";
  }

  // Props
  let {
    lessonType,
    questionData = null,
    showFeedback = false,
    selectedAnswerId = null,
    isAnswered = false,
    onAnswerSelected,
    onNextQuestion,
  } = $props<{
    lessonType: QuizType;
    questionData?: QuizQuestionData | null;
    showFeedback?: boolean;
    selectedAnswerId?: string | null;
    isAnswered?: boolean;
    onAnswerSelected?: (data: {
      answerId: string;
      answerContent: PictographData;
      isCorrect: boolean;
    }) => void;
    onNextQuestion?: () => void;
  }>();

  // Reactive effect to generate question when needed
  $effect(() => {
    if (lessonType && !questionData) {
      generateNewQuestion();
    }
  });

  // Methods
  function generateNewQuestion() {
    // TODO: Re-enable when services are fixed
    // try {
    //   questionData = QuestionGeneratorService.generateQuestion(lessonType);
    // } catch (error) {
    //   console.error("Failed to generate question:", error);
    // }
  }

  function handleAnswerClick(option: QuizAnswerOption) {
    if (isAnswered) return;

    // Trigger selection haptic for answer
    hapticService?.trigger("selection");

    selectedAnswerId = option.id;
    onAnswerSelected?.({
      answerId: option.id,
      answerContent: option.content as PictographData,
      isCorrect: option.isCorrect,
    });

    // Trigger success/error haptic based on correctness
    if (option.isCorrect) {
      hapticService?.trigger("success");
    } else {
      hapticService?.trigger("error");
    }
  }

  function handleNextQuestion() {
    // Trigger navigation haptic for next question
    hapticService?.trigger("selection");

    // Reset state
    selectedAnswerId = null;
    showFeedback = false;
    isAnswered = false;

    // Generate new question
    generateNewQuestion();

    onNextQuestion?.();
  }

  function getAnswerClass(option: QuizAnswerOption): string {
    if (!showFeedback) {
      return selectedAnswerId === option.id ? "selected" : "";
    }

    if (option.isCorrect) {
      return "correct";
    } else if (selectedAnswerId === option.id && !option.isCorrect) {
      return "incorrect";
    }

    return "disabled";
  }
</script>

<div class="question-generator">
  {#if questionData}
    <!-- Question Section -->
    <div class="question-section">
      <div class="question-prompt">
        <h3>
          {getQuestionPrompt(questionData)}
        </h3>
      </div>

      <div class="question-content">
        {#if isPictographQuestion(questionData)}
          <PictographRenderer pictographData={questionData.questionContent} />
        {:else if isLetterQuestion(questionData)}
          <div class="letter-display">
            <span class="letter">{questionData.questionContent}</span>
          </div>
        {:else}
          <div class="text-display">
            <p>{questionData.questionContent}</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Answer Section -->
    <div class="answer-section">
      <div
        class="answer-grid"
        class:button-grid={hasButtonAnswers(questionData)}
      >
        {#each questionData.answerOptions as option (option.id)}
          <div class="answer-option {getAnswerClass(option)}">
            {#if hasButtonAnswers(questionData)}
              <AnswerButton
                content={option.content as string}
                isSelected={selectedAnswerId === option.id}
                isCorrect={option.isCorrect}
                {showFeedback}
                disabled={isAnswered}
                onclick={() => handleAnswerClick(option)}
              />
            {:else if hasPictographAnswers(questionData)}
              <AnswerPictograph
                pictographData={option.content as PictographData}
                isSelected={selectedAnswerId === option.id}
                isCorrect={option.isCorrect}
                {showFeedback}
                disabled={isAnswered}
                onclick={() => handleAnswerClick(option)}
              />
              />
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <!-- Feedback Section -->
    {#if showFeedback && isAnswered}
      <div class="feedback-section">
        {#if questionData.answerOptions.find((opt: QuizAnswerOption) => opt.id === selectedAnswerId)?.isCorrect}
          <div class="feedback correct">
            <span class="icon">✓</span>
            <span class="message">Correct!</span>
          </div>
        {:else}
          <div class="feedback incorrect">
            <span class="icon">✗</span>
            <span class="message"
              >Incorrect. The correct answer is highlighted.</span
            >
          </div>
        {/if}

        <button class="next-button" onclick={handleNextQuestion} aria-label="Next question">
          Next Question
        </button>
      </div>
    {/if}
  {:else}
    <div class="loading">
      <p>Generating question...</p>
    </div>
  {/if}
</div>

<style>
  .question-generator {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 1.5rem;
    height: 100%;
    background: var(--theme-card-bg);
    border-radius: 12px;
    border: 1px solid var(--theme-stroke);
  }

  .question-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }

  .question-prompt h3 {
    margin: 0;
    color: var(--theme-text, #ffffff);
    font-size: 1.25rem;
    font-weight: 500;
  }

  .question-content {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 120px;
    padding: 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border-radius: 8px;
    border: 1px solid var(--theme-stroke);
  }

  .letter-display {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .letter {
    font-size: 4rem;
    font-weight: bold;
    color: var(--theme-text, #ffffff);
    text-shadow: 0 2px 4px color-mix(in srgb, var(--theme-panel-bg) 70%, transparent);
  }

  .text-display p {
    margin: 0;
    font-size: 1.125rem;
    color: var(--theme-text, #ffffff);
    line-height: 1.5;
  }

  .answer-section {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .answer-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(2, 1fr);
    height: 100%;
  }

  .answer-grid.button-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .answer-option {
    transition: all var(--duration-normal) ease;
  }

  .answer-option.selected {
    transform: scale(1.02);
  }

  .answer-option.correct {
    animation: correctPulse 0.6s ease-in-out;
  }

  .answer-option.incorrect {
    animation: incorrectShake 0.6s ease-in-out;
  }

  .answer-option.disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .feedback-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--theme-card-bg);
    border-radius: 8px;
    border: 1px solid var(--theme-stroke);
  }

  .feedback {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.125rem;
    font-weight: 500;
  }

  .feedback.correct {
    color: var(--semantic-success);
  }

  .feedback.incorrect {
    color: var(--semantic-error);
  }

  .feedback .icon {
    font-size: 1.5rem;
  }

  .next-button {
    padding: 0.75rem 2rem;
    background: var(--theme-accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .next-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--theme-accent) 40%, transparent);
  }

  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 200px;
    color: var(--theme-text, #ffffff);
    font-size: 1.125rem;
  }

  @keyframes correctPulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }

  @keyframes incorrectShake {
    0%,
    100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-5px);
    }
    75% {
      transform: translateX(5px);
    }
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .question-generator {
      padding: 1rem;
      gap: 1.5rem;
    }

    .answer-grid {
      grid-template-columns: 1fr;
    }

    .letter {
      font-size: 3rem;
    }

    .question-prompt h3 {
      font-size: 1.125rem;
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .correct {
      animation: none;
    }
    .incorrect {
      animation: none;
    }
  }
</style>
