<script lang="ts">
  import { onMount } from "svelte";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { loadCanonicalLearningLettersSequences } from "$lib/features/browse/gallery-home/canonical-tnd-pool";
  import {
    TND_ELEMENTS,
    type TnDElement,
  } from "$lib/features/choreo-card/domain/tnd-element";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
  import type { ExperienceViewMode } from "../../../domain/types";
  import { getExperiencePersistence } from "../../../state/experience-persistence.svelte";
  import ExperienceProgressIndicator from "../ExperienceProgressIndicator.svelte";
  import WordSequencePair from "./WordSequencePair.svelte";

  type LoadState = "loading" | "ready" | "error";
  type AnswerState = "correct" | "wrong" | null;

  interface LearningLettersFamily {
    element: TnDElement;
    sequences: readonly SequenceData[];
  }

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

  let phase = $state(Math.min(3, Math.max(1, saved.step || 1)));
  let loadState = $state<LoadState>("loading");
  let loadError = $state<string | null>(null);
  let sequences = $state<readonly SequenceData[]>([]);
  let selectedSequenceId = $state(
    persistence.getPhaseData<string>("selectedSequenceId", "")
  );
  let challengeFamilyIndex = $state(
    Math.min(
      TND_ELEMENTS.length - 1,
      Math.max(0, persistence.getPhaseData<number>("challengeFamilyIndex", 0))
    )
  );
  let selectedAnswerId = $state<string | null>(null);
  let answerState = $state<AnswerState>(null);
  let experienceElement = $state<HTMLDivElement | null>(null);

  const families = $derived.by((): LearningLettersFamily[] =>
    TND_ELEMENTS.map((element) => ({
      element,
      sequences: sequences.filter(
        (sequence) => sequence.metadata["familyId"] === element.familyId
      ),
    })).filter((family) => family.sequences.length > 0)
  );

  const selectedSequence = $derived(
    sequences.find((sequence) => sequence.id === selectedSequenceId) ??
      sequences[0] ??
      null
  );

  const selectedFamily = $derived(
    selectedSequence
      ? (families.find(
          (family) =>
            family.element.familyId === selectedSequence.metadata["familyId"]
        ) ?? null)
      : null
  );

  const activeFamily = $derived(families[challengeFamilyIndex] ?? null);

  const activeTarget = $derived.by(() => {
    const family = activeFamily;
    if (!family || family.sequences.length === 0) return null;
    return (
      family.sequences[(challengeFamilyIndex + 1) % family.sequences.length] ??
      null
    );
  });

  const selectedAnswer = $derived(
    selectedAnswerId
      ? (sequences.find((sequence) => sequence.id === selectedAnswerId) ?? null)
      : null
  );

  function displayWord(sequence: SequenceData): string {
    return simplifyRepeatedWord(sequence.word || sequence.name);
  }

  async function loadDeck(): Promise<void> {
    loadState = "loading";
    loadError = null;

    try {
      const loaded = await loadCanonicalLearningLettersSequences();
      if (loaded.length !== 19) {
        throw new Error(
          `Learning Letters resolved ${loaded.length} cards instead of 19`
        );
      }

      sequences = loaded;
      if (!loaded.some((sequence) => sequence.id === selectedSequenceId)) {
        selectedSequenceId = loaded[0]?.id ?? "";
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

  function chooseSequence(sequence: SequenceData): void {
    selectedSequenceId = sequence.id;
    persistence.savePhaseData("selectedSequenceId", sequence.id);
    haptic?.trigger("selection");
  }

  function resetLessonScroll(): void {
    requestAnimationFrame(() => {
      experienceElement?.scrollTo({ top: 0, behavior: "auto" });
      experienceElement?.scrollIntoView({ block: "start", behavior: "auto" });
    });
  }

  function goToPhase(nextPhase: number): void {
    phase = Math.min(3, Math.max(1, nextPhase));
    persistence.saveStep(phase);
    selectedAnswerId = null;
    answerState = null;
    haptic?.trigger("selection");
    resetLessonScroll();
  }

  function answerQuestion(sequence: SequenceData): void {
    if (!activeTarget || answerState === "correct") return;
    selectedAnswerId = sequence.id;
    answerState = sequence.id === activeTarget.id ? "correct" : "wrong";
    haptic?.trigger(answerState === "correct" ? "success" : "warning");
  }

  function nextChallenge(): void {
    if (challengeFamilyIndex < families.length - 1) {
      challengeFamilyIndex += 1;
      persistence.savePhaseData("challengeFamilyIndex", challengeFamilyIndex);
      selectedAnswerId = null;
      answerState = null;
      haptic?.trigger("selection");
      resetLessonScroll();
      return;
    }
    goToPhase(3);
  }

  function complete(): void {
    persistence.reset();
    haptic?.trigger("success");
    onComplete?.();
  }

  export function handleBack(): void {
    if (phase === 2 && challengeFamilyIndex > 0) {
      challengeFamilyIndex -= 1;
      persistence.savePhaseData("challengeFamilyIndex", challengeFamilyIndex);
      selectedAnswerId = null;
      answerState = null;
      resetLessonScroll();
      return;
    }
    if (phase > 1) goToPhase(phase - 1);
  }
</script>

{#snippet cardArtwork(sequence: SequenceData)}
  <ChoreoCard
    {sequence}
    showWord
    showStepNumbers
    showDifficultyLevel={false}
    includeStartPosition
    showNotes={false}
    showLoopGlyph={false}
    showQRCode={false}
    darkMode
    forceContain
    bluePropType={PropType.STAFF}
    redPropType={PropType.STAFF}
  />
{/snippet}

<div
  class="experience"
  class:review-mode={viewMode === "scroll"}
  bind:this={experienceElement}
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
  {:else if selectedSequence}
    {#if phase === 1}
      <section class="explore" aria-labelledby="learning-letters-title">
        <header class="deck-header">
          <div>
            <p class="eyebrow">TKA 1</p>
            <h1 id="learning-letters-title">Learning Letters</h1>
          </div>
          <p class="deck-count">19 words · 6 families</p>
        </header>

        <div class="explore-layout">
          <div class="stage-column">
            <header class="stage-header">
              {#if selectedFamily}
                <span class="family-identity">
                  <img src={selectedFamily.element.iconPath} alt="" />
                  <span>{selectedFamily.element.name}</span>
                </span>
              {/if}
              <TKAWordGlyph
                word={displayWord(selectedSequence)}
                height={34}
                darkMode
                fitToParent
              />
            </header>
            <WordSequencePair sequence={selectedSequence} />
          </div>

          <div class="deck-column" aria-label="Learning Letters deck">
            {#each families as family (family.element.familyId)}
              <section
                class="family-section"
                style:--family-accent={family.element.accentColor}
                aria-labelledby={`family-${family.element.familyId}`}
              >
                <header class="family-header">
                  <span class="family-name">
                    <img src={family.element.iconPath} alt="" />
                    <span id={`family-${family.element.familyId}`}>
                      {family.element.name}
                    </span>
                  </span>
                  <span class="family-count">{family.sequences.length}</span>
                </header>

                <div
                  class="family-cards themed-scrollbar"
                  class:four-up={family.sequences.length === 4}
                >
                  {#each family.sequences as sequence (sequence.id)}
                    <button
                      type="button"
                      class="deck-card"
                      class:selected={selectedSequence.id === sequence.id}
                      aria-pressed={selectedSequence.id === sequence.id}
                      aria-label={`Inspect ${displayWord(sequence)}`}
                      onclick={() => chooseSequence(sequence)}
                    >
                      {@render cardArtwork(sequence)}
                    </button>
                  {/each}
                </div>
              </section>
            {/each}
          </div>
        </div>

        <footer class="phase-action">
          <PanelButton variant="primary" onclick={() => goToPhase(2)}>
            <span>Practice the deck</span>
            <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </PanelButton>
        </footer>
      </section>
    {:else if phase === 2 && activeFamily && activeTarget}
      <section class="challenge" aria-labelledby="word-check-title">
        <header class="challenge-header">
          <div class="challenge-family">
            <img src={activeFamily.element.iconPath} alt="" />
            <span>{activeFamily.element.name}</span>
            <span aria-hidden="true">·</span>
            <span>{challengeFamilyIndex + 1} of {families.length}</span>
          </div>
          <h1 id="word-check-title">Find the word</h1>
          <TKAWordGlyph
            word={displayWord(activeTarget)}
            height={58}
            darkMode
            fitToParent
          />
          <p>Choose the matching card.</p>
        </header>

        <div
          class="answer-grid"
          class:four-up={activeFamily.sequences.length === 4}
          aria-label={`Choose ${displayWord(activeTarget)}`}
        >
          {#each activeFamily.sequences as sequence (sequence.id)}
            <button
              type="button"
              class="answer-card"
              class:correct={answerState !== null &&
                sequence.id === activeTarget.id}
              class:wrong={answerState === "wrong" &&
                selectedAnswerId === sequence.id}
              disabled={answerState === "correct"}
              aria-label={`Choose ${displayWord(sequence)}`}
              onclick={() => answerQuestion(sequence)}
            >
              {@render cardArtwork(sequence)}
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
            {#if answerState === "wrong" && selectedAnswer}
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
              <span>You chose</span>
              <TKAWordGlyph
                word={displayWord(selectedAnswer)}
                height={20}
                darkMode
              />
              <span>.</span>
            {:else if answerState === "correct"}
              <i class="fa-solid fa-check" aria-hidden="true"></i>
              <span>Matched.</span>
            {:else}
              <i class="fa-solid fa-hand-pointer" aria-hidden="true"></i>
              <span>Choose one card.</span>
            {/if}
          </div>

          <PanelButton
            variant="primary"
            disabled={answerState !== "correct"}
            onclick={nextChallenge}
          >
            <span>
              {challengeFamilyIndex === families.length - 1
                ? "Review the deck"
                : "Next family"}
            </span>
            <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </PanelButton>
        </div>
      </section>
    {:else}
      <section class="summary" aria-labelledby="words-summary-title">
        <header class="summary-header">
          <div>
            <p class="eyebrow">TKA 1</p>
            <h1 id="words-summary-title">Learning Letters complete</h1>
          </div>
          <p>19 words · 6 families</p>
        </header>

        <div class="summary-families">
          {#each families as family (family.element.familyId)}
            <section
              class="summary-family"
              style:--family-accent={family.element.accentColor}
            >
              <header class="family-header">
                <span class="family-name">
                  <img src={family.element.iconPath} alt="" />
                  <span>{family.element.name}</span>
                </span>
              </header>
              <div class="summary-words">
                {#each family.sequences as sequence (sequence.id)}
                  <span class="summary-word">
                    <TKAWordGlyph
                      word={displayWord(sequence)}
                      height={28}
                      darkMode
                      fitToParent
                    />
                  </span>
                {/each}
              </div>
            </section>
          {/each}
        </div>

        <footer class="phase-action">
          <PanelButton variant="primary" onclick={complete}>
            <span>Complete lesson</span>
            <i class="fa-solid fa-check" aria-hidden="true"></i>
          </PanelButton>
        </footer>
      </section>
    {/if}

    <ExperienceProgressIndicator currentStep={phase} totalSteps={3} />
  {/if}
</div>

<style>
  .experience {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: var(--spacing-sm, 0.75rem);
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 4.5rem clamp(0.75rem, 1.8cqw, 2.25rem) 0.75rem;
    overflow: auto;
    color: var(--theme-text);
    container-type: inline-size;
  }

  .explore,
  .challenge,
  .summary {
    width: 100%;
    min-width: 0;
  }

  .explore,
  .summary {
    display: grid;
    align-content: start;
    gap: clamp(0.85rem, 1.2cqw, 1.35rem);
  }

  .deck-header,
  .summary-header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 0.8rem;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .eyebrow {
    margin: 0 0 0.2rem;
    color: var(--theme-accent);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 750;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    color: var(--theme-text);
    font-size: clamp(1.8rem, 2.1cqw, 3rem);
    font-weight: 760;
    letter-spacing: -0.035em;
    line-height: 1.05;
  }

  .deck-count,
  .summary-header > p:last-child,
  .challenge-header > p {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 0.875rem);
    font-variant-numeric: tabular-nums;
  }

  .explore-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.18fr) minmax(32rem, 0.82fr);
    align-items: start;
    gap: clamp(1rem, 1.6cqw, 2rem);
    min-width: 0;
  }

  .stage-column {
    position: sticky;
    top: 0;
    display: grid;
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-lg, 0.75rem);
    background: var(--theme-panel-bg);
    container-type: inline-size;
  }

  .stage-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 1rem;
    min-height: 3.5rem;
    padding: 0.65rem 0.85rem;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .stage-header :global(.tka-word-glyph) {
    max-width: min(18rem, 45cqw);
  }

  .family-identity,
  .family-name,
  .challenge-family {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    min-width: 0;
    color: var(--theme-text);
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 680;
  }

  .family-identity img,
  .family-name img,
  .challenge-family img {
    width: 1.6rem;
    height: 1.6rem;
    flex: none;
    object-fit: contain;
  }

  .deck-column {
    display: grid;
    gap: clamp(1rem, 1.3cqw, 1.5rem);
    min-width: 0;
  }

  .family-section,
  .summary-family {
    display: grid;
    gap: 0.6rem;
    min-width: 0;
  }

  .family-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    min-height: 2rem;
  }

  .family-count {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }

  .family-cards,
  .answer-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(0.45rem, 0.7cqw, 0.8rem);
    min-width: 0;
  }

  .family-cards.four-up,
  .answer-grid.four-up {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .deck-card,
  .answer-card {
    position: relative;
    display: grid;
    min-width: 0;
    padding: 0;
    overflow: visible;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    aspect-ratio: 4 / 3;
    container: image-container / size;
  }

  .deck-card :global(.choreo-card-root),
  .answer-card :global(.choreo-card-root) {
    width: 100%;
    height: 100%;
  }

  .deck-card:hover,
  .answer-card:hover:not(:disabled) {
    box-shadow: 0 0 0 1px var(--theme-stroke-strong);
  }

  .deck-card.selected {
    z-index: 2;
    box-shadow:
      0 0 0 2px var(--theme-panel-bg),
      0 0 0 4px var(--family-accent);
  }

  .deck-card:focus-visible,
  .answer-card:focus-visible {
    z-index: 3;
    outline: 2px solid var(--theme-accent-strong);
    outline-offset: 3px;
  }

  .phase-action {
    display: flex;
    justify-content: flex-end;
  }

  .challenge {
    display: grid;
    align-content: safe center;
    gap: clamp(1rem, 1.5cqw, 1.8rem);
    min-height: 100%;
    max-width: min(132rem, 94cqw);
    margin-inline: auto;
  }

  .challenge-header {
    display: grid;
    justify-items: center;
    gap: 0.55rem;
    text-align: center;
  }

  .challenge-family {
    color: var(--theme-text-dim);
  }

  .challenge-header :global(.tka-word-glyph) {
    width: auto;
    max-width: min(34rem, 80cqw);
  }

  .answer-card.correct {
    z-index: 2;
    box-shadow:
      0 0 0 2px var(--theme-panel-bg),
      0 0 0 4px var(--semantic-success);
  }

  .answer-card.wrong {
    z-index: 2;
    box-shadow:
      0 0 0 2px var(--theme-panel-bg),
      0 0 0 4px var(--semantic-error);
  }

  .answer-card:disabled {
    cursor: default;
  }

  .answer-dock {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 1rem;
    min-height: 4.5rem;
    padding: 0.7rem 0.8rem 0.7rem 1rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-md, 0.5rem);
    background: var(--theme-panel-bg);
  }

  .answer-message {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
    min-width: 0;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 0.875rem);
  }

  .answer-message > i {
    width: 1.2rem;
    color: var(--theme-accent);
    text-align: center;
  }

  .answer-dock.wrong-state .answer-message > i {
    color: var(--semantic-error);
  }

  .answer-dock.correct-state .answer-message > i {
    color: var(--semantic-success);
  }

  .summary {
    max-width: 100rem;
    margin-inline: auto;
  }

  .summary-families {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: clamp(1rem, 1.5cqw, 1.6rem);
  }

  .summary-family {
    padding: 0.85rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-md, 0.5rem);
    background: var(--theme-card-bg);
  }

  .summary-words {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .summary-word {
    display: grid;
    place-items: center;
    min-height: 3.5rem;
    padding: 0.5rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-sm, 0.35rem);
    background: var(--theme-panel-bg);
  }

  .summary-word :global(.tka-word-glyph) {
    max-width: 100%;
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

  :global(.experience > .progress-indicator) {
    justify-self: center;
  }

  @container (max-width: 1180px) {
    .explore-layout {
      grid-template-columns: 1fr;
    }

    .stage-column {
      position: static;
    }

    .answer-grid.four-up {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @container (max-width: 780px) {
    .experience {
      padding: 4rem 0.65rem 0.6rem;
    }

    .deck-header,
    .summary-header {
      align-items: start;
      flex-direction: column;
      gap: 0.45rem;
    }

    .family-cards,
    .family-cards.four-up {
      grid-template-columns: none;
      grid-auto-flow: column;
      grid-auto-columns: minmax(13rem, 74cqw);
      padding: 0.2rem 0.25rem 0.55rem;
      overflow-x: auto;
      scroll-snap-type: x proximity;
      overscroll-behavior-inline: contain;
    }

    .deck-card {
      scroll-snap-align: start;
    }

    .answer-grid,
    .answer-grid.four-up {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      width: 100%;
      margin-inline: auto;
    }

    .answer-grid.four-up {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .answer-dock {
      grid-template-columns: 1fr;
      align-items: stretch;
    }

    .answer-dock :global(.panel-btn),
    .phase-action :global(.panel-btn) {
      width: 100%;
    }

    .phase-action {
      display: block;
    }

    .summary-families {
      grid-template-columns: 1fr;
    }
  }

  @container (max-width: 480px) {
    .stage-header {
      grid-template-columns: 1fr;
      justify-items: start;
    }

    .stage-header :global(.tka-word-glyph) {
      max-width: 70cqw;
    }

    .summary-words {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .answer-grid,
    .answer-grid.four-up {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @container (min-width: 1680px) {
    .experience {
      padding-inline: 2.5cqw;
    }

    .explore-layout {
      grid-template-columns: minmax(0, 1.3fr) minmax(38rem, 0.7fr);
    }

    .summary-families {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @container (min-width: 2600px) {
    .experience {
      padding-top: 5.25rem;
    }

    .explore-layout {
      grid-template-columns: minmax(0, 1.4fr) minmax(48rem, 0.6fr);
    }

    h1 {
      font-size: clamp(2.8rem, 1.9cqw, 4.4rem);
    }
  }

  @media (max-height: 620px) and (min-width: 781px) {
    .experience {
      padding-top: 3.75rem;
    }

    .deck-header {
      padding-bottom: 0.45rem;
    }

    .explore-layout {
      grid-template-columns: minmax(0, 1.1fr) minmax(30rem, 0.9fr);
    }

    .stage-column {
      position: static;
    }

    :global(.experience > .progress-indicator) {
      display: none;
    }
  }
</style>
