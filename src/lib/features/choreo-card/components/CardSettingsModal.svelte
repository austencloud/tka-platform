<!--
  CardSettingsModal.svelte - Settings for choreo card visibility and composition

  Shows toggles for pictograph visibility (hand points, grid, TKA glyphs) and
  card composition (word, start position, difficulty, step numbers, creator name,
  notes, birthday, QR code). Changes are global and persist via the state managers.

  Uses SettingsModalLayout for responsive shell (desktop: side-by-side, mobile: stacked).
  Subscribes to both ImageCompositionStateManager and VisibilityStateManager via
  observer pattern for reactive state.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import SettingsModalLayout from "$lib/shared/foundation/ui/settings-modal/SettingsModalLayout.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
  import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";

  interface Props {
    open: boolean;
  }

  let { open = $bindable() }: Props = $props();

  const composition = getImageCompositionManager();
  const visibility = getVisibilityStateManager();

  // Version counters incremented by observers — drive $derived.by re-reads
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

  // Toggle handlers — pictograph visibility
  function toggleGrid() { visibility.setGridVisibility(!visibility.getGridVisibility()); }
  function toggleHandPoints() { visibility.setHandPointVisibility(handPointMode === "all" ? "active" : "all"); }
  function toggleTka() { visibility.setGlyphVisibility("tkaGlyph", !visibility.getRawGlyphVisibility("tkaGlyph")); }

  // Toggle handlers — card composition
  function toggleWord() { composition.setAddWord(!composition.addWord); }
  function toggleStartPosition() { composition.setIncludeStartPosition(!composition.includeStartPosition); }
  function toggleDifficulty() { composition.setAddDifficultyLevel(!composition.addDifficultyLevel); }
  function toggleStepNumbers() { composition.setAddBeatNumbers(!composition.addStepNumbers); }
  function toggleCreatorName() { composition.setShowCreatorName(!composition.showCreatorName); }
  function toggleNotes() { composition.setShowNotes(!composition.showNotes); }
  function toggleBirthday() { composition.setShowBirthday(!composition.showBirthday); }
  function toggleQRCode() { composition.setShowQRCode(!composition.showQRCode); }
</script>

<SettingsModalLayout
  title="Card Settings"
  icon="fa-id-card"
  bind:open
>
  {#snippet preview()}
    <div class="preview-placeholder">
      <span>Card Preview</span>
    </div>
  {/snippet}

  {#snippet controls()}
    <div class="toggle-sections">

      <!-- Pictograph Visibility -->
      <div class="section">
        <div class="section-title">Pictograph Visibility</div>
        <button class="toggle-row" type="button" aria-pressed={showGrid} onclick={toggleGrid}>
          <span>Grid</span>
          <span class="toggle-indicator" class:active={showGrid}></span>
        </button>
        <button class="toggle-row" type="button" aria-pressed={handPointMode === "all"} onclick={toggleHandPoints}>
          <span>All Hand Points</span>
          <span class="toggle-indicator" class:active={handPointMode === "all"}></span>
        </button>
        <button class="toggle-row" type="button" aria-pressed={tkaGlyph} onclick={toggleTka}>
          <span>TKA Glyphs</span>
          <span class="toggle-indicator" class:active={tkaGlyph}></span>
        </button>
      </div>

      <!-- Card Composition -->
      <div class="section">
        <div class="section-title">Card Composition</div>
        <button class="toggle-row" type="button" aria-pressed={showWord} onclick={toggleWord}>
          <span>Word</span>
          <span class="toggle-indicator" class:active={showWord}></span>
        </button>
        <button class="toggle-row" type="button" aria-pressed={includeStartPosition} onclick={toggleStartPosition}>
          <span>Start Position</span>
          <span class="toggle-indicator" class:active={includeStartPosition}></span>
        </button>
        <button class="toggle-row" type="button" aria-pressed={showDifficulty} onclick={toggleDifficulty}>
          <span>Difficulty</span>
          <span class="toggle-indicator" class:active={showDifficulty}></span>
        </button>
        <button class="toggle-row" type="button" aria-pressed={showStepNumbers} onclick={toggleStepNumbers}>
          <span>Step Numbers</span>
          <span class="toggle-indicator" class:active={showStepNumbers}></span>
        </button>
        <button class="toggle-row" type="button" aria-pressed={showCreatorName} onclick={toggleCreatorName}>
          <span>Creator Name</span>
          <span class="toggle-indicator" class:active={showCreatorName}></span>
        </button>
        <button class="toggle-row" type="button" aria-pressed={showNotes} onclick={toggleNotes}>
          <span>Notes</span>
          <span class="toggle-indicator" class:active={showNotes}></span>
        </button>
        <button class="toggle-row" type="button" aria-pressed={showBirthday} onclick={toggleBirthday}>
          <span>Birthday</span>
          <span class="toggle-indicator" class:active={showBirthday}></span>
        </button>
        <button class="toggle-row" type="button" aria-pressed={showQRCode} onclick={toggleQRCode}>
          <span>QR Code</span>
          <span class="toggle-indicator" class:active={showQRCode}></span>
        </button>
      </div>

    </div>
  {/snippet}
</SettingsModalLayout>

<style>
  .preview-placeholder {
    width: 100%;
    max-width: 300px;
    aspect-ratio: 5 / 7;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px dashed var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-sm, 14px);
  }

  .toggle-sections {
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
    margin-bottom: 0.25rem;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: background var(--duration-fast, 100ms) ease;
  }

  .toggle-row:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
  }

  .toggle-indicator {
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.15));
    position: relative;
    transition: background var(--duration-fast, 100ms) ease;
    flex-shrink: 0;
  }

  .toggle-indicator::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    transition: transform var(--duration-fast, 100ms) ease,
      background var(--duration-fast, 100ms) ease;
  }

  .toggle-indicator.active {
    background: var(--theme-accent, #8b5cf6);
  }

  .toggle-indicator.active::after {
    transform: translateX(16px);
    background: white;
  }

  @media (prefers-reduced-motion: reduce) {
    .toggle-row,
    .toggle-indicator,
    .toggle-indicator::after {
      transition: none;
    }
  }
</style>
