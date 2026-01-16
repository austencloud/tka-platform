<!--
  LayeredSequencePreview.svelte

  Renders a sequence preview with individually animated overlay layers.
  Instead of re-rendering the entire image when toggles change, this component
  composites DOM elements around a base image for instant, animated transitions.

  Structure:
  - Header section (word + difficulty badge) - animates in/out
  - Grid section (base image with beat number overlays)
  - Footer section (name, notes, birthday) - each animates independently
-->
<script lang="ts">
  import { fly, fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import { onMount, onDestroy, untrack } from "svelte";
  import { container } from "$lib/shared/di";
  import type { ISequenceRenderer } from "$lib/shared/render/services/contracts/ISequenceRenderer";
  import type { ILayoutCalculator } from "$lib/shared/render/services/contracts/ILayoutCalculator";
  import { SequenceDifficultyCalculator } from "$lib/features/discover/sequences/display/services/implementations/SequenceDifficultyCalculator";
  import { simplifyRepeatedWord } from "$lib/features/create/shared/workspace-panel/shared/utils/word-simplifier";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { authState } from "$lib/shared/auth/state/authState.svelte";

  interface Props {
    sequence: SequenceData;
    // Visibility toggles
    showWord?: boolean;
    showStepNumbers?: boolean;
    showDifficultyLevel?: boolean;
    includeStartPosition?: boolean;
    showCreatorName?: boolean;
    showNotes?: boolean;
    showBirthday?: boolean;
    // Settings
    darkMode?: boolean;
    userName?: string;
    customNotesText?: string;
    // Prop overrides
    bluePropType?: PropType;
    redPropType?: PropType;
    catDogModeEnabled?: boolean;
  }

  const {
    sequence,
    showWord = true,
    showStepNumbers = true,
    showDifficultyLevel = true,
    includeStartPosition = true,
    showCreatorName = true,
    showNotes = true,
    showBirthday = true,
    darkMode = false,
    userName = "",
    customNotesText = "Created using TKA Scribe",
    bluePropType,
    redPropType,
    catDogModeEnabled = false,
  }: Props = $props();

  // Base image state
  let baseImageUrl = $state<string | null>(null);
  let isLoading = $state(true);
  let isRendering = false; // Guard against concurrent renders
  let imageElement: HTMLImageElement | undefined = $state();
  let renderedImageWidth = $state(0);
  let renderedImageHeight = $state(0);

  // Track image element dimensions after render
  function handleImageLoad() {
    // Use requestAnimationFrame to ensure layout is complete
    requestAnimationFrame(() => {
      if (imageElement) {
        renderedImageWidth = imageElement.clientWidth;
        renderedImageHeight = imageElement.clientHeight;
      }
    });
  }

  // Also update dimensions when imageElement changes (new image URL)
  $effect(() => {
    const el = imageElement;
    const url = baseImageUrl;
    if (el && url) {
      // Re-measure when URL changes
      requestAnimationFrame(() => {
        // Guard against component being destroyed
        if (el) {
          renderedImageWidth = el.clientWidth;
          renderedImageHeight = el.clientHeight;
        }
      });
    }
  });

  // Layout calculations
  const difficultyCalculator = new SequenceDifficultyCalculator();

  // Layout dimensions
  let columns = $state(0);
  let rows = $state(0);
  let imageWidth = $state(0);
  let imageHeight = $state(0);

  // Derive word from sequence (with null safety)
  const derivedWord = $derived.by(() => {
    const rawWord = sequence.word || (sequence.steps ?? [])
      .filter(beat => beat.letter)
      .map(beat => beat.letter)
      .join("");
    return simplifyRepeatedWord(rawWord);
  });

  // Calculate difficulty level (with null safety)
  const difficultyLevel = $derived.by(() => {
    if (!sequence?.steps?.length) return 1;
    // Spread to convert readonly array to mutable for the calculator
    return difficultyCalculator.calculateDifficultyLevel([...sequence.steps]);
  });

  // Show header when either word or difficulty is enabled
  const showHeader = $derived(
    (showWord && derivedWord) || showDifficultyLevel
  );

  // Show footer when any footer element is enabled
  const showFooter = $derived(showCreatorName || showNotes || showBirthday);

  // Format birthday date (current date when export is created)
  const birthdayDate = $derived.by(() => {
    const date = new Date();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  });

  // Effective username
  const effectiveUserName = $derived(userName || authState.user?.displayName || "");

  // Level badge colors
  const defaultLevelStyle = { bg: "linear-gradient(135deg, #fff, #f5f5f5)", border: "#000", text: "#000" };
  const levelStyles: Record<number, { bg: string; border: string; text: string }> = {
    1: defaultLevelStyle,
    2: { bg: "linear-gradient(135deg, #d4d4d4, #a8a8a8)", border: "#000", text: "#000" },
    3: { bg: "linear-gradient(135deg, #ffd700, #b8860b)", border: "#000", text: "#000" },
    4: { bg: "linear-gradient(135deg, #c8a2c8, #9400d3)", border: "#000", text: "#000" },
    5: { bg: "linear-gradient(135deg, #ff4500, #8b0000)", border: "#000", text: "#fff" },
  };

  const currentLevelStyle = $derived(levelStyles[difficultyLevel] ?? defaultLevelStyle);

  // Calculate beat positions for beat number overlays (percentage-based for scaling)
  // Matches StepNumber.svelte: x="50", y="50" in 950x950 viewBox = ~5.26% from top-left
  // Font sizes: 100/950 = 10.526% for numbers, 80/950 = 8.42% for "Start"
  const beatPositions = $derived.by(() => {
    if (!columns || !rows) return [];
    const steps = sequence.steps ?? [];
    if (!steps.length) return [];

    const cellWidthPct = 100 / columns;
    const cellHeightPct = 100 / rows;
    // Position within cell: 50/950 ≈ 5.26%
    const inCellOffsetPct = 5.26;
    const positions: Array<{ leftPct: number; topPct: number; label: string; isStart: boolean }> = [];
    const startColumn = includeStartPosition ? 1 : 0;
    const stepsPerRow = columns - startColumn;

    // Start position
    if (includeStartPosition && sequence.startPosition) {
      positions.push({
        leftPct: cellWidthPct * (inCellOffsetPct / 100),
        topPct: cellHeightPct * (inCellOffsetPct / 100),
        label: "Start",
        isStart: true
      });
    }

    // Beat positions
    for (let i = 0; i < steps.length; i++) {
      const col = startColumn + (i % stepsPerRow);
      const row = Math.floor(i / stepsPerRow);
      positions.push({
        leftPct: col * cellWidthPct + cellWidthPct * (inCellOffsetPct / 100),
        topPct: row * cellHeightPct + cellHeightPct * (inCellOffsetPct / 100),
        label: String(i + 1),
        isStart: false
      });
    }

    return positions;
  });

  // Calculate font sizes based on cell dimensions
  // StepNumber.svelte uses font-size 100 in 950x950 viewBox = 10.526%
  // "Start" uses font-size 80 = 8.42%
  const beatFontSize = $derived.by(() => {
    if (!renderedImageWidth || !columns) return 12;
    const cellWidth = renderedImageWidth / columns;
    return Math.max(8, cellWidth * 0.10526); // 10.526% of cell width, min 8px
  });

  const startFontSize = $derived.by(() => {
    if (!renderedImageWidth || !columns) return 10;
    const cellWidth = renderedImageWidth / columns;
    return Math.max(7, cellWidth * 0.0842); // 8.42% of cell width, min 7px
  });

  // ===== PIXEL-PERFECT SIZING TO MATCH EXPORT =====
  // ImageComposer uses stepSize=240 (same as our render), then calculates:
  // - headerHeight = Math.floor(stepSize / 3)
  // - footerHeight = Math.floor(stepSize / 7)
  // TextRenderer then uses these heights to calculate font sizes.
  // We need to apply the same formulas, scaled by the display ratio.

  const RENDER_BEAT_SIZE = 240; // Must match renderBaseImage stepSize

  // Scale factor: how much the rendered image is scaled from original
  const scaleFactor = $derived.by(() => {
    if (!renderedImageWidth || !columns) return 1;
    const originalWidth = columns * RENDER_BEAT_SIZE;
    return renderedImageWidth / originalWidth;
  });

  // Header height: stepSize / 3 (matches ImageComposer.calculateHeaderHeight)
  const scaledHeaderHeight = $derived.by(() => {
    const baseHeaderHeight = Math.floor(RENDER_BEAT_SIZE / 3); // 80px at full size
    return Math.floor(baseHeaderHeight * scaleFactor);
  });

  // Footer height: stepSize / 7 (matches ImageComposer.calculateFooterHeight)
  const scaledFooterHeight = $derived.by(() => {
    const baseFooterHeight = Math.floor(RENDER_BEAT_SIZE / 7); // 34px at full size
    return Math.floor(baseFooterHeight * scaleFactor);
  });

  // Word font size: headerHeight * 0.9 (matches TextRenderer.renderWordHeader)
  const wordFontSize = $derived(Math.max(10, scaledHeaderHeight * 0.9));

  // Badge size: headerHeight * 0.9 (matches TextRenderer.renderWordHeader)
  const badgeSize = $derived(Math.max(16, scaledHeaderHeight * 0.9));

  // Badge padding from edge: headerHeight * 0.05
  const badgePadding = $derived(Math.max(2, scaledHeaderHeight * 0.05));

  // Badge number font size: badgeSize / 1.75 (matches TextRenderer.renderLevelBadge)
  const badgeNumberFontSize = $derived(Math.max(8, Math.floor(badgeSize / 1.75)));

  // Footer font size: Math.max(10, floor(footerHeight * 0.55)) (matches TextRenderer.renderUserInfo)
  const footerFontSize = $derived(Math.max(10, Math.floor(scaledFooterHeight * 0.55)));

  // Footer margin: Math.max(8, floor(footerHeight * 0.3))
  const footerMargin = $derived(Math.max(8, Math.floor(scaledFooterHeight * 0.3)));

  // Render base image on mount and when relevant props change
  async function renderBaseImage() {
    // Guard: need valid sequence with steps
    if (!sequence?.steps?.length) {
      isLoading = false;
      return;
    }

    // Guard against concurrent renders
    if (isRendering) {
      return;
    }
    isRendering = true;
    isLoading = true;

    try {
      const renderer = container.items.sequenceRenderer;
      const layoutService = container.items.layoutCalculator;

      // Calculate layout
      const stepCount = sequence.steps.length;
      const [cols, rws] = layoutService.calculateLayout(stepCount, includeStartPosition);
      columns = cols;
      rows = rws;

      // Render base image (without text overlays)
      const blob = await renderer.renderSequenceToBlob(sequence, {
        stepSize: 240,
        format: "PNG",
        quality: 1.0,
        includeStartPosition,
        addStepNumbers: false, // We overlay these
        addWord: false, // We overlay this
        addDifficultyLevel: false, // We overlay this
        addUserInfo: false, // We overlay this
        addReversalSymbols: true,
        propTypeOverride: catDogModeEnabled ? undefined : (bluePropType ?? undefined),
        bluePropTypeOverride: catDogModeEnabled ? bluePropType : undefined,
        redPropTypeOverride: catDogModeEnabled ? redPropType : undefined,
        visibilityOverrides: {
          darkMode,
        },
      });

      // Create URL for the base image
      const newUrl = URL.createObjectURL(blob);

      // Preload the image before showing
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          imageWidth = img.width;
          imageHeight = img.height;
          resolve();
        };
        img.onerror = (err) => {
          console.error("Failed to load image:", err);
          reject(err);
        };
        img.src = newUrl;
      });

      // Swap URLs
      if (baseImageUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(baseImageUrl);
      }
      baseImageUrl = newUrl;

    } catch (error) {
      console.error("Failed to render base image:", error);
    } finally {
      isLoading = false;
      isRendering = false;
    }
  }

  // Track if initial render is complete (to skip effect on mount)
  let hasMounted = false;

  // Re-render base image when relevant props change
  $effect(() => {
    // Access props to create reactive dependencies (these trigger the effect)
    const _darkMode = darkMode;
    const _bluePropType = bluePropType;
    const _redPropType = redPropType;
    const _catDogModeEnabled = catDogModeEnabled;
    const _includeStartPosition = includeStartPosition;

    // Skip initial mount - handled by onMount
    // Use untrack to prevent renderBaseImage from creating additional dependencies
    if (hasMounted) {
      untrack(() => {
        renderBaseImage();
      });
    }
  });

  onMount(() => {
    renderBaseImage().then(() => {
      // Mark as mounted AFTER first render completes
      hasMounted = true;
    });
  });

  onDestroy(() => {
    if (baseImageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(baseImageUrl);
    }
  });
</script>

<div class="layered-preview" class:dark-mode={darkMode}>
  {#if isLoading}
    <div class="loading-placeholder">
      <div class="spinner"></div>
    </div>
  {:else if baseImageUrl}
    <div
      class="preview-stack"
      style={renderedImageWidth > 0 ? `width: ${renderedImageWidth}px;` : ''}
    >
      <!-- Header section - matches TextRenderer.renderWordHeader layout -->
      {#if showHeader}
        <div
          class="header-section"
          style="height: {scaledHeaderHeight}px;"
          transition:fly={{ y: -20, duration: 250, easing: cubicOut }}
        >
          <!-- Difficulty badge - absolute positioned at top-left -->
          {#if showDifficultyLevel}
            <div
              class="difficulty-badge"
              style="
                background: {currentLevelStyle.bg};
                border-color: {currentLevelStyle.border};
                color: {currentLevelStyle.text};
                width: {badgeSize}px;
                height: {badgeSize}px;
                left: {badgePadding}px;
                font-size: {badgeNumberFontSize}px;
              "
              transition:scale={{ duration: 200, easing: cubicOut }}
            >
              {difficultyLevel}
            </div>
          {/if}

          <!-- Word text - centered across full width -->
          {#if showWord && derivedWord}
            <span
              class="word-text"
              style="font-size: {wordFontSize}px;"
              transition:fade={{ duration: 200 }}
            >
              {derivedWord}
            </span>
          {/if}
        </div>
      {/if}

      <!-- Grid section with base image and beat number overlays -->
      <div class="grid-section">
        <img
          class="base-image"
          src={baseImageUrl}
          alt="Sequence preview"
          draggable="false"
          bind:this={imageElement}
          onload={handleImageLoad}
        />

        <!-- Beat numbers overlay - centered to align with centered image -->
        {#if showStepNumbers && renderedImageWidth > 0}
          <div
            class="beat-numbers-overlay"
            style="width: {renderedImageWidth}px; height: {renderedImageHeight}px; top: 50%; left: 50%; transform: translate(-50%, -50%);"
            transition:fade={{ duration: 200 }}
          >
            {#each beatPositions as pos}
              <div
                class="beat-number"
                style="left: {pos.leftPct}%; top: {pos.topPct}%; font-size: {pos.isStart ? startFontSize : beatFontSize}px;"
              >
                {pos.label}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Footer section - matches TextRenderer.renderUserInfo layout -->
      {#if showFooter}
        <div
          class="footer-section"
          style="height: {scaledFooterHeight}px; padding-left: {footerMargin}px; padding-right: {footerMargin}px; font-size: {footerFontSize}px;"
          transition:fly={{ y: 20, duration: 250, easing: cubicOut }}
        >
          {#if showCreatorName && effectiveUserName}
            <span
              class="footer-name"
              transition:fly={{ x: -20, duration: 200, easing: cubicOut }}
            >
              {effectiveUserName}
            </span>
          {/if}

          {#if showNotes}
            <span
              class="footer-notes"
              transition:fade={{ duration: 200 }}
            >
              {customNotesText}
            </span>
          {/if}

          {#if showBirthday}
            <span
              class="footer-birthday"
              transition:fly={{ x: 20, duration: 200, easing: cubicOut }}
            >
              🎂 {birthdayDate}
            </span>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
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

  .loading-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: var(--theme-card-bg);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--theme-stroke);
    border-top-color: var(--theme-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .preview-stack {
    display: flex;
    flex-direction: column;
    max-width: 100%;
    max-height: 100%;
    /* Width is set via inline style from renderedImageWidth */
  }

  /* Header section - matches TextRenderer.renderWordHeader */
  .header-section {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    /* Height set via inline style from scaledHeaderHeight() */
    background: rgba(245, 245, 245, 0.98);
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    flex-shrink: 0;
    width: 100%; /* Fill parent (preview-stack) width */
    box-sizing: border-box;
  }

  .dark-mode .header-section {
    background: rgba(10, 10, 15, 0.98);
    border-bottom-color: rgba(255, 255, 255, 0.15);
  }

  /* Difficulty badge - absolute positioned, size set via inline style */
  .difficulty-badge {
    position: absolute;
    /* left set via inline style from badgePadding() */
    top: 50%;
    transform: translateY(-50%);
    /* width, height, font-size set via inline style */
    border-radius: 50%;
    border: 1px solid black;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Georgia, serif;
    font-weight: bold;
    flex-shrink: 0;
  }

  /* Word text - centered across full width, font-size set via inline style */
  .word-text {
    font-family: Georgia, serif;
    font-weight: 700;
    /* font-size set via inline style from wordFontSize() */
    color: #1f2937;
  }

  .dark-mode .word-text {
    color: #ffffff;
  }

  /* Grid section */
  .grid-section {
    position: relative;
    min-height: 0;
    min-width: 0;
    width: 100%; /* Fill parent (preview-stack) width */
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .base-image {
    display: block;
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    -webkit-user-drag: none;
    user-select: none;
  }

  .beat-numbers-overlay {
    position: absolute;
    pointer-events: none;
  }

  .beat-number {
    position: absolute;
    font-family: Georgia, serif;
    font-weight: bold;
    color: #231f20;
    white-space: nowrap;
    line-height: 1;
  }

  .dark-mode .beat-number {
    color: #ffffff;
  }

  /* Footer section - height, padding, font-size set via inline style */
  .footer-section {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    /* height, padding-left, padding-right, font-size set via inline style */
    background: rgba(245, 245, 245, 0.98);
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    font-family: Georgia, serif;
    color: black;
    flex-shrink: 0;
    width: 100%; /* Fill parent (preview-stack) width */
    box-sizing: border-box;
  }

  .dark-mode .footer-section {
    background: rgba(10, 10, 15, 0.98);
    border-top-color: rgba(255, 255, 255, 0.15);
    color: white;
  }

  .footer-name {
    font-weight: bold;
  }

  .footer-notes {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
  }

  .footer-birthday {
    margin-left: auto;
  }

  /* Responsive adjustments no longer needed - scaling is handled via JS calculations */
</style>
