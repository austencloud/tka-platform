<script lang="ts">
  import { onMount } from "svelte";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { loadFoundingCollectionSequences } from "$lib/features/browse/collections/config/founding-collections";
  import {
    TND_ELEMENTS,
    type TnDElement,
  } from "$lib/features/choreo-card/domain/tnd-element";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import type { ExperienceViewMode } from "../../../domain/types";
  import { getExperiencePersistence } from "../../../state/experience-persistence.svelte";
  import ExperienceProgressIndicator from "../ExperienceProgressIndicator.svelte";
  import LearningWordStage from "./LearningWordStage.svelte";
  import {
    getLearningLetterTeachingContent,
    LEARNING_LETTER_TEACHING_CONTENT,
  } from "./learning-letter-teaching-content";
  import {
    LEARNING_LETTERS_CORE_WORDS,
    LEARNING_LETTERS_SCHEMA_VERSION,
    LEARNING_LETTERS_TOTAL_STEPS,
    normalizeLearningLettersProgress,
  } from "./learning-letters-progress";

  type LoadState = "loading" | "ready" | "error";

  interface LearningLettersFamily {
    element: TnDElement;
    sequences: readonly SequenceData[];
  }

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
  const persistence = getExperiencePersistence("words-alpha-beta");
  const recapStepIndex = LEARNING_LETTERS_TOTAL_STEPS - 1;

  let loadState = $state<LoadState>("loading");
  let loadError = $state<string | null>(null);
  let sequences = $state<readonly SequenceData[]>([]);
  let stepIndex = $state(0);
  let shellWidth = $state(0);

  // TKAWordGlyph receives a pixel height, so only the canonical 1680/2600
  // big-screen seams can increase the rendered glyph size.
  const glyphScale = $derived(
    shellWidth >= 2600 ? 2 : shellWidth >= 1680 ? 1.15 : 1
  );

  const coreSequences = $derived(
    LEARNING_LETTERS_CORE_WORDS.flatMap((word) => {
      const match = sequences.find((sequence) => sequence.word === word);
      return match ? [match] : [];
    })
  );
  const coreFamilies = $derived.by((): LearningLettersFamily[] =>
    TND_ELEMENTS.map((element) => ({
      element,
      sequences: coreSequences.filter(
        (sequence) => sequence.metadata["familyId"] === element.familyId
      ),
    })).filter((family) => family.sequences.length > 0)
  );
  const activeCoreIndex = $derived(stepIndex - 1);
  const activeCoreSequence = $derived(coreSequences[activeCoreIndex] ?? null);
  const activeCoreFamily = $derived(
    activeCoreSequence
      ? (coreFamilies.find(
          (family) =>
            family.element.familyId === activeCoreSequence.metadata["familyId"]
        ) ?? null)
      : null
  );
  const activeTeachingContent = $derived(
    activeCoreSequence
      ? getLearningLetterTeachingContent(activeCoreSequence.word)
      : null
  );

  const announcement = $derived.by(() => {
    if (stepIndex === 0) return "Learning Letters";
    if (stepIndex === recapStepIndex) return "Six-word recap";
    const sequence = coreSequences[activeCoreIndex];
    return sequence
      ? `Word ${activeCoreIndex + 1} of ${LEARNING_LETTERS_CORE_WORDS.length}: ${displayWord(sequence)}`
      : "";
  });

  function displayWord(sequence: SequenceData): string {
    return simplifyRepeatedWord(sequence.word || sequence.name);
  }

  function saveProgress(): void {
    persistence.saveStep(stepIndex + 1);
    persistence.savePhaseData("schemaVersion", LEARNING_LETTERS_SCHEMA_VERSION);
  }

  async function loadDeck(): Promise<void> {
    loadState = "loading";
    loadError = null;
    try {
      const loaded = await loadFoundingCollectionSequences("founding_tka-1");
      const wordsInDeck = new Set(loaded.map((sequence) => sequence.word));
      const missingCore = LEARNING_LETTERS_CORE_WORDS.filter(
        (word) => !wordsInDeck.has(word)
      );
      const wordsWithTeachingSlots = new Set(
        LEARNING_LETTER_TEACHING_CONTENT.map((content) => content.word)
      );
      const missingTeachingSlots = loaded
        .map((sequence) => sequence.word)
        .filter((word) => !wordsWithTeachingSlots.has(word));
      if (missingCore.length > 0 || missingTeachingSlots.length > 0) {
        const details = [
          missingCore.length > 0 ? `core words: ${missingCore.join(", ")}` : "",
          missingTeachingSlots.length > 0
            ? `teaching slots: ${missingTeachingSlots.join(", ")}`
            : "",
        ].filter(Boolean);
        throw new Error(
          `Learning Letters deck is missing ${details.join("; ")}`
        );
      }

      sequences = loaded;
      const normalized = normalizeLearningLettersProgress(persistence.load());
      stepIndex = normalized.progress.stepIndex;
      if (normalized.migrated) {
        persistence.reset();
        saveProgress();
      }
      loadState = "ready";
    } catch (caught) {
      console.error("Learning Letters deck failed to load", caught);
      loadError = "The Learning Letters deck could not be loaded.";
      loadState = "error";
    }
  }

  onMount(() => {
    void loadDeck();
  });

  function goToStep(next: number): void {
    const clamped = Math.min(recapStepIndex, Math.max(0, next));
    if (clamped === stepIndex) return;
    stepIndex = clamped;
    saveProgress();
    haptic?.trigger("selection");
  }

  function complete(): void {
    persistence.reset();
    haptic?.trigger("success");
    onComplete?.();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (viewMode !== "step" || loadState !== "ready") return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      goToStep(stepIndex + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      handleBack();
    }
  }

  export function handleBack(): void {
    if (stepIndex > 0) {
      goToStep(stepIndex - 1);
      return;
    }
    onBack?.();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="experience"
  class:review-mode={viewMode === "scroll"}
  bind:clientWidth={shellWidth}
  onkeydown={handleKeydown}
  tabindex="0"
  role="application"
  aria-label="Learning Letters lesson, use arrow keys to navigate"
>
  {#if loadState === "loading"}
    <section class="load-state" role="status">
      <ProgressRing percent={-1} size={44} strokeWidth={3} />
      <p>Loading Learning Letters…</p>
    </section>
  {:else if loadState === "error"}
    <section class="load-state" role="alert">
      <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
      <p>{loadError}</p>
      <PanelButton variant="secondary" onclick={loadDeck}>
        <i class="fa-solid fa-arrow-rotate-right" aria-hidden="true"></i>
        <span>Try again</span>
      </PanelButton>
    </section>
  {:else}
    <main class="lesson-shell">
      <div class="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {#if stepIndex === 0}
        <section class="intro-step" aria-labelledby="learning-letters-title">
          <p class="eyebrow">TKA 1</p>
          <h1 id="learning-letters-title">Learning Letters</h1>
          <!-- Guide prose, verbatim from AlphaBetaWordsPage.svelte. -->
          <p class="guide-prose">
            The first words we will learn correspond to VTG’s 1:1 motions.<br />
            To execute these,
            <strong
              ><em>you’ll need to use body turns and/or negative space</em
              ></strong
            >.
          </p>
          <div
            class="word-preview"
            role="img"
            aria-label={`The six words: ${coreSequences.map(displayWord).join(", ")}`}
          >
            {#each coreSequences as sequence (sequence.id)}
              <span class="preview-glyph">
                <TKAWordGlyph
                  word={displayWord(sequence)}
                  height={Math.round(30 * glyphScale)}
                  darkMode
                  fitToParent
                />
              </span>
            {/each}
          </div>
        </section>
      {:else if activeCoreSequence && activeCoreFamily}
        <section
          class="word-step"
          aria-label={`Word ${activeCoreIndex + 1} of ${LEARNING_LETTERS_CORE_WORDS.length}: ${displayWord(activeCoreSequence)}`}
          style:--family-accent={activeCoreFamily.element.accentColor}
        >
          <header class="word-header">
            <span class="family-identity">
              <img src={activeCoreFamily.element.iconPath} alt="" />
              <span>{activeCoreFamily.element.name}</span>
            </span>
            <span class="sequence-position">
              Word {activeCoreIndex + 1} / {LEARNING_LETTERS_CORE_WORDS.length}
            </span>
          </header>
          <div class="word-stage">
            <LearningWordStage
              sequence={activeCoreSequence}
              content={activeTeachingContent}
            />
          </div>
        </section>
      {:else}
        <section class="recap-step" aria-labelledby="learning-letters-title">
          <header class="recap-header">
            <p class="eyebrow">Lesson recap</p>
            <h1 id="learning-letters-title">Six words</h1>
            <!-- Guide prose, verbatim from AlphaBetaWordsPage.svelte. -->
            <p class="guide-prose practice-prose">
              <strong
                >Practice each word once in both directions, then again starting
                with thumbs out.</strong
              >
            </p>
          </header>

          <div class="recap-families">
            {#each coreFamilies as family (family.element.familyId)}
              <section
                class="recap-family"
                style:--family-accent={family.element.accentColor}
                aria-label={family.element.name}
              >
                <header class="family-heading">
                  <span class="family-identity">
                    <img src={family.element.iconPath} alt="" />
                    <span>{family.element.name}</span>
                  </span>
                  <span>{family.sequences.length} words</span>
                </header>
                <div class="recap-word-grid">
                  {#each family.sequences as sequence (sequence.id)}
                    {@const coreIndex = coreSequences.findIndex(
                      (candidate) => candidate.id === sequence.id
                    )}
                    <button
                      type="button"
                      class="recap-word"
                      aria-label={`Review ${displayWord(sequence)}`}
                      onclick={() => goToStep(coreIndex + 1)}
                    >
                      <TKAWordGlyph
                        word={displayWord(sequence)}
                        height={Math.round(38 * glyphScale)}
                        darkMode
                        fitToParent
                      />
                      <span>Word {coreIndex + 1}</span>
                    </button>
                  {/each}
                </div>
              </section>
            {/each}
          </div>
        </section>
      {/if}

      <footer class="lesson-actions">
        <PanelButton
          variant="secondary"
          onclick={handleBack}
          disabled={stepIndex <= 0}
        >
          <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
          <span>Previous</span>
        </PanelButton>
        <ExperienceProgressIndicator
          currentStep={stepIndex + 1}
          totalSteps={LEARNING_LETTERS_TOTAL_STEPS}
        />
        {#if stepIndex === recapStepIndex}
          <PanelButton variant="primary" onclick={complete}>
            <span>Finish lesson</span>
            <i class="fa-solid fa-check" aria-hidden="true"></i>
          </PanelButton>
        {:else}
          <PanelButton
            variant="primary"
            onclick={() => goToStep(stepIndex + 1)}
          >
            <span>Next</span>
            <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </PanelButton>
        {/if}
      </footer>
    </main>
  {/if}
</div>

<style>
  .experience {
    container: learning-letters / inline-size;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    background: transparent;
    color: var(--theme-text, #fff);
    scrollbar-gutter: stable;
    outline: none;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .lesson-shell {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    width: min(100%, 126rem);
    min-height: 100%;
    margin-inline: auto;
    padding: clamp(4.6rem, 5.5cqw, 6rem) clamp(0.75rem, 2.2cqw, 2.5rem)
      clamp(1rem, 2cqw, 2rem);
  }

  .eyebrow {
    margin: 0;
    color: var(--theme-accent);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0.15rem 0 0 !important;
    font-size: clamp(1.6rem, 2.1cqw, 2.7rem);
    line-height: 1.05;
  }

  .guide-prose {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: clamp(1rem, 1.3cqw, 1.2rem);
    line-height: 1.55;
  }

  .guide-prose strong,
  .guide-prose em {
    color: var(--theme-text);
  }

  .intro-step,
  .recap-step {
    align-self: center;
    width: 100%;
  }

  .intro-step {
    display: grid;
    justify-items: center;
    gap: clamp(0.9rem, 1.4cqw, 1.5rem);
    text-align: center;
  }

  .intro-step .guide-prose {
    max-width: 60ch;
  }

  .word-preview {
    display: grid;
    grid-template-columns: repeat(6, minmax(3.5rem, 6.5rem));
    justify-content: center;
    gap: clamp(0.5rem, 1cqw, 1rem);
    margin-top: clamp(0.5rem, 1cqw, 1rem);
  }

  .preview-glyph {
    display: grid;
    place-items: center;
    height: 3.4rem;
    padding: 0.4rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-md, 0.5rem);
    background: color-mix(in srgb, var(--theme-card-bg) 78%, transparent);
    overflow: hidden;
  }

  .word-step {
    align-self: center;
    width: 100%;
    min-width: 0;
  }

  .word-header,
  .family-heading,
  .lesson-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .word-header {
    min-height: 3.75rem;
    padding: 0.65rem 0.9rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-lg, 0.75rem);
    background: color-mix(
      in srgb,
      var(--family-accent, var(--theme-accent)) 12%,
      color-mix(in srgb, var(--theme-panel-bg) 82%, transparent)
    );
  }

  .family-identity {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    color: var(--theme-text);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
  }

  .family-identity img {
    width: 1.25rem;
    height: 1.25rem;
    object-fit: contain;
  }

  .sequence-position {
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 0.875rem);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }

  .word-stage {
    min-width: 0;
    margin-top: clamp(0.65rem, 0.9cqw, 1rem);
  }

  .recap-step {
    display: grid;
    gap: clamp(1rem, 1.4cqw, 1.5rem);
    max-width: 96rem;
    margin-inline: auto;
  }

  .recap-header {
    display: grid;
    justify-items: center;
    gap: 0.6rem;
    text-align: center;
  }

  .practice-prose {
    max-width: 68ch;
  }

  .recap-families {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: clamp(0.8rem, 1.2cqw, 1.25rem);
  }

  .recap-family {
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-lg, 0.75rem);
    background: color-mix(in srgb, var(--theme-panel-bg) 78%, transparent);
  }

  .family-heading {
    min-height: 3.25rem;
    padding: 0.6rem 0.8rem;
    border-bottom: 1px solid var(--theme-stroke);
    background: color-mix(
      in srgb,
      var(--family-accent, var(--theme-accent)) 11%,
      color-mix(in srgb, var(--theme-card-bg) 78%, transparent)
    );
  }

  .family-heading > span:last-child {
    color: var(--theme-text-dim);
    font-size: var(--font-size-xs, 0.75rem);
    font-weight: 700;
  }

  .recap-word-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(0.5rem, 0.8cqw, 0.8rem);
    padding: clamp(0.65rem, 1cqw, 1rem);
  }

  .recap-word {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 0.65rem;
    min-width: 0;
    min-height: clamp(7rem, 9cqw, 9rem);
    padding: 0.75rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-md, 0.5rem);
    background: color-mix(in srgb, var(--theme-card-bg) 78%, transparent);
    color: var(--theme-text-dim);
    font: inherit;
    font-size: var(--font-size-xs, 0.75rem);
    font-weight: 700;
    cursor: pointer;
    transition:
      border-color var(--duration-fast) ease,
      background var(--duration-fast) ease,
      transform var(--duration-fast) ease;
  }

  .recap-word:hover {
    border-color: var(--theme-stroke-strong, var(--theme-accent));
    background: var(--theme-card-hover-bg);
    transform: translateY(-2px);
  }

  .recap-word:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .lesson-actions {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    margin-top: clamp(0.75rem, 1.2cqw, 1.25rem);
  }

  .lesson-actions > :global(:first-child) {
    justify-self: start;
  }

  .lesson-actions > :global(:last-child) {
    justify-self: end;
  }

  .load-state {
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 1rem;
    min-height: 100%;
    color: var(--theme-text-dim);
    text-align: center;
  }

  .load-state > i {
    color: var(--semantic-error);
    font-size: 1.8rem;
  }

  .load-state p {
    margin: 0;
    font-size: var(--font-size-min, 0.875rem);
  }

  @container learning-letters (max-width: 760px) {
    .lesson-shell {
      padding-top: 4.15rem;
      padding-inline: 0.55rem;
    }

    .word-preview {
      grid-template-columns: repeat(3, minmax(4.5rem, 7rem));
    }

    .word-header {
      min-height: 3.25rem;
      padding: 0.5rem 0.65rem;
    }

    .family-identity > span {
      display: none;
    }

    .recap-families {
      grid-template-columns: minmax(0, 1fr);
    }

    .recap-family .family-identity > span {
      display: inline;
    }

    .recap-word {
      min-height: 7rem;
      padding: 0.5rem;
    }

    .lesson-actions {
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }

    .lesson-actions :global(.progress-indicator) {
      grid-column: 1 / -1;
      grid-row: 2;
      justify-self: center;
    }

    .lesson-actions :global(.panel-btn) {
      width: 100%;
    }
  }

  @container learning-letters (max-width: 420px) {
    h1 {
      font-size: 1.45rem;
    }

    .recap-word-grid {
      gap: 0.4rem;
      padding: 0.5rem;
    }

    .recap-word {
      gap: 0.35rem;
      min-height: 5rem;
    }

    .recap-header {
      gap: 0.35rem;
    }

    .recap-header .guide-prose {
      line-height: 1.35;
    }

    .recap-family .family-heading {
      min-height: 2.75rem;
    }
  }

  @container learning-letters (min-width: 1680px) {
    .lesson-shell {
      width: min(100%, 136rem);
    }

    .word-step {
      width: min(100%, 124rem);
      margin-inline: auto;
    }
  }

  @container learning-letters (min-width: 2600px) {
    .lesson-shell {
      width: min(100%, 214rem);
    }

    .word-step {
      width: min(100%, 200rem);
    }

    .recap-step {
      max-width: 160rem;
    }

    .recap-step h1 {
      font-size: 3.8rem;
    }

    .recap-step .guide-prose {
      font-size: 1.45rem;
    }

    .recap-word {
      min-height: 12rem;
    }

    .family-identity img {
      width: 1.6rem;
      height: 1.6rem;
    }

    .word-header {
      min-height: 4.25rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .recap-word {
      transition: none;
    }
  }
</style>
