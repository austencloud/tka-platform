<script lang="ts">
  import { onMount } from "svelte";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { getWordSequenceGenerator } from "$lib/features/create/spell/get-word-sequence-generator";
  import { getCodexLetterMappingRepo } from "$lib/features/learn/codex/get-codex-letter-mapping-repo";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import PropAwareThumbnail from "$lib/shared/browse/components/PropAwareThumbnail.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/start-position-deriver";
  import type { ExperienceViewMode } from "../../../domain/types";
  import { getExperiencePersistence } from "../../../state/experience-persistence.svelte";
  import ExperienceProgressIndicator from "../ExperienceProgressIndicator.svelte";
  import CanonicalWordStage from "../shared/CanonicalWordStage.svelte";
  import {
    TYPE1_ACCENTS,
    WORD_LESSON_EXAMPLES,
    WORD_QUESTIONS,
  } from "../shared/canonical-lesson-content";

  type LessonWord = (typeof WORD_LESSON_EXAMPLES)[number]["word"];
  type WordLoadState = "idle" | "loading" | "ready" | "error";

  const LESSON_WORDS = WORD_LESSON_EXAMPLES.map(
    (example) => example.word
  ) as LessonWord[];

  let {
    onComplete,
    viewMode = "step",
  }: {
    onComplete?: () => void;
    viewMode?: ExperienceViewMode;
  } = $props();

  const haptic = getHapticFeedback();
  const persistence = getExperiencePersistence("words-alpha-beta");
  const saved = persistence.load();
  let generator: ReturnType<typeof getWordSequenceGenerator> | null = null;

  let phase = $state(Math.min(3, Math.max(1, saved.step || 1)));
  let selectedWord = $state(
    persistence.getPhaseData<LessonWord>(
      "selectedWord",
      WORD_LESSON_EXAMPLES[0].word
    )
  );
  let questionIndex = $state(
    Math.min(
      WORD_QUESTIONS.length - 1,
      persistence.getPhaseData<number>("questionIndex", 0)
    )
  );
  let selectedAnswer = $state<LessonWord | null>(null);
  let answerState = $state<"correct" | "wrong" | null>(null);
  let sequences = $state<Record<LessonWord, SequenceData | null>>({
    AABB: null,
    GGGG: null,
    CCCC: null,
  });
  let wordLoadStates = $state<Record<LessonWord, WordLoadState>>({
    AABB: "idle",
    GGGG: "idle",
    CCCC: "idle",
  });
  let wordErrors = $state<Record<LessonWord, string | null>>({
    AABB: null,
    GGGG: null,
    CCCC: null,
  });

  const activeExample = $derived(
    WORD_LESSON_EXAMPLES.find((item) => item.word === selectedWord) ??
      WORD_LESSON_EXAMPLES[0]
  );
  const activeQuestion = $derived(WORD_QUESTIONS[questionIndex]);
  const stageWord = $derived<LessonWord>(phase === 3 ? "AABB" : selectedWord);
  const selectedAnswerExample = $derived(
    WORD_LESSON_EXAMPLES.find((item) => item.word === selectedAnswer) ?? null
  );

  async function loadWord(word: LessonWord) {
    if (!generator || wordLoadStates[word] === "loading") return;
    wordLoadStates[word] = "loading";
    wordErrors[word] = null;

    try {
      const result = await generator.generateFromWord({
        word,
        preferences: {
          targetStepCount: null,
          motionTypeFilter: null,
          maxReversals: null,
          highContinuity: false,
          handPathMode: "smooth",
          makeCircular: false,
          selectedLOOPType: null,
          constraintPreset: "smooth",
        },
      });

      if (!result.success || !result.sequence) {
        throw new Error(result.error || `Could not build ${word}`);
      }

      const startPosition =
        result.sequence.startPosition ??
        (result.sequence.steps[0]
          ? startPositionDeriver.deriveFromFirstStep(result.sequence.steps[0])
          : null);

      sequences[word] = {
        ...result.sequence,
        startPosition: startPosition ?? result.sequence.startPosition,
      };
      wordLoadStates[word] = "ready";
    } catch (caught) {
      sequences[word] = null;
      wordErrors[word] =
        caught instanceof Error ? caught.message : `Could not build ${word}`;
      wordLoadStates[word] = "error";
    }
  }

  async function loadLessonWords() {
    // The transition graph initializes on the first request. Warming the three
    // cards in order keeps that one-time setup from racing itself, while the UI
    // still reserves all three answer slots immediately.
    for (const word of LESSON_WORDS) {
      await loadWord(word);
    }
  }

  onMount(() => {
    getCodexLetterMappingRepo();
    generator = getWordSequenceGenerator();
    void loadLessonWords();
  });

  function chooseWord(word: LessonWord) {
    selectedWord = word;
    persistence.savePhaseData("selectedWord", word);
    haptic?.trigger("selection");
  }

  function goToPhase(nextPhase: number) {
    phase = Math.min(3, Math.max(1, nextPhase));
    persistence.saveStep(phase);
    selectedAnswer = null;
    answerState = null;
    haptic?.trigger("selection");
  }

  function answerQuestion(word: LessonWord) {
    if (answerState === "correct" || wordLoadStates[word] !== "ready") return;
    selectedAnswer = word;
    answerState = word === activeQuestion.answer ? "correct" : "wrong";
    haptic?.trigger(answerState === "correct" ? "success" : "warning");
  }

  function nextQuestion() {
    if (questionIndex < WORD_QUESTIONS.length - 1) {
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
    if (phase > 1) goToPhase(phase - 1);
  }
</script>

<div
  class="experience"
  class:review-mode={viewMode === "scroll"}
  style:--type-one={TYPE1_ACCENTS[0]}
  style:--type-one-pair={TYPE1_ACCENTS[1]}
>
  {#if phase === 1}
    <section class="explore-grid" aria-labelledby="words-title">
      <div class="copy-column">
        <p class="eyebrow">Letters become movement</p>
        <h1 id="words-title">A word is a sequence you can perform.</h1>
        <p class="lede">
          Each letter contributes one real pictograph. The end of one step
          becomes the start of the next, so the word has to connect as movement,
          not just spelling.
        </p>

        <div class="word-picker" aria-label="Choose a word">
          {#each WORD_LESSON_EXAMPLES as item}
            <button
              type="button"
              class:active={selectedWord === item.word}
              aria-pressed={selectedWord === item.word}
              onclick={() => chooseWord(item.word)}
            >
              <strong>{item.word}</strong>
              <span>{item.label}</span>
            </button>
          {/each}
        </div>

        <div class="word-reading">
          <div
            class="letter-train"
            aria-label="{activeExample.word} as individual letters"
          >
            {#each activeExample.word.split("") as letter, index}
              <span>{letter}</span>
              {#if index < activeExample.word.length - 1}
                <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
              {/if}
            {/each}
          </div>
          <p>{activeExample.detail}</p>
        </div>

        <div class="action-row">
          <PanelButton variant="primary" onclick={() => goToPhase(2)}>
            <span>Check the connections</span>
            <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </PanelButton>
        </div>
      </div>

      <div class="stage-column">
        <CanonicalWordStage
          word={stageWord}
          sequence={sequences[stageWord]}
          loading={wordLoadStates[stageWord] !== "ready" &&
            wordLoadStates[stageWord] !== "error"}
          error={wordErrors[stageWord]}
          onretry={() => loadWord(stageWord)}
        />
        <p>
          Move plays the generated sequence. Read the card shows the same data
          through the production choreography-card component.
        </p>
      </div>
    </section>
  {:else if phase === 2}
    <section class="challenge" aria-labelledby="word-check-title">
      <div class="challenge-header">
        <div class="question-progress" aria-label="Question progress">
          <span>Word check</span>
          <strong>{questionIndex + 1} / {WORD_QUESTIONS.length}</strong>
          <div class="question-track" aria-hidden="true">
            <i
              style:width={`${((questionIndex + 1) / WORD_QUESTIONS.length) * 100}%`}
            ></i>
          </div>
        </div>
        <div class="question-copy">
          <h1 id="word-check-title">{activeQuestion.prompt}</h1>
          <p>Compare all three cards, then pick the sequence that matches.</p>
        </div>
      </div>

      <div class="word-answer-grid" aria-label="Choose a sequence">
        {#each activeQuestion.choices as word}
          {@const loadState = wordLoadStates[word]}
          {@const sequence = sequences[word]}
          <button
            type="button"
            class="word-answer-card"
            class:selected={selectedAnswer === word}
            class:correct={answerState !== null &&
              word === activeQuestion.answer}
            class:wrong={answerState === "wrong" && selectedAnswer === word}
            disabled={answerState === "correct" ||
              loadState === "loading" ||
              loadState === "idle"}
            aria-label={loadState === "error"
              ? `Build ${word} again`
              : `Choose ${word}`}
            onclick={() =>
              loadState === "error"
                ? void loadWord(word)
                : answerQuestion(word)}
          >
            <span class="answer-art">
              {#if loadState === "ready" && sequence}
                <PropAwareThumbnail
                  {sequence}
                  bluePropType={PropType.STAFF}
                  redPropType={PropType.STAFF}
                  lightMode={false}
                  variant="gallery"
                  addWord
                  addDifficultyLevel={false}
                  includeStartPosition
                  showNotes={false}
                  showLoopGlyph={false}
                  allowQR={false}
                  eager
                />
              {:else if loadState === "error"}
                <span class="answer-error">
                  <i class="fa-solid fa-arrow-rotate-right" aria-hidden="true"
                  ></i>
                  <span>Build again</span>
                </span>
              {:else}
                <span class="answer-loading">
                  <ProgressRing percent={-1} size={28} strokeWidth={2} />
                  <span>Building {word}</span>
                </span>
              {/if}
            </span>

            <span class="answer-footer">
              <span>
                <strong>{word}</strong>
                <small>{sequence?.steps.length ?? 4} beats</small>
              </span>
              <span
                class="result-slot"
                class:visible={answerState !== null &&
                  (word === activeQuestion.answer || selectedAnswer === word)}
                class:is-correct={word === activeQuestion.answer}
                aria-hidden="true"
              >
                <i
                  class={word === activeQuestion.answer
                    ? "fa-solid fa-check"
                    : "fa-solid fa-xmark"}
                ></i>
              </span>
            </span>
          </button>
        {/each}
      </div>

      <div
        class="answer-dock"
        class:wrong-state={answerState === "wrong"}
        class:correct-state={answerState === "correct"}
        aria-live="polite"
      >
        <div class="answer-message">
          {#if answerState === "wrong" && selectedAnswerExample}
            <i class="fa-solid fa-arrows-left-right" aria-hidden="true"></i>
            <p>
              <strong>{selectedAnswerExample.word}:</strong>
              {selectedAnswerExample.detail} Compare it with the green card.
            </p>
          {:else if answerState === "correct"}
            <i class="fa-solid fa-check" aria-hidden="true"></i>
            <p>
              <strong>{activeQuestion.answer}.</strong>
              {activeQuestion.explanation}
            </p>
          {:else}
            <i class="fa-solid fa-hand-pointer" aria-hidden="true"></i>
            <p>
              Read the hand positions first. Use the arrows as the tiebreaker.
            </p>
          {/if}
        </div>

        <PanelButton
          variant="primary"
          disabled={answerState !== "correct"}
          onclick={nextQuestion}
        >
          <span>
            {questionIndex === WORD_QUESTIONS.length - 1
              ? "Build the AB idea"
              : "Next connection"}
          </span>
          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </PanelButton>
      </div>
    </section>
  {:else}
    <section class="summary-grid" aria-labelledby="words-summary-title">
      <div class="summary-copy">
        <p class="eyebrow">The AB idea</p>
        <h1 id="words-summary-title">AABB is more than four labels.</h1>
        <p class="summary-lede">
          A contributes the pro + pro pattern. B contributes anti + anti.
        </p>

        <div class="composition" aria-label="AABB composition">
          <div class="composition-block a-block">
            <span>A</span><span>A</span>
            <small>pro + pro</small>
          </div>
          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          <div class="composition-block b-block">
            <span>B</span><span>B</span>
            <small>anti + anti</small>
          </div>
        </div>

        <div class="action-row">
          <PanelButton variant="primary" onclick={complete}>
            <span>Complete words</span>
            <i class="fa-solid fa-check" aria-hidden="true"></i>
          </PanelButton>
        </div>
      </div>

      <CanonicalWordStage
        word="AABB"
        sequence={sequences.AABB}
        loading={wordLoadStates.AABB !== "ready" &&
          wordLoadStates.AABB !== "error"}
        error={wordErrors.AABB}
        onretry={() => loadWord("AABB")}
      />
    </section>
  {/if}

  <ExperienceProgressIndicator currentStep={phase} totalSteps={3} />
</div>

<style>
  .experience {
    --lesson-max: 92rem;
    --lesson-accent: var(--type-one);
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 0.75rem;
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 4.25rem clamp(1rem, 2.5cqw, 2.5rem) 0.75rem;
    overflow: auto;
    color: var(--theme-text);
    container-type: inline-size;
  }

  .explore-grid,
  .challenge,
  .summary-grid {
    width: min(100%, var(--lesson-max));
    margin-block: 0;
    margin-inline: auto;
  }

  .explore-grid,
  .summary-grid {
    display: grid;
    grid-template-columns: minmax(20rem, 0.9fr) minmax(24rem, 1.1fr);
    align-items: center;
    gap: clamp(1rem, 2.5cqw, 2.5rem);
  }

  .copy-column,
  .summary-copy {
    display: grid;
    align-content: center;
    gap: 1rem;
    min-width: 0;
    padding: clamp(1rem, 2cqw, 1.75rem);
    border: 1px solid var(--theme-stroke);
    border-radius: 0.9rem;
    background: var(--theme-panel-bg);
  }

  .eyebrow {
    margin: 0;
    color: var(--lesson-accent);
    font-size: clamp(0.75rem, 0.75cqw, 0.9rem);
    font-weight: 750;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  h1 {
    max-width: 22ch;
    margin: 0;
    color: var(--theme-text);
    font-size: clamp(1.9rem, 2.7cqw, 3rem);
    font-weight: 780;
    letter-spacing: -0.03em;
    line-height: 1.05;
    text-wrap: balance;
  }

  .lede,
  .summary-lede {
    max-width: 58ch;
    margin: 0;
    color: var(--theme-text-dim);
    font-size: clamp(0.95rem, 1cqw, 1.08rem);
    line-height: 1.5;
  }

  .word-picker {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.55rem;
  }

  .word-picker button {
    display: grid;
    gap: 0.25rem;
    min-height: 4rem;
    padding: 0.7rem;
    border: 1px solid var(--theme-stroke);
    border-radius: 0.65rem;
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .word-picker button strong {
    font-size: 1rem;
    letter-spacing: 0.05em;
  }

  .word-picker button span {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.3;
  }

  .word-picker button:hover,
  .word-picker button.active {
    border-color: var(--lesson-accent);
    background: color-mix(
      in srgb,
      var(--lesson-accent) 10%,
      var(--theme-card-bg)
    );
    box-shadow: inset 0 -3px 0 var(--lesson-accent);
  }

  .word-reading {
    display: grid;
    gap: 0.65rem;
    padding: 0.9rem 1rem;
    border-left: 3px solid var(--lesson-accent);
    border-radius: 0 0.85rem 0.85rem 0;
    background: color-mix(
      in srgb,
      var(--lesson-accent) 8%,
      var(--theme-card-bg)
    );
  }

  .letter-train {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .letter-train span {
    display: grid;
    place-items: center;
    width: 2.25rem;
    aspect-ratio: 1;
    border: 1px solid
      color-mix(in srgb, var(--lesson-accent) 50%, var(--theme-stroke));
    border-radius: 0.55rem;
    background: var(--theme-panel-bg);
    color: var(--theme-text);
    font-weight: 900;
  }

  .letter-train i {
    color: var(--theme-text-dim);
    font-size: 0.65rem;
  }

  .word-reading p {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: 0.86rem;
    line-height: 1.4;
  }

  .action-row {
    justify-self: start;
    --theme-accent: var(--lesson-accent);
    --theme-text-on-accent: #061013;
  }

  button:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--lesson-accent) 72%, white);
    outline-offset: 2px;
  }

  .stage-column {
    display: grid;
    gap: 0.65rem;
    min-width: 0;
    --theme-accent: var(--lesson-accent);
  }

  .stage-column > p {
    max-width: 56ch;
    margin: 0 auto;
    color: var(--theme-text-dim);
    font-size: 0.78rem;
    line-height: 1.45;
    text-align: center;
  }

  .challenge {
    display: grid;
    align-content: start;
    gap: clamp(0.75rem, 1.4cqw, 1.25rem);
  }

  .challenge-header {
    display: grid;
    grid-template-columns: minmax(7rem, 0.18fr) minmax(0, 1fr);
    align-items: center;
    gap: clamp(0.9rem, 1.8cqw, 1.6rem);
    padding: clamp(0.8rem, 1.2cqw, 1.15rem) clamp(0.9rem, 1.5cqw, 1.4rem);
    border: 1px solid var(--theme-stroke);
    border-radius: 0.85rem;
    background: var(--theme-panel-bg);
  }

  .challenge-header h1 {
    max-width: none;
    font-size: clamp(1.55rem, 2cqw, 2.55rem);
    line-height: 1.08;
  }

  .question-progress {
    display: grid;
    gap: 0.35rem;
    min-width: 0;
  }

  .question-progress > span {
    color: var(--lesson-accent);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .question-progress strong {
    color: var(--theme-text);
    font-size: clamp(1rem, 1.2cqw, 1.35rem);
    font-variant-numeric: tabular-nums;
  }

  .question-track {
    width: 100%;
    height: 3px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--theme-stroke);
  }

  .question-track i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--type-one), var(--type-one-pair));
    transition: width var(--duration-normal, 200ms) ease;
  }

  .question-copy {
    display: grid;
    gap: 0.25rem;
    min-width: 0;
  }

  .question-copy p {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: clamp(0.85rem, 0.9cqw, 1rem);
    line-height: 1.4;
  }

  .word-answer-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(0.55rem, 1.2cqw, 1rem);
  }

  .word-answer-card {
    --theme-accent: var(--lesson-accent);
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    min-width: 0;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: 0.8rem;
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      border-color var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease,
      box-shadow var(--duration-fast, 150ms) ease;
  }

  .word-answer-card:hover:not(:disabled),
  .word-answer-card.selected {
    border-color: color-mix(in srgb, var(--lesson-accent) 72%, white 8%);
    background: color-mix(
      in srgb,
      var(--lesson-accent) 7%,
      var(--theme-card-bg)
    );
    box-shadow: 0 0 0 1px
      color-mix(in srgb, var(--lesson-accent) 26%, transparent);
  }

  .word-answer-card:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  .word-answer-card:disabled {
    cursor: default;
  }

  .word-answer-card.correct {
    border-color: var(--semantic-success);
    box-shadow: inset 0 -3px 0 var(--semantic-success);
  }

  .word-answer-card.wrong {
    border-color: var(--semantic-error);
    box-shadow: inset 0 -3px 0 var(--semantic-error);
  }

  .answer-art {
    display: grid;
    place-items: center;
    width: 100%;
    aspect-ratio: 4 / 3;
    min-height: 0;
    overflow: hidden;
    border-bottom: 1px solid var(--theme-stroke);
    background: var(--theme-panel-bg);
    container: image-container / size;
  }

  .answer-art :global(.prop-thumbnail) {
    width: 100%;
    height: 100%;
    aspect-ratio: auto !important;
  }

  .answer-art :global(.prop-thumbnail > img) {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .answer-loading,
  .answer-error {
    display: grid;
    place-items: center;
    gap: 0.5rem;
    color: var(--theme-text-dim);
    font-size: clamp(0.75rem, 0.8cqw, 0.9rem);
    text-align: center;
  }

  .answer-error i {
    color: var(--semantic-warning, #f0b429);
    font-size: 1.2rem;
  }

  .answer-footer {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.6rem;
    min-height: 3.75rem;
    padding: 0.65rem 0.75rem;
  }

  .answer-footer > span:first-child {
    display: grid;
    gap: 0.1rem;
    min-width: 0;
  }

  .answer-footer strong {
    color: var(--theme-text);
    font-size: clamp(0.95rem, 1.1cqw, 1.25rem);
    font-weight: 800;
    letter-spacing: 0.06em;
  }

  .answer-footer small {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
  }

  .result-slot {
    display: grid;
    place-items: center;
    width: 1.8rem;
    height: 1.8rem;
    border-radius: 50%;
    background: color-mix(in srgb, var(--semantic-error) 16%, transparent);
    color: var(--semantic-error);
    opacity: 0;
    transition: opacity var(--duration-fast, 150ms) ease;
  }

  .result-slot.visible {
    opacity: 1;
  }

  .result-slot.is-correct {
    background: color-mix(in srgb, var(--semantic-success) 16%, transparent);
    color: var(--semantic-success);
  }

  .answer-dock {
    --theme-accent: var(--lesson-accent);
    --theme-text-on-accent: #061013;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 1rem;
    min-height: 4.5rem;
    padding: 0.65rem 0.75rem 0.65rem 1rem;
    border: 1px solid var(--theme-stroke);
    border-radius: 0.8rem;
    background: var(--theme-panel-bg);
  }

  .answer-message {
    display: grid;
    grid-template-columns: 1.3rem minmax(0, 1fr);
    align-items: start;
    gap: 0.65rem;
    min-width: 0;
  }

  .answer-message > i {
    margin-top: 0.15rem;
    color: var(--lesson-accent);
  }

  .answer-dock.wrong-state .answer-message > i {
    color: var(--semantic-warning, #f0b429);
  }

  .answer-dock.correct-state .answer-message > i {
    color: var(--semantic-success);
  }

  .answer-message p {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: clamp(0.82rem, 0.85cqw, 0.95rem);
    line-height: 1.45;
  }

  .answer-message strong {
    color: var(--theme-text);
  }

  .summary-grid {
    grid-template-columns: minmax(19rem, 0.82fr) minmax(24rem, 1.18fr);
  }

  .summary-grid > :last-child {
    --theme-accent: var(--lesson-accent);
  }

  .composition {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 0.7rem;
  }

  .composition > i {
    color: var(--theme-text-dim);
  }

  .composition-block {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.35rem;
    padding: 0.75rem;
    border: 1px solid var(--theme-stroke);
    border-radius: 0.85rem;
    background: var(--theme-card-bg);
  }

  .composition-block span {
    display: grid;
    place-items: center;
    min-height: 2.7rem;
    border-radius: 0.55rem;
    background: color-mix(
      in srgb,
      var(--lesson-accent) 14%,
      var(--theme-panel-bg)
    );
    color: var(--theme-text);
    font-size: 1.15rem;
    font-weight: 900;
  }

  .composition-block small {
    grid-column: 1 / -1;
    color: var(--theme-text-dim);
    font-size: 0.7rem;
    text-align: center;
  }

  .summary-copy ul {
    display: grid;
    gap: 0.45rem;
    margin: 0;
    padding-left: 1.2rem;
    color: var(--theme-text-dim);
    font-size: 0.88rem;
    line-height: 1.45;
  }

  :global(.experience > .progress-indicator) {
    justify-self: center;
  }

  @container (max-width: 820px) {
    .explore-grid,
    .summary-grid {
      grid-template-columns: 1fr;
    }

    .stage-column,
    .summary-grid > :last-child {
      order: -1;
    }

    h1 {
      font-size: clamp(1.8rem, 6cqw, 2.7rem);
    }
  }

  @container (max-width: 480px) {
    .experience {
      padding: 3.75rem 0.55rem 0.55rem;
    }

    .word-picker {
      grid-template-columns: 1fr;
    }

    .word-picker button {
      grid-template-columns: 5rem 1fr;
      align-items: center;
      min-height: 3.5rem;
    }

    .challenge-header {
      grid-template-columns: 1fr;
      gap: 0.55rem;
    }

    .question-progress {
      grid-template-columns: auto auto minmax(3rem, 1fr);
      align-items: center;
      gap: 0.55rem;
    }

    .question-progress strong {
      font-size: 0.9rem;
    }

    .challenge-header h1 {
      font-size: clamp(1.35rem, 6cqw, 1.7rem);
    }

    .word-answer-grid {
      gap: 0.35rem;
    }

    .word-answer-card {
      border-radius: 0.55rem;
    }

    .answer-footer {
      min-height: 2.85rem;
      padding: 0.45rem 0.5rem;
    }

    .answer-footer strong {
      font-size: 0.85rem;
    }

    .answer-footer small {
      display: none;
    }

    .result-slot {
      width: 1.35rem;
      height: 1.35rem;
      font-size: 0.7rem;
    }

    .answer-dock {
      grid-template-columns: 1fr;
      gap: 0.55rem;
      padding: 0.65rem;
    }
  }

  @container (min-width: 1680px) {
    .experience {
      --lesson-max: min(92cqw, 150rem);
      padding-inline: 4cqw;
    }

    .challenge-header,
    .answer-dock {
      border-radius: 1rem;
    }

    .word-answer-card {
      border-radius: 1rem;
    }
  }

  @container (min-width: 2600px) {
    .experience {
      --lesson-max: min(92cqw, 170rem);
      padding-top: 5rem;
    }

    .challenge {
      gap: 1.35rem;
    }

    .challenge-header {
      padding: 1.25rem 1.5rem;
    }

    .answer-footer {
      min-height: 4.5rem;
      padding: 0.8rem 1rem;
    }

    .answer-dock {
      min-height: 5.25rem;
      padding: 0.8rem 0.9rem 0.8rem 1.2rem;
    }
  }

  @media (max-height: 560px) and (min-width: 700px) {
    .experience {
      padding: 3.35rem 0.75rem 0.45rem;
    }

    .explore-grid,
    .summary-grid {
      align-items: start;
    }

    .challenge {
      gap: 0.45rem;
    }

    .challenge-header {
      padding: 0.5rem 0.75rem;
    }

    .challenge-header h1 {
      font-size: 1.25rem;
    }

    .question-copy p {
      display: none;
    }

    .answer-footer {
      min-height: 1.8rem;
      padding-block: 0.15rem;
    }

    .answer-footer small {
      display: none;
    }

    .answer-art {
      aspect-ratio: 2.4 / 1;
    }

    .answer-dock {
      min-height: 2.8rem;
      padding-block: 0;
    }

    :global(.experience > .progress-indicator) {
      display: none;
    }

    .copy-column,
    .summary-copy {
      gap: 0.6rem;
    }

    h1 {
      font-size: clamp(1.7rem, 4cqw, 2.6rem);
    }

    .lede,
    .stage-column > p {
      font-size: 0.78rem;
    }

    .word-picker button {
      min-height: 3.4rem;
      padding: 0.55rem 0.65rem;
    }

    .word-reading {
      padding: 0.6rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .word-answer-card,
    .result-slot,
    .question-track i {
      transition: none;
    }

    .word-answer-card:hover:not(:disabled) {
      transform: none;
    }
  }
</style>
