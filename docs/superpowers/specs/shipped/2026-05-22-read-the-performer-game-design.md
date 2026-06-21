# Read the Performer — Game 4 Design Spec

## Overview

4th game in the Learn module's quiz system. Player watches a 3D performer execute a sequence, then identifies the correct 4-letter TKA word from 4 multiple-choice options.

## Data Source

**Level 1, 16-count, rotated, quartered loop sequences** from the deck system (Firestore). These are 4-letter TKA words (period=4, repeated 4x = 16 beats). Letter dash suffixes (e.g., Sigma-) don't count toward the 4-letter count — "AΣ-BC" is a valid 4-letter word.

All sequences in matching decks are valid candidates. No English word filtering needed.

## Game Flow

1. **Load phase:** Fetch deck metadata → filter to L1/rotated/quartered/16-count → load sequences from a random matching deck → cache pool for the session
2. **Question phase:** Pick a random sequence from pool → load into 3D performer → auto-play on loop
3. **Answer phase:** Display 4 word buttons (1 correct + 3 distractors from same pool, different words) → player picks
4. **Feedback phase:** Standard quiz feedback (correct/incorrect banner, streak tracking, score pop, misconception hint, haptics, confetti at streak milestones)
5. **Next question:** Pick new sequence from pool, repeat

## Layout

### Desktop (>768px) — Horizontal Split

```
┌─────────────────────────────────────────────────┐
│  QuizPrompt: "What word is being performed?"    │
├──────────────────────┬──────────────────────────┤
│                      │                          │
│   3D Performer       │   ┌──────────────────┐   │
│   Stage              │   │     AAAB         │   │
│                      │   └──────────────────┘   │
│   (Threlte Canvas)   │   ┌──────────────────┐   │
│                      │   │     ABCD         │   │
│   Auto-playing       │   └──────────────────┘   │
│   sequence on loop   │   ┌──────────────────┐   │
│                      │   │     CCBA         │   │
│                      │   └──────────────────┘   │
│                      │   ┌──────────────────┐   │
│                      │   │     DBCA         │   │
│                      │   └──────────────────┘   │
├──────────────────────┴──────────────────────────┤
│  QuizFeedbackBanner + ScorePopAnimation         │
└─────────────────────────────────────────────────┘
```

### Mobile (<768px) — Vertical Stack

```
┌─────────────────────────┐
│  QuizPrompt             │
├─────────────────────────┤
│                         │
│   3D Performer Stage    │
│   (shorter height)      │
│                         │
├─────────────────────────┤
│  ┌─────────┐ ┌────────┐│
│  │  AAAB   │ │  ABCD  ││
│  └─────────┘ └────────┘│
│  ┌─────────┐ ┌────────┐│
│  │  CCBA   │ │  DBCA  ││
│  └─────────┘ └────────┘│
├─────────────────────────┤
│  Feedback               │
└─────────────────────────┘
```

Mobile answer buttons use a 2x2 grid. Desktop uses a vertical stack of 4 full-width buttons.

## New Components

### 1. `SequenceToWordQuiz.svelte`

Main game component. Follows `PictographToLetterQuiz.svelte` pattern exactly:
- Props: `onAnswerSubmit`, `onNextQuestion`, `onBack`
- State: `questionData`, `selectedAnswerId`, `isAnswered`, `showFeedback`, `currentStreak`, `showScorePop`, `currentGap`
- Uses shared components: `QuizContainer`, `QuizPrompt`, `QuizFeedbackBanner`, `ScorePopAnimation`, `MisconceptionHint`
- Contains `QuizPerformerStage` for the 3D view and `QuizWordButton` instances for answers
- Horizontal layout on desktop via CSS media query

### 2. `QuizPerformerStage.svelte`

Self-contained Threlte Canvas rendering a single performer playing a sequence.

**Props:**
- `sequence: SequenceData` — sequence to perform
- `size?: { width: string; height: string }` — container dimensions

**Internals:**
- Creates `AvatarInstanceState` via `createAvatarInstanceState()`
- Calls `loadSequence(sequence)` on sequence prop change
- Sets `loop = true`, auto-plays
- Minimal scene: ambient + directional light, subtle stage platform, no environment/audience
- Orbit controls enabled (player can rotate the view to study the performer)
- Reactive to sequence changes — when new question loads, calls `loadSequence()` with new data

**Cleanup:** Destroys avatar state on component unmount.

### 3. `QuizWordButton.svelte`

Answer button displaying a TKA word string. Follows `QuizLetterButton.svelte` pattern.

**Props:**
- `word: string` — the TKA word to display (e.g., "AAAB")
- `state: "default" | "correct" | "incorrect" | "dimmed"`
- `disabled: boolean`
- `onclick: () => void`

**Visual:** Larger than letter buttons to fit multi-character words. Monospace font for consistent letter spacing. Same glass morphism + state colors as `QuizLetterButton`. Letter characters spaced with slight tracking for readability.

### 4. `sequence-question-generator.ts`

Separate module for generating sequence-based questions. Different data source (Firestore decks) from the existing CSV-based `question-generator.ts`.

**Public API:**
```typescript
initialize(): Promise<void>
  // Loads deck metadata, filters to L1/rotated/quartered/16-count,
  // loads sequences from matching decks, caches pool

generateSequenceToWordQuestion(questionId: string): QuizQuestionData
  // Picks random sequence, generates 3 distractors (different words from pool),
  // returns QuizQuestionData with questionContent = SequenceData,
  // answerOptions = 4 word strings, correctAnswer = correct word

resetState(): void
```

**Distractor strategy:** Pick 3 random sequences from the pool whose `word` field differs from the correct sequence's word. Shuffle all 4. If pool has fewer than 4 distinct words (unlikely for L1 quartered), fall back to generating synthetic distractors by shuffling letters.

**Previous-question avoidance:** Track last N correct words to avoid repeating the same sequence consecutively.

## Registration Changes

### `quiz-enums.ts`
```typescript
export enum QuizType {
  // ... existing
  SEQUENCE_TO_WORD = "sequence_to_word",
}

export enum QuizQuestionFormat {
  // ... existing
  SEQUENCE_3D = "sequence_3d",
}

export enum QuizAnswerFormat {
  // ... existing
  WORD_BUTTON = "word_button",
}
```

### `quiz-constants.ts`
```typescript
// Add to LESSON_CONFIGS:
[QuizType.SEQUENCE_TO_WORD]: {
  type: "sequence_to_word",
  difficulty: "intermediate",
  lessonType: QuizType.SEQUENCE_TO_WORD,
  questionFormat: QuizQuestionFormat.SEQUENCE_3D,
  answerFormat: QuizAnswerFormat.WORD_BUTTON,
  quizDescription: "sequence_to_word",
  questionPrompt: "What word is being performed?",
}

// Add to LESSON_INFO:
{
  id: "lesson-4",
  name: "Quiz 4",
  description: "Watch the 3D performer and identify the word",
  lessonType: QuizType.SEQUENCE_TO_WORD,
}

// Add to LESSON_TYPE_NAMES:
[QuizType.SEQUENCE_TO_WORD]: "Read the Performer",
```

### `quiz-configurator.ts`

Add `SEQUENCE_TO_WORD` cases to:
- `getQuizNumber()` → returns 4
- `getQuizTypeFromNumber()` → case 4
- `getDifficultyLevel()` → returns 3 (harder than letter matching, easier than sequence chaining)
- `getRecommendedQuizMode()` → `FIXED_QUESTION`

### `QuizWorkspaceView.svelte`

Add routing branch:
```svelte
{:else if quizType === QuizType.SEQUENCE_TO_WORD}
  <SequenceToWordQuiz
    onAnswerSubmit={handleAnswerSubmit}
    onNextQuestion={handleNextQuestion}
    onBack={handleBackClick}
  />
```

### `LessonButton.svelte`

Add icon config for `SEQUENCE_TO_WORD`:
- Icon: 3D figure silhouette with "?" word bubble
- Title: "Read the Performer"
- Subtitle: "Watch the moves, name the word"

### `question-generator.ts`

Add delegation for the new type:
```typescript
case QuizType.SEQUENCE_TO_WORD:
  return SequenceQuestionGenerator.generateSequenceToWordQuestion(questionId);
```

## Shared Infrastructure Reuse

All of these are used as-is with zero modifications:
- `QuizContainer` — layout wrapper
- `QuizPrompt` — question text banner
- `QuizFeedbackBanner` — correct/incorrect feedback
- `ScorePopAnimation` — score pop on correct answer
- `MisconceptionHint` — misconception feedback on wrong answer
- `QuizSessionManager` — session state, streak tracking, scoring
- `QuizResultsView` — end-of-quiz results display
- Haptic feedback integration
- Delight orchestrator (confetti at streak milestones)
- Gap detector for misconception analysis

## 3D Scene Specification

Minimal scene to keep GPU cost low and focus attention on the performer:

- **Lighting:** Single directional light (warm white, intensity ~2) + ambient light (intensity ~0.5)
- **Stage:** Subtle circular platform beneath performer (same as museum stations)
- **Camera:** Orbit controls, default angle slightly above eye level, moderate zoom
- **Background:** Transparent or very dark gradient matching quiz theme (`--theme-panel-bg`)
- **No:** Environment skybox, audience, terrain, grid labels, effects
- **Performance:** One performer, one avatar instance, ~60fps target on mid-range mobile

## Future Expansion Hooks

Designed for but not building now:
- **Difficulty levels:** Higher TKA levels, longer words, halved loops, different loop types
- **Replay controls:** Button to replay animation from start (currently auto-loops, which suffices)
- **Speed control:** Slower/faster playback for difficulty tuning
- **Hint system:** Show first letter after N seconds of watching
