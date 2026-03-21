<!--
  PictographSettingsModal.svelte - Visibility settings for pictographs

  Shows a live preview of a specific beat alongside chip toggles for all visibility
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

  let version = $state(0);
  function onVisibilityChange() { version++; }

  onMount(() => {
    vm.registerObserver(onVisibilityChange, ["all"]);
    return () => vm.unregisterObserver(onVisibilityChange);
  });

  // Reactive reads
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

<SettingsModalLayout title="Pictograph Settings" icon="fa-eye" bind:open>
  {#snippet preview()}
    <div class="preview-container">
      <PictographContainer pictographData={stepData} disableTransitions={true} />
    </div>
  {/snippet}

  {#snippet controls()}
    <div class="chip-sections">

      <div class="section">
        <div class="section-title">Motions</div>
        <div class="chip-group">
          <button class="chip" class:active={blueMotion} aria-pressed={blueMotion} onclick={toggleBlue}>
            Blue Motion
          </button>
          <button class="chip" class:active={redMotion} aria-pressed={redMotion} onclick={toggleRed}>
            Red Motion
          </button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Grid & Points</div>
        <div class="chip-group">
          <button class="chip" class:active={showGrid} aria-pressed={showGrid} onclick={toggleGrid}>
            Grid
          </button>
          <button class="chip" class:active={handPointMode === "all"} aria-pressed={handPointMode === "all"} onclick={toggleHandPoints}>
            All Hand Points
          </button>
          <button class="chip" class:active={nonRadial} aria-pressed={nonRadial} onclick={toggleNonRadial}>
            Non-Radial Points
          </button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Glyphs</div>
        {#if !allMotionsVisible}
          <p class="glyph-hint">Some glyphs require both motions visible</p>
        {/if}
        <div class="chip-group">
          <button class="chip" class:active={tkaGlyph} class:disabled={!allMotionsVisible}
            aria-pressed={tkaGlyph} disabled={!allMotionsVisible} onclick={toggleTka}>
            TKA
          </button>
          <button class="chip" class:active={vtgGlyph} class:disabled={!allMotionsVisible}
            aria-pressed={vtgGlyph} disabled={!allMotionsVisible} onclick={toggleVtg}>
            VTG
          </button>
          <button class="chip" class:active={elementalGlyph} class:disabled={!allMotionsVisible}
            aria-pressed={elementalGlyph} disabled={!allMotionsVisible} onclick={toggleElemental}>
            Elemental
          </button>
          <button class="chip" class:active={positionsGlyph} class:disabled={!allMotionsVisible}
            aria-pressed={positionsGlyph} disabled={!allMotionsVisible} onclick={togglePositions}>
            Positions
          </button>
          <button class="chip" class:active={reversalIndicators} aria-pressed={reversalIndicators} onclick={toggleReversals}>
            Reversals
          </button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Display</div>
        <div class="chip-group">
          <button class="chip" class:active={stepNumbers} aria-pressed={stepNumbers} onclick={toggleStepNumbers}>
            Step Numbers
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
    aspect-ratio: 1;
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

  .chip:hover:not(.active):not(.disabled) {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    color: var(--theme-text, white);
  }

  .chip:active:not(.disabled) {
    transform: scale(0.97);
  }

  .chip.disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .chip:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .glyph-hint {
    font-size: var(--font-size-compact, 12px);
    color: var(--semantic-warning, #f59e0b);
    font-style: italic;
    margin: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .chip {
      transition: none;
    }
  }
</style>
