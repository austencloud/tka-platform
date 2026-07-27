<!--
CardBasedSettingsContainer - Minimal card grid renderer
Delegates ALL logic to services (SRP compliant)
-->
<script lang="ts">

import { buildCardDescriptors } from "$lib/features/create/generate/shared/services/card-configurator";
import { getLOOPParameterProvider } from "$lib/features/create/generate/shared/get-loop-parameter-provider";
  import { onMount, getContext, type ComponentProps } from "svelte";
  import { flip } from "svelte/animate";
  import type {
    PanelCoordinationState,
    StartEndOptions,
  } from "$lib/shared/create/state/panel-coordination-state.svelte";
  import { quintOut } from "svelte/easing";

  import type { CardDescriptor } from "$lib/shared/create/domain/generator-contract-types";
  import type { LOOPParameterProvider } from "$lib/features/create/generate/shared/services/loop-parameter-provider";
  import { calculateResponsiveFontSize } from "../shared/services/responsive-typographer";
  import type { UIGenerationConfig } from "../state/generate-config.svelte";
  import type { StartEndOptionsState } from "../state/start-end-options-state.svelte";
  import type {
    DifficultyLevel,
    GenerationOptions,
    PropContinuity,
  } from "../shared/domain/models/generate-models";
  import {
    ROTATED_LOOP_TYPES,
    LOOPType,
    Period,
  } from "../circular/domain/models/circular-models";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { getCardColors } from "../shared/domain/card-colors";
  import * as spellServiceLoader from "$lib/features/create/spell/services/spell-service-loader";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { resolveAccessTier, getMaxSteps } from "$lib/shared/auth/domain/access-tier";
  import { isPremiumOrAbove } from "$lib/shared/auth/domain/models/user-role";
  import type { AuthNudgeTrigger } from "$lib/shared/auth/domain/auth-nudge-trigger";
  import AuthNudge from "$lib/shared/auth/components/AuthNudge.svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";
  // Card components
  import GridModeCard from "./cards/GridModeCard.svelte";
  import LengthCard from "./cards/LengthCard.svelte";
  import LevelCard from "./cards/LevelCard.svelte";
  import TurnIntensityCard from "./cards/TurnIntensityCard.svelte";
  import GenerateButtonCard from "./cards/GenerateButtonCard.svelte";
  import ConsolidatedLOOPCard from "./cards/ConsolidatedLOOPCard.svelte";
  import CustomizeCard from "./cards/CustomizeCard.svelte";
  import WordInputCard from "./cards/WordInputCard.svelte";
  import PresetCard from "./cards/PresetCard.svelte";
  import type { createFavoriteState } from "../state/favorite-state.svelte";
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
    isMobile = false,
    onOpenWordInput,
    favoriteState,
  } = $props<{
    config: UIGenerationConfig;
    isFreeformMode: boolean;
    updateConfig: (updates: Partial<UIGenerationConfig>) => void;
    isGenerating: boolean;
    onGenerateClicked: (options: GenerationOptions) => Promise<void>;
    startEndState?: StartEndOptionsState;
    hasSettingsChanged?: boolean;
    wordInputValue?: string;
    onWordInput?: (value: string) => void;
    onWordSubmit?: () => void;
    isMobile?: boolean;
    onOpenWordInput?: () => void;
    favoriteState: ReturnType<typeof createFavoriteState>;
  }>();

  // Get panel coordination state from context (for LOOP expanded overlay)
  const panelState = getContext<PanelCoordinationState>("panelState");

  // Services - use $state to make them reactive
  let loopParamProvider = $state<LOOPParameterProvider | null>(null);

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

  // Step cap nudge state
  let showStepCapNudge = $state(false);
  const accessTier = $derived(
    resolveAccessTier(authState.isAuthenticated, authState.isAnonymous, isPremiumOrAbove(authState.role))
  );
  const stepCapNudgeTrigger: AuthNudgeTrigger = "step-cap-guest";
  // Only guests get a step-cap nudge now — a free-account pitch for the full
  // 64-step cap. Logged-in users are hard-capped at 64 with no upsell, so the
  // cap applies silently. (The paid Scribe tier is shelved until there's a plan.)
  const stepCapNudgeAllowed = $derived(accessTier === "guest");

  // Get card colors based on current background (reactive to background changes)
  let cardColors = $derived(getCardColors(settingsService.settings.backgroundType ?? BackgroundType.WINTER));

  // Pre-compute word length including bridges and LOOP multiplication
  let computedWordLength = $state<number | undefined>(undefined);
  let requiredBridgeCount = $state<number>(0);
  let naturalLength = $state<number>(0);
  // The LOOP-multiplied natural length (without extra bridges) - used as the floor for the stepper
  let naturalDisplayLength = $state<number>(0);

  $effect(() => {
    const word = wordInputValue?.trim();
    if (!word) {
      computedWordLength = undefined;
      requiredBridgeCount = 0;
      naturalLength = 0;
      naturalDisplayLength = 0;
      if (config.spellTargetLength !== null) {
        updateConfig({ spellTargetLength: null });
      }
      return;
    }
    computeWordLength(word, config.loopEnabled, config.loopType, config.period);
  });

  // Reset spell target when the word itself changes
  let previousWord = $state<string>("");
  $effect(() => {
    const word = wordInputValue?.trim() ?? "";
    if (word !== previousWord && previousWord !== "") {
      if (config.spellTargetLength !== null) {
        updateConfig({ spellTargetLength: null });
      }
    }
    previousWord = word;
  });

  async function computeWordLength(
    word: string,
    loopEnabled: boolean,
    loopType: string,
    period: string
  ) {
    try {
      const graph = await spellServiceLoader.getTransitionGraph();
      const generator = await spellServiceLoader.getWordGenerator();

      const parseResult = generator.parseWord(word);
      if (!parseResult || parseResult.error || !parseResult.letters?.length) {
        computedWordLength = undefined;
        requiredBridgeCount = 0;
        naturalLength = 0;
        naturalDisplayLength = 0;
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

      requiredBridgeCount = bridgeCount;
      naturalLength = originalLetters.length + bridgeCount;

      // Helper to apply LOOP multiplication to a pre-LOOP step count.
      // Does NOT add +1 for a LOOP bridge step - a bridge is only inserted
      // when the sequence can't directly connect back to start, and we
      // can't know that until actual generation runs. The displayed count
      // should match the most common case (direct extension, no bridge).
      function applyLoopMultiplier(steps: number): number {
        if (!loopEnabled) return steps;
        const multiplier = ROTATED_LOOP_TYPES.has(loopType as LOOPType)
          ? (period === Period.QUARTERED ? 4 : 2)
          : 2;
        return steps * multiplier;
      }

      // Natural display length = LOOP-multiplied natural (the floor for the stepper)
      naturalDisplayLength = applyLoopMultiplier(naturalLength);

      // Total display length includes extra bridges from spell target
      const extraBridges = config.spellTargetLength
        ? Math.max(0, config.spellTargetLength - naturalLength)
        : 0;
      computedWordLength = applyLoopMultiplier(naturalLength + extraBridges);
    } catch {
      computedWordLength = undefined;
      requiredBridgeCount = 0;
      naturalLength = 0;
      naturalDisplayLength = 0;
    }
  }

  function handleSpellLengthChange(newLength: number) {
    let preLoopTarget: number;

    if (config.loopEnabled) {
      const isRotatedType = ROTATED_LOOP_TYPES.has(config.loopType as LOOPType);
      let multiplier: number;
      if (isRotatedType) {
        multiplier = config.period === Period.QUARTERED ? 4 : 2;
      } else {
        multiplier = 2;
      }
      preLoopTarget = Math.round(newLength / multiplier) - 1;
    } else {
      preLoopTarget = newLength;
    }

    if (preLoopTarget <= naturalLength) {
      updateConfig({ spellTargetLength: null });
    } else {
      updateConfig({ spellTargetLength: preLoopTarget });
    }
  }

  // Initialize services
  onMount(() => {
    loopParamProvider = getLOOPParameterProvider();

    updateFontSize();
    window.addEventListener("resize", updateFontSize);

    return () => window.removeEventListener("resize", updateFontSize);
  });

  function updateFontSize() {
    // Desktop gets larger header text (11-18px) for better readability
    // Mobile/tablet stays at (9-14px)
    const isDesktop = window.innerWidth >= 1280;
    headerFontSize = isDesktop
      ? calculateResponsiveFontSize(11, 18, 1.2)
      : calculateResponsiveFontSize(9, 14, 1.2);
  }

  // Event handlers - safe because we check loopParamProvider exists
  function handleLevelChange(level: DifficultyLevel) {
    if (!loopParamProvider) return;
    const newLevelNum = loopParamProvider.difficultyToNumber(level);
    const allowed = loopParamProvider.getAllowedTurnsForLevel(level);
    const updates: Partial<UIGenerationConfig> = { level: newLevelNum };

    // Clamp turn intensity if the current value isn't valid at the new level
    // (e.g. 0.5 is valid at level 3 but not level 2)
    if (allowed.length > 0 && !allowed.includes(config.turnIntensity)) {
      updates.turnIntensity = allowed.reduce((best, v) =>
        Math.abs(v - config.turnIntensity) < Math.abs(best - config.turnIntensity) ? v : best
      );
    }

    // Old presets may still carry a quartered value on a LOOP without
    // rotation. Keep the config honest even though the engine also normalizes
    // that legacy combination before generation.
    const currentType = config.loopType as LOOPType;
    const isRotated = ROTATED_LOOP_TYPES.has(currentType);
    if (!isRotated && config.period === Period.QUARTERED) {
      updates.period = Period.HALVED;
    }

    updateConfig(updates);
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
    // Applying a loop type enables the loop. The card no longer pre-enables on
    // tap, so this is the enable seam: pick a loop → on; back out → stays off.
    const updates: Partial<UIGenerationConfig> = { loopType, loopEnabled: true };

    // Rotation is the only transformation with a 90° option. Switching to a
    // LOOP without rotation must clear any quartered value left by the prior
    // selection.
    if (
      !ROTATED_LOOP_TYPES.has(loopType) &&
      config.period === Period.QUARTERED
    ) {
      updates.period = Period.HALVED;
    }

    updateConfig(updates);
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
  function handleStartEndChange(options: StartEndOptions) {
    startEndState?.setOptions(options);
  }

  // Preset: open drawer via panel state (drawer rendered in GeneratePanel)
  function handleOpenPresetDrawer() {
    panelState.openPresetDrawer();
  }

  function withFavoriteDeselect<T extends (...args: any[]) => any>(handler: T): T {
    return ((...args: any[]) => {
      if (favoriteState.activeFavoriteId) {
        favoriteState.deactivateFavorite();
      }
      return handler(...args);
    }) as T;
  }

  // Build cards using service - reactive to all dependencies
  // Read LOOP-related properties explicitly so Svelte tracks them as
  // direct dependencies of this derived. Without this, toggling loopEnabled
  // or loopType via a preset (parent-driven config update) may not cause
  // the card list to recalculate because Svelte doesn't always track deep
  // property reads that happen inside a called method like buildCardDescriptors.
  let cards = $derived.by((): CardDescriptor[] => {
    if (!currentLevel) return [];

    // Explicit reads so Svelte registers these as reactive dependencies.
    // The LOOP card summary depends on both values.
    const loopEnabled = config.loopEnabled;
    const _loopType = config.loopType;
    const _reflectionAxis = config.reflectionAxis;
    void _loopType;
    void _reflectionAxis;

    return buildCardDescriptors(
      config,
      currentLevel,
      isFreeformMode,
      {
        handleLevelChange: withFavoriteDeselect(handleLevelChange),
        handleLengthChange: withFavoriteDeselect(handleLengthChange),
        handleTurnIntensityChange: withFavoriteDeselect(handleTurnIntensityChange),
        handlePropContinuityChange: withFavoriteDeselect(handlePropContinuityChange),
        handleGridModeChange: withFavoriteDeselect(handleGridModeChange),
        handleGenerationModeChange: () => {}, // No-op: mode is now derived from word presence
        handleLOOPTypeChange: withFavoriteDeselect(handleLOOPTypeChange),
        handleConstraintPresetChange: withFavoriteDeselect(handleConstraintPresetChange),
        handleHandPathModeChange: withFavoriteDeselect(handleHandPathModeChange),
        handleMotionTypeFilterChange: withFavoriteDeselect(handleMotionTypeFilterChange),
        handleDurationTemplateSelect: withFavoriteDeselect(handleDurationTemplateSelect),
        handleLoopToggle: withFavoriteDeselect(handleLoopToggle),
        wordInputValue,
        computedWordLength,
        handleSpellLengthChange: withFavoriteDeselect(handleSpellLengthChange),
        bridgeInfo: wordInputValue?.trim() ? {
          requiredBridges: requiredBridgeCount,
          extraBridges: Math.max(0, (config.spellTargetLength ?? 0) - naturalLength),
          totalBridges: requiredBridgeCount + Math.max(0, (config.spellTargetLength ?? 0) - naturalLength),
          naturalLength,
          naturalDisplayLength,
        } : undefined,
        handleWordInput: onWordInput ? withFavoriteDeselect(onWordInput) : undefined,
        handleWordSubmit: onWordSubmit ? withFavoriteDeselect(onWordSubmit) : undefined,
        handleStartEndChange: startEndState
          ? withFavoriteDeselect(handleStartEndChange)
          : undefined,
        startEndOptions: startEndState?.options,
        positionsResetTrigger,
        currentGridMode: config.gridMode,
        handleGenerateClick: onGenerateClicked,
        activeFavoriteId: favoriteState.activeFavoriteId,
        activeFavoriteName: favoriteState.activeFavoriteId === "mine"
          ? "My Fav"
          : favoriteState.activeFavoriteId
            ? favoriteState.communityFavorites.find((f: { userId: string }) => f.userId === favoriteState.activeFavoriteId)?.displayName ?? null
            : null,
        handleOpenPresetDrawer,
      },
      allowedIntensityValues,
      isGenerating,
      hasSettingsChanged,
      loopEnabled
    );
  });

</script>

<div class="card-settings-container" style="--header-font-size: {headerFontSize}">

  {#each cards as card (card.id)}
    <div
      class="card-wrapper"
      style:grid-column="span {card.gridColumnSpan}"
      animate:flip={{ duration: 300, easing: quintOut }}
    >
      {#if card.id === "level"}
        <!-- LevelCard declares no color/shadowColor props (it derives its own
             palette from difficulty-styles); the values previously passed here
             were silently discarded under the `as any` spread. -->
        <LevelCard {...card.props as ComponentProps<typeof LevelCard>} />
      {:else if card.id === "length"}
        <LengthCard {...card.props as ComponentProps<typeof LengthCard>} color={cardColors.length.color} shadowColor={cardColors.length.shadowColor} onStepCapExceeded={() => { showStepCapNudge = true; }} />
      {:else if card.id === "word-input"}
        <WordInputCard
          {...card.props as ComponentProps<typeof WordInputCard>}
          color={cardColors.mode.color}
          shadowColor={cardColors.mode.shadowColor}
          {isMobile}
          onOpenOverlay={onOpenWordInput}
        />
      {:else if card.id === "grid-mode"}
        <GridModeCard {...card.props as ComponentProps<typeof GridModeCard>} color={cardColors.gridMode.color} shadowColor={cardColors.gridMode.shadowColor} />
      {:else if card.id === "turn-intensity"}
        <!-- TurnIntensityCard declares shadowColor but no color prop. -->
        <TurnIntensityCard {...card.props as ComponentProps<typeof TurnIntensityCard>} shadowColor={cardColors.turnIntensity.shadowColor} />
      {:else if card.id === "customize"}
        <CustomizeCard {...card.props as ComponentProps<typeof CustomizeCard>} color={cardColors.customize.color} shadowColor={cardColors.customize.shadowColor} />
      {:else if card.id === "loop"}
        <ConsolidatedLOOPCard {...card.props as ComponentProps<typeof ConsolidatedLOOPCard>} />
      {:else if card.id === "preset"}
        <PresetCard
          {...card.props as ComponentProps<typeof PresetCard>}
          color={cardColors.favorite.color}
          shadowColor={cardColors.favorite.shadowColor}
        />
      {:else if card.id === "generate-button"}
        <GenerateButtonCard {...card.props as ComponentProps<typeof GenerateButtonCard>} />
      {/if}
    </div>
  {/each}

  <BaseModal
    open={showStepCapNudge && stepCapNudgeAllowed}
    size="fit"
    class="chromeless"
    onclose={() => { showStepCapNudge = false; }}
  >
    <AuthNudge
      trigger={stepCapNudgeTrigger}
      onCreateAccount={() => { showStepCapNudge = false; authDrawerState.show("signup"); }}
      onLogin={() => { showStepCapNudge = false; authDrawerState.show("signin"); }}
      onDismiss={() => { showStepCapNudge = false; }}
    />
  </BaseModal>
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

    /* Responsive gap - scales with respects device setting as max */
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

  @media (prefers-reduced-motion: reduce) {
    .card-wrapper {
      transition: none;
    }
  }

</style>
