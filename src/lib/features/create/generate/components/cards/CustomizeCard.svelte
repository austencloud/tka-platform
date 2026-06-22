<!--
CustomizeCard.svelte - Single card absorbing Style and Start/End
Shows summary ("Default" or "Custom"), click opens the expanded overlay.
(Rhythm was removed pending a finished rhythm-preset design.)
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import type { StartEndOptions, PanelCoordinationState } from "$lib/shared/create/state/panel-coordination-state.svelte";
  import { onMount, getContext } from "svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import CardHeader from "./shared/CardHeader.svelte";
  import {
    detectPresetFromBlocked,
    getAllowedPositions,
    StartPositionPreset,
  } from "../../shared/domain/start-position-presets";
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

  let {
    constraintPreset,
    handPathMode,
    motionTypeFilter,
    startEndOptions,
    gridMode = GridMode.DIAMOND,
    isFreeformMode = true,
    onConstraintPresetChange,
    onHandPathModeChange,
    onMotionTypeFilterChange,
    onStartEndChange,
    color = "linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%)",
    shadowColor = "190deg 75% 50%",
    cardIndex = 0,
    headerFontSize = "9px",
  } = $props<{
    constraintPreset: "smooth" | "mixed" | "choppy";
    handPathMode: "smooth" | "mixed" | "choppy";
    motionTypeFilter: "no-dash" | "prefer-dash" | null;
    startEndOptions?: StartEndOptions;
    gridMode?: GridMode;
    isFreeformMode?: boolean;
    onConstraintPresetChange: (v: "smooth" | "mixed" | "choppy") => void;
    onHandPathModeChange: (v: "smooth" | "mixed" | "choppy") => void;
    onMotionTypeFilterChange: (v: "no-dash" | "mixed" | "prefer-dash") => void;
    onStartEndChange?: (options: StartEndOptions) => void;
    color?: string;
    shadowColor?: string;
    cardIndex?: number;
    headerFontSize?: string;
  }>();

  let hapticService: HapticFeedback | null = $state(null);
  const panelState = getContext<PanelCoordinationState>("panelState");

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  // Determine if everything is default
  const isAllDefault = $derived.by(() => {
    const isDefaultStyle =
      constraintPreset === "smooth" &&
      handPathMode === "smooth" &&
      (motionTypeFilter === null || motionTypeFilter === "no-dash");
    const isDefaultOri =
      (startEndOptions?.blueStartOrientation ?? Orientation.IN) === Orientation.IN &&
      (startEndOptions?.redStartOrientation ?? Orientation.IN) === Orientation.IN;
    const isDefaultStartEnd = !startEndOptions ||
      (startEndOptions.blockedStartPositions.length === 0 &&
       !startEndOptions.endPosition &&
       isDefaultOri);
    return isDefaultStyle && isDefaultStartEnd;
  });

  // Build summary lines for non-default settings
  const summaryLines = $derived.by((): string[] => {
    if (isAllDefault) return [];
    const lines: string[] = [];

    // Start position
    if (startEndOptions && startEndOptions.blockedStartPositions.length > 0) {
      const preset = detectPresetFromBlocked(startEndOptions.blockedStartPositions, gridMode);
      if (preset === StartPositionPreset.CLASSIC) {
        lines.push("Classic 3");
      } else {
        const allowed = getAllowedPositions(startEndOptions.blockedStartPositions, gridMode);
        if (allowed.length === 1) {
          lines.push(`Start: ${allowed[0]}`);
        }
      }
    }

    // Start orientation (only when non-default In/In)
    const blueOri = startEndOptions?.blueStartOrientation ?? Orientation.IN;
    const redOri = startEndOptions?.redStartOrientation ?? Orientation.IN;
    if (blueOri !== Orientation.IN || redOri !== Orientation.IN) {
      const short: Record<string, string> = {
        [Orientation.IN]: "In",
        [Orientation.CLOCK]: "CW",
        [Orientation.OUT]: "Out",
        [Orientation.COUNTER]: "CCW",
      };
      lines.push(`Ori: ${short[blueOri] ?? blueOri}/${short[redOri] ?? redOri}`);
    }

    return lines;
  });

  function handleClick() {
    hapticService?.trigger("selection");
    panelState?.openCustomizeOverlay?.({
      constraintPreset,
      handPathMode,
      motionTypeFilter,
      startEndOptions: startEndOptions ?? null,
      gridMode,
      isFreeformMode,
      onConstraintPresetChange,
      onHandPathModeChange,
      onMotionTypeFilterChange,
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
  aria-label="Customize: {isAllDefault ? 'Default' : 'Custom'}. Click to configure style, rhythm, and positions."
>
  <CardHeader title="Customize" {headerFontSize} />
  {#if isAllDefault}
    <div class="card-value">Default</div>
  {:else if summaryLines.length > 0}
    <div class="card-summary">
      {#each summaryLines as line}
        <span class="summary-line">{line}</span>
      {/each}
    </div>
  {:else}
    <div class="card-value">Custom</div>
  {/if}
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

  .card-summary {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(1px, 0.5cqh, 4px);
    flex: 1;
    min-height: 0;
    position: relative;
    z-index: 2;
  }

  .summary-line {
    font-size: var(--card-text-size);
    font-weight: var(--card-text-weight);
    letter-spacing: var(--card-text-spacing);
    color: white;
    text-shadow: var(--card-text-shadow);
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  /* Scale down when multiple lines need to fit */
  .card-summary:has(.summary-line:nth-child(2)) .summary-line {
    font-size: clamp(11px, 3.5cqw, 16px);
    font-weight: 600;
    letter-spacing: 0;
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
