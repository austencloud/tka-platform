<!--
TurnIntensityCard.svelte - Card for selecting turn intensity
Uses stepper pattern for direct increment/decrement interaction
-->
<script lang="ts">
  import { BackgroundType } from "@austencloud/backgrounds";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { isBrightBackground } from "../../shared/domain/card-colors";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
  import StepperCard from "./StepperCard/StepperCard.svelte";

  let {
    currentIntensity,
    allowedValues,
    onIntensityChange,
    brightBackgroundOverride,
    shadowColor = "0deg 0% 0%", // Neutral shadow (adapts to any color)
    gridColumnSpan = 2,
    cardIndex = 0,
    headerFontSize = "9px",
  } = $props<{
    currentIntensity: number;
    allowedValues: number[];
    onIntensityChange: (intensity: number) => void;
    /** Pins the palette for isolated embeds that do not share app settings. */
    brightBackgroundOverride?: boolean;
    shadowColor?: string;
    gridColumnSpan?: number;
    cardIndex?: number;
    headerFontSize?: string;
  }>();

  // The app follows its selected background. Isolated embeds can pin the
  // palette so a visitor's saved setting cannot restyle the card.
  const useDarkColors = $derived.by(
    () =>
      brightBackgroundOverride ??
      isBrightBackground(
        settingsService.settings.backgroundType ?? BackgroundType.WINTER
      )
  );

  // Find current index in allowed values
  const currentIndex = $derived(allowedValues.indexOf(currentIntensity));

  // Check if we can increment/decrement within allowed values
  const canIncrement = $derived(currentIndex < allowedValues.length - 1);
  const canDecrement = $derived(currentIndex > 0);

  // Get min/max from allowed values for stepper
  const minValue = $derived(Math.min(...allowedValues));
  const maxValue = $derived(Math.max(...allowedValues));

  function handleIncrement() {
    if (canIncrement) {
      const nextValue = allowedValues[currentIndex + 1];
      onIntensityChange(nextValue);
    }
  }

  function handleDecrement() {
    if (canDecrement) {
      const prevValue = allowedValues[currentIndex - 1];
      onIntensityChange(prevValue);
    }
  }

  // Format intensity display
  function formatValue(value: number): string {
    return `≤${value}`;
  }

  // Generate description based on intensity
  function getDescription(value: number): string {
    if (value <= 0.5) return "Minimal turns";
    if (value <= 1.0) return "Gentle turns";
    if (value <= 1.5) return "Light turns";
    if (value <= 2.0) return "Moderate turns";
    if (value <= 2.5) return "Strong turns";
    return "Intense turns";
  }

  // 🎨 Default colors for normal backgrounds - Green → Yellow → Orange → Red
  function getDefaultColor(value: number): string {
    if (value <= 0.5) {
      return "radial-gradient(ellipse at top left, #a7f3d0 0%, #6ee7b7 40%, #34d399 100%)";
    } else if (value <= 1.0) {
      return "radial-gradient(ellipse at top left, #4ade80 0%, var(--semantic-success) 40%, #16a34a 100%)";
    } else if (value <= 1.5) {
      return "radial-gradient(ellipse at top left, #bef264 0%, #a3e635 40%, #84cc16 100%)";
    } else if (value <= 2.0) {
      return "radial-gradient(ellipse at top left, var(--semantic-warning) 0%, var(--semantic-warning) 40%, #d97706 100%)";
    } else if (value <= 2.5) {
      return "radial-gradient(ellipse at top left, #fb923c 0%, #f97316 40%, #ea580c 100%)";
    } else {
      return "radial-gradient(ellipse at top left, var(--semantic-error) 0%, var(--semantic-error) 40%, var(--semantic-error) 100%)";
    }
  }

  // 🎨 Vibrant but darker colors for bright/glowing backgrounds (Aurora, Ember)
  function getBrightBgColor(value: number): string {
    if (value <= 0.5) {
      // Rich emerald - vibrant but darker
      return "radial-gradient(ellipse at top left, #34d399 0%, #10b981 40%, #059669 100%)";
    } else if (value <= 1.0) {
      // Rich green
      return "radial-gradient(ellipse at top left, #22c55e 0%, #16a34a 40%, #15803d 100%)";
    } else if (value <= 1.5) {
      // Rich lime
      return "radial-gradient(ellipse at top left, #a3e635 0%, #84cc16 40%, #65a30d 100%)";
    } else if (value <= 2.0) {
      // Rich amber
      return "radial-gradient(ellipse at top left, #fbbf24 0%, #f59e0b 40%, #d97706 100%)";
    } else if (value <= 2.5) {
      // Rich orange
      return "radial-gradient(ellipse at top left, #fb923c 0%, #f97316 40%, #ea580c 100%)";
    } else {
      // Rich red
      return "radial-gradient(ellipse at top left, #f87171 0%, #ef4444 40%, #dc2626 100%)";
    }
  }

  // 🎨 Dynamic text color based on background lightness
  function getDefaultTextColor(value: number): string {
    const transitionStart = 2.0;
    const transitionEnd = 2.5;

    if (value <= transitionStart) {
      return "rgb(0, 0, 0)";
    } else if (value >= transitionEnd) {
      return "rgb(255, 255, 255)";
    } else {
      const progress =
        (value - transitionStart) / (transitionEnd - transitionStart);
      const grayValue = Math.round(progress * 255);
      return `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
    }
  }

  // Bright background text color - black for lighter shades, white for darker
  function getBrightBgTextColor(value: number): string {
    // Most bright-bg colors are still vibrant enough to need black text
    // Only the darkest red values need white
    return value > 2.5 ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)";
  }

  const description = $derived(getDescription(currentIntensity));
  const dynamicColor = $derived(
    useDarkColors
      ? getBrightBgColor(currentIntensity)
      : getDefaultColor(currentIntensity)
  );
  const textColor = $derived(
    useDarkColors
      ? getBrightBgTextColor(currentIntensity)
      : getDefaultTextColor(currentIntensity)
  );
</script>

<StepperCard
  title={t("generator_turn_intensity")}
  currentValue={currentIntensity}
  {minValue}
  {maxValue}
  onIncrement={handleIncrement}
  onDecrement={handleDecrement}
  {formatValue}
  {description}
  color={dynamicColor}
  {shadowColor}
  {textColor}
  {gridColumnSpan}
  {cardIndex}
  {headerFontSize}
/>
