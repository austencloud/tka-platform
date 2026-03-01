<!--
CustomizeCard.svelte - Single card absorbing Style, Rhythm, and Start/End
Shows summary ("Default" or "Custom"), click opens the expanded overlay
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { StartEndOptions, PanelCoordinationState } from "$lib/features/create/shared/state/panel-coordination-state.svelte";
  import { container } from "$lib/shared/di";
  import { onMount, getContext } from "svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import CardHeader from "./shared/CardHeader.svelte";

  let {
    constraintPreset,
    handPathMode,
    motionTypeFilter,
    durationTemplateId,
    stepCount,
    startEndOptions,
    gridMode = GridMode.DIAMOND,
    isFreeformMode = true,
    onConstraintPresetChange,
    onHandPathModeChange,
    onMotionTypeFilterChange,
    onDurationTemplateSelect,
    onStartEndChange,
    color = "linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%)",
    shadowColor = "190deg 75% 50%",
    cardIndex = 0,
    headerFontSize = "9px",
  } = $props<{
    constraintPreset: "smooth" | "mixed" | "high-reversal";
    handPathMode: "smooth" | "mixed" | "high";
    motionTypeFilter: "no-dash" | "prefer-dash" | null;
    durationTemplateId: string | null;
    stepCount: number;
    startEndOptions?: StartEndOptions;
    gridMode?: GridMode;
    isFreeformMode?: boolean;
    onConstraintPresetChange: (v: "smooth" | "mixed" | "high-reversal") => void;
    onHandPathModeChange: (v: "smooth" | "mixed" | "high") => void;
    onMotionTypeFilterChange: (v: "no-dash" | "mixed" | "prefer-dash") => void;
    onDurationTemplateSelect: (id: string | null) => void;
    onStartEndChange?: (options: StartEndOptions) => void;
    color?: string;
    shadowColor?: string;
    cardIndex?: number;
    headerFontSize?: string;
  }>();

  let hapticService: IHapticFeedback | null = $state(null);
  const panelState = getContext<PanelCoordinationState>("panelState");

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Summary: "Default" when all axes are at their default values, otherwise "Custom"
  const displayValue = $derived.by(() => {
    const isDefaultStyle =
      constraintPreset === "smooth" &&
      handPathMode === "smooth" &&
      (motionTypeFilter === null || motionTypeFilter === "no-dash");
    const isDefaultRhythm = !durationTemplateId;
    const isDefaultStartEnd = !startEndOptions ||
      (startEndOptions.blockedStartPositions.length === 0 &&
       !startEndOptions.endPosition);

    if (isDefaultStyle && isDefaultRhythm && isDefaultStartEnd) return "Default";
    return "Custom";
  });

  function handleClick() {
    hapticService?.trigger("selection");
    panelState?.openCustomizeOverlay?.({
      constraintPreset,
      handPathMode,
      motionTypeFilter,
      durationTemplateId,
      stepCount,
      startEndOptions: startEndOptions ?? null,
      gridMode,
      isFreeformMode,
      onConstraintPresetChange,
      onHandPathModeChange,
      onMotionTypeFilterChange,
      onDurationTemplateSelect,
      onStartEndChange: onStartEndChange ?? null,
    });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  }
</script>

<button
  class="customize-card"
  style="--card-color: {color}; --shadow-color: {shadowColor}; --card-index: {cardIndex};"
  onclick={handleClick}
  onkeydown={handleKeydown}
  aria-label="Customize: {displayValue}. Click to configure style, rhythm, and positions."
>
  <CardHeader title="Customize" {headerFontSize} />
  <div class="card-value">{displayValue}</div>
</button>

<style>
  .customize-card {
    container-type: size;
    container-name: customize-card;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    padding: clamp(6px, 2cqh, 12px) clamp(4px, 1.5cqw, 8px);
    border-radius: 16px;
    background: var(--card-color);
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    cursor: pointer;
    color: white;
    text-align: center;
    border: none;
    font-family: inherit;

    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.12),
      0 1px 2px hsl(var(--shadow-color) / 0.15),
      0 2px 4px hsl(var(--shadow-color) / 0.12),
      0 4px 8px hsl(var(--shadow-color) / 0.1),
      inset 0 1px 0 var(--theme-stroke);

    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Glossy sheen */
  .customize-card::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 60%;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-text) 30%, transparent) 0%,
      color-mix(in srgb, var(--theme-text) 15%, transparent) 40%,
      color-mix(in srgb, var(--theme-text) 5%, transparent) 70%,
      transparent 100%
    );
    border-radius: 16px 16px 0 0;
    pointer-events: none;
    z-index: 1;
  }

  @media (hover: hover) {
    .customize-card:hover {
      transform: translateY(-2px);
      filter: brightness(1.08);
      box-shadow:
        0 2px 4px hsl(var(--shadow-color) / 0.12),
        0 4px 8px hsl(var(--shadow-color) / 0.1),
        0 8px 16px hsl(var(--shadow-color) / 0.08),
        0 16px 24px hsl(var(--shadow-color) / 0.06),
        0 0 40px hsl(var(--shadow-color) / 0.25);
    }
  }

  .customize-card:active {
    transform: translateY(0) scale(0.98);
    transition: all var(--duration-instant) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .card-value {
    font-size: var(--card-text-size);
    font-weight: var(--card-text-weight);
    letter-spacing: var(--card-text-spacing);
    text-shadow: var(--card-text-shadow);
    color: white;
    text-align: center;
    line-height: 1.1;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    width: 100%;
    margin: clamp(2px, 0.5cqh, 4px) 0;
    position: relative;
    z-index: 2;
  }

  .customize-card:focus-visible {
    outline: 2px solid var(--theme-stroke-strong);
    outline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    .customize-card {
      transition: none;
    }
  }
</style>
