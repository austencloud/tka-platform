<!--
  Inline Quiz Component

  Interactive knowledge testing embedded in TIKA chat.
  Features:
  - Visual quizzes with clickable pictograph grids
  - Motion pattern matching with color-coded chips
  - Text-based multiple choice and true/false
  - Duolingo-inspired micro-interactions (green check, red X, confetti)
  - WCAG 2.2 compliant (48px touch targets, keyboard nav, reduced motion)
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { InlineQuiz, QuizOption, TextQuizOption, PictographQuizOption, MotionPatternQuizOption } from "../types";
  import InlinePictograph from "./InlinePictograph.svelte";

  // Props
  let {
    quiz,
    onQuizComplete,
  }: {
    quiz: InlineQuiz;
    onQuizComplete?: (quizId: string, topic: string, correct: boolean) => void;
  } = $props();

  // State
  type QuizState = "unanswered" | "processing" | "correct" | "incorrect";
  let quizState: QuizState = $state("unanswered");
  let selectedOptionId: string | null = $state(null);
  let showConfetti: boolean = $state(false);

  // Find the correct option
  const correctOption = $derived(quiz.options.find(opt => opt.correct));

  // Timer handles for cleanup
  let processingTimer: number | null = null;
  let confettiTimer: number | null = null;

  // Schedule a timeout with automatic cleanup on component destroy
  const _timer = window.setTimeout.bind(window);
  const scheduleTimeout = (fn: () => void, ms: number): number => _timer(fn, ms);

  // Cleanup timers on destroy
  onMount(() => {
    return () => {
      if (processingTimer !== null) window.clearTimeout(processingTimer);
      if (confettiTimer !== null) window.clearTimeout(confettiTimer);
    };
  });

  // Check if reduced motion is preferred
  let prefersReducedMotion: boolean = $state(false);

  $effect(() => {
    if (typeof window !== "undefined") {
      prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
  });

  // Type guards for option types
  function isTextOption(opt: QuizOption): opt is TextQuizOption {
    return opt.type === "text";
  }

  function isPictographOption(opt: QuizOption): opt is PictographQuizOption {
    return opt.type === "pictograph";
  }

  function isMotionPatternOption(opt: QuizOption): opt is MotionPatternQuizOption {
    return opt.type === "motion-pattern";
  }

  // Handle option selection
  function selectOption(option: QuizOption) {
    if (quizState !== "unanswered") return;

    selectedOptionId = option.id;
    quizState = "processing";

    // Brief delay for processing feel (100ms)
    processingTimer = scheduleTimeout(() => {
      processingTimer = null;
      if (option.correct) {
        quizState = "correct";
        if (!prefersReducedMotion) {
          showConfetti = true;
          confettiTimer = scheduleTimeout(() => {
            confettiTimer = null;
            showConfetti = false;
          }, 1500);
        }
      } else {
        quizState = "incorrect";
      }

      // Notify parent of quiz completion for tracking
      onQuizComplete?.(quiz.id, quiz.topic || quiz.id, option.correct);
    }, 100);
  }

  // Keyboard navigation
  function handleKeydown(event: KeyboardEvent, option: QuizOption) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectOption(option);
    }
  }

  // Get option quizState class
  function getOptionClass(option: QuizOption): string {
    if (quizState === "unanswered" || quizState === "processing") {
      return selectedOptionId === option.id ? "selected" : "";
    }

    if (option.correct) {
      return "correct";
    }

    if (selectedOptionId === option.id && !option.correct) {
      return "incorrect";
    }

    return "faded";
  }

  // Get the correct letter for feedback (for pictograph quizzes)
  function getCorrectLetterLabel(): string {
    const correct = quiz.options.find(o => o.correct);
    if (correct && isPictographOption(correct)) {
      return correct.letter;
    }
    return "";
  }
</script>

<figure class="inline-quiz" role="group" aria-labelledby="quiz-question-{quiz.id}">
  <!-- Optional pictograph context (shown above question) -->
  {#if quiz.pictograph}
    <div class="quiz-visual">
      <InlinePictograph
        pictograph={{
          type: "inline-pictograph",
          letter: quiz.pictograph.letter,
          variation: quiz.pictograph.variation,
        }}
        size={180}
      />
    </div>
  {/if}

  <!-- Question -->
  <h4 class="quiz-question" id="quiz-question-{quiz.id}">
    <span class="question-icon" aria-hidden="true">
      {#if quiz.quizType === "true-false"}
        <i class="fas fa-balance-scale"></i>
      {:else if quiz.quizType === "pick-letter" || quiz.quizType === "odd-one-out"}
        <i class="fas fa-hand-pointer"></i>
      {:else if quiz.quizType === "match-motion"}
        <i class="fas fa-arrows-alt"></i>
      {:else}
        <i class="fas fa-question-circle"></i>
      {/if}
    </span>
    {quiz.question}
  </h4>

  <!-- Options - different rendering based on displayMode -->
  {#if quiz.displayMode === "pictograph-grid"}
    <!-- Pictograph Grid Display -->
    <div
      class="quiz-pictograph-grid"
      role="radiogroup"
      aria-labelledby="quiz-question-{quiz.id}"
    >
      {#each quiz.options as option (option.id)}
        {#if isPictographOption(option)}
          <button aria-label="Letter {option.letter}"
            class="quiz-pictograph-option {getOptionClass(option)}"
            onclick={() => selectOption(option)}
            onkeydown={(e) => handleKeydown(e, option)}
            disabled={quizState !== "unanswered"}
            role="radio"
            aria-checked={selectedOptionId === option.id}
          >
            <div class="pictograph-wrapper">
              <InlinePictograph
                pictograph={{
                  type: "inline-pictograph",
                  letter: option.letter,
                  variation: option.variation,
                }}
                size={120}
              />
            </div>
            <span class="pictograph-label">{option.letter}</span>
            {#if quizState !== "unanswered"}
              <span class="option-overlay" aria-hidden="true">
                {#if option.correct}
                  <i class="fas fa-check"></i>
                {:else if selectedOptionId === option.id}
                  <i class="fas fa-times"></i>
                {/if}
              </span>
            {/if}
          </button>
        {/if}
      {/each}
    </div>

  {:else if quiz.displayMode === "motion-chips"}
    <!-- Motion Pattern Chips Display -->
    <div
      class="quiz-motion-chips"
      role="radiogroup"
      aria-labelledby="quiz-question-{quiz.id}"
    >
      {#each quiz.options as option (option.id)}
        {#if isMotionPatternOption(option)}
          <button aria-label="Blue {option.blueMotion}, Red {option.redMotion}"
            class="quiz-motion-chip {getOptionClass(option)}"
            onclick={() => selectOption(option)}
            onkeydown={(e) => handleKeydown(e, option)}
            disabled={quizState !== "unanswered"}
            role="radio"
            aria-checked={selectedOptionId === option.id}
          >
            <span class="motion-blue">
              <span class="motion-dot blue"></span>
              {option.blueMotion}
            </span>
            <span class="motion-separator">+</span>
            <span class="motion-red">
              <span class="motion-dot red"></span>
              {option.redMotion}
            </span>
            {#if quizState !== "unanswered"}
              <span class="chip-indicator" aria-hidden="true">
                {#if option.correct}
                  <i class="fas fa-check"></i>
                {:else if selectedOptionId === option.id}
                  <i class="fas fa-times"></i>
                {/if}
              </span>
            {/if}
          </button>
        {/if}
      {/each}
    </div>

  {:else}
    <!-- Text Options Display (default) -->
    <div
      class="quiz-options"
      role="radiogroup"
      aria-labelledby="quiz-question-{quiz.id}"
    >
      {#each quiz.options as option, index (option.id)}
        {#if isTextOption(option)}
          <button aria-label={option.text}
            class="quiz-option {getOptionClass(option)}"
            onclick={() => selectOption(option)}
            onkeydown={(e) => handleKeydown(e, option)}
            disabled={quizState !== "unanswered"}
            role="radio"
            aria-checked={selectedOptionId === option.id}
            aria-disabled={quizState !== "unanswered"}
          >
            <span class="option-letter" aria-hidden="true">
              {String.fromCharCode(65 + index)}
            </span>
            <span class="option-text">{option.text}</span>
            <span class="option-indicator" aria-hidden="true">
              {#if quizState !== "unanswered" && option.correct}
                <i class="fas fa-check"></i>
              {:else if quizState === "incorrect" && selectedOptionId === option.id}
                <i class="fas fa-times"></i>
              {/if}
            </span>
          </button>
        {/if}
      {/each}
    </div>
  {/if}

  <!-- Feedback -->
  {#if quizState === "correct" || quizState === "incorrect"}
    <div
      class="quiz-feedback {quizState}"
      role="status"
      aria-live="polite"
    >
      <div class="feedback-header">
        {#if quizState === "correct"}
          <span class="feedback-icon correct" aria-hidden="true">
            <i class="fas fa-check-circle"></i>
          </span>
          <span class="feedback-title">Correct!</span>
        {:else}
          <span class="feedback-icon incorrect" aria-hidden="true">
            <i class="fas fa-times-circle"></i>
          </span>
          <span class="feedback-title">Not quite</span>
        {/if}
      </div>
      <p class="feedback-message">
        {quizState === "correct" ? quiz.correctFeedback : quiz.incorrectFeedback}
      </p>
      {#if quiz.explanation && quizState === "incorrect"}
        <p class="feedback-explanation">{quiz.explanation}</p>
      {/if}
    </div>
  {/if}

  <!-- Confetti (only shown briefly on correct answer) -->
  {#if showConfetti}
    <div class="confetti-container" aria-hidden="true">
      {#each Array(8) as _, i}
        <span class="confetti" style="--delay: {i * 0.1}s; --x: {(i - 4) * 15}px;"></span>
      {/each}
    </div>
  {/if}
</figure>

<style>
  .inline-quiz {
    margin: 16px 0;
    padding: 0;
    position: relative;
    width: 100%;
  }

  .quiz-visual {
    display: flex;
    justify-content: center;
    margin-bottom: 16px;
  }

  .quiz-question {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    line-height: 1.4;
  }

  .question-icon {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-accent, #6366f1);
    font-size: 18px;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     Pictograph Grid Display
     ═══════════════════════════════════════════════════════════════════════════ */
  .quiz-pictograph-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    max-width: 320px;
    margin: 0 auto;
  }

  .quiz-pictograph-option {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .quiz-pictograph-option:hover:not(:disabled) {
    border-color: var(--theme-accent, #6366f1);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 10%, transparent);
  }

  .quiz-pictograph-option:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .quiz-pictograph-option:disabled {
    cursor: default;
  }

  .pictograph-wrapper {
    width: 120px;
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pictograph-label {
    font-size: 18px;
    font-weight: 700;
    color: var(--theme-text, #ffffff);
  }

  .option-overlay {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: white;
  }

  .quiz-pictograph-option.correct .option-overlay {
    background: var(--semantic-success, #22c55e);
  }

  .quiz-pictograph-option.incorrect .option-overlay {
    background: var(--semantic-error, #ef4444);
  }

  .quiz-pictograph-option.correct {
    border-color: var(--semantic-success, #22c55e);
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 15%, transparent);
    animation: pulse-correct 0.3s ease;
  }

  .quiz-pictograph-option.incorrect {
    border-color: var(--semantic-error, #ef4444);
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 15%, transparent);
    animation: shake 0.3s ease;
  }

  .quiz-pictograph-option.faded {
    opacity: 0.4;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     Motion Chips Display
     ═══════════════════════════════════════════════════════════════════════════ */
  .quiz-motion-chips {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .quiz-motion-chip {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: 48px;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text, #ffffff);
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .quiz-motion-chip:hover:not(:disabled) {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .quiz-motion-chip:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .quiz-motion-chip:disabled {
    cursor: default;
  }

  .motion-blue, .motion-red {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .motion-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .motion-dot.blue {
    background: var(--prop-blue, #3b82f6);
  }

  .motion-dot.red {
    background: var(--prop-red, #ef4444);
  }

  .motion-separator {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .chip-indicator {
    position: absolute;
    right: 12px;
    font-size: 16px;
  }

  .quiz-motion-chip.correct {
    border-color: var(--semantic-success, #22c55e);
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 15%, transparent);
    animation: pulse-correct 0.3s ease;
  }

  .quiz-motion-chip.correct .chip-indicator {
    color: var(--semantic-success, #22c55e);
  }

  .quiz-motion-chip.incorrect {
    border-color: var(--semantic-error, #ef4444);
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 15%, transparent);
    animation: shake 0.3s ease;
  }

  .quiz-motion-chip.incorrect .chip-indicator {
    color: var(--semantic-error, #ef4444);
  }

  .quiz-motion-chip.faded {
    opacity: 0.5;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     Text Options Display
     ═══════════════════════════════════════════════════════════════════════════ */
  .quiz-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .quiz-option {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 48px;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text, #ffffff);
    font-size: 15px;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .quiz-option:hover:not(:disabled) {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .quiz-option:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .quiz-option:disabled {
    cursor: default;
  }

  .option-letter {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border-radius: 6px;
    font-weight: 700;
    font-size: 13px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .option-text {
    flex: 1;
  }

  .option-indicator {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }

  .quiz-option.selected {
    border-color: var(--theme-accent, #6366f1);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 10%, transparent);
  }

  .quiz-option.correct {
    border-color: var(--semantic-success, #22c55e);
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 15%, transparent);
    animation: pulse-correct 0.3s ease;
  }

  .quiz-option.correct .option-letter {
    background: var(--semantic-success, #22c55e);
    color: white;
  }

  .quiz-option.correct .option-indicator {
    color: var(--semantic-success, #22c55e);
  }

  .quiz-option.incorrect {
    border-color: var(--semantic-error, #ef4444);
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 15%, transparent);
    animation: shake 0.3s ease;
  }

  .quiz-option.incorrect .option-letter {
    background: var(--semantic-error, #ef4444);
    color: white;
  }

  .quiz-option.incorrect .option-indicator {
    color: var(--semantic-error, #ef4444);
  }

  .quiz-option.faded {
    opacity: 0.5;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     Feedback Section
     ═══════════════════════════════════════════════════════════════════════════ */
  .quiz-feedback {
    margin-top: 16px;
    padding: 14px 16px;
    border-radius: 10px;
    animation: fadeIn 0.3s ease;
  }

  .quiz-feedback.correct {
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-success, #22c55e) 30%, transparent);
  }

  .quiz-feedback.incorrect {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
  }

  .feedback-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .feedback-icon {
    font-size: 20px;
  }

  .feedback-icon.correct {
    color: var(--semantic-success, #22c55e);
  }

  .feedback-icon.incorrect {
    color: var(--semantic-error, #ef4444);
  }

  .feedback-title {
    font-weight: 700;
    font-size: 15px;
    color: var(--theme-text, #ffffff);
  }

  .feedback-message {
    margin: 0;
    font-size: 14px;
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    line-height: 1.5;
  }

  .feedback-explanation {
    margin: 10px 0 0 0;
    padding-top: 10px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    font-size: 13px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    line-height: 1.5;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     Confetti Animation
     ═══════════════════════════════════════════════════════════════════════════ */
  .confetti-container {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .confetti {
    position: absolute;
    width: 10px;
    height: 10px;
    border-radius: 2px;
    animation: confetti-fall 1s ease-out forwards;
    animation-delay: var(--delay);
  }

  .confetti:nth-child(1) { background: var(--semantic-success, #22c55e); }
  .confetti:nth-child(2) { background: var(--theme-accent, #6366f1); }
  .confetti:nth-child(3) { background: var(--semantic-warning, #f59e0b); }
  .confetti:nth-child(4) { background: var(--semantic-error, #ec4899); }
  .confetti:nth-child(5) { background: var(--semantic-success, #22c55e); }
  .confetti:nth-child(6) { background: var(--theme-accent, #6366f1); }
  .confetti:nth-child(7) { background: var(--semantic-warning, #f59e0b); }
  .confetti:nth-child(8) { background: var(--semantic-error, #ec4899); }

  /* ═══════════════════════════════════════════════════════════════════════════
     Animations
     ═══════════════════════════════════════════════════════════════════════════ */
  @keyframes pulse-correct {
    0% { transform: scale(1); }
    50% { transform: scale(1.02); }
    100% { transform: scale(1); }
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-3px); }
    75% { transform: translateX(3px); }
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes confetti-fall {
    0% {
      transform: translate(var(--x), 0) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: translate(calc(var(--x) * 2), 80px) rotate(720deg);
      opacity: 0;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     Reduced Motion
     ═══════════════════════════════════════════════════════════════════════════ */
  @media (prefers-reduced-motion: reduce) {
    .quiz-option,
    .quiz-pictograph-option,
    .quiz-motion-chip,
    .quiz-feedback {
      animation: none;
      transition: none;
    }

    .confetti {
      display: none;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     Mobile Adjustments
     ═══════════════════════════════════════════════════════════════════════════ */
  @media (max-width: 480px) {
    .quiz-pictograph-grid {
      max-width: 280px;
    }

    .pictograph-wrapper {
      width: 100px;
      height: 100px;
    }

    .quiz-option {
      padding: 10px 14px;
    }

    .option-letter {
      width: 26px;
      height: 26px;
      font-size: 12px;
    }

    .quiz-question {
      font-size: 15px;
    }
  }
</style>
