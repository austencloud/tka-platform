<!--
CompactSettingsToolbar.svelte - Compact morph chip mode for Generate panel

Replaces the card grid on small viewports (iPhone SE, etc.) where vertical space
is limited. Uses MorphChip primitives from the shared foundation layer.

Each chip gets the same gradient color as its card-mode counterpart via
CSS custom property inheritance (--chip-bg flows from wrapper to absolute chip).

Triggered by container query @container tool-panel (max-height: 340px)
in CardBasedSettingsContainer.
-->
<script lang="ts">
  import { container as diContainer } from "$lib/shared/di";
  import { onMount } from "svelte";
  import MorphChipGroup from "$lib/shared/foundation/ui/morph-chip/MorphChipGroup.svelte";
  import MorphChip from "$lib/shared/foundation/ui/morph-chip/MorphChip.svelte";
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
  import { getCardColors } from "../shared/domain/card-colors";
  import { LOOP_COMPONENTS } from "../shared/domain/constants/loop-constants";
  import { loopTypeResolver } from "../shared/services/implementations/LOOPTypeResolver";

  // ============================================================================
  // PROPS - Mirrors CardBasedSettingsContainer for drop-in switching
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

  // LOOP type allows slice choice when rotation is involved
  let loopTypeAllowsSliceChoice = $derived(
    config.loopType === LOOPType.STRICT_ROTATED ||
    config.loopType === LOOPType.ROTATED_INVERTED ||
    config.loopType === LOOPType.ROTATED_SWAPPED ||
    config.loopType === LOOPType.MIRRORED_ROTATED ||
    config.loopType === LOOPType.MIRRORED_INVERTED_ROTATED ||
    config.loopType === LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED
  );

  // ============================================================================
  // CHIP VALUES & OPTIONS
  // ============================================================================

  // Level chip
  const levelOptions = [
    { value: "1", label: "1" },
    { value: "2", label: "2" },
    { value: "3", label: "3" },
    { value: "4", label: "4" },
  ];
  let levelChipValue = $derived(String(config.level));
  let levelDisplayValue = $derived(String(config.level));

  function handleLevelChange(v: string) {
    haptic?.trigger("selection");
    const num = parseInt(v, 10);
    if (!loopParamProvider) return;
    const level = loopParamProvider.numberToDifficulty(num);
    updateConfig({ level: loopParamProvider.difficultyToNumber(level) });
  }

  // Length chip - uses +/- stepper via expandedContent
  let lengthValue = $derived(String(config.length));
  let lengthDisplayValue = $derived(String(config.length));

  function handleLengthDecrement() {
    haptic?.trigger("selection");
    const newLen = Math.max(2, config.length - 2);
    updateConfig({ length: newLen });
  }

  function handleLengthIncrement() {
    haptic?.trigger("selection");
    const newLen = Math.min(32, config.length + 2);
    updateConfig({ length: newLen });
  }

  // Mode chip
  const modeOptions = [
    { value: GenerationMode.CIRCULAR, label: "LOOP" },
    { value: GenerationMode.FREEFORM, label: "Free" },
  ];
  let modeChipValue = $derived(config.mode);
  let modeDisplayValue = $derived(
    config.mode === GenerationMode.CIRCULAR ? "LOOP" : "Free"
  );

  function handleModeChange(v: string) {
    haptic?.trigger("selection");
    updateConfig({ mode: v as GenerationMode });
  }

  // Grid chip
  const gridOptions = [
    { value: GridMode.DIAMOND, label: "\u25C7" },
    { value: GridMode.BOX, label: "\u25A2" },
  ];
  let gridChipValue = $derived(config.gridMode);
  let gridDisplayValue = $derived(
    config.gridMode === GridMode.DIAMOND ? "\u25C7" : "\u25A2"
  );

  function handleGridChange(v: string) {
    haptic?.trigger("selection");
    updateConfig({ gridMode: v as GridMode });
    if (startEndState?.options?.startPosition || startEndState?.options?.endPosition) {
      setTimeout(() => startEndState?.clearPositions(), 150);
    }
  }

  // Continuity chip
  const continuityOptions = [
    { value: PropContinuity.CONTINUOUS, label: "Smooth" },
    { value: PropContinuity.RANDOM, label: "Random" },
  ];
  let continuityChipValue = $derived(config.propContinuity);
  let continuityDisplayValue = $derived(
    config.propContinuity === PropContinuity.CONTINUOUS ? "Smooth" : "Random"
  );

  function handleContinuityChange(v: string) {
    haptic?.trigger("selection");
    updateConfig({ propContinuity: v as PropContinuity });
  }

  // Turn Intensity chip
  let turnIntensityChipValue = $derived(String(config.turnIntensity));
  let turnIntensityDisplayValue = $derived(`\u2264${config.turnIntensity}`);
  let turnIntensityOptions = $derived(
    allowedIntensityValues.map((v) => ({
      value: String(v),
      label: `\u2264${v}`,
    }))
  );

  function handleTurnIntensityChange(v: string) {
    haptic?.trigger("selection");
    updateConfig({ turnIntensity: parseFloat(v) });
  }

  // LOOP chip - uses expandedContent with toggle grid
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
        const newType = loopTypeResolver.generateLOOPType(newSet);
        updateConfig({ loopType: newType });
      }
    }
  }

  let loopDisplayValue = $derived.by(() => {
    if (!isValidLoopCombo) return `${localLoopSelection.size} sel`;
    if (config.loopType) {
      return LOOP_TYPE_LABELS[config.loopType as LOOPType] ?? "Custom";
    }
    return "Rotated";
  });

  // Slice chip
  const sliceOptions = [
    { value: SliceSize.QUARTERED, label: "Quartered" },
    { value: SliceSize.HALVED, label: "Halved" },
  ];
  let sliceChipValue = $derived(config.sliceSize);
  let sliceDisplayValue = $derived(
    config.sliceSize === SliceSize.QUARTERED ? "Quartered" : "Halved"
  );

  function handleSliceChange(v: string) {
    haptic?.trigger("selection");
    updateConfig({ sliceSize: v as SliceSize });
  }

  // Start/End chip
  let startEndDisplayValue = $derived.by(() => {
    const start = startEndState?.options?.startPosition;
    const end = startEndState?.options?.endPosition;
    if (start && end) return "Set";
    if (start) return "Start";
    if (end) return "End";
    return "Any";
  });

  // ============================================================================
  // HELP MODE
  // ============================================================================
  const chipIdToHelpId: Record<string, GeneratorHelpId> = {
    "level": "level",
    "length": "length",
    "mode": "generation-mode",
    "grid": "grid-mode",
    "continuity": "prop-continuity",
    "turn-intensity": "turn-intensity",
    "loop": "loop-type",
    "slice": "slice-size",
    "start-end": "start-end",
  };

  // Expansion state
  let expandedId = $state<string | null>(null);
</script>

<div
  class="compact-toolbar"
  class:help-mode={helpMode}
  class:help-mode-exiting={helpModeExiting}
>
  <MorphChipGroup bind:expandedId gap={6}>
    <!-- Row 1: Level, Length, Mode -->
    <div class="chip-row">
      <div class="chip-color-wrap" style:--chip-bg={cardColors.level.color}>
        <MorphChip
          id="level"
          label="Level"
          bind:value={levelChipValue}
          options={levelOptions}
          displayValue={levelDisplayValue}
          onchange={handleLevelChange}
        />
      </div>
      <div class="chip-color-wrap" style:--chip-bg={cardColors.length.color}>
        <MorphChip
          id="length"
          label="Length"
          value={lengthValue}
          options={[]}
          displayValue={lengthDisplayValue}
        >
          {#snippet expandedContent({ collapse, morphProgress })}
            <div
              class="length-stepper"
              onclick={(e) => e.stopPropagation()}
              onkeydown={(e) => e.stopPropagation()}
              role="group"
              aria-label="Sequence length"
            >
              <button
                class="stepper-btn"
                onclick={handleLengthDecrement}
                disabled={config.length <= 2}
                tabindex={morphProgress > 0.5 ? 0 : -1}
                aria-label="Decrease length"
              >
                <i class="fas fa-minus" aria-hidden="true"></i>
              </button>
              <span class="stepper-value">{config.length}</span>
              <button
                class="stepper-btn"
                onclick={handleLengthIncrement}
                disabled={config.length >= 32}
                tabindex={morphProgress > 0.5 ? 0 : -1}
                aria-label="Increase length"
              >
                <i class="fas fa-plus" aria-hidden="true"></i>
              </button>
            </div>
          {/snippet}
        </MorphChip>
      </div>
      <div class="chip-color-wrap" style:--chip-bg={cardColors.mode.color}>
        <MorphChip
          id="mode"
          label="Mode"
          bind:value={modeChipValue}
          options={modeOptions}
          displayValue={modeDisplayValue}
          onchange={handleModeChange}
        />
      </div>
    </div>

    <!-- Row 2: Grid, Continuity, Turn Intensity (conditional) -->
    <div class="chip-row">
      <div class="chip-color-wrap" style:--chip-bg={cardColors.gridMode.color}>
        <MorphChip
          id="grid"
          label="Grid"
          bind:value={gridChipValue}
          options={gridOptions}
          displayValue={gridDisplayValue}
          onchange={handleGridChange}
        />
      </div>
      <div class="chip-color-wrap" style:--chip-bg={cardColors.continuity.color}>
        <MorphChip
          id="continuity"
          label="Props"
          expandedLabel="Prop Continuity"
          bind:value={continuityChipValue}
          options={continuityOptions}
          displayValue={continuityDisplayValue}
          onchange={handleContinuityChange}
        />
      </div>
      {#if !isBeginnerLevel && turnIntensityOptions.length > 0}
        <div class="chip-color-wrap" style:--chip-bg={cardColors.turnIntensity.color}>
          <MorphChip
            id="turn-intensity"
            label="Turns"
            expandedLabel="Turn Intensity"
            bind:value={turnIntensityChipValue}
            options={turnIntensityOptions}
            displayValue={turnIntensityDisplayValue}
            onchange={handleTurnIntensityChange}
          />
        </div>
      {/if}
    </div>

    <!-- Row 3 (conditional): LOOP chips when in circular mode -->
    {#if !isFreeformMode}
      <div class="chip-row">
        <div class="chip-color-wrap" style:--chip-bg="linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)">
          <MorphChip
            id="loop"
            label="LOOP"
            value={"loop"}
            options={[]}
            displayValue={loopDisplayValue}
            expandedHeight={200}
          >
            {#snippet expandedContent({ collapse, morphProgress })}
              <div
                class="loop-expanded-content"
                role="group"
                aria-label="LOOP components"
                onpointerdown={(e) => e.stopPropagation()}
              >
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
                      tabindex={morphProgress > 0.5 ? 0 : -1}
                    >
                      <i class="fas fa-{info.icon}" aria-hidden="true"></i>
                      <span>{info.label}</span>
                    </button>
                  {/each}
                </div>
                {#if !isValidLoopCombo}
                  <div class="combo-hint" role="status">
                    <i class="fas fa-flask" aria-hidden="true"></i>
                    This combination isn't wired up yet
                  </div>
                {/if}
              </div>
            {/snippet}
          </MorphChip>
        </div>
        {#if loopTypeAllowsSliceChoice}
          <div class="chip-color-wrap" style:--chip-bg={cardColors.sliceSize.color}>
            <MorphChip
              id="slice"
              label="Slice"
              bind:value={sliceChipValue}
              options={sliceOptions}
              displayValue={sliceDisplayValue}
              onchange={handleSliceChange}
            />
          </div>
        {/if}
      </div>
    {/if}
  </MorphChipGroup>

  <!-- Generate button always visible below chips -->
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
    gap: 6px;
    height: 100%;
    padding: 4px;
    overflow: hidden;
  }

  .chip-row {
    display: flex;
    gap: 6px;
    width: 100%;
  }

  /*
   * Color wrapper: participates in flex layout (inherits placeholder sizing)
   * and sets --chip-bg for its MorphChip descendant. display: contents would
   * remove the box and break CSS custom property inheritance, so we use
   * flex: 1 to make wrappers share space equally — same as placeholders would.
   *
   * The MorphChip's .chip is absolutely positioned relative to the MorphChipGroup,
   * but CSS custom properties still inherit through the DOM tree (parent -> child),
   * not the visual tree. So --chip-bg reaches .chip through DOM inheritance.
   */
  .chip-color-wrap {
    flex: 1;
    min-width: 0;
    /* No position property — must stay transparent to the offsetParent chain
       so MorphChip's absolute positioning still anchors to MorphChipGroup */
  }

  /* Override MorphChip's default dark background with the card gradient color */
  .chip-color-wrap :global(.chip) {
    background: var(--chip-bg) !important;
    border-color: rgba(255, 255, 255, 0.25);
  }

  /* Make label text bright white against colored backgrounds */
  .chip-color-wrap :global(.chip-label) {
    color: rgba(255, 255, 255, 0.85) !important;
  }

  /* Value text: bold white with subtle shadow for legibility */
  .chip-color-wrap :global(.chip-value) {
    color: #fff !important;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  /* When expanded, switch to neutral background so option buttons are readable */
  .chip-color-wrap :global(.chip.expanding) {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98)) !important;
    border-color: var(--theme-accent, #6366f1);
  }

  /* Expanded label uses accent color (matches MorphChip's morph progress logic) */
  .chip-color-wrap :global(.chip.expanding .chip-label) {
    color: var(--theme-accent, #6366f1) !important;
  }

  .compact-generate-btn {
    flex-shrink: 0;
    min-height: 48px;
    max-height: 56px;
  }

  .compact-generate-btn > :global(*) {
    height: 100%;
  }

  /* ============================================================ */
  /* LENGTH STEPPER (expandedContent for Length chip) */
  /* ============================================================ */

  .length-stepper {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 4px 8px;
  }

  .stepper-btn {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.6));
    color: var(--theme-text, #fff);
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 150ms ease;
  }

  .stepper-btn:hover:not(:disabled) {
    border-color: var(--theme-accent, #6366f1);
    background: color-mix(in srgb, var(--theme-accent) 15%, var(--theme-card-bg));
  }

  .stepper-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .stepper-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .stepper-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--theme-text, #fff);
    min-width: 40px;
    text-align: center;
  }

  /* ============================================================ */
  /* LOOP TOGGLE GRID (same pattern as SpellSettingsBar) */
  /* ============================================================ */

  .loop-expanded-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .loop-toggle-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .loop-toggle-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-height: 48px;
    padding: 6px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.6));
    border: 1.5px solid var(--theme-stroke);
    border-radius: 10px;
    color: var(--theme-text-muted);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .loop-toggle-chip:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--chip-color, var(--theme-stroke-strong));
    color: var(--theme-text);
  }

  .loop-toggle-chip:active {
    transform: scale(0.96);
  }

  .loop-toggle-chip.active {
    background: color-mix(in srgb, var(--chip-color, var(--theme-accent)) 20%, var(--theme-card-bg));
    border-color: var(--chip-color, var(--theme-accent));
    color: var(--theme-text);
  }

  .loop-toggle-chip.active i {
    color: var(--chip-color);
  }

  .loop-toggle-chip i {
    font-size: 16px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    transition: color 150ms ease;
  }

  .loop-toggle-chip:focus-visible {
    outline: 2px solid var(--chip-color, var(--theme-accent));
    outline-offset: 2px;
  }

  .combo-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-compact, 12px);
    color: var(--semantic-warning, #f59e0b);
    padding: 4px 8px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 6px;
  }

  .combo-hint i {
    font-size: 12px;
    flex-shrink: 0;
  }

  /* ============================================================ */
  /* HELP MODE - glow on chips */
  /* ============================================================ */

  .compact-toolbar.help-mode :global(.chip) {
    cursor: pointer;
  }

  .compact-toolbar.help-mode :global(.chip)::after {
    content: "";
    position: absolute;
    inset: -2px;
    border-radius: 20px;
    border: 2px solid rgba(59, 130, 246, 0.6);
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.2);
    pointer-events: none;
    animation: help-chip-pulse 1.5s ease-in-out infinite;
  }

  .compact-toolbar.help-mode-exiting :global(.chip)::after {
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
  /* Reduced motion */
  /* ============================================================ */

  @media (prefers-reduced-motion: reduce) {
    .loop-toggle-chip,
    .stepper-btn {
      transition: none;
    }

    .compact-toolbar.help-mode :global(.chip)::after {
      animation: none;
    }
  }
</style>
