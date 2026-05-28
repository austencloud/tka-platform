<!--
ImageExportPreviewLayered.svelte - Animated choreo card preview for visibility settings

Simulates a full choreo card layout (header + sequence grid + footer) with fly/fade
transitions that animate each section in and out as the user toggles visibility options.
This gives users a live preview of exactly how their settings affect the exported image.
-->
<script lang="ts">
  import { fly, fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import DifficultyBadge from "$lib/shared/components/DifficultyBadge.svelte";
  import PictographWithVisibility from "$lib/shared/pictograph/shared/components/PictographWithVisibility.svelte";
  import {
    exampleStartPositionData,
    getAabbPictographSteps,
  } from "./example-data";
  import { authState } from "$lib/shared/auth/state/authState.svelte";

  interface Props {
    showWord?: boolean;
    showDifficultyLevel?: boolean;
    includeStartPosition?: boolean;
    showStepNumbers?: boolean;
    showQRCode?: boolean;
    showCreatorName?: boolean;
    showNotes?: boolean;
    showDate?: boolean;
    customNotesText?: string;
    darkMode?: boolean;
    onToggleTKA?: () => void;
    onToggleTnD?: () => void;
    onToggleElemental?: () => void;
    onTogglePositions?: () => void;
    onToggleReversals?: () => void;
    onToggleNonRadial?: () => void;
  }

  let {
    showWord = true,
    showDifficultyLevel = false,
    includeStartPosition = false,
    showStepNumbers = false,
    showQRCode = false,
    showCreatorName = false,
    showNotes = false,
    showDate = false,
    customNotesText = "",
    darkMode = false,
    onToggleTKA = undefined,
    onToggleTnD = undefined,
    onToggleElemental = undefined,
    onTogglePositions = undefined,
    onToggleReversals = undefined,
    onToggleNonRadial = undefined,
  }: Props = $props();

  const aabbSteps = getAabbPictographSteps();
  const previewWord = "AABB";
  const difficultyLevel = 2;

  const showHeader = $derived(showWord || showDifficultyLevel);
  const showFooter = $derived(showCreatorName || showNotes || showDate);

  const birthdayDate = $derived(() => {
    const date = new Date();
    return `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`;
  });

  const effectiveUserName = $derived(
    authState.user?.displayName || "Your Name"
  );

</script>

<div class="layered-preview" class:dark-mode={darkMode}>
  <div class="preview-stack">
    <!-- Header: word text + difficulty badge -->
    {#if showHeader}
      <div
        class="header-section"
        transition:fly={{ y: -20, duration: 250, easing: cubicOut }}
      >
        {#if showDifficultyLevel}
          <div class="badge-wrapper" transition:scale={{ duration: 200, easing: cubicOut }}>
            <DifficultyBadge level={difficultyLevel} size="clamp(18px, 6cqi, 28px)" fontSize="clamp(10px, 3cqi, 14px)" />
          </div>
        {/if}
        {#if showWord}
          <span class="word-text" transition:fade={{ duration: 200 }}>
            {previewWord}
          </span>
        {/if}
      </div>
    {/if}

    <!-- Sequence grid: 2x2 beats with optional start position top row -->
    <div class="grid-section" class:with-start={includeStartPosition}>
      {#if includeStartPosition}
        <div class="sequence-cell start-cell" transition:fade={{ duration: 200 }}>
          <PictographWithVisibility
            pictographData={exampleStartPositionData}
            forceShowAll={true}
          />
        </div>
      {/if}
      {#each aabbSteps as step}
        <div class="sequence-cell">
          <PictographWithVisibility
            pictographData={step}
            forceShowAll={false}
            previewMode={true}
            {onToggleTKA}
            {onToggleTnD}
            {onToggleElemental}
            {onTogglePositions}
            {onToggleReversals}
            {onToggleNonRadial}
          />
        </div>
      {/each}
    </div>

    <!-- QR code indicator - shows in the corner when enabled -->
    {#if showQRCode}
      <div class="qr-indicator" transition:fade={{ duration: 200 }}>
        <i class="fas fa-qrcode" aria-hidden="true"></i>
      </div>
    {/if}

    <!-- Footer: creator name (left), notes (center), date (right) -->
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
        {#if showDate}
          <span
            class="footer-date"
            transition:fly={{ x: 20, duration: 200, easing: cubicOut }}
          >
            {birthdayDate()}
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
    position: relative;
  }

  .dark-mode .preview-stack {
    background: rgba(10, 10, 15, 0.98);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

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

  .badge-wrapper {
    position: absolute;
    left: 4px;
    top: 50%;
    transform: translateY(-50%);
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

  /* 2-column grid matching layout table: 4 steps = [2,2] */
  .grid-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: rgba(255, 255, 255, 1);
    min-height: 0;
  }

  /* With start position: top row spans full width, then 2x2 beats below */
  .grid-section.with-start {
    grid-template-columns: 1fr 1fr;
  }

  .dark-mode .grid-section {
    background: rgba(20, 20, 25, 1);
  }

  .sequence-cell {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    min-width: 0;
    border-right: 1px solid rgba(0, 0, 0, 0.08);
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  }

  /* Remove right border on last column */
  .sequence-cell:nth-child(2n) {
    border-right: none;
  }

  /* Remove bottom border on last row */
  .grid-section:not(.with-start) .sequence-cell:nth-last-child(-n+2) {
    border-bottom: none;
  }
  .grid-section.with-start .sequence-cell:nth-last-child(-n+2) {
    border-bottom: none;
  }

  .dark-mode .sequence-cell {
    border-right-color: rgba(255, 255, 255, 0.1);
    border-bottom-color: rgba(255, 255, 255, 0.1);
  }

  /* Start position spans the full top row */
  .sequence-cell.start-cell {
    grid-column: 1 / -1;
    aspect-ratio: auto;
    max-height: 50%;
    background: rgba(250, 250, 250, 1);
    border-right: none;
  }

  .dark-mode .sequence-cell.start-cell {
    background: rgba(25, 25, 30, 1);
  }

  /* Force pictograph children to fill the cell completely */
  .sequence-cell :global(.pictograph-with-visibility),
  .sequence-cell :global(.pictograph),
  .sequence-cell :global(svg.pictograph) {
    width: 100% !important;
    height: 100% !important;
    max-width: 100%;
    max-height: 100%;
  }

  /* QR code icon - absolute-positioned in bottom-right corner */
  .qr-indicator {
    position: absolute;
    bottom: 4px;
    right: 4px;
    font-size: clamp(10px, 3cqi, 16px);
    color: rgba(0, 0, 0, 0.3);
    z-index: 1;
  }

  .dark-mode .qr-indicator {
    color: rgba(255, 255, 255, 0.3);
  }

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

  .footer-date {
    flex-shrink: 0;
    white-space: nowrap;
  }

  /*
   * In preview mode, glyphs that are toggled off should be fully hidden
   * (opacity 0), not just dimmed. The parent preview mode dims them;
   * we override that here to match the actual export behavior.
   */
  .sequence-cell :global(.tka-glyph.preview-mode:not(.visible)),
  .sequence-cell :global(.turns-column.preview-mode:not(.visible)),
  .sequence-cell :global(.tnd-glyph.preview-mode:not(.visible)),
  .sequence-cell :global(.elemental-glyph.preview-mode:not(.visible)),
  .sequence-cell :global(.position-glyph.preview-mode:not(.visible)),
  .sequence-cell :global(.reversal-indicators.preview-mode:not(.visible)) {
    opacity: 0 !important;
  }

  .sequence-cell
    :global(.grid-container.preview-mode.hide-inactive-hand-points .hand-point-inactive) {
    opacity: 0 !important;
  }

  .sequence-cell
    :global(
      .grid-container.preview-mode:not(.show-non-radial) #ne_diamond_layer2_point
    ),
  .sequence-cell
    :global(
      .grid-container.preview-mode:not(.show-non-radial) #se_diamond_layer2_point
    ),
  .sequence-cell
    :global(
      .grid-container.preview-mode:not(.show-non-radial) #sw_diamond_layer2_point
    ),
  .sequence-cell
    :global(
      .grid-container.preview-mode:not(.show-non-radial) #nw_diamond_layer2_point
    ) {
    opacity: 0 !important;
  }

  @media (prefers-reduced-motion: reduce) {
    .header-section,
    .footer-section,
    .badge-wrapper,
    .word-text,
    .footer-name,
    .footer-notes,
    .footer-date,
    .sequence-cell {
      transition: opacity 200ms ease;
    }
  }
</style>
