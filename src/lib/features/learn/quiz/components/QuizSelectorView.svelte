<!--
PlaySelectorView - Game selection interface

A fun, engaging layout for selecting game type and mode.
Features a welcoming header, mode toggle, and game cards.
-->
<script lang="ts">
  import { LESSON_INFO } from "../domain/constants/quiz-constants";
  import { QuizMode, QuizType } from "../domain/enums/quiz-enums";
  import LessonButton from "./LessonButton.svelte";
  import LessonModeToggle from "./QuizModeToggle.svelte";

  // Props
  let {
    selectedMode = $bindable(QuizMode.FIXED_QUESTION),
    availableQuizzes = Object.values(QuizType),
    isLoading = false,
    onQuizSelect,
    onQuizRequested,
    onModeChanged,
  } = $props<{
    selectedMode?: QuizMode;
    availableQuizzes?: QuizType[];
    isLoading?: boolean;
    onQuizSelect?: (data: { quizType: QuizType; quizMode: QuizMode }) => void;
    onQuizRequested?: (data: {
      quizType: QuizType;
      quizMode: QuizMode;
    }) => void;
    onModeChanged?: (mode: QuizMode) => void;
  }>();

  // Handle mode change
  function handleModeChanged(mode: QuizMode) {
    selectedMode = mode;
    onModeChanged?.(selectedMode);
  }

  // Handle quiz selection
  function handleQuizClicked(quizType: QuizType) {
    const data = { quizType, quizMode: selectedMode };
    onQuizSelect?.(data);
    onQuizRequested?.(data);
  }

  // Check if quiz is available
  function isQuizAvailable(quizType: QuizType): boolean {
    return availableQuizzes.includes(quizType);
  }
</script>

<div class="quiz-selector">
  <!-- Header Section -->
  <header class="header-section">
    <div class="header-icon">
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <!-- Play/Game controller icon -->
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    </div>
    <h1 class="header-title">Let's Play!</h1>
    <p class="header-subtitle">Pick a game to test your skills</p>
  </header>

  <!-- Mode Toggle Section -->
  <section class="mode-section">
    <LessonModeToggle
      bind:selectedMode
      disabled={isLoading}
      onModeChanged={handleModeChanged}
    />
  </section>

  <!-- Games Section -->
  <section class="quizzes-section">
    <h2 class="section-label">Pick a Game</h2>
    <div class="quiz-cards">
      {#each LESSON_INFO as quiz}
        <LessonButton
          text={quiz.name}
          lessonType={quiz.lessonType}
          description={quiz.description}
          disabled={isLoading || !isQuizAvailable(quiz.lessonType)}
          onClicked={handleQuizClicked}
        />
      {/each}
    </div>
  </section>
</div>

<style>
  .quiz-selector {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    width: 100%;
    padding: var(--spacing-xl) var(--spacing-lg);
    gap: var(--spacing-xl);
    overflow-y: auto;
    overflow-x: hidden;

    /* Enable smooth scrolling */
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
  }

  /* Header Section */
  .header-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
    padding: var(--spacing-md) 0;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent) 25%, transparent),
      color-mix(in srgb, var(--theme-accent) 20%, transparent)
    );
    border-radius: 18px;
    color: var(--theme-text);
    margin-bottom: 8px;
    border: 1px solid color-mix(in srgb, var(--theme-accent) 30%, transparent);
    box-shadow:
      0 4px 16px color-mix(in srgb, var(--theme-accent) 20%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .header-title {
    margin: 0;
    font-family: var(
      --font-sans,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif
    );
    font-size: 2rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  .header-subtitle {
    margin: 0;
    font-family: var(
      --font-sans,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif
    );
    font-size: 1rem;
    color: var(--theme-text-dim);
    font-weight: 400;
  }

  /* Mode Section */
  .mode-section {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 440px;
  }

  /* Quizzes Section */
  .quizzes-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md);
    width: 100%;
    max-width: 440px;
    flex: 1;
  }

  .section-label {
    margin: 0;
    font-family: var(
      --font-sans,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif
    );
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.75); /* WCAG AAA */
    align-self: flex-start;
    padding-left: 4px;
  }

  .quiz-cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .quiz-selector {
      padding: var(--spacing-lg) var(--spacing-md);
      gap: var(--spacing-lg);
    }

    .header-icon {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      border-radius: 16px;
    }

    .header-icon svg {
      width: 30px;
      height: 30px;
    }

    .header-title {
      font-size: 1.75rem;
    }

    .header-subtitle {
      font-size: 0.9375rem;
    }
  }

  @media (max-width: 480px) {
    .quiz-selector {
      padding: var(--spacing-md) var(--spacing-sm);
      gap: var(--spacing-md);
    }

    .header-section {
      padding: var(--spacing-sm) 0;
    }

    .header-icon {
      width: var(--min-touch-target);
      height: var(--min-touch-target);
      border-radius: 14px;
    }

    .header-icon svg {
      width: 26px;
      height: 26px;
    }

    .header-title {
      font-size: 1.5rem;
    }

    .header-subtitle {
      font-size: 0.875rem;
    }

    .section-label {
      font-size: 0.6875rem;
    }

    .quiz-cards {
      gap: 10px;
    }
  }

  @media (max-width: 360px) {
    .quiz-selector {
      padding: var(--spacing-sm);
      gap: var(--spacing-sm);
    }

    .header-title {
      font-size: 1.375rem;
    }

    .header-subtitle {
      font-size: 0.8125rem;
    }

    .quiz-cards {
      gap: 8px;
    }
  }

  /* Custom scrollbar */
  .quiz-selector::-webkit-scrollbar {
    width: 6px;
  }

  .quiz-selector::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  .quiz-selector::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 3px;
  }

  .quiz-selector::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }
</style>
