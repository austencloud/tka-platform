<!--
CompactSettingsToolbar.svelte - Compact chip toolbar for Generate panel

Plain CSS Grid layout — no MorphChip absolute positioning.
Chips are normal flow elements that respect container height.
Tapping a chip opens an inline expand panel below the grid.

Row 1: Level, Length, Mode, Grid (always 4)
  - Mode, Grid, Slice: tap toggles inline (no morph expand)
Row 2: Style, [Turns], [LOOP], [Slice] (2-4 conditional)
  - Style: 3-axis morph panel (Props/Hands/Dashes)
Expand panel: slides in below chips when one is active
Bottom row: [Start/End] [Generate]
-->
<script lang="ts">
  import { container as diContainer } from "$lib/shared/di";
  import { onMount, getContext } from "svelte";
  import GenerateButtonCard from "./cards/GenerateButtonCard.svelte";
  import LOOPExpandPanel from "./LOOPExpandPanel.svelte";
  import StartEndExpandPanel from "./StartEndExpandPanel.svelte";
  import type { ILOOPParameterProvider } from "../shared/services/contracts/ILOOPParameterProvider";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { UIGenerationConfig } from "../state/generate-config.svelte";
  import type { StartEndOptionsState } from "../state/start-end-options-state.svelte";
  import type { GeneratorHelpId } from "../domain/generator-help-content";
  import type { PanelCoordinationState } from "$lib/features/create/shared/state/panel-coordination-state.svelte";
  import {
    DifficultyLevel,
    GenerationMode,
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
  import {
    detectPresetFromBlocked,
    getAllPositions,
    StartPositionPreset,
  } from "../shared/domain/start-position-presets";
  import {
    LEVEL_COLORS,
    LEVEL_COLORS_BRIGHT,
    FALLBACK_LEVEL_COLOR,
  } from "../shared/domain/constants/level-color-palettes";
  import { getTemplateById } from "../../shared/domain/templates/duration-templates";

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

  // Get panel coordination state from context (provided by CreateModule)
  const panelState = getContext<PanelCoordinationState>("panelState");

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
  // INLINE TOGGLE ANIMATION STATE
  // ============================================================================
  let pulsingChipId = $state<string | null>(null);

  function triggerPulse(chipId: string) {
    pulsingChipId = chipId;
    setTimeout(() => {
      if (pulsingChipId === chipId) pulsingChipId = null;
    }, 150);
  }

  // ============================================================================
  // BINARY TOGGLE CHIP IDS
  // ============================================================================
  const INLINE_TOGGLE_IDS = new Set(["mode", "grid", "slice"]);

  // ============================================================================
  // EXPAND PANEL STATE + MORPH ANIMATION
  // ============================================================================
  let activeChipId = $state<string | null>(null);
  let morphOrigin = $state<{ left: number; top: number; width: number; height: number } | null>(null);
  let toolbarRef = $state<HTMLElement | null>(null);
  let morphPhase = $state<'entering' | 'expanded' | 'exiting' | null>(null);
  let overlayRef = $state<HTMLElement | null>(null);

  function toggleChip(chipId: string, chipEl?: HTMLElement) {
    if (helpMode && onHelpSelect) {
      const helpId = chipIdToHelpId[chipId];
      if (helpId) onHelpSelect(helpId);
      return;
    }
    haptic?.trigger("selection");

    // Binary chips toggle inline — no morph expand
    if (INLINE_TOGGLE_IDS.has(chipId)) {
      handleInlineToggle(chipId);
      triggerPulse(chipId);
      return;
    }

    // Duration chip opens a drawer instead of morph-expanding
    if (chipId === "duration") {
      panelState?.openDurationRhythmPanel();
      return;
    }

    if (activeChipId === chipId) {
      collapsePanel();
      return;
    }

    // Measure chip origin relative to toolbar (full-height positioning context)
    if (chipEl && toolbarRef) {
      const chipRect = chipEl.getBoundingClientRect();
      const toolbarRect = toolbarRef.getBoundingClientRect();
      morphOrigin = {
        left: chipRect.left - toolbarRect.left,
        top: chipRect.top - toolbarRect.top,
        width: chipRect.width,
        height: chipRect.height,
      };
    } else {
      morphOrigin = null;
    }

    activeChipId = chipId;
    morphPhase = 'entering';

    // Next frame: transition to expanded
    requestAnimationFrame(() => {
      morphPhase = 'expanded';
    });
  }

  function handleInlineToggle(chipId: string) {
    switch (chipId) {
      case "mode":
        updateConfig({
          mode: config.mode === GenerationMode.CIRCULAR
            ? GenerationMode.FREEFORM
            : GenerationMode.CIRCULAR,
        });
        break;
      case "grid":
        updateConfig({ gridMode: config.gridMode === GridMode.DIAMOND ? GridMode.BOX : GridMode.DIAMOND });
        if (startEndState?.options?.startPosition || startEndState?.options?.endPosition) {
          setTimeout(() => startEndState?.clearPositions(), 150);
        }
        break;
      case "slice":
        updateConfig({
          sliceSize: config.sliceSize === SliceSize.QUARTERED
            ? SliceSize.HALVED
            : SliceSize.QUARTERED,
        });
        break;
    }
  }

  function collapsePanel() {
    if (!activeChipId) return;
    morphPhase = 'exiting';

    function onEnd(e: TransitionEvent) {
      if (e.propertyName !== 'width' && e.propertyName !== 'left') return;
      overlayRef?.removeEventListener('transitionend', onEnd);
      activeChipId = null;
      morphPhase = null;
      morphOrigin = null;
    }

    if (overlayRef) {
      overlayRef.addEventListener('transitionend', onEnd);
      // Safety fallback: clear after 400ms even if transitionend doesn't fire
      setTimeout(() => {
        if (morphPhase === 'exiting') {
          activeChipId = null;
          morphPhase = null;
          morphOrigin = null;
        }
      }, 400);
    } else {
      activeChipId = null;
      morphPhase = null;
      morphOrigin = null;
    }
  }

  function closePanel() {
    collapsePanel();
  }

  // Compute inline morph styles
  let morphStyles = $derived.by(() => {
    if (!morphOrigin) return '';
    if (morphPhase === 'entering' || morphPhase === 'exiting') {
      return `left:${morphOrigin.left}px;top:${morphOrigin.top}px;width:${morphOrigin.width}px;height:${morphOrigin.height}px;border-radius:14px;`;
    }
    if (morphPhase === 'expanded') {
      return 'left:0;top:0;width:100%;height:100%;border-radius:14px;';
    }
    return '';
  });

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

  function handleTurnIntensityChange(v: string) {
    haptic?.trigger("selection");
    updateConfig({ turnIntensity: parseFloat(v) });
    closePanel();
  }

  // ============================================================================
  // STYLE (3-AXIS) HANDLERS
  // ============================================================================
  function handlePropsChange(v: "smooth" | "mixed" | "high-reversal") {
    haptic?.trigger("selection");
    updateConfig({ constraintPreset: v });
  }

  function handleHandsChange(v: "smooth" | "mixed" | "high") {
    haptic?.trigger("selection");
    updateConfig({ handPathMode: v });
  }

  function handleDashesChange(v: "no-dash" | "mixed" | "prefer-dash") {
    haptic?.trigger("selection");
    updateConfig({ motionTypeFilter: v === "mixed" ? null : v as "no-dash" | "prefer-dash" });
  }

  // Style chip display value
  let styleDisplayValue = $derived.by(() => {
    const presetLabel = config.constraintPreset === "smooth" ? "Smooth"
      : config.constraintPreset === "high-reversal" ? "High" : "Mixed";
    const handLabel = config.handPathMode === "smooth" ? "Smooth"
      : config.handPathMode === "high" ? "High" : "Mixed";
    const dashLabel = config.motionTypeFilter === "no-dash" ? "Low"
      : config.motionTypeFilter === "prefer-dash" ? "High" : "Mixed";

    // If all same level, show that name
    if (presetLabel === handLabel && handLabel === dashLabel) return presetLabel;
    return "Custom";
  });

  let durationDisplayValue = $derived.by(() => {
    if (!config.durationTemplateId) return "Off";
    const template = getTemplateById(config.durationTemplateId);
    return template?.name ?? "Off";
  });

  let loopDisplayValue = $derived(
    config.loopType ? (LOOP_TYPE_LABELS[config.loopType as LOOPType] ?? "Custom") : "Rotated"
  );

  // ============================================================================
  // START/END DISPLAY VALUE
  // ============================================================================
  let startEndDisplayValue = $derived.by(() => {
    const options = startEndState?.options;
    if (!options) return "Any";
    const blocked = options.blockedStartPositions ?? [];
    const allPositions = getAllPositions(config.gridMode as GridMode);
    const enabledCount = allPositions.length - blocked.length;

    if (blocked.length === 0) return "Any";

    const preset = detectPresetFromBlocked(blocked, config.gridMode as GridMode);
    if (preset === StartPositionPreset.CLASSIC) return "Classic";
    if (enabledCount === 1) return "1 pos";
    return `${enabledCount} pos`;
  });


  // Help mode mapping
  const chipIdToHelpId: Record<string, GeneratorHelpId> = {
    "level": "level",
    "length": "length",
    "mode": "generation-mode",
    "grid": "grid-mode",
    "style": "prop-continuity",
    "turn-intensity": "turn-intensity",
    "loop": "loop-type",
    "slice": "slice-size",
    "duration": "duration-rhythm",
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
        id: "style",
        label: "Style",
        value: styleDisplayValue,
        bg: cardColors.continuity.color,
        shadowHsl: cardColors.continuity.shadowColor,
      },
      {
        id: "duration",
        label: "Rhythm",
        value: durationDisplayValue,
        bg: cardColors.duration.color,
        shadowHsl: cardColors.duration.shadowColor,
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

  // ============================================================================
  // STYLE PANEL OPTIONS (3-axis)
  // ============================================================================
  const propsOptions = [
    { value: "smooth", label: "Smooth" },
    { value: "mixed", label: "Mixed" },
    { value: "high-reversal", label: "High" },
  ] as const;

  const handsOptions = [
    { value: "smooth", label: "Smooth" },
    { value: "mixed", label: "Mixed" },
    { value: "high", label: "High" },
  ] as const;

  const dashOptions = [
    { value: "no-dash", label: "Low" },
    { value: "mixed", label: "Mixed" },
    { value: "prefer-dash", label: "High" },
  ] as const;

  let currentDashValue = $derived.by(() => {
    if (config.motionTypeFilter === "no-dash") return "no-dash";
    if (config.motionTypeFilter === "prefer-dash") return "prefer-dash";
    return "mixed";
  });

</script>

<div
  class="compact-toolbar"
  class:help-mode={helpMode}
  class:help-mode-exiting={helpModeExiting}
  bind:this={toolbarRef}
>
  <!-- Chip rows wrapper -->
  <div class="chip-rows-wrapper">
    <!-- Chip Row 1: Level, Length, Mode, Grid (always 4 columns) -->
    <div class="chip-row">
      <button
        class="compact-chip"
        class:active={activeChipId === "level"}
        style:--chip-bg={currentLevelColor.color}
        style:--chip-shadow-hsl={currentLevelColor.shadowHsl}
        style:--chip-text={currentLevelColor.textColor}
        onclick={(e) => toggleChip("level", e.currentTarget as HTMLElement)}
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
        onclick={(e) => toggleChip("length", e.currentTarget as HTMLElement)}
        aria-expanded={activeChipId === "length"}
        aria-label="Length: {config.length}"
      >
        <span class="chip-label">Len</span>
        <span class="chip-value">{config.length}</span>
      </button>

      <button
        class="compact-chip"
        class:pulsing={pulsingChipId === "mode"}
        style:--chip-bg={cardColors.mode.color}
        style:--chip-shadow-hsl={cardColors.mode.shadowColor}
        onclick={(e) => toggleChip("mode", e.currentTarget as HTMLElement)}
        aria-label="Mode: {config.mode === GenerationMode.CIRCULAR ? 'LOOP' : 'Free'} (tap to toggle)"
      >
        <span class="chip-label">Mode</span>
        <span class="chip-value">{config.mode === GenerationMode.CIRCULAR ? "LOOP" : "Free"}</span>
      </button>

      <button
        class="compact-chip"
        class:pulsing={pulsingChipId === "grid"}
        style:--chip-bg={cardColors.gridMode.color}
        style:--chip-shadow-hsl={cardColors.gridMode.shadowColor}
        onclick={(e) => toggleChip("grid", e.currentTarget as HTMLElement)}
        aria-label="Grid: {config.gridMode === GridMode.DIAMOND ? 'Diamond' : 'Box'} (tap to toggle)"
      >
        <span class="chip-label">Grid</span>
        <span class="chip-value">{config.gridMode === GridMode.DIAMOND ? "\u25C7" : "\u25A2"}</span>
      </button>
    </div>

    <!-- Chip Row 2: dynamic chips (column count adapts to chip count) -->
    <div class="chip-row" style:--chip-cols={row2Chips.length}>
      {#each row2Chips as chip (chip.id)}
        <button
          class="compact-chip"
          class:active={activeChipId === chip.id}
          class:pulsing={pulsingChipId === chip.id}
          style:--chip-bg={chip.bg}
          style:--chip-shadow-hsl={chip.shadowHsl}
          style:--chip-text={chip.textColor ?? "white"}
          onclick={(e) => toggleChip(chip.id, e.currentTarget as HTMLElement)}
          aria-expanded={activeChipId === chip.id}
          aria-label="{chip.label}: {chip.value}"
        >
          <span class="chip-label">{chip.label}</span>
          <span class="chip-value">{chip.value}</span>
        </button>
      {/each}
    </div>

  </div>

  <!-- Bottom row: Start/End + Generate button -->
  <div class="compact-bottom-row">
    <button
      class="start-end-btn"
      class:active={activeChipId === "start-end"}
      onclick={(e) => toggleChip("start-end", e.currentTarget as HTMLElement)}
      aria-expanded={activeChipId === "start-end"}
      aria-label="Start/End: {startEndDisplayValue}"
    >
      <span class="start-end-label">Start/End</span>
      <span class="start-end-value">{startEndDisplayValue}</span>
    </button>
    <div class="compact-generate-btn">
      <GenerateButtonCard
        {isGenerating}
        onGenerateClicked={onGenerateClicked}
        {config}
        startEndOptions={startEndState?.options}
      />
    </div>
  </div>

  <!-- Expand Overlay: absolutely positioned over entire toolbar (all 3 rows) -->
  {#if activeChipId}
    {@const activeChipDef = activeChipId === "level" ? { bg: currentLevelColor.color, text: currentLevelColor.textColor } :
      activeChipId === "length" ? { bg: cardColors.length.color, text: "white" } :
      activeChipId === "style" ? { bg: cardColors.continuity.color, text: "white" } :
      activeChipId === "turn-intensity" ? { bg: cardColors.turnIntensity.color, text: "white" } :
      activeChipId === "loop" ? { bg: "linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)", text: "white" } :
      activeChipId === "start-end" ? { bg: cardColors.startEnd.color, text: "white" } :
      { bg: "var(--theme-card-bg)", text: "white" }}
    <div
      class="expand-overlay"
      class:morphed={morphPhase === 'expanded'}
      class:morph-exiting={morphPhase === 'exiting'}
      style="{morphStyles}"
      style:--expand-bg={activeChipDef.bg}
      style:--expand-text={activeChipDef.text}
      bind:this={overlayRef}
      role="region"
      aria-label="Options for {activeChipId}"
    >
      <!-- Close / back button + label -->
      <button class="expand-header" onclick={closePanel}>
        <i class="fas fa-chevron-left expand-back-icon" aria-hidden="true"></i>
        <span class="expand-title">
          {activeChipId === "level" ? "Level" :
           activeChipId === "length" ? "Length" :
           activeChipId === "style" ? "Style" :
           activeChipId === "turn-intensity" ? "Turns" :
           activeChipId === "loop" ? "LOOP Type" :
           activeChipId === "start-end" ? "Start / End" : ""}
        </span>
      </button>

      <!-- Content area -->
      <div class="expand-content">
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

        {:else if activeChipId === "style"}
          <div class="style-panel">
            <div class="style-axis">
              <span class="style-axis-label">Prop Rev.</span>
              <div class="style-axis-options">
                {#each propsOptions as opt}
                  <button
                    class="option-btn"
                    class:selected={config.constraintPreset === opt.value}
                    onclick={() => handlePropsChange(opt.value)}
                  >{opt.label}</button>
                {/each}
              </div>
            </div>
            <div class="style-axis">
              <span class="style-axis-label">Hand Rev.</span>
              <div class="style-axis-options">
                {#each handsOptions as opt}
                  <button
                    class="option-btn"
                    class:selected={config.handPathMode === opt.value}
                    onclick={() => handleHandsChange(opt.value)}
                  >{opt.label}</button>
                {/each}
              </div>
            </div>
            <div class="style-axis">
              <span class="style-axis-label">Dashes</span>
              <div class="style-axis-options">
                {#each dashOptions as opt}
                  <button
                    class="option-btn"
                    class:selected={currentDashValue === opt.value}
                    onclick={() => handleDashesChange(opt.value)}
                  >{opt.label}</button>
                {/each}
              </div>
            </div>
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
          <LOOPExpandPanel
            loopType={config.loopType}
            {isFreeformMode}
            {haptic}
            updateLoopType={(type) => updateConfig({ loopType: type })}
          />

        {:else if activeChipId === "start-end" && startEndState}
          <StartEndExpandPanel
            {startEndState}
            gridMode={config.gridMode as GridMode}
            {isFreeformMode}
            {haptic}
          />
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .compact-toolbar {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 2px 4px;
    overflow: hidden;
  }

  /* ============================================================ */
  /* CHIP ROWS WRAPPER - positioning context for expand overlay */
  /* ============================================================ */

  .chip-rows-wrapper {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 2;
    min-height: 0;
  }

  /* ============================================================ */
  /* CHIP GRID - normal CSS Grid, no absolute positioning */
  /* ============================================================ */

  .chip-row {
    display: grid;
    grid-template-columns: repeat(var(--chip-cols, 4), 1fr);
    gap: 4px;
    flex: 1;
    min-height: 0;
    transition: opacity 150ms ease, visibility 150ms ease;
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

  /* Inline toggle pulse animation */
  .compact-chip.pulsing {
    animation: chip-pulse 150ms ease;
  }

  @keyframes chip-pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.06); }
    100% { transform: scale(1); }
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
  /* EXPAND OVERLAY - covers entire toolbar (all 3 rows) */
  /* ============================================================ */

  .expand-overlay {
    position: absolute;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 8px;
    background: var(--expand-bg, var(--theme-card-bg));
    color: var(--expand-text, white);
    border-radius: 14px;
    overflow: hidden;

    /* Morph transition */
    transition:
      left 280ms cubic-bezier(0.34, 1.12, 0.64, 1),
      top 280ms cubic-bezier(0.34, 1.12, 0.64, 1),
      width 280ms cubic-bezier(0.34, 1.12, 0.64, 1),
      height 280ms cubic-bezier(0.34, 1.12, 0.64, 1),
      border-radius 280ms cubic-bezier(0.34, 1.12, 0.64, 1);

    /* Same shadow style as chips for visual continuity */
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.12),
      0 2px 8px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  /* Glossy sheen on expand overlay (matches chip technique) */
  .expand-overlay::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 50%;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-text, white) 20%, transparent) 0%,
      color-mix(in srgb, var(--theme-text, white) 8%, transparent) 40%,
      transparent 100%
    );
    border-radius: 14px 14px 0 0;
    pointer-events: none;
    z-index: 0;
  }

  .expand-header {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 2px 0;
    position: relative;
    z-index: 1;
    opacity: 0;
    transition: opacity 150ms ease 130ms;
  }

  .expand-overlay.morphed .expand-header {
    opacity: 1;
  }

  .expand-overlay.morph-exiting .expand-header {
    opacity: 0;
    transition: opacity 80ms ease;
  }

  .expand-header:active {
    opacity: 0.7;
  }

  .expand-back-icon {
    font-size: 12px;
    opacity: 0.8;
  }

  .expand-title {
    font-size: 13px;
    font-weight: 700;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .expand-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    position: relative;
    z-index: 1;
    opacity: 0;
    transition: opacity 150ms ease 130ms;
  }

  .expand-overlay.morphed .expand-content {
    opacity: 1;
  }

  .expand-overlay.morph-exiting .expand-content {
    opacity: 0;
    transition: opacity 80ms ease;
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
    min-height: 48px;
    background: rgba(0, 0, 0, 0.25);
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.7);
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
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.5);
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  /* ============================================================ */
  /* STYLE PANEL (3-axis: Props, Hands, Dashes) */
  /* ============================================================ */

  .style-panel {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    flex: 1;
    justify-content: center;
  }

  .style-axis {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .style-axis-label {
    font-size: 11px;
    font-weight: 600;
    opacity: 0.75;
    min-width: 58px;
    text-align: right;
    flex-shrink: 0;
  }

  .style-axis-options {
    display: flex;
    gap: 4px;
    flex: 1;
  }

  .style-axis-options .option-btn {
    min-height: 40px;
    font-size: 13px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 10px;
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
    width: 48px;
    height: 48px;
    border-radius: 10px;
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    background: rgba(0, 0, 0, 0.25);
    color: #fff;
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
    color: #fff;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    min-width: 32px;
    text-align: center;
  }



  /* ============================================================ */
  /* BOTTOM ROW: Start/End + Generate */
  /* ============================================================ */

  .compact-bottom-row {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 4px;
    flex: 1;
    min-height: 0;
  }

  .start-end-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    padding: 4px 2px;
    border: 1.5px solid transparent;
    border-radius: 14px;
    cursor: pointer;
    position: relative;
    overflow: hidden;

    background: linear-gradient(135deg, #64748b 0%, #475569 100%);
    color: white;

    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.12),
      0 1px 2px hsl(215deg 20% 40% / 0.15),
      0 2px 4px hsl(215deg 20% 40% / 0.12),
      0 4px 8px hsl(215deg 20% 40% / 0.1),
      inset 0 1px 0 var(--theme-stroke, rgba(255, 255, 255, 0.1));

    transition: border-color 150ms ease, transform 100ms ease;
  }

  .start-end-btn:active {
    transform: scale(0.96);
  }

  /* Glossy sheen on start/end button */
  .start-end-btn::before {
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

  .start-end-label {
    font-size: 10px;
    font-weight: 500;
    opacity: 0.75;
    line-height: 1;
    position: relative;
    z-index: 1;
  }

  .start-end-value {
    font-size: 13px;
    font-weight: 700;
    line-height: 1.1;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    position: relative;
    z-index: 1;
  }

  .compact-generate-btn {
    min-height: 0;
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
    .stepper-btn {
      transition: none;
    }

    .compact-chip.pulsing {
      animation: none;
    }

    .expand-overlay {
      transition: none;
    }

    .expand-overlay .expand-content,
    .expand-overlay .expand-header {
      transition: none;
      opacity: 1;
    }

    .compact-toolbar.help-mode .compact-chip::after {
      animation: none;
    }
  }
</style>
