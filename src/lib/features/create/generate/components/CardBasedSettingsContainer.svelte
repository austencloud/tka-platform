<!--
CardBasedSettingsContainer - Minimal card grid renderer
Delegates ALL logic to services (SRP compliant)
Supports help mode: when active, clicking cards opens help instead of normal action
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import { onMount, getContext } from "svelte";
  import { flip } from "svelte/animate";
  import type { PanelCoordinationState } from "$lib/features/create/shared/state/panel-coordination-state.svelte";
  import { quintOut } from "svelte/easing";
  import { scale } from "svelte/transition";
  import type { CardDescriptor } from "../shared/services/contracts/ICardConfigurator";
  import type { ILOOPParameterProvider } from "../shared/services/contracts/ILOOPParameterProvider";
  import type { ICardConfigurator } from "../shared/services/contracts/ICardConfigurator";
  import type { IResponsiveTypographer } from "../shared/services/contracts/IResponsiveTypographer";
  import type { UIGenerationConfig } from "../state/generate-config.svelte";
  import type { StartEndOptionsState } from "../state/start-end-options-state.svelte";
  import type {
    DifficultyLevel,
    GenerationMode,
    PropContinuity,
  } from "../shared/domain/models/generate-models";
  import type {
    LOOPType,
    SliceSize,
  } from "../circular/domain/models/circular-models";
  import type { GeneratorHelpId } from "../domain/generator-help-content";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { BackgroundType } from "$lib/shared/background/shared/domain/enums/background-enums";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { getCardColors } from "../shared/domain/card-colors";
  // Card components
  import LOOPCard from "./cards/LOOPCard.svelte";
  import LOOPExpandedOverlay from "./cards/LOOPExpandedOverlay.svelte";
  import GenerationModeCard from "./cards/GenerationModeCard.svelte";
  import GridModeCard from "./cards/GridModeCard.svelte";
  import LengthCard from "./cards/LengthCard.svelte";
  import LevelCard from "./cards/LevelCard.svelte";
  import PropContinuityCard from "./cards/PropContinuityCard.svelte";
  import SliceSizeCard from "./cards/SliceSizeCard.svelte";
  import TurnIntensityCard from "./cards/TurnIntensityCard.svelte";
  import GenerateButtonCard from "./cards/GenerateButtonCard.svelte";
  import StartEndCard from "./cards/StartEndCard.svelte";

  // Props
  let {
    config,
    isFreeformMode,
    updateConfig,
    isGenerating,
    onGenerateClicked,
    startEndState,
    helpMode = false,
    onHelpSelect,
  } = $props<{
    config: UIGenerationConfig;
    isFreeformMode: boolean;
    updateConfig: (updates: Partial<UIGenerationConfig>) => void;
    isGenerating: boolean;
    onGenerateClicked: (options: any) => Promise<void>;
    startEndState?: StartEndOptionsState;
    helpMode?: boolean;
    onHelpSelect?: (controlId: GeneratorHelpId) => void;
  }>();

  // Get panel coordination state from context (for LOOP expanded overlay)
  const panelState = getContext<PanelCoordinationState>("panelState");

  // Map card IDs to help IDs
  const cardIdToHelpId: Record<string, GeneratorHelpId> = {
    "level": "level",
    "length": "length",
    "generation-mode": "generation-mode",
    "grid-mode": "grid-mode",
    "prop-continuity": "prop-continuity",
    "turn-intensity": "turn-intensity",
    "loop-type": "loop-type",
    "slice-size": "slice-size",
    "start-end": "start-end",
    "generate-button": "generate",
  };

  function handleCardClick(cardId: string, event: MouseEvent) {
    if (!helpMode || !onHelpSelect) return;

    const helpId = cardIdToHelpId[cardId];
    if (helpId) {
      event.preventDefault();
      event.stopPropagation();
      onHelpSelect(helpId);
    }
  }

  // Check if a card has help available
  function hasHelp(cardId: string): boolean {
    return cardId in cardIdToHelpId;
  }

  // Services - use $state to make them reactive
  let typographyService = $state<IResponsiveTypographer | null>(null);
  let cardConfigService = $state<ICardConfigurator | null>(null);
  let loopParamProvider = $state<ILOOPParameterProvider | null>(null);

  // State
  let headerFontSize = $state("9px");
  let positionsResetTrigger = $state(0); // Increment to trigger reset animation

  // Derived values - now safe because services are reactive $state
  let currentLevel = $derived(
    loopParamProvider?.numberToDifficulty(config.level) ?? null
  );
  let allowedIntensityValues = $derived(
    currentLevel && loopParamProvider
      ? loopParamProvider.getAllowedTurnsForLevel(currentLevel)
      : []
  );

  // Get card colors based on current background (reactive to background changes)
  let cardColors = $derived(getCardColors(settingsService.settings.backgroundType ?? BackgroundType.SNOWFALL));

  // Initialize services
  onMount(() => {
    typographyService = container.items.responsiveTypographer;
    cardConfigService = container.items.cardConfigurator;
    loopParamProvider = container.items.loopParameterProvider;

    updateFontSize();
    window.addEventListener("resize", updateFontSize);

    return () => window.removeEventListener("resize", updateFontSize);
  });

  function updateFontSize() {
    if (!typographyService) return;
    // Desktop gets larger header text (11-18px) for better readability
    // Mobile/tablet stays at (9-14px)
    const isDesktop = window.innerWidth >= 1280;
    headerFontSize = isDesktop
      ? typographyService.calculateResponsiveFontSize(11, 18, 1.2)
      : typographyService.calculateResponsiveFontSize(9, 14, 1.2);
  }

  // Event handlers - safe because we check loopParamProvider exists
  function handleLevelChange(level: DifficultyLevel) {
    if (!loopParamProvider) return;
    updateConfig({ level: loopParamProvider.difficultyToNumber(level) });
  }

  function handleLengthChange(length: number) {
    updateConfig({ length });
  }

  function handleTurnIntensityChange(turnIntensity: number) {
    updateConfig({ turnIntensity });
  }

  function handlePropContinuityChange(propContinuity: PropContinuity) {
    updateConfig({ propContinuity });
  }

  function handleGridModeChange(gridMode: GridMode) {
    updateConfig({ gridMode });

    // Check if we have positions to clear
    const hasPositions =
      startEndState?.options?.startPosition !== null ||
      startEndState?.options?.endPosition !== null;

    if (hasPositions) {
      // Trigger animation FIRST
      positionsResetTrigger++;

      // Clear positions at animation midpoint (150ms into 300ms animation)
      // This makes the text change happen while it's invisible
      setTimeout(() => {
        startEndState?.clearPositions();
      }, 150);
    }
  }

  function handleGenerationModeChange(mode: GenerationMode) {
    updateConfig({ mode });
  }

  function handleLOOPTypeChange(loopType: LOOPType) {
    updateConfig({ loopType });
  }

  function handleSliceSizeChange(sliceSize: SliceSize) {
    updateConfig({ sliceSize });
  }

  // Start/End options handler
  function handleStartEndChange(options: any) {
    startEndState?.setOptions(options);
  }

  // Build cards using service - reactive to all dependencies
  let cards = $derived.by((): CardDescriptor[] => {
    if (!cardConfigService || !currentLevel) return [];

    return cardConfigService.buildCardDescriptors(
      config,
      currentLevel,
      isFreeformMode,
      {
        handleLevelChange,
        handleLengthChange,
        handleTurnIntensityChange,
        handlePropContinuityChange,
        handleGridModeChange,
        handleGenerationModeChange,
        handleLOOPTypeChange,
        handleSliceSizeChange,
        handleStartEndChange: startEndState
          ? handleStartEndChange
          : undefined,
        startEndOptions: startEndState?.options,
        positionsResetTrigger,
        currentGridMode: config.gridMode,
        handleGenerateClick: onGenerateClicked,
      },
      headerFontSize,
      allowedIntensityValues,
      isGenerating
    );
  });
</script>

<div class="card-settings-container" class:help-mode={helpMode}>
  <!-- LOOP Expanded Overlay - covers cards when open -->
  {#if panelState?.isLOOPPanelOpen && panelState.loopSelectedComponents && panelState.loopOnChange}
    <LOOPExpandedOverlay
      currentType={panelState.loopCurrentType!}
      selectedComponents={panelState.loopSelectedComponents}
      onChange={panelState.loopOnChange}
      onClose={() => panelState.closeLOOPPanel()}
    />
  {/if}

  {#each cards as card (card.id)}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="card-wrapper"
      class:help-clickable={helpMode && hasHelp(card.id)}
      style:grid-column="span {card.gridColumnSpan}"
      animate:flip={{ duration: 300, easing: quintOut }}
      in:scale={{ start: 0.95, duration: 300, easing: quintOut }}
      out:scale={{ start: 0.95, duration: 250, easing: quintOut }}
      onclick={(e) => handleCardClick(card.id, e)}
      role={helpMode && hasHelp(card.id) ? "button" : undefined}
    >
      <!-- Props are dynamically typed by CardConfigurator - type assertion needed -->
      <!-- Colors are overridden based on current background for visibility -->
      {#if card.id === "level"}
        <LevelCard {...card.props as any} color={cardColors.level.color} shadowColor={cardColors.level.shadowColor} />
      {:else if card.id === "length"}
        <LengthCard {...card.props as any} color={cardColors.length.color} shadowColor={cardColors.length.shadowColor} />
      {:else if card.id === "generation-mode"}
        <GenerationModeCard {...card.props as any} color={cardColors.mode.color} shadowColor={cardColors.mode.shadowColor} />
      {:else if card.id === "grid-mode"}
        <GridModeCard {...card.props as any} color={cardColors.gridMode.color} shadowColor={cardColors.gridMode.shadowColor} />
      {:else if card.id === "prop-continuity"}
        <PropContinuityCard {...card.props as any} color={cardColors.continuity.color} shadowColor={cardColors.continuity.shadowColor} />
      {:else if card.id === "slice-size"}
        <SliceSizeCard {...card.props as any} color={cardColors.sliceSize.color} shadowColor={cardColors.sliceSize.shadowColor} />
      {:else if card.id === "turn-intensity"}
        <TurnIntensityCard {...card.props as any} color={cardColors.turnIntensity.color} shadowColor={cardColors.turnIntensity.shadowColor} />
      {:else if card.id === "loop-type"}
        <LOOPCard {...card.props as any} />
      {:else if card.id === "start-end"}
        <StartEndCard {...card.props as any} color={cardColors.startEnd.color} shadowColor={cardColors.startEnd.shadowColor} />
      {:else if card.id === "generate-button"}
        <GenerateButtonCard {...card.props as any} />
      {/if}
    </div>
  {/each}
</div>

<style>
  .card-settings-container {
    /* Position relative for LOOP expanded overlay */
    position: relative;
    container-type: size; /* Enable both inline and block size container queries */
    container-name: settings-grid; /* Name the container for explicit targeting */
    display: grid;

    /* Fill available space UP TO max dimensions - don't expand beyond sensible size */
    flex: 1 1 auto;
    width: 100%;
    /* Mobile: use full width; Desktop: constrain to 550px */
    max-width: 100%;
    /* max-height applied conditionally below - not on mobile stacked layouts */
    margin: 0 auto; /* Center horizontally */
    /* Mobile: minimal horizontal padding */
    padding-inline: 0.25rem;
    align-self: stretch; /* Default: fill vertical space (mobile stacked) */

    /* Responsive gap - scales with container, respects device setting as max */
    gap: clamp(4px, 1.5cqi, var(--element-spacing, 10px));

    /* 🎯 SHARED CARD TEXT STYLING - Consistent across all cards */
    --card-text-size: clamp(16px, 2.2vmin, 30px);
    --card-text-weight: 700;
    --card-text-spacing: 0.3px;
    --card-text-shadow:
      0 2px 6px var(--theme-shadow), 0 0 20px var(--theme-stroke-strong);

    min-height: 0; /* Allow flex to shrink */
    overflow: visible; /* Allow cards to pop over neighbors and modals to escape */

    /* 6-subcolumn grid for flexible last-row spanning
       - Normal cards span 2 subcolumns (2/6 = 1/3 width)
       - 1 card in last row spans 6 subcolumns (full width)
       - 2 cards in last row each span 3 subcolumns (half width each)
    */
    grid-template-columns: repeat(6, minmax(0, 1fr));
    grid-auto-rows: 1fr; /* Rows divide available space equally */
    grid-auto-flow: row;
    align-content: center;

    /* Smooth transition for size changes (syncs with workspace 450ms animation) */
    transition:
      max-width 450ms cubic-bezier(0.4, 0, 0.2, 1),
      max-height 450ms cubic-bezier(0.4, 0, 0.2, 1),
      padding 450ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .card-wrapper {
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    overflow: visible; /* Allow cards to pop over neighbors */
    transition: grid-column 350ms ease;
    position: relative;
  }

  .card-wrapper > :global(*) {
    flex: 1;
    min-height: 0;
    min-width: 0;
  }

  /* Help mode styles */
  .card-settings-container.help-mode .card-wrapper.help-clickable {
    cursor: pointer;
  }

  /* Block pointer events on actual cards in help mode - wrapper handles clicks */
  .card-settings-container.help-mode .card-wrapper.help-clickable > :global(*) {
    pointer-events: none;
  }

  /* Highlight effect on clickable cards in help mode */
  .card-settings-container.help-mode .card-wrapper.help-clickable::after {
    content: "";
    position: absolute;
    inset: -2px;
    border-radius: 14px;
    border: 2px solid rgba(59, 130, 246, 0.6);
    pointer-events: none;
    animation: help-card-pulse 1.5s ease-in-out infinite;
  }

  @keyframes help-card-pulse {
    0%, 100% {
      border-color: rgba(59, 130, 246, 0.4);
      box-shadow: 0 0 8px rgba(59, 130, 246, 0.2);
    }
    50% {
      border-color: rgba(59, 130, 246, 0.8);
      box-shadow: 0 0 16px rgba(59, 130, 246, 0.4);
    }
  }

  /*
   * MAX-HEIGHT CONSTRAINTS:
   * - Mobile/tablet stacked layouts: NO max-height - use all vertical space
   * - Desktop (1024px+): Apply max-height so cards don't expand infinitely
   *
   * Note: Don't use orientation to detect layout - app uses width breakpoints
   * to decide stacked vs side-by-side, not orientation.
   */

  /* Desktop (side-by-side layout): constrain height and center */
  @media (min-width: 1024px) {
    .card-settings-container {
      max-width: min(750px, 95%);
      max-height: min(65%, 750px);
      padding-inline: 0; /* Remove mobile padding on desktop */
      align-self: center; /* Center vertically when height is constrained */
    }
  }

  /* Accessibility: Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .card-wrapper {
      transition: none;
    }
  }
</style>
