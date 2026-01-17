<!--
  Admin Quiz Testing Page
  Navigate to /test/learn-quizzes to directly test any quiz component
-->
<script lang="ts">
  // Main quiz components
  import PictographToLetterQuiz from "$lib/features/learn/quiz/components/PictographToLetterQuiz.svelte";
  import LetterToPictographQuiz from "$lib/features/learn/quiz/components/LetterToPictographQuiz.svelte";
  import ValidNextPictographQuiz from "$lib/features/learn/quiz/components/ValidNextPictographQuiz.svelte";

  // Interactive concept quizzes
  import GridIdentificationQuiz from "$lib/features/learn/components/interactive/GridIdentificationQuiz.svelte";
  import GridPointTapQuiz from "$lib/features/learn/components/interactive/GridPointTapQuiz.svelte";
  import Type1LetterQuiz from "$lib/features/learn/components/interactive/letters/type1/Type1LetterQuiz.svelte";
  import StaffIdentificationQuiz from "$lib/features/learn/components/interactive/staff/StaffIdentificationQuiz.svelte";
  import PositionIdentificationQuiz from "$lib/features/learn/components/interactive/positions/PositionIdentificationQuiz.svelte";
  import MotionIdentificationQuiz from "$lib/features/learn/components/interactive/motions/MotionIdentificationQuiz.svelte";
  import VTGQuiz from "$lib/features/learn/components/interactive/vtg/VTGQuiz.svelte";
  import WordBuildingQuiz from "$lib/features/learn/components/interactive/words/WordBuildingQuiz.svelte";

  // Full concept experiences
  import GridConceptExperience from "$lib/features/learn/components/interactive/GridConceptExperience.svelte";
  import VTGConceptExperience from "$lib/features/learn/components/interactive/vtg/VTGConceptExperience.svelte";
  import MotionsConceptExperience from "$lib/features/learn/components/interactive/motions/MotionsConceptExperience.svelte";
  import PositionsConceptExperience from "$lib/features/learn/components/interactive/positions/PositionsConceptExperience.svelte";
  import StaffConceptExperience from "$lib/features/learn/components/interactive/staff/StaffConceptExperience.svelte";
  import WordsConceptExperience from "$lib/features/learn/components/interactive/words/WordsConceptExperience.svelte";
  import Type1ConceptExperience from "$lib/features/learn/components/interactive/letters/type1/Type1ConceptExperience.svelte";

  type QuizItem = {
    id: string;
    name: string;
    category: "play" | "concept-quiz" | "concept-experience";
    component: any;
  };

  const quizItems: QuizItem[] = [
    // Play mode quizzes
    {
      id: "pictograph-to-letter",
      name: "Pictograph → Letter",
      category: "play",
      component: PictographToLetterQuiz,
    },
    {
      id: "letter-to-pictograph",
      name: "Letter → Pictograph",
      category: "play",
      component: LetterToPictographQuiz,
    },
    {
      id: "valid-next",
      name: "Valid Next Pictograph",
      category: "play",
      component: ValidNextPictographQuiz,
    },
    // Concept quizzes (standalone)
    {
      id: "grid-identification",
      name: "Grid Identification",
      category: "concept-quiz",
      component: GridIdentificationQuiz,
    },
    {
      id: "grid-point-tap",
      name: "Grid Point Tap",
      category: "concept-quiz",
      component: GridPointTapQuiz,
    },
    {
      id: "type1-letter",
      name: "Type 1 Letter Quiz",
      category: "concept-quiz",
      component: Type1LetterQuiz,
    },
    {
      id: "staff-identification",
      name: "Staff Identification",
      category: "concept-quiz",
      component: StaffIdentificationQuiz,
    },
    {
      id: "position-identification",
      name: "Position Identification",
      category: "concept-quiz",
      component: PositionIdentificationQuiz,
    },
    {
      id: "motion-identification",
      name: "Motion Identification",
      category: "concept-quiz",
      component: MotionIdentificationQuiz,
    },
    {
      id: "vtg-quiz",
      name: "VTG Quiz",
      category: "concept-quiz",
      component: VTGQuiz,
    },
    {
      id: "word-building",
      name: "Word Building Quiz",
      category: "concept-quiz",
      component: WordBuildingQuiz,
    },
    // Full concept experiences
    {
      id: "grid-experience",
      name: "Grid Experience",
      category: "concept-experience",
      component: GridConceptExperience,
    },
    {
      id: "vtg-experience",
      name: "VTG Experience",
      category: "concept-experience",
      component: VTGConceptExperience,
    },
    {
      id: "motions-experience",
      name: "Motions Experience",
      category: "concept-experience",
      component: MotionsConceptExperience,
    },
    {
      id: "positions-experience",
      name: "Positions Experience",
      category: "concept-experience",
      component: PositionsConceptExperience,
    },
    {
      id: "staff-experience",
      name: "Staff Experience",
      category: "concept-experience",
      component: StaffConceptExperience,
    },
    {
      id: "words-experience",
      name: "Words Experience",
      category: "concept-experience",
      component: WordsConceptExperience,
    },
    {
      id: "type1-experience",
      name: "Type 1 Experience",
      category: "concept-experience",
      component: Type1ConceptExperience,
    },
  ];

  let selectedQuiz = $state<QuizItem | null>(null);
  let completionMessage = $state<string | null>(null);

  function selectQuiz(item: QuizItem) {
    selectedQuiz = item;
    completionMessage = null;
  }

  function handleComplete() {
    completionMessage = `✅ "${selectedQuiz?.name}" completed!`;
  }

  function handleBack() {
    selectedQuiz = null;
    completionMessage = null;
  }

  const playQuizzes = $derived(quizItems.filter((q) => q.category === "play"));
  const conceptQuizzes = $derived(
    quizItems.filter((q) => q.category === "concept-quiz")
  );
  const conceptExperiences = $derived(
    quizItems.filter((q) => q.category === "concept-experience")
  );
</script>

<div class="quiz-tester">
  {#if selectedQuiz}
    <div class="quiz-container">
      <button class="back-btn" onclick={handleBack}> ← Back to List </button>
      <h2 class="quiz-title">{selectedQuiz.name}</h2>

      {#if completionMessage}
        <div class="completion-banner">
          {completionMessage}
          <button
            class="retry-btn"
            onclick={() => {
              completionMessage = null;
            }}
          >
            Retry
          </button>
        </div>
      {:else}
        {@const QuizComponent = selectedQuiz.component}
        <div class="quiz-wrapper">
          <QuizComponent onComplete={handleComplete} onBack={handleBack} />
        </div>
      {/if}
    </div>
  {:else}
    <div class="selector">
      <h1>Quiz Testing Panel</h1>
      <p class="subtitle">Admin tool to test all quiz components directly</p>

      <section class="category">
        <h2>Play Mode Quizzes</h2>
        <p class="category-desc">Main quiz games accessible from "Play" tab</p>
        <div class="quiz-grid">
          {#each playQuizzes as quiz}
            <button class="quiz-card play" onclick={() => selectQuiz(quiz)}>
              {quiz.name}
            </button>
          {/each}
        </div>
      </section>

      <section class="category">
        <h2>Concept Quizzes (Standalone)</h2>
        <p class="category-desc">Embedded quizzes from concept lessons</p>
        <div class="quiz-grid">
          {#each conceptQuizzes as quiz}
            <button class="quiz-card concept" onclick={() => selectQuiz(quiz)}>
              {quiz.name}
            </button>
          {/each}
        </div>
      </section>

      <section class="category">
        <h2>Full Concept Experiences</h2>
        <p class="category-desc">
          Complete lesson flows (intro → content → quiz)
        </p>
        <div class="quiz-grid">
          {#each conceptExperiences as quiz}
            <button
              class="quiz-card experience"
              onclick={() => selectQuiz(quiz)}
            >
              {quiz.name}
            </button>
          {/each}
        </div>
      </section>
    </div>
  {/if}
</div>

<style>
  .quiz-tester {
    min-height: 100vh;
    background: #0a0a0f;
    color: white;
    padding: 2rem;
  }

  .selector {
    max-width: 1000px;
    margin: 0 auto;
  }

  h1 {
    font-size: 2rem;
    font-weight: 800;
    margin: 0 0 0.5rem 0;
  }

  .subtitle {
    color: var(--theme-text-dim);
    margin: 0 0 2rem 0;
  }

  .category {
    margin-bottom: 2rem;
  }

  .category h2 {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0 0 0.25rem 0;
  }

  .category-desc {
    font-size: 0.875rem;
    color: var(--theme-text-dim);
    margin: 0 0 1rem 0;
  }

  .quiz-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.75rem;
  }

  .quiz-card {
    padding: 1rem;
    border-radius: 10px;
    border: 1px solid var(--theme-stroke-strong);
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    text-align: left;
  }

  .quiz-card:hover {
    transform: translateY(-2px);
  }

  .quiz-card.play {
    background: rgba(34, 211, 238, 0.15);
    border-color: rgba(34, 211, 238, 0.3);
    color: #22d3ee;
  }
  .quiz-card.play:hover {
    background: rgba(34, 211, 238, 0.25);
  }

  .quiz-card.concept {
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(168, 85, 247, 0.3);
    color: #a855f7;
  }
  .quiz-card.concept:hover {
    background: rgba(168, 85, 247, 0.25);
  }

  .quiz-card.experience {
    background: rgba(74, 222, 128, 0.15);
    border-color: rgba(74, 222, 128, 0.3);
    color: #4ade80;
  }
  .quiz-card.experience:hover {
    background: rgba(74, 222, 128, 0.25);
  }

  /* Quiz container */
  .quiz-container {
    max-width: 900px;
    margin: 0 auto;
  }

  .back-btn {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 8px;
    padding: 0.5rem 1rem;
    color: white;
    font-weight: 600;
    cursor: pointer;
    margin-bottom: 1rem;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .quiz-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0 0 1.5rem 0;
  }

  .quiz-wrapper {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--theme-stroke);
    border-radius: 16px;
    padding: 1.5rem;
    min-height: 400px;
  }

  .completion-banner {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.5rem;
    background: rgba(74, 222, 128, 0.15);
    border: 1px solid rgba(74, 222, 128, 0.3);
    border-radius: 12px;
    color: #4ade80;
    font-weight: 600;
    font-size: 1.125rem;
  }

  .retry-btn {
    margin-left: auto;
    background: rgba(74, 222, 128, 0.2);
    border: 1px solid rgba(74, 222, 128, 0.4);
    border-radius: 6px;
    padding: 0.5rem 1rem;
    color: #4ade80;
    font-weight: 600;
    cursor: pointer;
  }

  .retry-btn:hover {
    background: rgba(74, 222, 128, 0.3);
  }
</style>
