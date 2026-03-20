<!--
  PictographSettingsModal.svelte - Visibility settings for pictographs

  Shows a live preview of a specific beat alongside toggles for all visibility
  settings. Changes are global and persist to localStorage/Firebase.

  Uses SettingsModalLayout for responsive shell (desktop: side-by-side, mobile: stacked).
  Subscribes to VisibilityStateManager via observer pattern for reactive state.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import SettingsModalLayout from "$lib/shared/foundation/ui/settings-modal/SettingsModalLayout.svelte";
  import PictographContainer from "./PictographContainer.svelte";
  import { getVisibilityStateManager } from "../state/visibility-state.svelte";
  import { MotionColor } from "../domain/enums/pictograph-enums";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";

  interface Props {
    open: boolean;
    stepData: StepData | StartPositionData | null;
  }

  let { open = $bindable(), stepData }: Props = $props();

  const vm = getVisibilityStateManager();

  // Version counter incremented by the observer — drives $derived.by re-reads
  let version = $state(0);

  function onVisibilityChange() {
    version++;
  }

  onMount(() => {
    vm.registerObserver(onVisibilityChange, ["all"]);
    return () => {
      vm.unregisterObserver(onVisibilityChange);
    };
  });

  // Reactive reads gated on version so Svelte re-evaluates when anything changes
  const blueMotion = $derived.by(() => {
    void version;
    return vm.getMotionVisibility(MotionColor.BLUE);
  });

  const redMotion = $derived.by(() => {
    void version;
    return vm.getMotionVisibility(MotionColor.RED);
  });

  const showGrid = $derived.by(() => {
    void version;
    return vm.getGridVisibility();
  });

  const handPointMode = $derived.by(() => {
    void version;
    return vm.getHandPointVisibility();
  });

  const nonRadial = $derived.by(() => {
    void version;
    return vm.getNonRadialVisibility();
  });

  const tkaGlyph = $derived.by(() => {
    void version;
    return vm.getRawGlyphVisibility("tkaGlyph");
  });

  const vtgGlyph = $derived.by(() => {
    void version;
    return vm.getRawGlyphVisibility("vtgGlyph");
  });

  const elementalGlyph = $derived.by(() => {
    void version;
    return vm.getRawGlyphVisibility("elementalGlyph");
  });

  const positionsGlyph = $derived.by(() => {
    void version;
    return vm.getRawGlyphVisibility("positionsGlyph");
  });

  const reversalIndicators = $derived.by(() => {
    void version;
    return vm.getRawGlyphVisibility("reversalIndicators");
  });

  const stepNumbers = $derived.by(() => {
    void version;
    return vm.getBeatNumbersVisibility();
  });

  const allMotionsVisible = $derived.by(() => {
    void version;
    return vm.areAllMotionsVisible();
  });

  // Toggle handlers
  function toggleBlue() {
    vm.setMotionVisibility(MotionColor.BLUE, !vm.getMotionVisibility(MotionColor.BLUE));
  }

  function toggleRed() {
    vm.setMotionVisibility(MotionColor.RED, !vm.getMotionVisibility(MotionColor.RED));
  }

  function toggleGrid() {
    vm.setGridVisibility(!vm.getGridVisibility());
  }

  function setHandPointMode(mode: "all" | "active") {
    vm.setHandPointVisibility(mode);
  }

  function toggleNonRadial() {
    vm.setNonRadialVisibility(!vm.getNonRadialVisibility());
  }

  function toggleTka() {
    vm.setGlyphVisibility("tkaGlyph", !vm.getRawGlyphVisibility("tkaGlyph"));
  }

  function toggleVtg() {
    vm.setGlyphVisibility("vtgGlyph", !vm.getRawGlyphVisibility("vtgGlyph"));
  }

  function toggleElemental() {
    vm.setGlyphVisibility("elementalGlyph", !vm.getRawGlyphVisibility("elementalGlyph"));
  }

  function togglePositions() {
    vm.setGlyphVisibility("positionsGlyph", !vm.getRawGlyphVisibility("positionsGlyph"));
  }

  function toggleReversals() {
    vm.setGlyphVisibility("reversalIndicators", !vm.getRawGlyphVisibility("reversalIndicators"));
  }

  function toggleStepNumbers() {
    vm.setBeatNumbersVisibility(!vm.getBeatNumbersVisibility());
  }
</script>

<SettingsModalLayout
  title="Pictograph Settings"
  icon="fa-eye"
  bind:open
>
  {#snippet preview()}
    <div class="preview-container">
      <PictographContainer pictographData={stepData} disableTransitions={true} />
    </div>
  {/snippet}

  {#snippet controls()}
    <div class="toggle-sections">

      <!-- Motions -->
      <div class="section">
        <div class="section-title">Motions</div>

        <label class="toggle-row">
          <input
            type="checkbox"
            checked={blueMotion}
            onchange={toggleBlue}
          />
          <i class="fas fa-circle" style="color: var(--prop-blue, #4fc3f7);" aria-hidden="true"></i>
          <span>Blue Motion</span>
        </label>

        <label class="toggle-row">
          <input
            type="checkbox"
            checked={redMotion}
            onchange={toggleRed}
          />
          <i class="fas fa-circle" style="color: var(--prop-red, #ef5350);" aria-hidden="true"></i>
          <span>Red Motion</span>
        </label>
      </div>

      <!-- Grid & Points -->
      <div class="section">
        <div class="section-title">Grid &amp; Points</div>

        <label class="toggle-row">
          <input
            type="checkbox"
            checked={showGrid}
            onchange={toggleGrid}
          />
          <i class="fas fa-border-all" aria-hidden="true"></i>
          <span>Grid</span>
        </label>

        <div class="toggle-row hand-points-row">
          <i class="fas fa-hand-dots" aria-hidden="true"></i>
          <span>Hand Points</span>
          <div class="hand-point-options">
            <label class="radio-option">
              <input
                type="radio"
                name="hand-point-mode"
                value="all"
                checked={handPointMode === "all"}
                onchange={() => setHandPointMode("all")}
              />
              <span>All</span>
            </label>
            <label class="radio-option">
              <input
                type="radio"
                name="hand-point-mode"
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
            checked={nonRadial}
            onchange={toggleNonRadial}
          />
          <i class="fas fa-circle-dot" aria-hidden="true"></i>
          <span>Non-Radial Points</span>
        </label>
      </div>

      <!-- Glyphs -->
      <div class="section">
        <div class="section-title">Glyphs</div>

        {#if !allMotionsVisible}
          <p class="glyph-hint">Some glyphs require both motions visible</p>
        {/if}

        <label class="toggle-row" class:disabled={vm.isGlyphDependent("tkaGlyph") && !allMotionsVisible}>
          <input
            type="checkbox"
            checked={tkaGlyph}
            disabled={vm.isGlyphDependent("tkaGlyph") && !allMotionsVisible}
            onchange={toggleTka}
          />
          <i class="fas fa-language" aria-hidden="true"></i>
          <span>TKA Glyphs</span>
        </label>

        <label class="toggle-row" class:disabled={vm.isGlyphDependent("vtgGlyph") && !allMotionsVisible}>
          <input
            type="checkbox"
            checked={vtgGlyph}
            disabled={vm.isGlyphDependent("vtgGlyph") && !allMotionsVisible}
            onchange={toggleVtg}
          />
          <i class="fas fa-v" aria-hidden="true"></i>
          <span>VTG Glyphs</span>
        </label>

        <label class="toggle-row" class:disabled={vm.isGlyphDependent("elementalGlyph") && !allMotionsVisible}>
          <input
            type="checkbox"
            checked={elementalGlyph}
            disabled={vm.isGlyphDependent("elementalGlyph") && !allMotionsVisible}
            onchange={toggleElemental}
          />
          <i class="fas fa-fire" aria-hidden="true"></i>
          <span>Elemental Glyphs</span>
        </label>

        <label class="toggle-row" class:disabled={vm.isGlyphDependent("positionsGlyph") && !allMotionsVisible}>
          <input
            type="checkbox"
            checked={positionsGlyph}
            disabled={vm.isGlyphDependent("positionsGlyph") && !allMotionsVisible}
            onchange={togglePositions}
          />
          <i class="fas fa-map-pin" aria-hidden="true"></i>
          <span>Position Glyphs</span>
        </label>

        <label class="toggle-row">
          <input
            type="checkbox"
            checked={reversalIndicators}
            onchange={toggleReversals}
          />
          <i class="fas fa-rotate" aria-hidden="true"></i>
          <span>Reversal Indicators</span>
        </label>
      </div>

      <!-- Display -->
      <div class="section">
        <div class="section-title">Display</div>

        <label class="toggle-row">
          <input
            type="checkbox"
            checked={stepNumbers}
            onchange={toggleStepNumbers}
          />
          <i class="fas fa-list-ol" aria-hidden="true"></i>
          <span>Step Numbers</span>
        </label>
      </div>

    </div>
  {/snippet}
</SettingsModalLayout>

<style>
  .preview-container {
    width: 100%;
    max-width: 300px;
    aspect-ratio: 1;
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

  .toggle-row.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .toggle-row.disabled input[type="checkbox"] {
    cursor: not-allowed;
  }

  /* Hand points row: icon + label on left, radio options on right */
  .hand-points-row {
    cursor: default;
  }

  .hand-point-options {
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

  .glyph-hint {
    font-size: var(--font-size-compact, 12px);
    color: var(--semantic-warning, #f59e0b);
    font-style: italic;
    margin: 0;
    padding: 0.15rem 0;
  }
</style>
