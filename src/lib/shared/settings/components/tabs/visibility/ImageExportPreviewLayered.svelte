<!--
  ImageExportPreviewLayered.svelte

  Simulates the export image layout with animated overlay layers.
  Shows how visibility toggles affect the exported image in real-time
  with smooth fade transitions instead of regenerating the entire image.

  Structure:
  - Header section (word + difficulty badge) - animates in/out
  - Grid section (pictograph that responds to visibility toggles)
  - Footer section (name, notes, birthday) - each animates independently
-->
<script lang="ts">
  import { fly, fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import PictographWithVisibility from "$lib/shared/pictograph/shared/components/PictographWithVisibility.svelte";
  import { examplePictographData } from "./example-data";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";

  interface Props {
    // Content visibility toggles
    showWord?: boolean;
    showDifficultyLevel?: boolean;
    includeStartPosition?: boolean;
    // Footer toggles
    showCreatorName?: boolean;
    showNotes?: boolean;
    showBirthday?: boolean;
    // Custom values
    customNotesText?: string;
    // Dark mode
    darkMode?: boolean;
    // Pictograph visibility callbacks
    onToggleTKA?: () => void;
    onToggleVTG?: () => void;
    onToggleElemental?: () => void;
    onTogglePositions?: () => void;
    onToggleReversals?: () => void;
    onToggleNonRadial?: () => void;
  }

  const {
    showWord = true,
    showDifficultyLevel = false,
    includeStartPosition = true,
    showCreatorName = true,
    showNotes = true,
    showBirthday = true,
    customNotesText = "Created using TKA Scribe",
    darkMode = false,
    onToggleTKA,
    onToggleVTG,
    onToggleElemental,
    onTogglePositions,
    onToggleReversals,
    onToggleNonRadial,
  }: Props = $props();

  // Get visibility manager to read beat numbers setting from Pictograph panel
  const visibilityManager = getVisibilityStateManager();

  // Beat numbers visibility comes from Pictograph settings
  let showBeatNumbers = $state(visibilityManager.getBeatNumbersVisibility());

  // Update beat numbers when visibility changes
  $effect(() => {
    const observer = () => {
      showBeatNumbers = visibilityManager.getBeatNumbersVisibility();
    };
    visibilityManager.registerObserver(observer, ["all"]);
    return () => visibilityManager.unregisterObserver(observer);
  });

  // Example word for preview
  const previewWord = "SAMPLE";

  // Example difficulty level for preview
  const difficultyLevel = 2;

  // Show header when either word or difficulty is enabled
  const showHeader = $derived(showWord || showDifficultyLevel);

  // Show footer when any footer element is enabled
  const showFooter = $derived(showCreatorName || showNotes || showBirthday);

  // Format birthday date (current date when export is created)
  const birthdayDate = $derived(() => {
    const date = new Date();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  });

  // Effective username
  const effectiveUserName = $derived(authState.user?.displayName || "Your Name");

  // Level badge colors (matching LayeredSequencePreview)
  const defaultLevelStyle = { bg: "linear-gradient(135deg, #fff, #f5f5f5)", border: "#000", text: "#000" };
  const levelStyles: Record<number, { bg: string; border: string; text: string }> = {
    1: defaultLevelStyle,
    2: { bg: "linear-gradient(135deg, #d4d4d4, #a8a8a8)", border: "#000", text: "#000" },
    3: { bg: "linear-gradient(135deg, #ffd700, #b8860b)", border: "#000", text: "#000" },
    4: { bg: "linear-gradient(135deg, #c8a2c8, #9400d3)", border: "#000", text: "#000" },
    5: { bg: "linear-gradient(135deg, #ff4500, #8b0000)", border: "#000", text: "#fff" },
  };

  const currentLevelStyle = $derived(levelStyles[difficultyLevel] ?? defaultLevelStyle);
</script>

<div class="layered-preview" class:dark-mode={darkMode}>
  <div class="preview-stack">
    <!-- Header section with word and difficulty badge -->
    {#if showHeader}
      <div
        class="header-section"
        transition:fly={{ y: -20, duration: 250, easing: cubicOut }}
      >
        <!-- Difficulty badge -->
        {#if showDifficultyLevel}
          <div
            class="difficulty-badge"
            style="
              background: {currentLevelStyle.bg};
              border-color: {currentLevelStyle.border};
              color: {currentLevelStyle.text};
            "
            transition:scale={{ duration: 200, easing: cubicOut }}
          >
            {difficultyLevel}
          </div>
        {/if}

        <!-- Word text -->
        {#if showWord}
          <span class="word-text" transition:fade={{ duration: 200 }}>
            {previewWord}
          </span>
        {/if}
      </div>
    {/if}

    <!-- Grid section with pictograph -->
    <div class="grid-section">
      <!-- Start position indicator -->
      {#if includeStartPosition}
        <div class="start-position-cell" transition:fade={{ duration: 200 }}>
          <div class="start-label">Start</div>
        </div>
      {/if}

      <!-- Pictograph with visibility toggles -->
      <div class="pictograph-cell">
        <PictographWithVisibility
          pictographData={examplePictographData}
          forceShowAll={false}
          previewMode={true}
          {onToggleTKA}
          {onToggleVTG}
          {onToggleElemental}
          {onTogglePositions}
          {onToggleReversals}
          {onToggleNonRadial}
        />

        <!-- Beat number overlay -->
        {#if showBeatNumbers}
          <div class="beat-number-overlay" transition:fade={{ duration: 200 }}>
            1
          </div>
        {/if}
      </div>
    </div>

    <!-- Footer section -->
    {#if showFooter}
      <div
        class="footer-section"
        transition:fly={{ y: 20, duration: 250, easing: cubicOut }}
      >
        {#if showCreatorName}
          <span
            class="footer-name"
            transition:fly={{ x: -20, duration: 200, easing: cubicOut }}
          >
            {effectiveUserName}
          </span>
        {/if}

        {#if showNotes}
          <span class="footer-notes" transition:fade={{ duration: 200 }}>
            {customNotesText}
          </span>
        {/if}

        {#if showBirthday}
          <span
            class="footer-birthday"
            transition:fly={{ x: 20, duration: 200, easing: cubicOut }}
          >
            🎂 {birthdayDate()}
          </span>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .layered-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
  }

  .preview-stack {
    display: flex;
    flex-direction: column;
    max-width: 100%;
    max-height: 100%;
    background: rgba(245, 245, 245, 0.98);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .dark-mode .preview-stack {
    background: rgba(10, 10, 15, 0.98);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  /* Header section */
  .header-section {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: clamp(24px, 8cqi, 36px);
    background: rgba(245, 245, 245, 0.98);
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    flex-shrink: 0;
    padding: 0 8px;
  }

  .dark-mode .header-section {
    background: rgba(10, 10, 15, 0.98);
    border-bottom-color: rgba(255, 255, 255, 0.15);
  }

  .difficulty-badge {
    position: absolute;
    left: 4px;
    top: 50%;
    transform: translateY(-50%);
    width: clamp(18px, 6cqi, 28px);
    height: clamp(18px, 6cqi, 28px);
    border-radius: 50%;
    border: 1px solid black;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Georgia, serif;
    font-weight: bold;
    font-size: clamp(10px, 3cqi, 14px);
    flex-shrink: 0;
  }

  .word-text {
    font-family: Georgia, serif;
    font-weight: 700;
    font-size: clamp(12px, 4cqi, 18px);
    color: #1f2937;
    text-transform: uppercase;
  }

  .dark-mode .word-text {
    color: #ffffff;
  }

  /* Grid section */
  .grid-section {
    display: flex;
    align-items: stretch;
    background: rgba(255, 255, 255, 1);
    min-height: 0;
  }

  .dark-mode .grid-section {
    background: rgba(20, 20, 25, 1);
  }

  .start-position-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(40px, 15cqi, 80px);
    background: rgba(250, 250, 250, 1);
    border-right: 1px solid rgba(0, 0, 0, 0.08);
    flex-shrink: 0;
  }

  .dark-mode .start-position-cell {
    background: rgba(25, 25, 30, 1);
    border-right-color: rgba(255, 255, 255, 0.1);
  }

  .start-label {
    font-family: Georgia, serif;
    font-weight: bold;
    font-size: clamp(8px, 2.5cqi, 12px);
    color: #231f20;
    transform: rotate(-90deg);
    white-space: nowrap;
  }

  .dark-mode .start-label {
    color: #ffffff;
  }

  .pictograph-cell {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    aspect-ratio: 1;
  }

  .pictograph-cell :global(.pictograph-with-visibility),
  .pictograph-cell :global(.pictograph) {
    width: 100% !important;
    height: 100% !important;
    max-width: 100%;
    max-height: 100%;
  }

  .beat-number-overlay {
    position: absolute;
    top: 4%;
    left: 4%;
    font-family: Georgia, serif;
    font-weight: bold;
    font-size: clamp(10px, 4cqi, 16px);
    color: #231f20;
    pointer-events: none;
  }

  .dark-mode .beat-number-overlay {
    color: #ffffff;
  }

  /* Footer section */
  .footer-section {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: clamp(18px, 5cqi, 26px);
    padding: 0 clamp(4px, 1.5cqi, 8px);
    background: rgba(245, 245, 245, 0.98);
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    font-family: Georgia, serif;
    font-size: clamp(8px, 2.5cqi, 11px);
    color: black;
    flex-shrink: 0;
    gap: 4px;
  }

  .dark-mode .footer-section {
    background: rgba(10, 10, 15, 0.98);
    border-top-color: rgba(255, 255, 255, 0.15);
    color: white;
  }

  .footer-name {
    font-weight: bold;
    flex-shrink: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 30%;
  }

  .footer-notes {
    flex: 1;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .footer-birthday {
    flex-shrink: 0;
    white-space: nowrap;
  }

  /* Ensure pictograph fills available space */
  .pictograph-cell :global(svg.pictograph) {
    width: 100% !important;
    height: 100% !important;
  }

  /* Override preview mode opacity to fully hide (not dim) invisible glyphs */
  /* This gives smooth fade transitions while ensuring invisible = opacity 0, not 0.4 */
  .pictograph-cell :global(.tka-glyph.preview-mode:not(.visible)),
  .pictograph-cell :global(.vtg-glyph.preview-mode:not(.visible)),
  .pictograph-cell :global(.elemental-glyph.preview-mode:not(.visible)),
  .pictograph-cell :global(.positions-glyph.preview-mode:not(.visible)),
  .pictograph-cell :global(.reversal-indicator.preview-mode:not(.visible)),
  .pictograph-cell :global(.hand-point.preview-mode:not(.visible)),
  .pictograph-cell :global(.non-radial-point.preview-mode:not(.visible)) {
    opacity: 0 !important;
  }

  @media (prefers-reduced-motion: reduce) {
    .header-section,
    .footer-section,
    .difficulty-badge,
    .word-text,
    .footer-name,
    .footer-notes,
    .footer-birthday,
    .start-position-cell,
    .beat-number-overlay {
      transition: opacity 0.2s ease;
    }
  }
</style>
