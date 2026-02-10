<!--
CompactSettingsToolbar.svelte - Compact chip toolbar for Generate panel

Plain CSS Grid layout — no MorphChip absolute positioning.
Chips are normal flow elements that respect container height.
Tapping a chip opens an inline expand panel below the grid.

Row 1: Level, Length, Mode, Grid (always 4)
Row 2: Props, [Turns], [LOOP], [Slice] (2-4 conditional)
Expand panel: slides in below chips when one is active
Generate button: always at bottom
-->
<script lang="ts">
  import { container as diContainer } from "$lib/shared/di";
  import { onMount } from "svelte";
  import GenerateButtonCard from "./cards/GenerateButtonCard.svelte";
  import type { ILOOPParameterProvider } from "../shared/services/contracts/ILOOPParameterProvider";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { UIGenerationConfig } from "../state/generate-config.svelte";
  import type { StartEndOptionsState } from "../state/start-end-options-state.svelte";
  import type { GeneratorHelpId } from "../domain/generator-help-content";
  import {
    DifficultyLevel,
    GenerationMode,
    PropContinuity,
    LOOPComponent,
  } from "../shared/domain/models/generate-models";
  import {
    LOOPType,
    LOOP_TYPE_LABELS,
    SliceSize,
  } from "../circular/domain/models/circular-models";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
  import { getCardColors, isBrightBackground } from "../shared/domain/card-colors";
  import { LOOP_COMPONENTS } from "../shared/domain/constants/loop-constants";
  import { loopTypeResolver } from "../shared/services/implementations/LOOPTypeResolver";

  // ============================================================================
  // PROPS
  // ============================================================================
  let {
    config,
    isFreeformMode,
    updateConfig,
    isGenerating,
    onGenerateClicked,
    startEndState,
    helpMode = false,
    helpModeExiting = false,
    onHelpSelect,
  }: {
    config: UIGenerationConfig;
    isFreeformMode: boolean;
    updateConfig: (updates: Partial<UIGenerationConfig>) => void;
    isGenerating: boolean;
    onGenerateClicked: (options: any) => Promise<void>;
    startEndState?: StartEndOptionsState;
    helpMode?: boolean;
    helpModeExiting?: boolean;
    onHelpSelect?: (controlId: GeneratorHelpId) => void;
  } = $props();

  // ============================================================================
  // SERVICES
  // ============================================================================
  let loopParamProvider = $state<ILOOPParameterProvider | null>(null);
  let haptic = $state<IHapticFeedback | null>(null);

  onMount(() => {
    loopParamProvider = diContainer.items.loopParameterProvider;
    haptic = diContainer.items.hapticFeedback as IHapticFeedback;
  });

  // ============================================================================
  // CARD COLORS (reactive to background changes)
  // ============================================================================
  let cardColors = $derived(
    getCardColors(settingsService.settings.backgroundType ?? BackgroundType.SNOWFALL)
  );

  // ============================================================================
  // PER-LEVEL COLORS (matching LevelCard's radial gradients)
  // ============================================================================
  let useDarkLevelColors = $derived(
    isBrightBackground(settingsService.settings.backgroundType ?? BackgroundType.SNOWFALL)
  );

  const LEVEL_COLORS: Record<number, { color: string; shadowHsl: string; textColor: string }> = {
    1: {
      color: `radial-gradient(ellipse at top left, rgb(186,230,253) 0%, rgb(125,211,252) 30%, rgb(56,189,248) 70%, rgb(14,165,233) 100%)`,
      shadowHsl: "200deg 80% 55%",
      textColor: "black",
    },
    2: {
      color: `radial-gradient(ellipse at top left, rgb(226,232,240) 0%, rgb(148,163,184) 30%, rgb(100,116,139) 70%, rgb(71,85,105) 100%)`,
      shadowHsl: "215deg 20% 40%",
      textColor: "white",
    },
    3: {
      color: `radial-gradient(ellipse at top left, rgb(254,240,138) 0%, rgb(253,224,71) 20%, rgb(250,204,21) 40%, rgb(234,179,8) 60%, rgb(202,138,4) 80%, rgb(161,98,7) 100%)`,
      shadowHsl: "45deg 80% 45%",
      textColor: "black",
    },
    4: {
      color: `radial-gradient(ellipse at top left, rgb(255,180,180) 0%, rgb(255,140,140) 20%, rgb(255,100,100) 40%, rgb(239,68,68) 60%, rgb(220,38,38) 80%, rgb(185,28,28) 100%)`,
      shadowHsl: "0deg 75% 50%",
      textColor: "white",
    },
  };

  const LEVEL_COLORS_BRIGHT: Record<number, { color: string; shadowHsl: string; textColor: string }> = {
    1: {
      color: `radial-gradient(ellipse at top left, rgb(165,218,250) 0%, rgb(105,195,248) 30%, rgb(45,175,240) 70%, rgb(8,145,210) 100%)`,
      shadowHsl: "200deg 80% 45%",
      textColor: "black",
    },
    2: {
      color: `radial-gradient(ellipse at top left, rgb(148,163,184) 0%, rgb(100,116,139) 30%, rgb(71,85,105) 70%, rgb(51,65,85) 100%)`,
      shadowHsl: "215deg 20% 30%",
      textColor: "white",
    },
    3: {
      color: `radial-gradient(ellipse at top left, rgb(253,224,71) 0%, rgb(250,204,21) 20%, rgb(234,179,8) 40%, rgb(217,155,6) 60%, rgb(202,138,4) 80%, rgb(180,115,5) 100%)`,
      shadowHsl: "45deg 80% 40%",
      textColor: "black",
    },
    4: {
      color: `radial-gradient(ellipse at top left, rgb(255,140,140) 0%, rgb(255,100,100) 20%, rgb(239,68,68) 40%, rgb(220,38,38) 60%, rgb(185,28,28) 80%, rgb(153,27,27) 100%)`,
      shadowHsl: "0deg 75% 40%",
      textColor: "white",
    },
  };

  const FALLBACK_LEVEL_COLOR = {
    color: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
    shadowHsl: "215deg 20% 40%",
    textColor: "white",
  };

  let currentLevelColor = $derived.by(() => {
    const palette = useDarkLevelColors ? LEVEL_COLORS_BRIGHT : LEVEL_COLORS;
    const entry = palette[config.level as keyof typeof palette];
    return entry ?? FALLBACK_LEVEL_COLOR;
  });

  // ============================================================================
  // DERIVED STATE
  // ============================================================================
  let currentLevel = $derived(
    loopParamProvider?.numberToDifficulty(config.level) ?? null
  );
  let allowedIntensityValues = $derived(
    currentLevel && loopParamProvider
      ? loopParamProvider.getAllowedTurnsForLevel(currentLevel)
      : []
  );
  let isBeginnerLevel = $derived(currentLevel === DifficultyLevel.BEGINNER);
  let showTurnIntensity = $derived(!isBeginnerLevel && allowedIntensityValues.length > 0);

  let loopTypeAllowsSliceChoice = $derived(
    config.loopType === LOOPType.STRICT_ROTATED ||
    config.loopType === LOOPType.ROTATED_INVERTED ||
    config.loopType === LOOPType.ROTATED_SWAPPED ||
    config.loopType === LOOPType.MIRRORED_ROTATED ||
    config.loopType === LOOPType.MIRRORED_INVERTED_ROTATED ||
    config.loopType === LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED
  );

  // ============================================================================
  // EXPAND PANEL STATE
  // ============================================================================
  let activeChipId = $state<string | null>(null);

  function toggleChip(chipId: string) {
    if (helpMode && onHelpSelect) {
      const helpId = chipIdToHelpId[chipId];
      if (helpId) onHelpSelect(helpId);
      return;
    }
    haptic?.trigger("selection");
    activeChipId = activeChipId === chipId ? null : chipId;
  }

  function closePanel() {
    activeChipId = null;
  }

  // ============================================================================
  // CHIP HANDLERS
  // ============================================================================

  function handleLevelChange(v: string) {
    haptic?.trigger("selection");
    const num = parseInt(v, 10);
    if (!loopParamProvider) return;
    const level = loopParamProvider.numberToDifficulty(num);
    updateConfig({ level: loopParamProvider.difficultyToNumber(level) });
    closePanel();
  }

  function handleLengthDecrement() {
    haptic?.trigger("selection");
    updateConfig({ length: Math.max(2, config.length - 2) });
  }

  function handleLengthIncrement() {
    haptic?.trigger("selection");
    updateConfig({ length: Math.min(32, config.length + 2) });
  }

  function handleModeChange(v: string) {
    haptic?.trigger("selection");
    updateConfig({ mode: v as GenerationMode });
    closePanel();
  }

  function handleGridChange(v: string) {
    haptic?.trigger("selection");
    updateConfig({ gridMode: v as GridMode });
    if (startEndState?.options?.startPosition || startEndState?.options?.endPosition) {
      setTimeout(() => startEndState?.clearPositions(), 150);
    }
    closePanel();
  }

  function handleContinuityChange(v: string) {
    haptic?.trigger("selection");
    updateConfig({ propContinuity: v as PropContinuity });
    closePanel();
  }

  function handleTurnIntensityChange(v: string) {
    haptic?.trigger("selection");
    updateConfig({ turnIntensity: parseFloat(v) });
    closePanel();
  }

  // LOOP toggle state
  let localLoopSelection = $state<Set<LOOPComponent>>(new Set());
  let isValidLoopCombo = $state(true);

  $effect(() => {
    if (!isFreeformMode && config.loopType) {
      localLoopSelection = loopTypeResolver.parseComponents(config.loopType as LOOPType);
      isValidLoopCombo = true;
    }
  });

  function isRoundTripValid(components: Set<LOOPComponent>): boolean {
    if (components.size === 0) return true;
    const type = loopTypeResolver.generateLOOPType(components);
    const parsed = loopTypeResolver.parseComponents(type);
    if (parsed.size !== components.size) return false;
    for (const c of components) {
      if (!parsed.has(c)) return false;
    }
    return true;
  }

  function handleLoopToggle(component: LOOPComponent) {
    haptic?.trigger("selection");
    const newSet = new Set(localLoopSelection);
    if (newSet.has(component)) {
      newSet.delete(component);
    } else {
      newSet.add(component);
    }
    localLoopSelection = newSet;
    if (newSet.size === 0) {
      isValidLoopCombo = true;
    } else {
      const valid = isRoundTripValid(newSet);
      isValidLoopCombo = valid;
      if (valid) {
        updateConfig({ loopType: loopTypeResolver.generateLOOPType(newSet) });
      }
    }
  }

  let loopDisplayValue = $derived.by(() => {
    if (!isValidLoopCombo) return `${localLoopSelection.size} sel`;
    if (config.loopType) return LOOP_TYPE_LABELS[config.loopType as LOOPType] ?? "Custom";
    return "Rotated";
  });

  function handleSliceChange(v: string) {
    haptic?.trigger("selection");
    updateConfig({ sliceSize: v as SliceSize });
    closePanel();
  }

  // Help mode mapping
  const chipIdToHelpId: Record<string, GeneratorHelpId> = {
    "level": "level",
    "length": "length",
    "mode": "generation-mode",
    "grid": "grid-mode",
    "continuity": "prop-continuity",
    "turn-intensity": "turn-intensity",
    "loop": "loop-type",
    "slice": "slice-size",
  };

  // ============================================================================
  // CHIP DEFINITIONS (for clean template rendering)
  // ============================================================================

  // Build visible row 2 chips dynamically
  let row2Chips = $derived.by(() => {
    const chips: Array<{
      id: string;
      label: string;
      value: string;
      bg: string;
      shadowHsl: string;
      textColor?: string;
    }> = [
      {
        id: "continuity",
        label: "Props",
        value: config.propContinuity === PropContinuity.CONTINUOUS ? "Smooth" : "Random",
        bg: cardColors.continuity.color,
        shadowHsl: cardColors.continuity.shadowColor,
      },
    ];

    if (showTurnIntensity) {
      chips.push({
        id: "turn-intensity",
        label: "Turns",
        value: `\u2264${config.turnIntensity}`,
        bg: cardColors.turnIntensity.color,
        shadowHsl: cardColors.turnIntensity.shadowColor,
      });
    }

    if (!isFreeformMode) {
      chips.push({
        id: "loop",
        label: "LOOP",
        value: loopDisplayValue,
        bg: "linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)",
        shadowHsl: "25deg 80% 50%",
      });

      if (loopTypeAllowsSliceChoice) {
        chips.push({
          id: "slice",
          label: "Slice",
          value: config.sliceSize === SliceSize.QUARTERED ? "Quartered" : "Halved",
          bg: cardColors.sliceSize.color,
          shadowHsl: cardColors.sliceSize.shadowColor,
        });
      }
    }

    return chips;
  });

  // Total chip count determines grid columns: 3 for ≤6 chips, 4 for 7+
  let chipColumns = $derived((4 + row2Chips.length) <= 6 ? 3 : 4);
</script>

<div
  class="compact-toolbar"
  class:help-mode={helpMode}
  class:help-mode-exiting={helpModeExiting}
>
  <!-- Chip Grid: normal flow, respects container height -->
  <div class="chip-grid" style:--chip-cols={chipColumns}>
    <!-- Row 1: Level, Length, Mode, Grid -->
    <button
      class="compact-chip"
      class:active={activeChipId === "level"}
      style:--chip-bg={currentLevelColor.color}
      style:--chip-shadow-hsl={currentLevelColor.shadowHsl}
      style:--chip-text={currentLevelColor.textColor}
      onclick={() => toggleChip("level")}
      aria-expanded={activeChipId === "level"}
      aria-label="Level: {config.level}"
    >
      <span class="chip-label">Lvl</span>
      <span class="chip-value">{config.level}</span>
    </button>

    <button
      class="compact-chip"
      class:active={activeChipId === "length"}
      style:--chip-bg={cardColors.length.color}
      style:--chip-shadow-hsl={cardColors.length.shadowColor}
      onclick={() => toggleChip("length")}
      aria-expanded={activeChipId === "length"}
      aria-label="Length: {config.length}"
    >
      <span class="chip-label">Len</span>
      <span class="chip-value">{config.length}</span>
    </button>

    <button
      class="compact-chip"
      class:active={activeChipId === "mode"}
      style:--chip-bg={cardColors.mode.color}
      style:--chip-shadow-hsl={cardColors.mode.shadowColor}
      onclick={() => toggleChip("mode")}
      aria-expanded={activeChipId === "mode"}
      aria-label="Mode: {config.mode === GenerationMode.CIRCULAR ? 'LOOP' : 'Free'}"
    >
      <span class="chip-label">Mode</span>
      <span class="chip-value">{config.mode === GenerationMode.CIRCULAR ? "LOOP" : "Free"}</span>
    </button>

    <button
      class="compact-chip"
      class:active={activeChipId === "grid"}
      style:--chip-bg={cardColors.gridMode.color}
      style:--chip-shadow-hsl={cardColors.gridMode.shadowColor}
      onclick={() => toggleChip("grid")}
      aria-expanded={activeChipId === "grid"}
      aria-label="Grid: {config.gridMode === GridMode.DIAMOND ? 'Diamond' : 'Box'}"
    >
      <span class="chip-label">Grid</span>
      <span class="chip-value">{config.gridMode === GridMode.DIAMOND ? "\u25C7" : "\u25A2"}</span>
    </button>

    <!-- Row 2: dynamic chips -->
    {#each row2Chips as chip (chip.id)}
      <button
        class="compact-chip"
        class:active={activeChipId === chip.id}
        style:--chip-bg={chip.bg}
        style:--chip-shadow-hsl={chip.shadowHsl}
        style:--chip-text={chip.textColor ?? "white"}
        onclick={() => toggleChip(chip.id)}
        aria-expanded={activeChipId === chip.id}
        aria-label="{chip.label}: {chip.value}"
      >
        <span class="chip-label">{chip.label}</span>
        <span class="chip-value">{chip.value}</span>
      </button>
    {/each}
  </div>

  <!-- Expand Panel: inline below chips, slides in/out -->
  {#if activeChipId}
    <div class="expand-panel" role="region" aria-label="Options for {activeChipId}">
      {#if activeChipId === "level"}
        <div class="option-row">
          {#each ["1", "2", "3", "4"] as v}
            <button
              class="option-btn"
              class:selected={String(config.level) === v}
              onclick={() => handleLevelChange(v)}
            >{v}</button>
          {/each}
        </div>

      {:else if activeChipId === "length"}
        <div class="stepper-row">
          <button
            class="stepper-btn"
            onclick={handleLengthDecrement}
            disabled={config.length <= 2}
            aria-label="Decrease length"
          >
            <i class="fas fa-minus" aria-hidden="true"></i>
          </button>
          <span class="stepper-value">{config.length}</span>
          <button
            class="stepper-btn"
            onclick={handleLengthIncrement}
            disabled={config.length >= 32}
            aria-label="Increase length"
          >
            <i class="fas fa-plus" aria-hidden="true"></i>
          </button>
        </div>

      {:else if activeChipId === "mode"}
        <div class="option-row">
          <button
            class="option-btn"
            class:selected={config.mode === GenerationMode.CIRCULAR}
            onclick={() => handleModeChange(GenerationMode.CIRCULAR)}
          >LOOP</button>
          <button
            class="option-btn"
            class:selected={config.mode === GenerationMode.FREEFORM}
            onclick={() => handleModeChange(GenerationMode.FREEFORM)}
          >Free</button>
        </div>

      {:else if activeChipId === "grid"}
        <div class="option-row">
          <button
            class="option-btn"
            class:selected={config.gridMode === GridMode.DIAMOND}
            onclick={() => handleGridChange(GridMode.DIAMOND)}
          >{"\u25C7"} Diamond</button>
          <button
            class="option-btn"
            class:selected={config.gridMode === GridMode.BOX}
            onclick={() => handleGridChange(GridMode.BOX)}
          >{"\u25A2"} Box</button>
        </div>

      {:else if activeChipId === "continuity"}
        <div class="option-row">
          <button
            class="option-btn"
            class:selected={config.propContinuity === PropContinuity.CONTINUOUS}
            onclick={() => handleContinuityChange(PropContinuity.CONTINUOUS)}
          >Smooth</button>
          <button
            class="option-btn"
            class:selected={config.propContinuity === PropContinuity.RANDOM}
            onclick={() => handleContinuityChange(PropContinuity.RANDOM)}
          >Random</button>
        </div>

      {:else if activeChipId === "turn-intensity"}
        <div class="option-row">
          {#each allowedIntensityValues as v}
            <button
              class="option-btn"
              class:selected={config.turnIntensity === v}
              onclick={() => handleTurnIntensityChange(String(v))}
            >{"\u2264"}{v}</button>
          {/each}
        </div>

      {:else if activeChipId === "loop"}
        <div class="loop-panel">
          <div class="loop-toggle-grid">
            {#each LOOP_COMPONENTS as info}
              {@const isActive = localLoopSelection.has(info.component)}
              <button
                class="loop-toggle-chip"
                class:active={isActive}
                onclick={() => handleLoopToggle(info.component)}
                style:--chip-color={info.color}
                aria-pressed={isActive}
                aria-label="{info.label}: {isActive ? 'on' : 'off'}"
              >
                <i class="fas fa-{info.icon}" aria-hidden="true"></i>
                <span>{info.label}</span>
              </button>
            {/each}
          </div>
          {#if !isValidLoopCombo}
            <div class="combo-hint" role="status">
              <i class="fas fa-flask" aria-hidden="true"></i>
              Invalid combination
            </div>
          {/if}
        </div>

      {:else if activeChipId === "slice"}
        <div class="option-row">
          <button
            class="option-btn"
            class:selected={config.sliceSize === SliceSize.QUARTERED}
            onclick={() => handleSliceChange(SliceSize.QUARTERED)}
          >Quartered</button>
          <button
            class="option-btn"
            class:selected={config.sliceSize === SliceSize.HALVED}
            onclick={() => handleSliceChange(SliceSize.HALVED)}
          >Halved</button>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Generate button -->
  <div class="compact-generate-btn">
    <GenerateButtonCard
      {isGenerating}
      onGenerateClicked={onGenerateClicked}
      {config}
      startEndOptions={startEndState?.options}
    />
  </div>
</div>

<style>
  .compact-toolbar {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 2px 4px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* ============================================================ */
  /* CHIP GRID - normal CSS Grid, no absolute positioning */
  /* ============================================================ */

  .chip-grid {
    display: grid;
    grid-template-columns: repeat(var(--chip-cols, 4), 1fr);
    gap: 4px;
    flex-shrink: 0;
  }

  /* ============================================================ */
  /* INDIVIDUAL CHIPS - normal flow buttons */
  /* ============================================================ */

  .compact-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    padding: 4px 2px;
    min-height: 0;
    border: 1.5px solid transparent;
    border-radius: 14px;
    cursor: pointer;
    position: relative;
    overflow: hidden;

    /* Gradient background from card colors */
    background: var(--chip-bg);
    color: var(--chip-text, white);

    /* Layered color-matched shadows (BaseCard technique) */
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.12),
      0 1px 2px hsl(var(--chip-shadow-hsl, 0deg 0% 0%) / 0.15),
      0 2px 4px hsl(var(--chip-shadow-hsl, 0deg 0% 0%) / 0.12),
      0 4px 8px hsl(var(--chip-shadow-hsl, 0deg 0% 0%) / 0.1),
      inset 0 1px 0 var(--theme-stroke, rgba(255, 255, 255, 0.1));

    transition: border-color 150ms ease, transform 100ms ease;
  }

  .compact-chip:active {
    transform: scale(0.96);
  }

  .compact-chip.active {
    border-color: var(--theme-accent, #6366f1);
    box-shadow:
      0 0 0 1px rgba(99, 102, 241, 0.3),
      0 2px 8px rgba(99, 102, 241, 0.2),
      inset 0 1px 0 var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  /* Glossy sheen overlay (BaseCard technique) */
  .compact-chip::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 60%;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-text, white) 30%, transparent) 0%,
      color-mix(in srgb, var(--theme-text, white) 15%, transparent) 40%,
      color-mix(in srgb, var(--theme-text, white) 5%, transparent) 70%,
      transparent 100%
    );
    border-radius: 14px 14px 0 0;
    pointer-events: none;
  }

  .chip-label {
    font-size: 10px;
    font-weight: 500;
    opacity: 0.75;
    line-height: 1;
    position: relative;
    z-index: 1;
  }

  .chip-value {
    font-size: 13px;
    font-weight: 700;
    line-height: 1.1;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    position: relative;
    z-index: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  /* ============================================================ */
  /* EXPAND PANEL - inline below chips */
  /* ============================================================ */

  .expand-panel {
    flex-shrink: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-accent, #6366f1);
    border-radius: 12px;
    padding: 4px;
    animation: panel-slide-in 200ms cubic-bezier(0.34, 1.2, 0.64, 1);
  }

  @keyframes panel-slide-in {
    from {
      opacity: 0;
      transform: translateY(-4px) scaleY(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scaleY(1);
    }
  }

  /* ============================================================ */
  /* OPTION ROW - horizontal button set */
  /* ============================================================ */

  .option-row {
    display: flex;
    gap: 4px;
  }

  .option-btn {
    flex: 1;
    min-height: 36px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.6));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    font-weight: 600;
    font-size: 13px;
    padding: 4px 8px;
    transition: all 100ms ease;
  }

  .option-btn:active {
    transform: scale(0.96);
  }

  .option-btn.selected {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 25%, var(--theme-card-bg, #1a1a2e));
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-text, #fff);
  }

  /* ============================================================ */
  /* LENGTH STEPPER */
  /* ============================================================ */

  .stepper-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 2px 8px;
  }

  .stepper-btn {
    width: 40px;
    height: 36px;
    border-radius: 10px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.6));
    color: var(--theme-text, #fff);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 100ms ease;
  }

  .stepper-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .stepper-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .stepper-value {
    font-size: 20px;
    font-weight: 700;
    color: var(--theme-text, #fff);
    min-width: 32px;
    text-align: center;
  }

  /* ============================================================ */
  /* LOOP TOGGLE GRID */
  /* ============================================================ */

  .loop-panel {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .loop-toggle-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3px;
  }

  .loop-toggle-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    min-height: 36px;
    padding: 3px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.6));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 100ms ease;
  }

  .loop-toggle-chip:active {
    transform: scale(0.96);
  }

  .loop-toggle-chip.active {
    background: color-mix(in srgb, var(--chip-color, var(--theme-accent)) 20%, var(--theme-card-bg, #1a1a2e));
    border-color: var(--chip-color, var(--theme-accent));
    color: var(--theme-text, #fff);
  }

  .loop-toggle-chip.active i {
    color: var(--chip-color, var(--theme-accent));
  }

  .loop-toggle-chip i {
    font-size: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    transition: color 100ms ease;
  }

  .combo-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--semantic-warning, #f59e0b);
    padding: 2px 6px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 6px;
  }

  .combo-hint i {
    font-size: 10px;
    flex-shrink: 0;
  }

  /* ============================================================ */
  /* GENERATE BUTTON */
  /* ============================================================ */

  .compact-generate-btn {
    flex-shrink: 0;
    height: 48px;
    width: 100%;
  }

  .compact-generate-btn > :global(*) {
    height: 100%;
    border-radius: 14px;
  }

  /* ============================================================ */
  /* HELP MODE */
  /* ============================================================ */

  .compact-toolbar.help-mode .compact-chip {
    cursor: pointer;
  }

  .compact-toolbar.help-mode .compact-chip::after {
    content: "";
    position: absolute;
    inset: -2px;
    border-radius: 16px;
    border: 2px solid rgba(59, 130, 246, 0.6);
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.2);
    pointer-events: none;
    animation: help-chip-pulse 1.5s ease-in-out infinite;
  }

  .compact-toolbar.help-mode-exiting .compact-chip::after {
    opacity: 0;
    animation: none;
  }

  @keyframes help-chip-pulse {
    0%, 100% {
      border-color: rgba(59, 130, 246, 0.4);
      box-shadow: 0 0 8px rgba(59, 130, 246, 0.2);
    }
    50% {
      border-color: rgba(59, 130, 246, 0.8);
      box-shadow: 0 0 16px rgba(59, 130, 246, 0.4);
    }
  }

  /* ============================================================ */
  /* REDUCED MOTION */
  /* ============================================================ */

  @media (prefers-reduced-motion: reduce) {
    .compact-chip,
    .option-btn,
    .stepper-btn,
    .loop-toggle-chip {
      transition: none;
    }

    .expand-panel {
      animation: none;
    }

    .compact-toolbar.help-mode .compact-chip::after {
      animation: none;
    }
  }
</style>
