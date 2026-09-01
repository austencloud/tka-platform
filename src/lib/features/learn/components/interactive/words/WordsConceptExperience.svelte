<script lang="ts">
  import { onMount } from "svelte";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { loadFoundingCollectionSequences } from "$lib/features/browse/collections/config/founding-collections";
  import {
    TND_ELEMENTS,
    type TnDElement,
  } from "$lib/features/choreo-card/domain/tnd-element";
  import ChoreoCardThumbnail from "$lib/shared/browse/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { ExperienceViewMode } from "../../../domain/types";
  import { getExperiencePersistence } from "../../../state/experience-persistence.svelte";
  import ExperienceProgressIndicator from "../ExperienceProgressIndicator.svelte";
  import WordSequencePair from "./WordSequencePair.svelte";
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
  const capstoneStepIndex = LEARNING_LETTERS_TOTAL_STEPS - 1;

  let loadState = $state<LoadState>("loading");
  let loadError = $state<string | null>(null);
  let sequences = $state<readonly SequenceData[]>([]);
  let stepIndex = $state(0);
  let selectedSequenceId = $state("");
  let visitedSequenceIds = $state<string[]>([]);
  let shellWidth = $state(0);

  // TKAWordGlyph sizes via a px prop, so the big-screen scale step has to be
  // computed here rather than in the container-query tiers below. Same seams:
  // 1680 and 2600 (4k-native-layout.md).
  const glyphScale = $derived(
    shellWidth >= 2600 ? 1.45 : shellWidth >= 1680 ? 1.15 : 1
  );

  // The six guide words (lt1-abc-ghi order) resolved from the loaded deck.
  const coreSequences = $derived(
    LEARNING_LETTERS_CORE_WORDS.flatMap((word) => {
      const match = sequences.find((sequence) => sequence.word === word);
      return match ? [match] : [];
    })
  );
  const activeCoreIndex = $derived(stepIndex - 1);
  const activeCoreSequence = $derived(coreSequences[activeCoreIndex] ?? null);

  const families = $derived.by((): LearningLettersFamily[] =>
    TND_ELEMENTS.map((element) => ({
      element,
      sequences: sequences.filter(
        (sequence) => sequence.metadata["familyId"] === element.familyId
      ),
    })).filter((family) => family.sequences.length > 0)
  );
  const activeCoreFamily = $derived(
    activeCoreSequence
      ? (families.find(
          (family) =>
            family.element.familyId === activeCoreSequence.metadata["familyId"]
        ) ?? null)
      : null
  );

  const selectedSequenceIndex = $derived(
    sequences.findIndex((sequence) => sequence.id === selectedSequenceId)
  );
  const selectedSequence = $derived(
    sequences[selectedSequenceIndex] ?? sequences[0] ?? null
  );
  const selectedFamily = $derived(
    selectedSequence
      ? (families.find(
          (family) =>
            family.element.familyId === selectedSequence.metadata["familyId"]
        ) ?? null)
      : null
  );
  const visitedIds = $derived(new Set(visitedSequenceIds));
  const familyOptions = $derived(
    families.map((family) => {
      const shortLabel = family.element.name
        .split("-")
        .map((part) => part[0])
        .join("");
      return {
        value: family.element.familyId,
        label: family.element.name,
        shortLabel,
        ariaLabel: `${shortLabel} ${family.sequences.length}, ${family.element.name} cards`,
        count: family.sequences.length,
        id: `learning-letters-tab-${family.element.familyId}`,
        controls: `learning-letters-family-${family.element.familyId}`,
      };
    })
  );

  const announcement = $derived.by(() => {
    if (stepIndex === 0) return "Learning Letters";
    if (stepIndex === capstoneStepIndex) return "The full deck";
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
    persistence.savePhaseData("selectedSequenceId", selectedSequenceId);
    persistence.savePhaseData("visitedSequenceIds", visitedSequenceIds);
  }

  function markVisited(sequenceId: string): void {
    if (!visitedIds.has(sequenceId)) {
      visitedSequenceIds = [...visitedSequenceIds, sequenceId];
    }
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
      if (missingCore.length > 0) {
        throw new Error(
          `Learning Letters deck is missing core words: ${missingCore.join(", ")}`
        );
      }
      sequences = loaded;
      const normalized = normalizeLearningLettersProgress(
        persistence.load(),
        loaded.map((sequence) => sequence.id)
      );
      stepIndex = normalized.progress.stepIndex;
      selectedSequenceId = normalized.progress.selectedSequenceId;
      visitedSequenceIds = normalized.progress.visitedSequenceIds;
      if (normalized.migrated) {
        // Drop stale keys from rejected builds (e.g. questionIndex) instead
        // of carrying them alongside the v3 shape forever.
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
    stepIndex = Math.min(capstoneStepIndex, Math.max(0, next));
    const core = coreSequences[stepIndex - 1];
    if (core) markVisited(core.id);
    saveProgress();
    haptic?.trigger("selection");
  }

  function chooseSequence(sequence: SequenceData): void {
    selectedSequenceId = sequence.id;
    markVisited(sequence.id);
    saveProgress();
    haptic?.trigger("selection");
  }

  function chooseFamily(familyId: string): void {
    const family = families.find(
      (candidate) => candidate.element.familyId === familyId
    );
    const first = family?.sequences[0];
    if (first) chooseSequence(first);
  }

  function complete(): void {
    persistence.reset();
    haptic?.trigger("success");
    onComplete?.();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (viewMode !== "step" || loadState !== "ready") return;
    // The capstone's deck browser owns its own keyboard interaction.
    if (stepIndex === capstoneStepIndex) return;
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

{#snippet familyTab(familyId: string)}
  {@const family = families.find(
    (candidate) => candidate.element.familyId === familyId
  )}
  {@const option = familyOptions.find(
    (candidate) => candidate.value === familyId
  )}
  {#if family && option}
    <span class="family-tab-content">
      <img src={family.element.iconPath} alt="" />
      <span class="tab-name">{option.label}</span>
      <span class="tab-abbr">{option.shortLabel}</span>
    </span>
  {/if}
{/snippet}

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
    <main class="lesson-shell" class:capstone={stepIndex === capstoneStepIndex}>
      <div class="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {#if stepIndex === 0}
        <section class="intro-step" aria-labelledby="learning-letters-title">
          <p class="eyebrow">TKA 1</p>
          <h1 id="learning-letters-title">Learning Letters</h1>
          <!-- Guide prose, verbatim from the Alpha/Beta Words page
               (lt1-abc-ghi) — see docs/learn/copy-reviews/words-alpha-beta.md -->
          <p class="guide-prose">
            The first words we will learn correspond to VTG’s 1:1 motions.<br />
            To execute these,
            <strong><em>you’ll need to use body turns and/or negative space</em
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
          <header class="selection-header">
            <span class="family-identity">
              <img src={activeCoreFamily.element.iconPath} alt="" />
              <span>{activeCoreFamily.element.name}</span>
            </span>
            <div class="selected-glyph">
              <TKAWordGlyph
                word={displayWord(activeCoreSequence)}
                height={Math.round(40 * glyphScale)}
                darkMode
                fitToParent
              />
            </div>
            <span class="sequence-position">
              Word {activeCoreIndex + 1} / {LEARNING_LETTERS_CORE_WORDS.length}
            </span>
          </header>
          <div class="word-stage">
            <WordSequencePair sequence={activeCoreSequence} />
          </div>
        </section>
      {:else if selectedSequence && selectedFamily}
        <section class="capstone-step" aria-labelledby="learning-letters-title">
          <header class="lesson-header">
            <div class="title-block">
              <p class="eyebrow">The full deck</p>
              <h1 id="learning-letters-title">TKA 1: Learning Letters</h1>
            </div>
            <p
              class="deck-progress"
              aria-label={`${visitedIds.size} of ${sequences.length} viewed`}
            >
              <span>{visitedIds.size}</span>
              <span aria-hidden="true">/</span>
              <span>{sequences.length}</span>
              <span class="progress-word" aria-hidden="true">viewed</span>
            </p>
          </header>

          <!-- Guide prose, verbatim from the Alpha/Beta Words page
               (lt1-abc-ghi) — see docs/learn/copy-reviews/words-alpha-beta.md -->
          <p class="guide-prose practice-prose">
            <strong
              >Practice each word once in both directions, then again starting
              with thumbs out.</strong
            >
          </p>

          <div class="deck-browser" aria-label="TKA 1: Learning Letters deck">
            <div class="family-tabs">
              <SegmentedControl
                options={familyOptions}
                value={selectedFamily.element.familyId}
                onchange={chooseFamily}
                color="accent"
                size="sm"
                semantics="tabs"
                ariaLabel="Letter families"
                optionContent={familyTab}
              />
            </div>

            <div
              class="word-choices"
              id={`learning-letters-family-${selectedFamily.element.familyId}`}
              role="tabpanel"
              aria-labelledby={`learning-letters-tab-${selectedFamily.element.familyId}`}
              style={`--family-cols: ${selectedFamily.sequences.length}`}
            >
              {#each selectedFamily.sequences as sequence (sequence.id)}
                <div
                  class="word-choice"
                  class:selected={sequence.id === selectedSequence.id}
                >
                  <ChoreoCardThumbnail
                    {sequence}
                    selected={sequence.id === selectedSequence.id}
                    onPrimaryAction={chooseSequence}
                    leftPropType={PropType.STAFF}
                    rightPropType={PropType.STAFF}
                    eager
                    allowQR={false}
                  />
                  <div class="choice-glyph" aria-hidden="true">
                    <TKAWordGlyph
                      word={displayWord(sequence)}
                      height={Math.round(25 * glyphScale)}
                      darkMode
                      fitToParent
                    />
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <div class="selected-workspace" aria-label="Selected word">
            <header class="selection-header">
              <span class="family-identity">
                <img src={selectedFamily.element.iconPath} alt="" />
                <span>{selectedFamily.element.name}</span>
              </span>
              <div class="selected-glyph">
                <TKAWordGlyph
                  word={displayWord(selectedSequence)}
                  height={Math.round(34 * glyphScale)}
                  darkMode
                  fitToParent
                />
              </div>
              <span class="sequence-position">
                {selectedSequenceIndex + 1} / {sequences.length}
              </span>
            </header>
            <WordSequencePair sequence={selectedSequence} />
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
        {#if stepIndex === capstoneStepIndex}
          <PanelButton variant="primary" onclick={complete}>
            <span>Finish lesson</span>
            <i class="fa-solid fa-check" aria-hidden="true"></i>
          </PanelButton>
        {:else}
          <PanelButton variant="primary" onclick={() => goToStep(stepIndex + 1)}>
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
    background: var(--theme-bg-deep, var(--background, #07070a));
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
    width: min(100%, 118rem);
    min-height: 100%;
    margin-inline: auto;
    padding: clamp(4.6rem, 5.5cqw, 6rem) clamp(0.75rem, 2.2cqw, 2.5rem)
      clamp(1rem, 2cqw, 2rem);
  }

  .lesson-header,
  .selection-header,
  .lesson-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .lesson-header {
    margin-bottom: clamp(0.5rem, 0.8cqw, 0.9rem);
  }

  .title-block,
  .title-block p,
  .title-block h1 {
    min-width: 0;
    margin: 0;
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

  .intro-step {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: clamp(0.9rem, 1.4cqw, 1.5rem);
    min-height: 100%;
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
    background: var(--theme-card-bg);
    overflow: hidden;
  }

  .word-step,
  .deck-browser,
  .selected-workspace {
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-lg, 0.75rem);
    background: var(--theme-panel-bg);
  }

  .word-step {
    /* Hug the pair and center in the remaining row — no dead band inside
       the panel (4k-native-layout.md). */
    align-self: center;
    width: 100%;
    overflow: hidden;
  }

  .word-step .selection-header {
    /* Identity color as data, not a selection bar: the whole header carries a
       tint of the active family's accent (no-left-edge-accent-bar.md). */
    background: color-mix(
      in srgb,
      var(--family-accent, var(--theme-accent)) 14%,
      var(--theme-card-bg)
    );
  }

  .selection-header {
    min-height: 3.5rem;
    padding: 0.6rem 0.85rem;
    border-bottom: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
  }

  .word-stage {
    min-width: 0;
  }

  .deck-progress,
  .sequence-position {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 0.875rem);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }

  .deck-progress {
    display: flex;
    align-items: baseline;
    gap: 0.28rem;
  }

  .deck-progress span:first-child {
    color: var(--theme-text);
    font-size: 1.35rem;
  }

  .deck-progress .progress-word {
    margin-left: 0.15rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-size: 0.7em;
  }

  .family-identity {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
  }

  .word-step .family-identity {
    color: var(--theme-text);
  }

  .family-tab-content img,
  .family-identity img {
    width: 1.25rem;
    height: 1.25rem;
    object-fit: contain;
  }

  .selected-glyph {
    display: grid;
    place-items: center;
    min-width: 4rem;
    max-width: min(16rem, 42cqw);
  }

  /* ── Capstone deck browser ──────────────────────────────────────────────── */
  .capstone-step {
    min-width: 0;
  }

  .practice-prose {
    margin-bottom: clamp(0.75rem, 1cqw, 1.15rem);
  }

  .deck-browser {
    padding: clamp(0.55rem, 0.9cqw, 0.9rem);
  }

  .family-tabs {
    max-width: 64rem;
    margin-inline: auto;
  }

  .family-tab-content {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
  }

  /* Full family names by default; the two-letter abbreviation is the
     narrow-container fallback, not the desktop presentation. */
  .tab-abbr {
    display: none;
  }

  .word-choices {
    display: grid;
    /* Track count follows the active family (3 or 4 cards) so a 3-card
       family centers as 3 columns instead of sitting in tracks 1-3 of a
       phantom 4-track grid (4k-native-layout.md: no empty trailing tracks). */
    grid-template-columns: repeat(
      var(--family-cols, 4),
      minmax(0, var(--choice-track, 13.5rem))
    );
    justify-content: center;
    align-items: end;
    gap: clamp(0.6rem, 1cqw, 1rem);
    min-height: 12rem;
    padding: clamp(0.75rem, 1.2cqw, 1.25rem) 0.25rem 0.25rem;
  }

  .word-choice {
    min-width: 0;
    padding: 0.28rem;
    border: 1px solid transparent;
    border-radius: var(--radius-md, 0.5rem);
    background: transparent;
    transition:
      border-color var(--duration-fast) ease,
      background var(--duration-fast) ease;
  }

  .word-choice.selected {
    border-color: var(--theme-stroke-strong);
    background: var(--theme-card-hover-bg);
  }

  .word-choice :global(.choreo-card) {
    aspect-ratio: 0.72;
  }

  .choice-glyph {
    display: grid;
    place-items: center;
    height: 2.1rem;
    margin-top: 0.35rem;
    overflow: hidden;
  }

  .selected-workspace {
    margin-top: clamp(0.75rem, 1.2cqw, 1.25rem);
    overflow: hidden;
  }

  .lesson-actions {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 1rem;
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

  @container learning-letters (max-width: 1120px) {
    .tab-name {
      display: none;
    }

    .tab-abbr {
      display: inline;
    }
  }

  @container learning-letters (max-width: 760px) {
    .lesson-shell {
      padding-top: 4.15rem;
      padding-inline: 0.55rem;
    }

    .lesson-header {
      margin-bottom: 0.5rem;
    }

    .word-preview {
      grid-template-columns: repeat(3, minmax(4.5rem, 7rem));
    }

    .family-tab-content img {
      width: 1rem;
      height: 1rem;
    }

    .word-choices {
      grid-template-columns: none;
      grid-auto-flow: column;
      grid-auto-columns: minmax(8.5rem, 42cqw);
      justify-content: start;
      min-height: 0;
      padding: 0.7rem 0.25rem 0.45rem;
      overflow-x: auto;
      overscroll-behavior-inline: contain;
      scroll-snap-type: x proximity;
    }

    .word-choice {
      scroll-snap-align: start;
    }

    .selection-header {
      min-height: 3.1rem;
      padding: 0.45rem 0.6rem;
    }

    .capstone-step .family-identity > span {
      display: none;
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

    .deck-progress span:first-child {
      font-size: 1.1rem;
    }

    .family-tab-content {
      gap: 0;
    }

    .family-tab-content > span {
      display: none;
    }

    .word-choices {
      grid-auto-columns: minmax(8rem, 46cqw);
    }
  }

  /* Big-screen seams per 4k-native-layout.md: 1680 catches 4K@200% and
     1440p@100%; the 2600 tier steps element/type scale for 4K@100% and TVs.
     A 2200 seam is dead on 4K@200% and is forbidden. */
  @container learning-letters (min-width: 1680px) {
    .lesson-shell {
      width: min(100%, 132rem);
    }

    .word-choices {
      --choice-track: 15.5rem;
    }

    .family-tabs {
      max-width: 72rem;
    }

    .word-step {
      width: min(100%, 110rem);
      margin-inline: auto;
    }
  }

  @container learning-letters (min-width: 2600px) {
    .lesson-shell {
      width: min(100%, 164rem);
      padding-top: 5.5rem;
    }

    .word-choices {
      --choice-track: 20rem;
      gap: 1.4rem;
    }

    .choice-glyph {
      height: 3rem;
      margin-top: 0.55rem;
    }

    .family-tabs {
      max-width: 88rem;
    }

    .family-tab-content img,
    .family-identity img {
      width: 1.6rem;
      height: 1.6rem;
    }

    h1 {
      font-size: 3.4rem;
    }

    .eyebrow {
      font-size: 0.95rem;
    }

    .guide-prose {
      font-size: 1.5rem;
    }

    .deck-progress,
    .sequence-position,
    .family-identity {
      font-size: 1.1rem;
    }

    .deck-progress span:first-child {
      font-size: 1.7rem;
    }

    .selection-header {
      min-height: 4.6rem;
      padding: 0.85rem 1.2rem;
    }

    .selected-glyph {
      min-width: 5rem;
      max-width: min(22rem, 42cqw);
    }

    .word-preview {
      grid-template-columns: repeat(6, minmax(4.5rem, 8.5rem));
    }

    .preview-glyph {
      height: 4.6rem;
    }

    .word-step {
      width: min(100%, 130rem);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .word-choice {
      transition: none;
    }
  }
</style>
