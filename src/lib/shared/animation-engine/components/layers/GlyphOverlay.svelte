<!--
GlyphOverlay.svelte

Cross-fading glyph overlay for AnimatorCanvas.
Displays TKA glyph and beat number with fade transitions.

Dark mode: Uses prop-based approach for preview isolation.
When darkMode prop is provided, it overrides global state.
CSS class .dark-mode triggers styling, with fallback to :global(:root.dark).

Toggle animations: Delightful scale/pop transitions when visibility toggles.
-->
<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import { backOut, cubicOut } from "svelte/easing";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import TKAGlyph from "$lib/shared/pictograph/tka-glyph/components/TKAGlyph.svelte";
  import TurnsColumn from "$lib/shared/pictograph/tka-glyph/components/TurnsColumn.svelte";
  import StepNumber from "$lib/shared/pictograph/shared/components/StepNumber.svelte";
  import BeatPositionGlyph from "$lib/shared/pictograph/shared/components/BeatPositionGlyph.svelte";

  let {
    // Current glyph state
    letter = null,
    displayedLetter = null,
    displayedTurnsTuple = "(s, 0, 0)",
    displayedStepNumber = null,
    displayedMusicalPosition = null,
    // Fading out state
    fadingOutLetter = null,
    fadingOutTurnsTuple = null,
    fadingOutStepNumber = null,
    // Transition flag
    isNewLetter = false,
    // Visibility
    tkaGlyphVisible = true,
    stepNumbersVisible = true,
    beatPositionVisible = true,
    // Dark mode - when provided, overrides global state (for preview isolation)
    darkMode = false,
    // Start position indicator - shows "Start" in top-left when at start position
    isAtStartPosition = false,
  }: {
    letter?: Letter | null;
    displayedLetter?: Letter | null;
    displayedTurnsTuple?: string;
    displayedStepNumber?: number | null;
    displayedMusicalPosition?: string | null;
    fadingOutLetter?: Letter | null;
    fadingOutTurnsTuple?: string | null;
    fadingOutStepNumber?: number | null;
    isNewLetter?: boolean;
    tkaGlyphVisible?: boolean;
    stepNumbersVisible?: boolean;
    beatPositionVisible?: boolean;
    darkMode?: boolean;
    isAtStartPosition?: boolean;
  } = $props();
</script>

<div class="glyph-overlay" class:dark-mode={darkMode} data-controlled="true">
  <!-- Fading out glyph (previous letter + beat number) -->
  {#if fadingOutLetter || fadingOutStepNumber !== null}
    <div class="glyph-wrapper fade-out">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 950 950"
        class="glyph-svg"
      >
        {#if fadingOutLetter && tkaGlyphVisible}
          <TKAGlyph
            letter={fadingOutLetter}
            pictographData={null}
            x={50}
            y={800}
            scale={1}
            visible={true}
            {darkMode}
          />
          <TurnsColumn
            turnsTuple={fadingOutTurnsTuple ?? "(s, 0, 0)"}
            letter={fadingOutLetter}
            pictographData={null}
            x={50}
            y={800}
            scale={1}
            visible={true}
            {darkMode}
          />
        {/if}
        {#if stepNumbersVisible}
          <StepNumber stepNumber={fadingOutStepNumber} {darkMode} />
        {/if}
      </svg>
    </div>
  {/if}

  <!-- Current glyph (fades in when letter/beat changes) -->
  <!-- Show when: there's a letter, OR beat number is set, OR at start position -->
  {#if letter || displayedStepNumber !== null || isAtStartPosition}
    <div class="glyph-wrapper" class:fade-in={isNewLetter}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 950 950"
        class="glyph-svg"
      >
        {#if letter && tkaGlyphVisible}
          <!-- Glyph is bottom-left: flies in/out toward bottom-left -->
          <g
            class="glyph-group"
            in:fly={{ x: -30, y: 30, duration: 350, easing: backOut }}
            out:fly={{ x: -30, y: 30, duration: 250, easing: cubicOut }}
          >
            <TKAGlyph
              {letter}
              pictographData={null}
              x={50}
              y={800}
              scale={1}
              visible={true}
              {darkMode}
            />
            <TurnsColumn
              turnsTuple={displayedTurnsTuple}
              {letter}
              pictographData={null}
              x={50}
              y={800}
              scale={1}
              visible={true}
              {darkMode}
            />
          </g>
        {/if}
        {#if stepNumbersVisible || isAtStartPosition}
          <!-- Beat number is top-left: flies in/out toward top-left -->
          <!-- Always show "Start" indicator when at start position, even if beat numbers toggled off -->
          <g
            class="beat-number-group"
            in:fly={{ x: -30, y: -30, duration: 300, easing: backOut }}
            out:fly={{ x: -30, y: -30, duration: 200, easing: cubicOut }}
          >
            <StepNumber
              stepNumber={isAtStartPosition ? 0 : displayedStepNumber}
              {darkMode}
            />
          </g>
        {/if}
        {#if beatPositionVisible && !isAtStartPosition && displayedMusicalPosition}
          <!-- Beat position is bottom-center: flies in/out from bottom -->
          <g
            class="beat-position-group"
            in:fly={{ x: 0, y: 30, duration: 300, easing: backOut }}
            out:fly={{ x: 0, y: 30, duration: 200, easing: cubicOut }}
          >
            <BeatPositionGlyph
              musicalPosition={displayedMusicalPosition}
              visible={true}
              hasValidData={true}
              {darkMode}
            />
          </g>
        {/if}
      </svg>
    </div>
  {/if}
</div>

<style>
  .glyph-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 5;
  }

  .glyph-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 1;
  }

  /* Override TKAGlyph's internal opacity transitions - we control fade at wrapper level */
  /* Only disable opacity transition, allow filter transition for dark mode */
  .glyph-wrapper :global(.tka-glyph) {
    opacity: 1 !important;
    transition: filter var(--duration-fast) ease-out !important;
  }

  .glyph-wrapper :global(.turns-column) {
    opacity: 1 !important;
    transition: filter var(--duration-fast) ease-out !important;
  }

  /* Instant transitions - no fade animation for step playback sync */
  .glyph-wrapper.fade-out {
    opacity: 0;
  }

  .glyph-wrapper.fade-in {
    opacity: 1;
  }

  .glyph-svg {
    width: 100%;
    height: 100%;
  }

  /* SVG group styling - transform origins for fly animations */
  .glyph-group {
    transform-origin: 0% 100%; /* Bottom-left corner */
  }

  .beat-number-group {
    transform-origin: 0% 0%; /* Top-left corner */
  }

  .beat-position-group {
    transform-origin: 50% 100%; /* Bottom-center */
  }

  /* Dark Mode via prop (preview isolation) */
  .glyph-overlay.dark-mode :global(.tka-glyph) {
    filter: invert(0.9);
  }

  /* Fallback: Global .dark class only applies when NOT controlled by prop */
  /* data-controlled attribute marks prop-controlled instances */
  :global(:root.dark) .glyph-overlay:not([data-controlled]) :global(.tka-glyph) {
    filter: invert(0.9);
  }

  /* Accessibility: reduced motion users get instant transitions */
  @media (prefers-reduced-motion: reduce) {
    .glyph-group,
    .beat-number-group {
      transition: none !important;
    }
  }
</style>
