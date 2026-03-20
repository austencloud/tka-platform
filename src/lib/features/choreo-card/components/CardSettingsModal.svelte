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

  function onCompositionChange() {
    compositionVersion++;
  }

  function onVisibilityChange() {
    visibilityVersion++;
  }

  onMount(() => {
    composition.registerObserver(onCompositionChange);
    visibility.registerObserver(onVisibilityChange, ["all"]);
    return () => {
      composition.unregisterObserver(onCompositionChange);
      visibility.unregisterObserver(onVisibilityChange);
    };
  });

  // Pictograph visibility — reactive reads gated on version
  const handPointMode = $derived.by(() => {
    void visibilityVersion;
    return visibility.getHandPointVisibility();
  });

  const showGrid = $derived.by(() => {
    void visibilityVersion;
    return visibility.getGridVisibility();
  });

  const tkaGlyph = $derived.by(() => {
    void visibilityVersion;
    return visibility.getRawGlyphVisibility("tkaGlyph");
  });

  // Card composition — reactive reads gated on version
  const showWord = $derived.by(() => {
    void compositionVersion;
    return composition.addWord;
  });

  const includeStartPosition = $derived.by(() => {
    void compositionVersion;
    return composition.includeStartPosition;
  });

  const startPositionLayout = $derived.by(() => {
    void compositionVersion;
    return composition.startPositionLayout;
  });

  const showDifficulty = $derived.by(() => {
    void compositionVersion;
    return composition.addDifficultyLevel;
  });

  const showStepNumbers = $derived.by(() => {
    void compositionVersion;
    return composition.addStepNumbers;
  });

  const showCreatorName = $derived.by(() => {
    void compositionVersion;
    return composition.showCreatorName;
  });

  const showNotes = $derived.by(() => {
    void compositionVersion;
    return composition.showNotes;
  });

  const showBirthday = $derived.by(() => {
    void compositionVersion;
    return composition.showBirthday;
  });

  const showQRCode = $derived.by(() => {
    void compositionVersion;
    return composition.showQRCode;
  });

  // Toggle handlers — pictograph visibility
  function setHandPointMode(mode: "all" | "active") {
    visibility.setHandPointVisibility(mode);
  }

  function toggleGrid() {
    visibility.setGridVisibility(!visibility.getGridVisibility());
  }

  function toggleTka() {
    visibility.setGlyphVisibility("tkaGlyph", !visibility.getRawGlyphVisibility("tkaGlyph"));
  }

  // Toggle handlers — card composition
  function toggleWord() {
    composition.setAddWord(!composition.addWord);
  }

  function toggleStartPosition() {
    composition.setIncludeStartPosition(!composition.includeStartPosition);
  }

  function setStartPositionLayout(layout: "row" | "column") {
    composition.setStartPositionLayout(layout);
  }

  function toggleDifficulty() {
    composition.setAddDifficultyLevel(!composition.addDifficultyLevel);
  }

  function toggleStepNumbers() {
    composition.setAddBeatNumbers(!composition.addStepNumbers);
  }

  function toggleCreatorName() {
    composition.setShowCreatorName(!composition.showCreatorName);
  }

  function toggleNotes() {
    composition.setShowNotes(!composition.showNotes);
  }

  function toggleBirthday() {
    composition.setShowBirthday(!composition.showBirthday);
  }

  function toggleQRCode() {
    composition.setShowQRCode(!composition.showQRCode);
  }
</script>

<SettingsModalLayout
  title="Card Settings"
  icon="fa-id-card"
  bind:open
>
  {#snippet preview()}
    <div class="preview-placeholder">
      <i class="fas fa-id-card" aria-hidden="true"></i>
      <span>Card Preview</span>
    </div>
  {/snippet}

  {#snippet controls()}
    <div class="toggle-sections">

      <!-- Pictograph Visibility -->
      <div class="section">
        <div class="section-title">Pictograph Visibility</div>

        <div class="toggle-row hand-points-row">
          <i class="fas fa-hand-dots" aria-hidden="true"></i>
          <span>Hand Points</span>
          <div class="hand-point-options">
            <label class="radio-option">
              <input
                type="radio"
                name="card-hand-point-mode"
                value="all"
                checked={handPointMode === "all"}
                onchange={() => setHandPointMode("all")}
              />
              <span>All</span>
            </label>
            <label class="radio-option">
              <input
                type="radio"
                name="card-hand-point-mode"
                value="active"
                checked={handPointMode === "active"}
                onchange={() => setHandPointMode("active")}
              />
              <span>Active</span>
            </label>
          </div>
        </div>

        <label class="toggle-row">
          <input
            type="checkbox"
            checked={showGrid}
            onchange={toggleGrid}
          />
          <i class="fas fa-border-all" aria-hidden="true"></i>
          <span>Grid</span>
        </label>

        <label class="toggle-row">
          <input
            type="checkbox"
            checked={tkaGlyph}
            onchange={toggleTka}
          />
          <i class="fas fa-language" aria-hidden="true"></i>
          <span>TKA Glyphs</span>
        </label>
      </div>

      <!-- Card Composition -->
      <div class="section">
        <div class="section-title">Card Composition</div>

        <label class="toggle-row">
          <input type="checkbox" checked={showWord} onchange={toggleWord} />
          <i class="fas fa-font" aria-hidden="true"></i>
          <span>Word</span>
        </label>

        <label class="toggle-row">
          <input type="checkbox" checked={includeStartPosition} onchange={toggleStartPosition} />
          <i class="fas fa-play" aria-hidden="true"></i>
          <span>Start Position</span>
        </label>

        {#if includeStartPosition}
          <div class="toggle-row start-layout-row">
            <i class="fas fa-grip-lines" aria-hidden="true"></i>
            <span>Layout</span>
            <div class="start-layout-options">
              <label class="radio-option">
                <input
                  type="radio"
                  name="start-position-layout"
                  value="row"
                  checked={startPositionLayout === "row"}
                  onchange={() => setStartPositionLayout("row")}
                />
                <span>Top Row</span>
              </label>
              <label class="radio-option">
                <input
                  type="radio"
                  name="start-position-layout"
                  value="column"
                  checked={startPositionLayout === "column"}
                  onchange={() => setStartPositionLayout("column")}
                />
                <span>Left Column</span>
              </label>
            </div>
          </div>
        {/if}

        <label class="toggle-row">
          <input type="checkbox" checked={showDifficulty} onchange={toggleDifficulty} />
          <i class="fas fa-signal" aria-hidden="true"></i>
          <span>Difficulty</span>
        </label>

        <label class="toggle-row">
          <input type="checkbox" checked={showStepNumbers} onchange={toggleStepNumbers} />
          <i class="fas fa-list-ol" aria-hidden="true"></i>
          <span>Step Numbers</span>
        </label>

        <label class="toggle-row">
          <input type="checkbox" checked={showCreatorName} onchange={toggleCreatorName} />
          <i class="fas fa-user" aria-hidden="true"></i>
          <span>Creator Name</span>
        </label>

        <label class="toggle-row">
          <input type="checkbox" checked={showNotes} onchange={toggleNotes} />
          <i class="fas fa-sticky-note" aria-hidden="true"></i>
          <span>Notes</span>
        </label>

        <label class="toggle-row">
          <input type="checkbox" checked={showBirthday} onchange={toggleBirthday} />
          <i class="fas fa-cake-candles" aria-hidden="true"></i>
          <span>Birthday</span>
        </label>

        <label class="toggle-row">
          <input type="checkbox" checked={showQRCode} onchange={toggleQRCode} />
          <i class="fas fa-qrcode" aria-hidden="true"></i>
          <span>QR Code</span>
        </label>
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
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px dashed var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-sm, 14px);
  }

  .preview-placeholder i {
    font-size: 2rem;
    opacity: 0.5;
  }

  .toggle-sections {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
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
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    padding: 0.2rem 0;
    user-select: none;
  }

  .toggle-row input[type="checkbox"] {
    accent-color: var(--theme-accent, #3b82f6);
    width: 1rem;
    height: 1rem;
    cursor: pointer;
    flex-shrink: 0;
  }

  .toggle-row i {
    width: 1rem;
    text-align: center;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    flex-shrink: 0;
  }

  /* Hand points row and start layout row: icon + label on left, radio options on right */
  .hand-points-row,
  .start-layout-row {
    cursor: default;
  }

  .hand-point-options,
  .start-layout-options {
    display: flex;
    gap: 0.75rem;
    margin-left: auto;
  }

  .radio-option {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    user-select: none;
  }

  .radio-option input[type="radio"] {
    accent-color: var(--theme-accent, #3b82f6);
    cursor: pointer;
  }
</style>
