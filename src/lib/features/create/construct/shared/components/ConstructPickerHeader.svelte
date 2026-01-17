<!-- Shared header used by construct pickers (start positions & options) -->
<script lang="ts">
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { GridMode as GridModeEnum } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import SimpleAdvancedToggle from "../../start-position-picker/components/SimpleAdvancedToggle.svelte";
  import GridModeToggle from "./GridModeToggle.svelte";
  import OptionsHeaderButton from "./OptionsHeaderButton.svelte";
  import GuidedHeaderButtons from "./GuidedHeaderButtons.svelte";

  type HeaderVariant = "start" | "options" | "guided";

  const {
    variant = "start",
    title = "",
    titleHtml = "",
    isAdvanced = false,
    currentGridMode = GridModeEnum.BOX,
    isFilterPanelOpen = false,
    compact = false,
    showNextHandButton = false,
    nextHandButtonText = "Build Red Hand",
    isSideBySideLayout = false,
    onToggleAdvanced,
    onGridModeChange,
    onOpenFilters,
    onBackClick,
    onNextHand,
  }: {
    variant?: HeaderVariant;
    title?: string;
    titleHtml?: string;
    isAdvanced?: boolean;
    currentGridMode?: GridMode;
    isFilterPanelOpen?: boolean;
    compact?: boolean;
    showNextHandButton?: boolean;
    nextHandButtonText?: string;
    isSideBySideLayout?: boolean;
    onToggleAdvanced?: (isAdvanced: boolean) => void;
    onGridModeChange?: (gridMode: GridMode) => void;
    onOpenFilters?: () => void;
    onBackClick?: () => void;
    onNextHand?: () => void;
  } = $props();

  function handleAdvancedToggle(nextValue: boolean) {
    onToggleAdvanced?.(nextValue);
  }
</script>

<div
  class="construct-picker-header"
  data-variant={variant}
  class:compact
  class:side-by-side={isSideBySideLayout}
>
  {#if variant === "start"}
    <!-- Start variant: traditional 3-column layout -->
    <div class="header-left">
      <SimpleAdvancedToggle {isAdvanced} onToggle={handleAdvancedToggle} />
    </div>

    <div class="header-center">
      <!-- Title now shown in TopBar instead of here -->
    </div>

    <div class="header-right">
      {#if onGridModeChange}
        <GridModeToggle {currentGridMode} {onGridModeChange} />
      {/if}
    </div>
  {:else if variant === "options"}
    <OptionsHeaderButton
      {title}
      {titleHtml}
      {isFilterPanelOpen}
      {compact}
      {onOpenFilters}
    />
  {:else if variant === "guided"}
    <GuidedHeaderButtons
      {title}
      {showNextHandButton}
      {nextHandButtonText}
      {currentGridMode}
      {onBackClick}
      {onNextHand}
      {onGridModeChange}
    />
  {/if}
</div>

<style>
  .construct-picker-header {
    /* Default: subtle background for portrait/stacked layout */
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding: 4px 8px;
    transition: all var(--duration-emphasis) ease;
  }

  /* Side-by-side layout: completely transparent, no visual separation */
  .construct-picker-header.side-by-side {
    background: transparent;
    backdrop-filter: none;
    border-bottom: none;
  }

  /* Grid layout for start variant */
  .construct-picker-header[data-variant="start"] {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    align-items: center;
    gap: 8px;
  }

  /* Full-width layout for options variant */
  .construct-picker-header[data-variant="options"],
  .construct-picker-header[data-variant="guided"] {
    display: flex;
    align-items: stretch;
  }

  .header-left,
  .header-right {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    min-height: var(--min-touch-target);
  }

  .header-right {
    justify-content: flex-end;
  }

  .header-center {
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;
    min-width: 0;
    overflow: visible;
    min-height: var(--min-touch-target);
  }

  /* Compact mode: Reduced height for tight spaces */
  .construct-picker-header.compact {
    padding: 2px 6px;
  }

  .construct-picker-header.compact .header-left,
  .construct-picker-header.compact .header-right,
  .construct-picker-header.compact .header-center {
    min-height: var(--min-touch-target);
  }

  /* Mobile optimizations */
  @media (max-width: 600px) {
    .construct-picker-header {
      padding: 2px 6px;
      gap: 4px;
    }

    /* Extra compact on mobile when compact mode is active */
    .construct-picker-header.compact {
      padding: 1px 4px;
    }

    .construct-picker-header.compact .header-left,
    .construct-picker-header.compact .header-right,
    .construct-picker-header.compact .header-center {
      min-height: var(--min-touch-target);
    }
  }
</style>
