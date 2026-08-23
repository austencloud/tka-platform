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
  import WordSequencePair from "./WordSequencePair.svelte";
  import {
    LEARNING_LETTERS_SCHEMA_VERSION,
    nextUnvisitedSequenceIndex,
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

  let loadState = $state<LoadState>("loading");
  let loadError = $state<string | null>(null);
  let sequences = $state<readonly SequenceData[]>([]);
  let selectedSequenceId = $state("");
  let visitedSequenceIds = $state<string[]>([]);

  const families = $derived.by((): LearningLettersFamily[] =>
    TND_ELEMENTS.map((element) => ({
      element,
      sequences: sequences.filter(
        (sequence) => sequence.metadata["familyId"] === element.familyId
      ),
    })).filter((family) => family.sequences.length > 0)
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
  const allVisited = $derived(
    sequences.length > 0 && visitedIds.size === sequences.length
  );
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

  function displayWord(sequence: SequenceData): string {
    return simplifyRepeatedWord(sequence.word || sequence.name);
  }

  function saveProgress(): void {
    persistence.saveStep(1);
    persistence.savePhaseData("schemaVersion", LEARNING_LETTERS_SCHEMA_VERSION);
    persistence.savePhaseData("selectedSequenceId", selectedSequenceId);
    persistence.savePhaseData("visitedSequenceIds", visitedSequenceIds);
  }

  async function loadDeck(): Promise<void> {
    loadState = "loading";
    loadError = null;
    try {
      const loaded = await loadFoundingCollectionSequences("founding_tka-1");
      sequences = loaded;
      const normalized = normalizeLearningLettersProgress(
        persistence.load(),
        loaded.map((sequence) => sequence.id)
      );
      selectedSequenceId = normalized.progress.selectedSequenceId;
      visitedSequenceIds = normalized.progress.visitedSequenceIds;
      if (normalized.migrated) saveProgress();
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
    if (!visitedIds.has(sequence.id)) {
      visitedSequenceIds = [...visitedSequenceIds, sequence.id];
    }
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

  function moveToSequence(index: number): void {
    const next = sequences[index];
    if (next) chooseSequence(next);
  }

  function nextSequence(): void {
    if (!allVisited) {
      const nextIndex = nextUnvisitedSequenceIndex(
        selectedSequenceIndex,
        sequences.map((sequence) => sequence.id),
        visitedIds
      );
      moveToSequence(nextIndex);
      return;
    }
    persistence.reset();
    haptic?.trigger("success");
    onComplete?.();
  }

  export function handleBack(): void {
    if (selectedSequenceIndex > 0) {
      moveToSequence(selectedSequenceIndex - 1);
      return;
    }
    onBack?.();
  }
</script>

{#snippet familyTab(familyId: string)}
  {@const family = families.find(
    (candidate) => candidate.element.familyId === familyId
  )}
  {#if family}
    <span class="family-tab-content">
      <img src={family.element.iconPath} alt="" />
      <span
        >{familyOptions.find((option) => option.value === familyId)
          ?.shortLabel}</span
      >
    </span>
  {/if}
{/snippet}

<div class="experience" class:review-mode={viewMode === "scroll"}>
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
  {:else if selectedSequence && selectedFamily}
    <main class="lesson-shell" aria-labelledby="learning-letters-title">
      <header class="lesson-header">
        <div class="title-block">
          <p class="eyebrow">TKA 1</p>
          <h1 id="learning-letters-title">Learning Letters</h1>
        </div>
        <p
          class="deck-progress"
          aria-label={`${visitedIds.size} of ${sequences.length} viewed`}
        >
          <span>{visitedIds.size}</span>
          <span aria-hidden="true">/</span>
          <span>{sequences.length}</span>
        </p>
      </header>

      <section class="deck-browser" aria-label="TKA 1: Learning Letters deck">
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
                bluePropType={PropType.STAFF}
                redPropType={PropType.STAFF}
                eager
                allowQR={false}
              />
              <div class="choice-glyph" aria-hidden="true">
                <TKAWordGlyph
                  word={displayWord(sequence)}
                  height={25}
                  darkMode
                  fitToParent
                />
              </div>
            </div>
          {/each}
        </div>
      </section>

      <section class="selected-workspace" aria-label="Selected word">
        <header class="selection-header">
          <span class="family-identity">
            <img src={selectedFamily.element.iconPath} alt="" />
            <span>{selectedFamily.element.name}</span>
          </span>
          <div class="selected-glyph">
            <TKAWordGlyph
              word={displayWord(selectedSequence)}
              height={34}
              darkMode
              fitToParent
            />
          </div>
          <span class="sequence-position">
            {selectedSequenceIndex + 1} / {sequences.length}
          </span>
        </header>
        <WordSequencePair sequence={selectedSequence} />
      </section>

      <footer class="lesson-actions">
        <PanelButton
          variant="secondary"
          onclick={() => moveToSequence(selectedSequenceIndex - 1)}
          disabled={selectedSequenceIndex <= 0}
        >
          <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
          <span>Previous</span>
        </PanelButton>
        <PanelButton variant="primary" onclick={nextSequence}>
          <span>{allVisited ? "Finish lesson" : "Next word"}</span>
          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </PanelButton>
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
  }

  .lesson-shell {
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
    margin-bottom: clamp(0.75rem, 1cqw, 1.15rem);
  }

  .title-block,
  .title-block p,
  .title-block h1 {
    min-width: 0;
    margin: 0;
  }

  .eyebrow {
    color: var(--theme-accent);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  h1 {
    margin-top: 0.15rem !important;
    font-size: clamp(1.6rem, 2.1cqw, 2.7rem);
    line-height: 1.05;
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

  .deck-browser,
  .selected-workspace {
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-lg, 0.75rem);
    background: var(--theme-panel-bg);
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

  .family-tab-content img,
  .family-identity img {
    width: 1.25rem;
    height: 1.25rem;
    object-fit: contain;
  }

  .word-choices {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 13.5rem));
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

  .selection-header {
    min-height: 3.5rem;
    padding: 0.6rem 0.85rem;
    border-bottom: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
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

  .selected-glyph {
    display: grid;
    place-items: center;
    min-width: 4rem;
    max-width: min(16rem, 42cqw);
  }

  .lesson-actions {
    margin-top: clamp(0.75rem, 1.2cqw, 1.25rem);
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

    .lesson-header {
      margin-bottom: 0.65rem;
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

    .family-identity > span {
      display: none;
    }

    .lesson-actions :global(.panel-btn) {
      flex: 1;
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

    .lesson-actions {
      gap: 0.5rem;
    }
  }

  @container learning-letters (min-width: 2200px) {
    .lesson-shell {
      width: min(100%, 136rem);
    }

    .word-choices {
      grid-template-columns: repeat(4, minmax(0, 16rem));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .word-choice {
      transition: none;
    }
  }
</style>
