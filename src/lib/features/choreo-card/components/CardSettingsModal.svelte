<!--
  CardSettingsModal.svelte - Settings for choreo card visibility and composition

  Shows a live ChoreoCard preview alongside chip toggles for pictograph visibility
  and card composition. Changes are global and persist via the state managers.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import SettingsModalLayout from "$lib/shared/foundation/ui/settings-modal/SettingsModalLayout.svelte";
  import ChoreoCard from "./ChoreoCard.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

  interface Props {
    open: boolean;
    sequence?: SequenceData | null;
  }

  let { open = $bindable(), sequence = null }: Props = $props();

  const composition = getImageCompositionManager();
  const visibility = getVisibilityStateManager();

  let compositionVersion = $state(0);
  let visibilityVersion = $state(0);

  function onCompositionChange() { compositionVersion++; }
  function onVisibilityChange() { visibilityVersion++; }

  onMount(() => {
    composition.registerObserver(onCompositionChange);
    visibility.registerObserver(onVisibilityChange, ["all"]);
    return () => {
      composition.unregisterObserver(onCompositionChange);
      visibility.unregisterObserver(onVisibilityChange);
    };
  });

  // Pictograph visibility
  const handPointMode = $derived.by(() => { void visibilityVersion; return visibility.getHandPointVisibility(); });
  const showGrid = $derived.by(() => { void visibilityVersion; return visibility.getGridVisibility(); });
  const tkaGlyph = $derived.by(() => { void visibilityVersion; return visibility.getRawGlyphVisibility("tkaGlyph"); });

  // Card composition
  const showWord = $derived.by(() => { void compositionVersion; return composition.addWord; });
  const includeStartPosition = $derived.by(() => { void compositionVersion; return composition.includeStartPosition; });
  const showDifficulty = $derived.by(() => { void compositionVersion; return composition.addDifficultyLevel; });
  const showStepNumbers = $derived.by(() => { void compositionVersion; return composition.addStepNumbers; });
  const showCreatorName = $derived.by(() => { void compositionVersion; return composition.showCreatorName; });
  const showNotes = $derived.by(() => { void compositionVersion; return composition.showNotes; });
  const showBirthday = $derived.by(() => { void compositionVersion; return composition.showBirthday; });
  const showQRCode = $derived.by(() => { void compositionVersion; return composition.showQRCode; });
  const currentStepCount = $derived(sequence?.steps?.length ?? 0);
  const startPositionLayout = $derived.by(() => {
    void compositionVersion;
    if (currentStepCount > 0) {
      return composition.getStartPositionLayoutForStepCount(currentStepCount);
    }
    return composition.startPositionLayout;
  });
  const hasLayoutOverride = $derived.by(() => {
    void compositionVersion;
    return currentStepCount > 0 && composition.hasStartPositionLayoutOverride(currentStepCount);
  });

  // Pictograph visibility toggles
  function toggleGrid() { visibility.setGridVisibility(!visibility.getGridVisibility()); }
  function toggleHandPoints() { visibility.setHandPointVisibility(handPointMode === "all" ? "active" : "all"); }
  function toggleTka() { visibility.setGlyphVisibility("tkaGlyph", !visibility.getRawGlyphVisibility("tkaGlyph")); }

  // Card composition toggles
  function toggleWord() { composition.setAddWord(!composition.addWord); }
  function toggleStartPosition() { composition.setIncludeStartPosition(!composition.includeStartPosition); }
  function toggleDifficulty() { composition.setAddDifficultyLevel(!composition.addDifficultyLevel); }
  function toggleStepNumbers() { composition.setAddBeatNumbers(!composition.addStepNumbers); }
  function toggleCreatorName() { composition.setShowCreatorName(!composition.showCreatorName); }
  function toggleNotes() { composition.setShowNotes(!composition.showNotes); }
  function toggleBirthday() { composition.setShowBirthday(!composition.showBirthday); }
  function toggleQRCode() { composition.setShowQRCode(!composition.showQRCode); }
  function toggleStartLayout() {
    const newValue = startPositionLayout === "row" ? "column" : "row";
    if (currentStepCount > 0) {
      composition.setStartPositionLayoutForStepCount(currentStepCount, newValue);
    } else {
      composition.setStartPositionLayout(newValue);
    }
  }
  function clearLayoutOverride() {
    if (currentStepCount > 0) {
      composition.clearStartPositionLayoutOverride(currentStepCount);
    }
  }
</script>

<SettingsModalLayout title="Card Settings" icon="fa-id-card" bind:open>
  {#snippet preview()}
    <div class="preview-container">
      {#if sequence}
        <ChoreoCard
          {sequence}
          handPointsVisible={handPointMode === "all"}
          {showGrid}
          showTKA={tkaGlyph}
          {showWord}
          {includeStartPosition}
          {startPositionLayout}
          {showBirthday}
          showQRCodes={showQRCode}
        />
      {:else}
        <span class="no-sequence">No sequence selected</span>
      {/if}
    </div>
  {/snippet}

  {#snippet controls()}
    <div class="chip-sections">

      <div class="section">
        <div class="section-title">Pictograph Visibility</div>
        <div class="chip-group">
          <button class="chip" class:active={showGrid} aria-pressed={showGrid} onclick={toggleGrid}>
            Grid
          </button>
          <button class="chip" class:active={handPointMode === "all"} aria-pressed={handPointMode === "all"} onclick={toggleHandPoints}>
            All Hand Points
          </button>
          <button class="chip" class:active={tkaGlyph} aria-pressed={tkaGlyph} onclick={toggleTka}>
            TKA Glyphs
          </button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Card Composition</div>
        <div class="chip-group">
          <button class="chip" class:active={showWord} aria-pressed={showWord} onclick={toggleWord}>
            Word
          </button>
          <button class="chip" class:active={includeStartPosition} aria-pressed={includeStartPosition} onclick={toggleStartPosition}>
            Start Position
          </button>
          {#if includeStartPosition}
            <button class="chip layout-toggle" onclick={toggleStartLayout}>
              {startPositionLayout === "row" ? "Top Row" : "Left Column"}{currentStepCount > 0 ? ` (${currentStepCount}-beat)` : ""}
            </button>
            {#if hasLayoutOverride}
              <button class="chip reset-chip" onclick={clearLayoutOverride} title="Reset to global default">
                <i class="fas fa-undo" aria-hidden="true"></i>
              </button>
            {/if}
          {/if}
          <button class="chip" class:active={showDifficulty} aria-pressed={showDifficulty} onclick={toggleDifficulty}>
            Difficulty
          </button>
          <button class="chip" class:active={showStepNumbers} aria-pressed={showStepNumbers} onclick={toggleStepNumbers}>
            Step Numbers
          </button>
          <button class="chip" class:active={showCreatorName} aria-pressed={showCreatorName} onclick={toggleCreatorName}>
            Creator Name
          </button>
          <button class="chip" class:active={showNotes} aria-pressed={showNotes} onclick={toggleNotes}>
            Notes
          </button>
          <button class="chip" class:active={showBirthday} aria-pressed={showBirthday} onclick={toggleBirthday}>
            Birthday
          </button>
          <button class="chip" class:active={showQRCode} aria-pressed={showQRCode} onclick={toggleQRCode}>
            QR Code
          </button>
        </div>
      </div>

    </div>
  {/snippet}
</SettingsModalLayout>

<style>
  .preview-container {
    width: 100%;
    max-width: 300px;
  }

  .no-sequence {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-sm, 14px);
    font-style: italic;
  }

  .chip-sections {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-title {
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    padding-bottom: 0.25rem;
  }

  .chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    min-height: var(--min-touch-target, 44px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 100px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal, 300ms) cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
  }

  .chip.active {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
    color: var(--theme-text, white);
    box-shadow:
      0 0 12px color-mix(in srgb, var(--theme-accent) 15%, transparent),
      inset 0 1px 0 var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .chip:hover:not(.active) {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    color: var(--theme-text, white);
  }

  .chip:active {
    transform: scale(0.97);
  }

  .chip:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .chip {
      transition: none;
    }
  }
</style>
