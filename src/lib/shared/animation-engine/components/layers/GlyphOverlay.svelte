<!--
GlyphOverlay.svelte

Cross-fading glyph overlay for AnimatorCanvas.
Displays TKA glyph and beat number with fade transitions.

Dark mode: Uses prop-based approach for preview isolation.
When darkMode prop is provided, it overrides global state.
CSS class .dark-mode triggers styling, with fallback to :global(:root.dark).
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import TKAGlyph from "$lib/shared/pictograph/tka-glyph/components/TKAGlyph.svelte";
  import TurnsColumn from "$lib/shared/pictograph/tka-glyph/components/TurnsColumn.svelte";
  import StepNumber from "$lib/shared/pictograph/shared/components/StepNumber.svelte";
  import BeatPositionGlyph from "$lib/shared/pictograph/shared/components/BeatPositionGlyph.svelte";
  import { getLetterDimensions } from "$lib/shared/pictograph/tka-glyph/components/TKAGlyph.svelte";

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

  // Track letter dimensions with reactive state that updates when cache is populated
  // We use $state + $effect because $derived only evaluates once per change,
  // but the cache is populated asynchronously by TKAGlyph after SVG loads
  let letterDimensions = $state({ width: 100, height: 100 });
  let fadingOutLetterDimensions = $state({ width: 100, height: 100 });

  // Watch for letter changes and poll for dimensions until they're loaded
  $effect(() => {
    if (!letter) {
      letterDimensions = { width: 100, height: 100 };
      return;
    }

    // Check cache immediately
    const cached = getLetterDimensions(letter);
    if (cached.width !== 100 || cached.height !== 100) {
      letterDimensions = cached;
      return;
    }

    // Dimensions not cached yet - poll until available
    // TKAGlyph will load them, we just need to detect when it's done
    const interval = setInterval(() => {
      const dims = getLetterDimensions(letter);
      if (dims.width !== 100 || dims.height !== 100) {
        letterDimensions = dims;
        clearInterval(interval);
      }
    }, 16); // Check every frame

    return () => clearInterval(interval);
  });

  $effect(() => {
    if (!fadingOutLetter) {
      fadingOutLetterDimensions = { width: 100, height: 100 };
      return;
    }

    const cached = getLetterDimensions(fadingOutLetter);
    if (cached.width !== 100 || cached.height !== 100) {
      fadingOutLetterDimensions = cached;
      return;
    }

    const interval = setInterval(() => {
      const dims = getLetterDimensions(fadingOutLetter);
      if (dims.width !== 100 || dims.height !== 100) {
        fadingOutLetterDimensions = dims;
        clearInterval(interval);
      }
    }, 16);

    return () => clearInterval(interval);
  });
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
            disableChangeAnimation={true}
          />
          <TurnsColumn
            turnsTuple={fadingOutTurnsTuple ?? "(s, 0, 0)"}
            letter={fadingOutLetter}
            letterDimensions={fadingOutLetterDimensions}
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
          <!-- Glyph group with cross-fade transition -->
          <g
            class="glyph-group"
            in:fade={{ duration: 200, easing: cubicOut }}
            out:fade={{ duration: 150, easing: cubicOut }}
          >
            <TKAGlyph
              {letter}
              pictographData={null}
              x={50}
              y={800}
              scale={1}
              visible={true}
              {darkMode}
              disableChangeAnimation={true}
            />
            <TurnsColumn
              turnsTuple={displayedTurnsTuple}
              {letter}
              {letterDimensions}
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
          <!-- Beat number with cross-fade transition -->
          <!-- Always show "Start" indicator when at start position, even if beat numbers toggled off -->
          <g
            class="beat-number-group"
            in:fade={{ duration: 200, easing: cubicOut }}
            out:fade={{ duration: 150, easing: cubicOut }}
          >
            <StepNumber
              stepNumber={isAtStartPosition ? 0 : displayedStepNumber}
              {darkMode}
            />
          </g>
        {/if}
        {#if beatPositionVisible && !isAtStartPosition && displayedMusicalPosition}
          <!-- Beat position with cross-fade transition -->
          <g
            class="beat-position-group"
            in:fade={{ duration: 200, easing: cubicOut }}
            out:fade={{ duration: 150, easing: cubicOut }}
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
