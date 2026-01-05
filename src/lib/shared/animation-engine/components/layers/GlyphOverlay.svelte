<!--
GlyphOverlay.svelte

Cross-fading glyph overlay for AnimatorCanvas.
Displays TKA glyph and beat number with fade transitions.

Dark mode: Uses prop-based approach for preview isolation.
When darkMode prop is provided, it overrides global state.
CSS class .dark-mode triggers styling, with fallback to :global(:root.dark).
-->
<script lang="ts">
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import TKAGlyph from "$lib/shared/pictograph/tka-glyph/components/TKAGlyph.svelte";
  import TurnsColumn from "$lib/shared/pictograph/tka-glyph/components/TurnsColumn.svelte";
  import BeatNumber from "$lib/shared/pictograph/shared/components/BeatNumber.svelte";

  let {
    // Current glyph state
    letter = null,
    displayedLetter = null,
    displayedTurnsTuple = "(s, 0, 0)",
    displayedBeatNumber = null,
    // Fading out state
    fadingOutLetter = null,
    fadingOutTurnsTuple = null,
    fadingOutBeatNumber = null,
    // Transition flag
    isNewLetter = false,
    // Visibility
    tkaGlyphVisible = true,
    beatNumbersVisible = true,
    // Dark mode - when provided, overrides global state (for preview isolation)
    darkMode = false,
  }: {
    letter?: Letter | null;
    displayedLetter?: Letter | null;
    displayedTurnsTuple?: string;
    displayedBeatNumber?: number | null;
    fadingOutLetter?: Letter | null;
    fadingOutTurnsTuple?: string | null;
    fadingOutBeatNumber?: number | null;
    isNewLetter?: boolean;
    tkaGlyphVisible?: boolean;
    beatNumbersVisible?: boolean;
    darkMode?: boolean;
  } = $props();
</script>

<div class="glyph-overlay" class:dark-mode={darkMode} data-controlled="true">
  <!-- Fading out glyph (previous letter + beat number) -->
  {#if fadingOutLetter || fadingOutBeatNumber !== null}
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
        {#if beatNumbersVisible}
          <BeatNumber beatNumber={fadingOutBeatNumber} {darkMode} />
        {/if}
      </svg>
    </div>
  {/if}

  <!-- Current glyph (fades in when letter/beat changes) -->
  {#if letter || displayedBeatNumber !== null}
    <div class="glyph-wrapper" class:fade-in={isNewLetter}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 950 950"
        class="glyph-svg"
      >
        {#if letter && tkaGlyphVisible}
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
        {/if}
        {#if beatNumbersVisible}
          <BeatNumber beatNumber={displayedBeatNumber} {darkMode} />
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
    transition: filter 150ms ease-out !important;
  }

  .glyph-wrapper :global(.turns-column) {
    opacity: 1 !important;
    transition: filter 150ms ease-out !important;
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

  .glyph-overlay.dark-mode :global(.turns-column) {
    filter: drop-shadow(0 0 1.5px white) drop-shadow(0 0 1.5px white);
  }

  /* Fallback: Global .dark class only applies when NOT controlled by prop */
  /* data-controlled attribute marks prop-controlled instances */
  :global(:root.dark) .glyph-overlay:not([data-controlled]) :global(.tka-glyph) {
    filter: invert(0.9);
  }

  :global(:root.dark) .glyph-overlay:not([data-controlled]) :global(.turns-column) {
    filter: drop-shadow(0 0 1.5px white) drop-shadow(0 0 1.5px white);
  }
</style>
