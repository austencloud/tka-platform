<!--
CardBasedSettingsContainer - Minimal card grid renderer
Delegates ALL logic to services (SRP compliant)
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import { onMount, getContext } from "svelte";
  import { flip } from "svelte/animate";
  import type { PanelCoordinationState } from "$lib/features/create/shared/state/panel-coordination-state.svelte";
  import { quintOut } from "svelte/easing";

  import type { CardDescriptor } from "../shared/services/contracts/ICardConfigurator";
  import type { ILOOPParameterProvider } from "../shared/services/contracts/ILOOPParameterProvider";
  import type { ICardConfigurator } from "../shared/services/contracts/ICardConfigurator";
  import type { IResponsiveTypographer } from "../shared/services/contracts/IResponsiveTypographer";
  import { ResponsiveTypographer } from "../shared/services/implementations/ResponsiveTypographer";
  import type { UIGenerationConfig } from "../state/generate-config.svelte";
  import type { StartEndOptionsState } from "../state/start-end-options-state.svelte";
  import type {
    DifficultyLevel,
    PropContinuity,
  } from "../shared/domain/models/generate-models";
  import {
    ROTATED_LOOP_TYPES,
    LOOPType,
    SliceSize,
  } from "../circular/domain/models/circular-models";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { getCardColors } from "../shared/domain/card-colors";
  import { spellServiceLoader } from "$lib/features/create/spell/services/implementations/SpellServiceLoader";
  // Card components
  import GridModeCard from "./cards/GridModeCard.svelte";
  import LengthCard from "./cards/LengthCard.svelte";
  import LevelCard from "./cards/LevelCard.svelte";
  import TurnIntensityCard from "./cards/TurnIntensityCard.svelte";
  import GenerateButtonCard from "./cards/GenerateButtonCard.svelte";
  import ConsolidatedLOOPCard from "./cards/ConsolidatedLOOPCard.svelte";
  import SliceSizeCard from "./cards/SliceSizeCard.svelte";
  import CustomizeCard from "./cards/CustomizeCard.svelte";
  import WordInputCard from "./cards/WordInputCard.svelte";
  // Props
  let {
    config,
    isFreeformMode,
    updateConfig,
    isGenerating,
    onGenerateClicked,
    startEndState,
    hasSettingsChanged = false,
    wordInputValue = "",
    onWordInput,
    onWordSubmit,
    needsCycleCompletion = false,
    onCompleteCycle,
    tourActiveStop = null,
    isMobile = false,
    onOpenWordInput,
  } = $props<{
    config: UIGenerationConfig;
    isFreeformMode: boolean;
    updateConfig: (updates: Partial<UIGenerationConfig>) => void;
    isGenerating: boolean;
    onGenerateClicked: (options: any) => Promise<void>;
    startEndState?: StartEndOptionsState;
    hasSettingsChanged?: boolean;
    wordInputValue?: string;
    onWordInput?: (value: string) => void;
    onWordSubmit?: () => void;
    /** When true, shows "Complete Cycle" button next to generate */
    needsCycleCompletion?: boolean;
    /** Called when user clicks "Complete Cycle" */
    onCompleteCycle?: () => void;
    /** When set, highlights this card and dims others (used by tour modal) */
    tourActiveStop?: string | null;
    /** Whether the app is in mobile layout — used to open word input overlay */
    isMobile?: boolean;
    /** Called when user taps the word card on mobile to open the overlay */
    onOpenWordInput?: () => void;
  }>();

  // Get panel coordination state from context (for LOOP expanded overlay)
  const panelState = getContext<PanelCoordinationState>("panelState");

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

  // Pre-compute word length including bridges and LOOP multiplication
  let computedWordLength = $state<number | undefined>(undefined);

  $effect(() => {
    const word = wordInputValue?.trim();
    if (!word) {
      computedWordLength = undefined;
      return;
    }
    computeWordLength(word, config.loopEnabled, config.loopType, config.sliceSize);
  });

  async function computeWordLength(
    word: string,
    loopEnabled: boolean,
    loopType: string,
    sliceSize: string
  ) {
    try {
      const graph = await spellServiceLoader.getTransitionGraph();
      const generator = await spellServiceLoader.getWordGenerator();

      const parseResult = generator.parseWord(word);
      if (!parseResult || parseResult.error || !parseResult.letters?.length) {
        computedWordLength = undefined;
        return;
      }

      const originalLetters = parseResult.letters;

      // Count bridges needed between consecutive letters
      let bridgeCount = 0;
      for (let i = 1; i < originalLetters.length; i++) {
        const prev = originalLetters[i - 1]!;
        const curr = originalLetters[i]!;
        if (!graph.canFollow(prev, curr)) {
          const bridges = graph.findAllBridgeOptions(prev, curr);
          if (bridges.length > 0) {
            bridgeCount++;
          }
        }
      }

      let totalBeats = originalLetters.length + bridgeCount;

      // Apply LOOP multiplier
      if (loopEnabled) {
        // LOOP extension adds 1 bridge beat to connect end back to start
        totalBeats += 1;

        if (ROTATED_LOOP_TYPES.has(loopType as LOOPType)) {
          if (sliceSize === SliceSize.HALVED) {
            totalBeats *= 2;
          } else if (sliceSize === SliceSize.QUARTERED) {
            totalBeats *= 4;
          }
        } else {
          // Non-rotated LOOPs (mirrored, flipped, rewound) always double
          totalBeats *= 2;
        }
      }

      computedWordLength = totalBeats;
    } catch {
      computedWordLength = undefined;
    }
  }

  // Initialize services
  onMount(() => {
    typographyService = new ResponsiveTypographer();
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

  function handleLOOPTypeChange(loopType: LOOPType) {
    updateConfig({ loopType });
  }

  // Style handlers
  function handleConstraintPresetChange(v: "smooth" | "mixed" | "choppy") {
    updateConfig({ constraintPreset: v });
  }

  function handleHandPathModeChange(v: "smooth" | "mixed" | "choppy") {
    updateConfig({ handPathMode: v });
  }

  function handleMotionTypeFilterChange(v: "no-dash" | "mixed" | "prefer-dash") {
    updateConfig({ motionTypeFilter: v === "mixed" ? null : v });
  }

  // LOOP toggle handler
  function handleLoopToggle() {
    updateConfig({ loopEnabled: !config.loopEnabled });
  }

  // Duration handler (inline in customize overlay)
  function handleDurationTemplateSelect(id: string | null) {
    updateConfig({ durationTemplateId: id });
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
        handleGenerationModeChange: () => {}, // No-op: mode is now derived from word presence
        handleLOOPTypeChange,
        handleSliceSizeChange: (sliceSize: any) => updateConfig({ sliceSize }),
        handleConstraintPresetChange,
        handleHandPathModeChange,
        handleMotionTypeFilterChange,
        handleDurationTemplateSelect,
        handleLoopToggle,
        wordInputValue,
        computedWordLength,
        handleWordInput: onWordInput,
        handleWordSubmit: onWordSubmit,
        handleStartEndChange: startEndState
          ? handleStartEndChange
          : undefined,
        startEndOptions: startEndState?.options,
        positionsResetTrigger,
        currentGridMode: config.gridMode,
        handleGenerateClick: onGenerateClicked,
        needsCycleCompletion,
        handleCompleteCycle: onCompleteCycle,
      },
      allowedIntensityValues,
      isGenerating,
      hasSettingsChanged,
      config.loopEnabled
    );
  });

</script>

<div class="card-settings-container" class:tour-active={!!tourActiveStop} style="--header-font-size: {headerFontSize}">

  {#each cards as card (card.id)}
    <div
      class="card-wrapper"
      class:tour-highlight={tourActiveStop === card.id}
      class:tour-dim={!!tourActiveStop && tourActiveStop !== card.id}
      style:grid-column="span {card.gridColumnSpan}"
      animate:flip={{ duration: 300, easing: quintOut }}
    >
      {#if card.id === "level"}
        <LevelCard {...card.props as any} color={cardColors.level.color} shadowColor={cardColors.level.shadowColor} />
      {:else if card.id === "length"}
        <LengthCard {...card.props as any} color={cardColors.length.color} shadowColor={cardColors.length.shadowColor} />
      {:else if card.id === "word-input"}
        <WordInputCard
          {...card.props as any}
          color={cardColors.mode.color}
          shadowColor={cardColors.mode.shadowColor}
          {isMobile}
          onOpenOverlay={onOpenWordInput}
        />
      {:else if card.id === "grid-mode"}
        <GridModeCard {...card.props as any} color={cardColors.gridMode.color} shadowColor={cardColors.gridMode.shadowColor} />
      {:else if card.id === "turn-intensity"}
        <TurnIntensityCard {...card.props as any} color={cardColors.turnIntensity.color} shadowColor={cardColors.turnIntensity.shadowColor} />
      {:else if card.id === "customize"}
        <CustomizeCard {...card.props as any} color={cardColors.customize.color} shadowColor={cardColors.customize.shadowColor} />
      {:else if card.id === "loop"}
        <ConsolidatedLOOPCard {...card.props as any} />
      {:else if card.id === "slice-size"}
        <SliceSizeCard {...card.props as any} color={cardColors.sliceSize.color} shadowColor={cardColors.sliceSize.shadowColor} />
      {:else if card.id === "generate-button"}
        <GenerateButtonCard {...card.props as any} />
      {/if}
    </div>
  {/each}
</div>

<style>
  /* ============================================================ */
  /* CARD GRID */
  /* ============================================================ */

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
    min-height: var(--min-touch-target); /* WCAG AAA minimum touch target */
    min-width: 0;
    overflow: visible; /* Allow cards to pop over neighbors */
    transition: grid-column var(--duration-dramatic) ease;
    position: relative;
  }

  .card-wrapper > :global(*) {
    flex: 1;
    min-height: 0;
    min-width: 0;
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

  /* Tour highlighting — used when rendered inside the tour modal */
  .card-wrapper.tour-dim {
    opacity: 0.2;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }

  .card-wrapper.tour-highlight {
    position: relative;
    z-index: 1;
  }

  .card-wrapper.tour-highlight::after {
    content: "";
    position: absolute;
    inset: -2px;
    border-radius: 14px;
    border: 2px solid rgba(59, 130, 246, 0.6);
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.3);
    pointer-events: none;
    animation: tour-card-glow 1.5s ease-in-out infinite;
  }

  @keyframes tour-card-glow {
    0%, 100% {
      border-color: rgba(59, 130, 246, 0.4);
      box-shadow: 0 0 8px rgba(59, 130, 246, 0.2);
    }
    50% {
      border-color: rgba(59, 130, 246, 0.8);
      box-shadow: 0 0 16px rgba(59, 130, 246, 0.4);
    }
  }

  /* Accessibility: Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .card-wrapper {
      transition: none;
    }
    .card-wrapper.tour-dim {
      transition: none;
    }
    .card-wrapper.tour-highlight::after {
      animation: none;
      border-color: rgba(59, 130, 246, 0.6);
      box-shadow: 0 0 12px rgba(59, 130, 246, 0.3);
    }
  }

</style>
