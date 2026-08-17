<!--
TurnsCard.svelte - how much a sequence turns, or exactly how it turns.

One tile in the settings grid, the same shape as its neighbours: a title, what
the setting currently reads, and a line of supporting copy. Clicking it opens
the Turns drawer, where the choice between a ceiling and an exact figure is
made and either one is edited.

The tile keeps the intensity colour ramp — green through red as the turning
gets harder — in both modes, so the card still reports how much is going on at
a glance. In pattern mode the ramp reads the busiest value in the figure.
-->
<script lang="ts">
  import { getContext, onMount } from "svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { isBrightBackground } from "../../shared/domain/card-colors";
  import CardHeader from "./shared/CardHeader.svelte";
  import {
    describeTurnIntensity,
    turnIntensityColor,
    turnIntensityTextColor,
  } from "./turn-intensity-palette";
  import type { TurnLanes } from "@tka/sequence-engine/generation";
  import type { PanelCoordinationState } from "$lib/shared/create/state/panel-coordination-state.svelte";
  import { predictLayerSignature } from "$lib/shared/create/domain/layer-prediction";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";

  let {
    currentIntensity,
    allowedValues,
    onIntensityChange,
    level,
    turnPattern,
    onTurnPatternChange,
    blueStartOrientation,
    redStartOrientation,
    sequenceLength,
    loopPeriod,
    brightBackgroundOverride,
    shadowColor = "0deg 0% 0%", // Neutral shadow (adapts to any color)
    cardIndex = 0,
    headerFontSize = "9px",
  } = $props<{
    currentIntensity: number;
    allowedValues: number[];
    onIntensityChange: (intensity: number) => void;
    level: number;
    /** Absent means the generator is rolling its own turns under a ceiling. */
    turnPattern: TurnLanes | null | undefined;
    onTurnPatternChange: (lanes: TurnLanes | null) => void;
    blueStartOrientation: string;
    redStartOrientation: string;
    sequenceLength: number;
    /** When a LOOP is active, periods restrict to divisors of its seed block. */
    loopPeriod?: number;
    /** Pins the palette for isolated embeds that do not share app settings. */
    brightBackgroundOverride?: boolean;
    shadowColor?: string;
    cardIndex?: number;
    headerFontSize?: string;
  }>();

  let hapticService: HapticFeedback | null = $state(null);
  const panelState = getContext<PanelCoordinationState>("panelState");

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  // The app follows its selected background. Isolated embeds can pin the
  // palette so a visitor's saved setting cannot restyle the card.
  const useDarkColors = $derived(
    brightBackgroundOverride ??
      isBrightBackground(
        settingsService.settings.backgroundType ?? BackgroundType.WINTER
      )
  );

  // The ramp reads the intensity setting and nothing else. Deriving it from a
  // pattern's busiest value turned the card mint green the moment a pattern was
  // started, which is a colour this card has never been and which says nothing
  // about the theme or the setting.
  const cardColor = $derived(turnIntensityColor(currentIntensity, useDarkColors));
  const textColor = $derived(
    turnIntensityTextColor(currentIntensity, useDarkColors)
  );

  /**
   * The figure itself: "1·0 / 0·0". A long period would run off the tile, so
   * past four cells it shows the opening and an ellipsis — the drawer is where
   * the whole thing is read.
   */
  const patternSummary = $derived.by(() => {
    if (!turnPattern) return "";
    const lane = (values: readonly (number | "fl")[]) => {
      if (!values.length) return "0";
      const shown = values.slice(0, 4).map((v) => String(v)).join("·");
      return values.length > 4 ? `${shown}…` : shown;
    };
    return `${lane(turnPattern.blue)} / ${lane(turnPattern.red)}`;
  });

  const value = $derived(turnPattern ? patternSummary : `≤${currentIntensity}`);

  // Below level 3 there are no half turns and only radial starts, so every step
  // reads as layer 1 and the signature says nothing worth showing.
  const prediction = $derived(
    turnPattern && level >= 3
      ? predictLayerSignature({
          blueStartOrientation,
          redStartOrientation,
          lanes: turnPattern,
          length: sequenceLength,
        })
      : null
  );

  const description = $derived.by(() => {
    if (!turnPattern) return describeTurnIntensity(currentIntensity);
    if (prediction?.signature) {
      return prediction.uncertain
        ? `Layers ${prediction.signature}, floats vary`
        : `Layers ${prediction.signature}`;
    }
    return "Exact pattern";
  });

  function openEditor() {
    hapticService?.trigger("selection");
    panelState?.openTurnsOverlay?.({
      turnPattern: turnPattern ?? null,
      level,
      maxTurnIntensity: currentIntensity,
      allowedValues,
      onIntensityChange,
      blueStartOrientation,
      redStartOrientation,
      sequenceLength,
      loopPeriod,
      onTurnPatternChange,
    });
  }
</script>

<button
  class="turns-card"
  style="--card-color: {cardColor}; --card-text-color: {textColor}; --shadow-color: {shadowColor}; --card-index: {cardIndex};"
  onclick={openEditor}
  aria-label="Turns: {value}, {description}. Click to configure turns."
>
  <CardHeader title="Turns" {headerFontSize} />
  <div class="card-value">{value}</div>
  <div class="card-description">{description}</div>
</button>

<style>
  .turns-card {
    container-type: size;
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
    border: none;
    border-radius: 16px;
    background: var(--card-color);
    color: var(--card-text-color);
    font-family: inherit;
    text-align: center;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;

    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.12),
      0 1px 2px hsl(var(--shadow-color) / 0.15),
      0 2px 4px hsl(var(--shadow-color) / 0.12),
      0 4px 8px hsl(var(--shadow-color) / 0.1),
      inset 0 1px 0 var(--theme-stroke);

    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Glossy sheen, matching Customize and LOOP. */
  .turns-card::after {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 60%;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, white 30%, transparent) 0%,
      color-mix(in srgb, white 15%, transparent) 40%,
      color-mix(in srgb, white 5%, transparent) 70%,
      transparent 100%
    );
    border-radius: 16px 16px 0 0;
    pointer-events: none;
    z-index: 1;
  }

  @media (hover: hover) {
    .turns-card:hover {
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

  .turns-card:active {
    transform: translateY(0) scale(0.98);
    transition: all var(--duration-instant) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .turns-card:focus-visible {
    outline: 2px solid var(--theme-stroke-strong);
    outline-offset: 3px;
  }

  .card-value {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    margin: clamp(2px, 0.5cqh, 4px) 0;
    font-size: var(--card-text-size);
    font-weight: var(--card-text-weight);
    letter-spacing: var(--card-text-spacing);
    text-shadow: var(--card-text-shadow);
    line-height: 1.1;
    /* The figure is digits and separators and it changes as the pattern is
       edited. Tabular digits keep it from jittering its own width. */
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    position: relative;
    z-index: 2;
  }

  /* Supporting copy. The container query in the settings grid hides this when
     the row is too short to carry a fourth text band. */
  .card-description {
    font-size: clamp(9px, 2.2cqh, 12px);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.75;
    line-height: 1.2;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    position: relative;
    z-index: 2;
  }

  @media (prefers-reduced-motion: reduce) {
    .turns-card {
      transition: none;
    }
    .turns-card:hover {
      transform: none;
    }
  }
</style>
