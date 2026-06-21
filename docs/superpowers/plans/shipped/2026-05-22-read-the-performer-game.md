# Read the Performer (Quiz 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4th game to the Learn module where a 3D performer plays a TKA sequence and the player guesses the correct 4-letter word from 4 multiple-choice options.

**Architecture:** New game plugs into the existing quiz system (QuizType enum → constants → QuizWorkspaceView routing → game component). Data comes from Firestore decks (L1/rotated/quartered/16-count) instead of CSV pictographs. 3D performer uses createAvatarInstanceState + PerformerRig inside a self-contained Threlte Canvas.

**Tech Stack:** Svelte 5, Threlte, @austencloud/scene-3d (PerformerRig), Firestore (deck-loader)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/features/learn/quiz/services/sequence-question-generator.ts` | Load deck sequences, generate questions with distractors |
| Create | `src/lib/features/learn/quiz/components/SequenceToWordQuiz.svelte` | Main game component — layout, answer handling, feedback |
| Create | `src/lib/features/learn/quiz/components/shared/QuizPerformerStage.svelte` | Self-contained Threlte Canvas with PerformerRig |
| Create | `src/lib/features/learn/quiz/components/shared/QuizWordButton.svelte` | Answer button for multi-letter TKA words |
| Modify | `src/lib/features/learn/quiz/domain/enums/quiz-enums.ts` | Add SEQUENCE_TO_WORD, SEQUENCE_3D, WORD_BUTTON |
| Modify | `src/lib/features/learn/quiz/domain/constants/quiz-constants.ts` | Add lesson config + info + display name |
| Modify | `src/lib/features/learn/quiz/services/quiz-configurator.ts` | Add switch cases for quiz 4 |
| Modify | `src/lib/features/learn/quiz/services/question-generator.ts` | Delegate SEQUENCE_TO_WORD to new generator |
| Modify | `src/lib/features/learn/quiz/components/QuizWorkspaceView.svelte` | Add routing branch |
| Modify | `src/lib/features/learn/quiz/components/LessonButton.svelte` | Add icon + title for game 4 |

---

### Task 1: Enum & Constant Registration

**Files:**
- Modify: `src/lib/features/learn/quiz/domain/enums/quiz-enums.ts`
- Modify: `src/lib/features/learn/quiz/domain/constants/quiz-constants.ts`

- [ ] **Step 1: Add enum values to quiz-enums.ts**

Add `SEQUENCE_TO_WORD` to `QuizType`, `SEQUENCE_3D` to `QuizQuestionFormat`, and `WORD_BUTTON` to `QuizAnswerFormat`:

```typescript
// In QuizType enum, after VALID_NEXT_PICTOGRAPH:
SEQUENCE_TO_WORD = "sequence_to_word",

// In QuizQuestionFormat enum, after TEXT:
SEQUENCE_3D = "sequence_3d",

// In QuizAnswerFormat enum, after PICTOGRAPH:
WORD_BUTTON = "word_button",
```

- [ ] **Step 2: Add lesson config and info to quiz-constants.ts**

Add to `LESSON_CONFIGS` record:

```typescript
[QuizType.SEQUENCE_TO_WORD]: {
  type: "sequence_to_word",
  difficulty: "intermediate",
  lessonType: QuizType.SEQUENCE_TO_WORD,
  questionFormat: QuizQuestionFormat.SEQUENCE_3D,
  answerFormat: QuizAnswerFormat.WORD_BUTTON,
  quizDescription: "sequence_to_word",
  questionPrompt: "What word is being performed?",
},
```

Add to `LESSON_INFO` array:

```typescript
{
  id: "lesson-4",
  name: "Quiz 4",
  description: "Watch the 3D performer and identify the word",
  lessonType: QuizType.SEQUENCE_TO_WORD,
},
```

Add to `LESSON_TYPE_NAMES` record:

```typescript
[QuizType.SEQUENCE_TO_WORD]: "Read the Performer",
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors from the enum/constant additions. Existing switch statements that exhaustively check QuizType may now warn — that's expected and will be fixed in Task 2.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/learn/quiz/domain/enums/quiz-enums.ts src/lib/features/learn/quiz/domain/constants/quiz-constants.ts
git commit -m "feat(learn): register QuizType.SEQUENCE_TO_WORD enums and constants"
```

---

### Task 2: Quiz Configurator Updates

**Files:**
- Modify: `src/lib/features/learn/quiz/services/quiz-configurator.ts`

- [ ] **Step 1: Add SEQUENCE_TO_WORD cases to all switch statements**

In `getQuizNumber()`:
```typescript
case QuizType.SEQUENCE_TO_WORD:
  return 4;
```

In `getQuizTypeFromNumber()`:
```typescript
case 4:
  return QuizType.SEQUENCE_TO_WORD;
```

In `getDifficultyLevel()`:
```typescript
case QuizType.SEQUENCE_TO_WORD:
  return 3;
```

In `getRecommendedQuizMode()`:
```typescript
case QuizType.SEQUENCE_TO_WORD:
  return QuizMode.FIXED_QUESTION;
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: Clean pass — all switch statements now handle the new enum value.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/learn/quiz/services/quiz-configurator.ts
git commit -m "feat(learn): add SEQUENCE_TO_WORD cases to quiz configurator"
```

---

### Task 3: Sequence Question Generator

**Files:**
- Create: `src/lib/features/learn/quiz/services/sequence-question-generator.ts`
- Modify: `src/lib/features/learn/quiz/services/question-generator.ts`

- [ ] **Step 1: Create sequence-question-generator.ts**

```typescript
import type { Deck } from "$lib/features/choreo-card/domain/models/Deck";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { loadDecks, loadDeckSequences } from "$lib/features/choreo-card/services/deck-loader";
import { QuizAnswerFormat, QuizQuestionFormat, QuizType } from "../domain/enums/quiz-enums";
import type { QuizAnswerOption, QuizQuestionData } from "../domain/models/quiz-models";

let sequencePool: SequenceData[] = [];
let isInitialized = false;
const recentWords: string[] = [];
const RECENT_WORD_HISTORY = 5;

export async function initialize(): Promise<void> {
  if (isInitialized) return;

  const allDecks = await loadDecks();
  const matchingDecks = allDecks.filter(
    (d: Deck) =>
      d.level === 1 &&
      d.loopType === "rotated" &&
      d.sliceType === "quartered" &&
      d.stepCount === 16
  );

  if (matchingDecks.length === 0) {
    throw new Error("No L1 rotated quartered 16-count decks found");
  }

  const allSequences: SequenceData[] = [];
  for (const deck of matchingDecks) {
    const seqs = await loadDeckSequences(deck.id);
    allSequences.push(...seqs);
  }

  sequencePool = allSequences.filter((s) => s.word && s.word.length > 0);

  if (sequencePool.length < 4) {
    throw new Error(
      `Need at least 4 sequences with distinct words, found ${sequencePool.length}`
    );
  }

  isInitialized = true;
}

export async function generateSequenceToWordQuestion(
  questionId: string
): Promise<QuizQuestionData> {
  if (!isInitialized) {
    await initialize();
  }

  const correctSequence = pickRandomSequence();
  const correctWord = correctSequence.word;

  const distractorWords = pickDistractorWords(correctWord, 3);

  const allWords = [correctWord, ...distractorWords];
  shuffleArray(allWords);

  const answerOptions: QuizAnswerOption[] = allWords.map((word) => ({
    id: generateOptionId(),
    content: word,
    isCorrect: word === correctWord,
  }));

  trackRecentWord(correctWord);

  return {
    questionId,
    questionContent: correctSequence,
    answerOptions,
    correctAnswer: correctWord,
    questionType: QuizQuestionFormat.SEQUENCE_3D,
    answerType: QuizAnswerFormat.WORD_BUTTON,
    lessonType: QuizType.SEQUENCE_TO_WORD,
    generationTimestamp: new Date().toISOString(),
  };
}

export function resetState(): void {
  recentWords.length = 0;
}

function pickRandomSequence(): SequenceData {
  let candidates = sequencePool.filter(
    (s) => !recentWords.includes(s.word)
  );

  if (candidates.length < 4) {
    candidates = sequencePool;
    recentWords.length = 0;
  }

  return candidates[Math.floor(Math.random() * candidates.length)]!;
}

function pickDistractorWords(correctWord: string, count: number): string[] {
  const uniqueWords = [
    ...new Set(sequencePool.map((s) => s.word).filter((w) => w !== correctWord)),
  ];

  shuffleArray(uniqueWords);
  return uniqueWords.slice(0, count);
}

function trackRecentWord(word: string): void {
  recentWords.push(word);
  if (recentWords.length > RECENT_WORD_HISTORY) {
    recentWords.shift();
  }
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
}

function generateOptionId(): string {
  return `opt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
```

- [ ] **Step 2: Add delegation in question-generator.ts**

At the top of `question-generator.ts`, add the import:

```typescript
import * as SequenceQuestionGenerator from "./sequence-question-generator";
```

In the `generateQuestion()` function's switch statement, add:

```typescript
case QuizType.SEQUENCE_TO_WORD:
  return SequenceQuestionGenerator.generateSequenceToWordQuestion(questionId);
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: Clean pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/learn/quiz/services/sequence-question-generator.ts src/lib/features/learn/quiz/services/question-generator.ts
git commit -m "feat(learn): sequence question generator for Read the Performer"
```

---

### Task 4: QuizWordButton Component

**Files:**
- Create: `src/lib/features/learn/quiz/components/shared/QuizWordButton.svelte`

- [ ] **Step 1: Create QuizWordButton.svelte**

Based on `QuizLetterButton.svelte` pattern but adapted for multi-character TKA words — wider rectangular shape instead of square, monospace font with letter-spacing for readability:

```svelte
<script lang="ts">
  let {
    word,
    state,
    disabled,
    onclick,
  }: {
    word: string;
    state: "default" | "correct" | "incorrect" | "dimmed";
    disabled: boolean;
    onclick: () => void;
  } = $props();
</script>

<button
  class="word-btn"
  class:correct={state === "correct"}
  class:incorrect={state === "incorrect"}
  class:dimmed={state === "dimmed"}
  {onclick}
  {disabled}
  aria-label="Answer: {word}"
>
  <span class="word-text">{word}</span>
  {#if state === "correct"}
    <span class="result-icon correct-icon">✓</span>
  {:else if state === "incorrect"}
    <span class="result-icon incorrect-icon">✗</span>
  {/if}
</button>

<style>
  .word-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 0.875rem 1.25rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 14px;
    cursor: pointer;
    transition: all var(--duration-normal) cubic-bezier(0.16, 1, 0.3, 1);
  }

  .word-btn:hover:not(:disabled) {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    transform: translateY(-3px);
    box-shadow: 0 8px 24px color-mix(in srgb, var(--theme-accent) 20%, transparent);
  }

  .word-btn:active:not(:disabled) {
    transform: translateY(-1px) scale(0.98);
  }

  .word-text {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--theme-text, #ffffff);
    font-family: "JetBrains Mono", "Fira Code", "SF Mono", monospace;
    letter-spacing: 0.15em;
    text-shadow: 0 2px 8px color-mix(in srgb, var(--theme-panel-bg) 60%, transparent);
  }

  .word-btn.correct {
    background: color-mix(in srgb, var(--semantic-success) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success) 60%, transparent);
    animation: correctPulse 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes correctPulse {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--semantic-success) 40%, transparent);
    }
    50% {
      transform: scale(1.02);
      box-shadow: 0 0 0 10px transparent;
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 transparent;
    }
  }

  .word-btn.incorrect {
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error) 60%, transparent);
    animation: incorrectShake var(--duration-dramatic) ease-out;
  }

  @keyframes incorrectShake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-5px); }
    40%, 80% { transform: translateX(5px); }
  }

  .word-btn.dimmed {
    opacity: 0.35;
    cursor: default;
  }

  .word-btn:disabled {
    cursor: default;
  }

  .result-icon {
    position: absolute;
    top: 8px;
    right: 10px;
    font-size: 0.9rem;
    font-weight: bold;
    animation: iconPop var(--duration-emphasis) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes iconPop {
    from { transform: scale(0); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .correct-icon { color: var(--semantic-success); }
  .incorrect-icon { color: var(--semantic-error); }

  @media (min-width: 600px) {
    .word-btn {
      padding: 1rem 1.5rem;
      border-radius: 16px;
    }
    .word-text { font-size: 1.75rem; }
  }

  @media (min-width: 900px) {
    .word-btn {
      padding: 1.125rem 1.75rem;
      border-radius: 18px;
    }
    .word-text { font-size: 2rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    .word-btn.correct, .word-btn.incorrect, .result-icon {
      animation: none;
    }
    .word-btn {
      transition: background 0.15s ease, border-color 0.15s ease;
    }
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: Clean pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/learn/quiz/components/shared/QuizWordButton.svelte
git commit -m "feat(learn): QuizWordButton component for TKA word answers"
```

---

### Task 5: QuizPerformerStage Component

**Files:**
- Create: `src/lib/features/learn/quiz/components/shared/QuizPerformerStage.svelte`

- [ ] **Step 1: Create QuizPerformerStage.svelte**

Self-contained Threlte Canvas with a single PerformerRig. Follows MuseumPerformerStation3D pattern for avatar creation, but wraps its own Canvas:

```svelte
<script lang="ts">
  import { Canvas, T } from "@threlte/core";
  import { untrack, onDestroy } from "svelte";
  import { PerformerRig, Plane, PlaneMode, userProportionsState } from "@austencloud/scene-3d";
  import type { GridMode } from "@austencloud/scene-3d";
  import { OrbitControls } from "@threlte/extras";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import {
    createAvatarInstanceState,
    makeStandaloneDeps,
  } from "$lib/shared/3d/state/avatar-instance-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  let { sequence }: { sequence: SequenceData | null } = $props();

  const PLATFORM_HEIGHT = 0.2;
  const groundOffset = $derived(-userProportionsState.groundY + PLATFORM_HEIGHT);

  let performerState = $state<ReturnType<typeof createAvatarInstanceState> | null>(null);

  try {
    performerState = createAvatarInstanceState(
      { id: "quiz-performer", positionX: 0, positionZ: 0 },
      makeStandaloneDeps()
    );
  } catch (err) {
    console.warn("[QuizPerformerStage] Failed to init:", err);
  }

  $effect(() => {
    const seq = sequence;
    untrack(() => {
      if (!seq || !performerState) return;
      performerState.loadSequence(seq);
      performerState.loop = true;
      performerState.play();
    });
  });

  onDestroy(() => {
    if (performerState) {
      performerState.stop();
      performerState.destroy();
    }
  });
</script>

<div class="stage-container">
  <Canvas>
    <T.AmbientLight intensity={0.5} />
    <T.DirectionalLight position={[3, 8, 5]} intensity={2} castShadow />

    <T.PerspectiveCamera makeDefault position={[0, 2.5, 5]} fov={40}>
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
        autoRotate={false}
        target={[0, 1.2, 0]}
      />
    </T.PerspectiveCamera>

    <!-- Subtle platform disc -->
    <T.Mesh position.y={PLATFORM_HEIGHT / 2} receiveShadow>
      <T.CylinderGeometry args={[0.7, 0.8, PLATFORM_HEIGHT, 24]} />
      <T.MeshStandardMaterial
        color="#2a2520"
        roughness={0.85}
      />
    </T.Mesh>

    {#if performerState}
      <PerformerRig
        position={{ x: 0, z: 0 }}
        facingAngle={0}
        planeMode={PlaneMode.WALL}
        avatarState={performerState}
        showGrid={false}
        visiblePlanes={new Set([Plane.WALL])}
        gridMode={((sequence?.gridMode ?? "diamond") as GridMode)}
        bluePropType={PropType.STAFF}
        redPropType={PropType.STAFF}
        {groundOffset}
        enableLocomotion={true}
        enableFootPlanting={true}
      />
    {/if}
  </Canvas>
</div>

<style>
  .stage-container {
    width: 100%;
    height: 100%;
    min-height: 200px;
    border-radius: 16px;
    overflow: hidden;
    background: radial-gradient(
      ellipse at 50% 80%,
      color-mix(in srgb, var(--theme-panel-bg) 95%, var(--theme-accent)),
      var(--theme-panel-bg)
    );
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: Clean pass. If OrbitControls import differs, check `@threlte/extras` exports.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/learn/quiz/components/shared/QuizPerformerStage.svelte
git commit -m "feat(learn): QuizPerformerStage — standalone 3D performer for quizzes"
```

---

### Task 6: SequenceToWordQuiz Game Component

**Files:**
- Create: `src/lib/features/learn/quiz/components/SequenceToWordQuiz.svelte`

- [ ] **Step 1: Create SequenceToWordQuiz.svelte**

Main game component following PictographToLetterQuiz pattern exactly — same state management, feedback, streak, gap detection, haptics:

```svelte
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import { detectSingleError } from "$lib/features/learn/services/gap-detector";
  import type { HapticFeedback } from "$lib/shared/application/services/implementations/HapticFeedback";
  import { onDestroy, onMount } from "svelte";
  import * as QuestionGenerator from "../services/question-generator";
  import { QuizType } from "../domain/enums/quiz-enums";
  import type { QuizQuestionData, QuizAnswerEvent } from "../domain/models/quiz-models";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { DetectedGap } from "../../services/contracts/types";
  import QuizContainer from "./shared/QuizContainer.svelte";
  import QuizLoadingState from "./shared/QuizLoadingState.svelte";
  import QuizErrorState from "./shared/QuizErrorState.svelte";
  import QuizPrompt from "./shared/QuizPrompt.svelte";
  import QuizPerformerStage from "./shared/QuizPerformerStage.svelte";
  import QuizWordButton from "./shared/QuizWordButton.svelte";
  import QuizFeedbackBanner from "./shared/QuizFeedbackBanner.svelte";
  import MisconceptionHint from "./shared/MisconceptionHint.svelte";
  import ScorePopAnimation from "./shared/ScorePopAnimation.svelte";
  import { getDelightOrchestrator } from "$lib/shared/delight/context/delight-context";

  let { onAnswerSubmit, onNextQuestion, onBack } = $props<{
    onAnswerSubmit?: (event: QuizAnswerEvent) => void;
    onNextQuestion?: () => void;
    onBack?: () => void;
  }>();

  let hapticService: HapticFeedback;
  const delightOrchestrator = getDelightOrchestrator();

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
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  let currentStreak = $state(0);
  let showScorePop = $state(false);
  let currentGap = $state<DetectedGap | null>(null);

  const answerSlots = [0, 1, 2, 3];

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
    isLoading = true;
    error = null;
    try {
      questionData = await QuestionGenerator.generateQuestion(
        QuizType.SEQUENCE_TO_WORD
      );
    } catch (err) {
      console.error("Failed to load question:", err);
      error = err instanceof Error ? err.message : "Failed to load question";
    } finally {
      isLoading = false;
    }
  }

  function handleAnswerClick(optionId: string, isCorrect: boolean) {
    if (isAnswered) return;
    hapticService?.trigger("selection");
    selectedAnswerId = optionId;
    isAnswered = true;
    showFeedback = true;

    if (isCorrect) {
      currentStreak++;
      showScorePop = true;

      if (currentStreak >= 3 && currentStreak % 3 === 0) {
        delightOrchestrator?.celebrate("answer-correct", {
          confettiAmount: 15,
        });
      }

      scorePopTimer = setTimeout(() => {
        showScorePop = false;
      }, 800);
    } else {
      currentStreak = 0;
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
      onAnswerSubmit?.({
        isCorrect,
        questionData,
        selectedOptionId: optionId,
        selectedContent: selectedOption?.content ?? null,
        correctContent: correctOption?.content ?? null,
        quizType: QuizType.SEQUENCE_TO_WORD,
        answeredAt: new Date(),
      });
    }

    const feedbackDuration = currentGap ? 5000 : 1200;
    nextQuestionTimer = setTimeout(handleNextQuestion, feedbackDuration);
  }

  async function handleNextQuestion() {
    selectedAnswerId = null;
    isAnswered = false;
    showFeedback = false;
    currentGap = null;
    await loadQuestion();
    onNextQuestion?.();
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

{#if isLoading}
  <QuizContainer>
    <QuizLoadingState />
  </QuizContainer>
{:else if error}
  <QuizContainer>
    <QuizErrorState {error} onRetry={loadQuestion} />
  </QuizContainer>
{:else if questionData && currentSequence}
  <QuizContainer>
    <QuizPrompt text="What word is being performed?" />

    <div class="quiz-content">
      <div class="stage-panel">
        <QuizPerformerStage sequence={currentSequence} />
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
          streakCount={currentStreak}
        />

        {#if showFeedback}
          <QuizFeedbackBanner
            isCorrect={isCorrectAnswer}
            correctMessage={`Correct! The word is "${correctAnswer}"`}
            incorrectMessage={`The correct word is "${correctAnswer}"`}
            streakCount={currentStreak}
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
  }

  .stage-panel {
    width: 100%;
    aspect-ratio: 4 / 3;
    max-height: 280px;
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
    grid-template-columns: 1fr 1fr;
    gap: 0.625rem;
    width: 100%;
  }

  /* Desktop: horizontal split layout */
  @media (min-width: 768px) {
    .quiz-content {
      flex-direction: row;
      align-items: stretch;
      max-width: 900px;
      gap: 2rem;
    }

    .stage-panel {
      flex: 1;
      aspect-ratio: auto;
      max-height: none;
      min-height: 360px;
    }

    .answer-section {
      flex: 0 0 260px;
      justify-content: center;
    }

    .answer-grid {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }
  }

  @media (min-width: 1024px) {
    .quiz-content {
      max-width: 1000px;
    }

    .answer-section {
      flex: 0 0 300px;
    }

    .answer-grid {
      gap: 0.875rem;
    }
  }

  @media (max-width: 480px) {
    .quiz-content {
      gap: 1rem;
    }

    .stage-panel {
      max-height: 220px;
    }

    .answer-grid {
      gap: 0.5rem;
    }
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: Clean pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/learn/quiz/components/SequenceToWordQuiz.svelte
git commit -m "feat(learn): SequenceToWordQuiz — main game component for Read the Performer"
```

---

### Task 7: Wire Into QuizWorkspaceView & LessonButton

**Files:**
- Modify: `src/lib/features/learn/quiz/components/QuizWorkspaceView.svelte`
- Modify: `src/lib/features/learn/quiz/components/LessonButton.svelte`

- [ ] **Step 1: Add routing in QuizWorkspaceView.svelte**

Add import at top of `<script>`:

```typescript
import SequenceToWordQuiz from "./SequenceToWordQuiz.svelte";
```

Add the routing branch in the template after the `ValidNextPictographQuiz` block (around line 249):

```svelte
{:else if quizType === QuizType.SEQUENCE_TO_WORD}
  <SequenceToWordQuiz
    onAnswerSubmit={handleAnswerSubmit}
    onNextQuestion={handleNextQuestion}
    onBack={handleBackClick}
  />
```

- [ ] **Step 2: Add game card config in LessonButton.svelte**

Add a new case in the `gameConfig` derived block (inside the switch statement, after the `VALID_NEXT_PICTOGRAPH` case):

```typescript
case QuizType.SEQUENCE_TO_WORD:
  return {
    icon: "sequence-3d",
    title: "Read the Performer",
    subtitle: "Watch the moves, name the word",
  };
```

Add the SVG icon in the template's icon conditional block (after the `sequence` icon block):

```svelte
{:else if gameConfig.icon === "sequence-3d"}
  <svg viewBox="0 0 48 48" fill="none">
    <!-- Performer silhouette -->
    <circle cx="24" cy="10" r="4" fill="currentColor" opacity="0.8" />
    <path
      d="M24 14 L24 28 M18 20 L30 20 M20 36 L24 28 L28 36"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- Question mark bubble -->
    <rect x="30" y="4" width="14" height="12" rx="3" stroke="currentColor" stroke-width="1.5" fill="var(--theme-stroke)" />
    <text x="37" y="13" font-family="Georgia, serif" font-size="9" font-weight="bold" fill="currentColor" text-anchor="middle">?</text>
  </svg>
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: Clean pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/learn/quiz/components/QuizWorkspaceView.svelte src/lib/features/learn/quiz/components/LessonButton.svelte
git commit -m "feat(learn): wire Read the Performer into workspace routing and selector"
```

---

### Task 8: Build Verification & Visual Check

**Files:** None — verification only.

- [ ] **Step 1: Run full typecheck**

Run: `npx tsc --noEmit`
Expected: Clean pass with zero errors.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors. The new components are tree-shaken correctly and all imports resolve.

- [ ] **Step 3: Visual verification**

Open the app at `localhost:5173`, navigate to Learn → Play tab. Verify:

1. **Selector view:** 4 game cards now appear (was 3). The 4th card shows "Read the Performer" with the performer silhouette icon and "Watch the moves, name the word" subtitle.
2. **Game launch:** Click "Read the Performer". Loading state appears while deck data loads from Firestore.
3. **3D stage:** Performer appears on a small platform, auto-playing a sequence on loop. Orbit controls work (drag to rotate).
4. **Answer buttons:** 4 word buttons display TKA words. One is the correct word for the playing sequence.
5. **Correct answer:** Tapping the right word shows green correct state, score pop animation, feedback banner with the word.
6. **Incorrect answer:** Tapping a wrong word shows red incorrect state, shake animation, feedback banner showing the correct word.
7. **Streak:** Getting 3+ correct in a row triggers confetti.
8. **Next question:** After feedback, a new sequence loads into the performer and new word options appear.
9. **Completion:** After 20 questions (fixed mode), results view shows with accuracy, streak stats.

- [ ] **Step 4: Commit any fixes found during visual verification**

If any issues found during step 3, fix and commit with descriptive message.
