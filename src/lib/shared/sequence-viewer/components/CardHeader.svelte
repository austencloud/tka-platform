<!--
  CardHeader.svelte

  Renders the ChoreoCard header section: difficulty badge, word title,
  and LOOP icon strip. Extracted from ChoreoCard.svelte.
-->
<script lang="ts">
  import { fade, scale, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import DifficultyBadge from "$lib/shared/components/DifficultyBadge.svelte";
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";
  import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import { Period } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import {
    LOOP_ICON_SIZE_SCALE,
  } from "@tka/render-composition";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";

  interface Props {
    sequence: { word?: string };
    showHeader: boolean;
    isBrowseSoloMode: boolean;
    soloColor: "blue" | "red" | undefined;
    browseViewMode?: import("$lib/shared/browse/domain/browse-view-mode").BrowseViewMode;
    showDifficultyLevel: boolean;
    difficultyLevel: number;
    currentLevelStyle: { bg: string; border: string; text: string };
    wordVisible: boolean;
    showLoopGlyph: boolean;
    loopComponents: Set<LOOPComponent> | null;
    loopRotationPeriod: Period | undefined;
    loopInversionPeriod: Period | undefined;
    scaledHeaderHeight: number;
    badgeSize: number;
    badgePadding: number;
    badgeNumberFontSize: number;
    wordTitleFontSize: number;
    activeDarkMode: boolean;
  }

  const {
    sequence,
    showHeader,
    isBrowseSoloMode,
    soloColor,
    browseViewMode,
    showDifficultyLevel,
    difficultyLevel,
    currentLevelStyle,
    wordVisible,
    showLoopGlyph,
    loopComponents,
    loopRotationPeriod,
    loopInversionPeriod,
    scaledHeaderHeight,
    badgeSize,
    badgePadding,
    badgeNumberFontSize,
    wordTitleFontSize,
    activeDarkMode,
  }: Props = $props();
</script>

{#if showHeader}
  <div
    class="header-section"
    class:dark-mode={activeDarkMode}
    style="height: {scaledHeaderHeight}px;"
    transition:fly|local={{ y: -20, duration: 250, easing: cubicOut }}
  >
    {#if isBrowseSoloMode}
      <span
        class="word-title"
        style="font-size: {wordTitleFontSize}px; color: {soloColor === 'blue' ? 'var(--prop-blue, #2196f3)' : 'var(--prop-red, #f44336)'};"
      >
        {soloColor === "blue" ? "Blue" : "Red"} {browseViewMode?.subject === "hands" ? "Hand Path" : "Prop Path"}
      </span>
    {:else}
      {#if showDifficultyLevel}
        <div
          class="badge-wrapper"
          style="left: {badgePadding}px;"
          transition:scale|local={{ duration: 200, easing: cubicOut }}
        >
          <DifficultyBadge level={difficultyLevel} size="{badgeSize}px" fontSize="{badgeNumberFontSize}px" />
        </div>
      {/if}

      {#if wordVisible}
        <div
          class="word-title"
          transition:fade|local={{ duration: 200 }}
        >
          <TKAWordGlyph
            word={simplifyRepeatedWord(sequence.word!)}
            height={Math.floor(wordTitleFontSize * 0.85)}
            darkMode={activeDarkMode}
          />
        </div>
      {/if}

      {#if showLoopGlyph && loopComponents}
        <div
          class="loop-icon-badge"
          style="height: {badgeSize}px; right: {badgePadding}px;"
          transition:fade|local={{ duration: 200 }}
        >
          <LOOPIconStrip
            activeComponents={loopComponents}
            rotationPeriod={loopRotationPeriod}
            inversionPeriod={loopInversionPeriod}
            size={Math.floor(badgeSize * LOOP_ICON_SIZE_SCALE)}
            darkMode={activeDarkMode}
            showFreeformWhenEmpty={false}
          />
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  /* Header section */
  .header-section {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(245, 245, 245, 0.98);
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    flex-shrink: 0;
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
    transition: background-color 350ms ease, border-color 350ms ease;
  }

  .header-section.dark-mode {
    background: rgba(10, 10, 15, 0.98);
    border-bottom-color: rgba(255, 255, 255, 0.15);
  }

  .badge-wrapper {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
  }

  .word-title {
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 75%;
    overflow: hidden;
  }

  .loop-icon-badge {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0 4px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
  }

  .dark-mode .loop-icon-badge {
    background: rgba(255, 255, 255, 0.1);
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .header-section,
    .word-title {
      transition: none;
    }
  }
</style>
