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
  const blueMotion = $derived.by(() => { void version; return vm.getMotionVisibility(MotionColor.BLUE); });
  const redMotion = $derived.by(() => { void version; return vm.getMotionVisibility(MotionColor.RED); });
  const showGrid = $derived.by(() => { void version; return vm.getGridVisibility(); });
  const handPointMode = $derived.by(() => { void version; return vm.getHandPointVisibility(); });
  const nonRadial = $derived.by(() => { void version; return vm.getNonRadialVisibility(); });
  const tkaGlyph = $derived.by(() => { void version; return vm.getRawGlyphVisibility("tkaGlyph"); });
  const vtgGlyph = $derived.by(() => { void version; return vm.getRawGlyphVisibility("vtgGlyph"); });
  const elementalGlyph = $derived.by(() => { void version; return vm.getRawGlyphVisibility("elementalGlyph"); });
  const positionsGlyph = $derived.by(() => { void version; return vm.getRawGlyphVisibility("positionsGlyph"); });
  const reversalIndicators = $derived.by(() => { void version; return vm.getRawGlyphVisibility("reversalIndicators"); });
  const stepNumbers = $derived.by(() => { void version; return vm.getBeatNumbersVisibility(); });
  const allMotionsVisible = $derived.by(() => { void version; return vm.areAllMotionsVisible(); });

  // Toggle handlers
  function toggleBlue() { vm.setMotionVisibility(MotionColor.BLUE, !vm.getMotionVisibility(MotionColor.BLUE)); }
  function toggleRed() { vm.setMotionVisibility(MotionColor.RED, !vm.getMotionVisibility(MotionColor.RED)); }
  function toggleGrid() { vm.setGridVisibility(!vm.getGridVisibility()); }
  function toggleHandPoints() { vm.setHandPointVisibility(handPointMode === "all" ? "active" : "all"); }
  function toggleNonRadial() { vm.setNonRadialVisibility(!vm.getNonRadialVisibility()); }
  function toggleTka() { vm.setGlyphVisibility("tkaGlyph", !vm.getRawGlyphVisibility("tkaGlyph")); }
  function toggleVtg() { vm.setGlyphVisibility("vtgGlyph", !vm.getRawGlyphVisibility("vtgGlyph")); }
  function toggleElemental() { vm.setGlyphVisibility("elementalGlyph", !vm.getRawGlyphVisibility("elementalGlyph")); }
  function togglePositions() { vm.setGlyphVisibility("positionsGlyph", !vm.getRawGlyphVisibility("positionsGlyph")); }
  function toggleReversals() { vm.setGlyphVisibility("reversalIndicators", !vm.getRawGlyphVisibility("reversalIndicators")); }
  function toggleStepNumbers() { vm.setBeatNumbersVisibility(!vm.getBeatNumbersVisibility()); }
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
        <button class="toggle-row" type="button" aria-pressed={blueMotion} onclick={toggleBlue}>
          <span>Blue Motion</span>
          <span class="toggle-indicator" class:active={blueMotion}></span>
        </button>
        <button class="toggle-row" type="button" aria-pressed={redMotion} onclick={toggleRed}>
          <span>Red Motion</span>
          <span class="toggle-indicator" class:active={redMotion}></span>
        </button>
      </div>

      <!-- Grid & Points -->
      <div class="section">
        <div class="section-title">Grid & Points</div>
        <button class="toggle-row" type="button" aria-pressed={showGrid} onclick={toggleGrid}>
          <span>Grid</span>
          <span class="toggle-indicator" class:active={showGrid}></span>
        </button>
        <button class="toggle-row" type="button" aria-pressed={handPointMode === "all"} onclick={toggleHandPoints}>
          <span>All Hand Points</span>
          <span class="toggle-indicator" class:active={handPointMode === "all"}></span>
        </button>
        <button class="toggle-row" type="button" aria-pressed={nonRadial} onclick={toggleNonRadial}>
          <span>Non-Radial Points</span>
          <span class="toggle-indicator" class:active={nonRadial}></span>
        </button>
      </div>

      <!-- Glyphs -->
      <div class="section">
        <div class="section-title">Glyphs</div>

        {#if !allMotionsVisible}
          <p class="glyph-hint">Some glyphs require both motions visible</p>
        {/if}

        <button class="toggle-row" class:disabled={!allMotionsVisible} type="button"
          aria-pressed={tkaGlyph} disabled={!allMotionsVisible} onclick={toggleTka}>
          <span>TKA Glyphs</span>
          <span class="toggle-indicator" class:active={tkaGlyph}></span>
        </button>
        <button class="toggle-row" class:disabled={!allMotionsVisible} type="button"
          aria-pressed={vtgGlyph} disabled={!allMotionsVisible} onclick={toggleVtg}>
          <span>VTG Glyphs</span>
          <span class="toggle-indicator" class:active={vtgGlyph}></span>
        </button>
        <button class="toggle-row" class:disabled={!allMotionsVisible} type="button"
          aria-pressed={elementalGlyph} disabled={!allMotionsVisible} onclick={toggleElemental}>
          <span>Elemental Glyphs</span>
          <span class="toggle-indicator" class:active={elementalGlyph}></span>
        </button>
        <button class="toggle-row" class:disabled={!allMotionsVisible} type="button"
          aria-pressed={positionsGlyph} disabled={!allMotionsVisible} onclick={togglePositions}>
          <span>Position Glyphs</span>
          <span class="toggle-indicator" class:active={positionsGlyph}></span>
        </button>
        <button class="toggle-row" type="button" aria-pressed={reversalIndicators} onclick={toggleReversals}>
          <span>Reversal Indicators</span>
          <span class="toggle-indicator" class:active={reversalIndicators}></span>
        </button>
      </div>

      <!-- Display -->
      <div class="section">
        <div class="section-title">Display</div>
        <button class="toggle-row" type="button" aria-pressed={stepNumbers} onclick={toggleStepNumbers}>
          <span>Step Numbers</span>
          <span class="toggle-indicator" class:active={stepNumbers}></span>
        </button>
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

  .toggle-row.disabled {
    opacity: 0.4;
    cursor: not-allowed;
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

  .glyph-hint {
    font-size: var(--font-size-compact, 12px);
    color: var(--semantic-warning, #f59e0b);
    font-style: italic;
    margin: 0;
    padding: 0.15rem 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .toggle-row,
    .toggle-indicator,
    .toggle-indicator::after {
      transition: none;
    }
  }
</style>
