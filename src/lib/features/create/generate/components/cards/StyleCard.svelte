<!--
StyleCard.svelte - Card for 3-axis style configuration
Shows summary (Smooth/Mixed/Custom) and opens an inline overlay with StyleExpandPanel
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import CardHeader from "./shared/CardHeader.svelte";
  import StyleExpandPanel from "../StyleExpandPanel.svelte";

  let {
    constraintPreset,
    handPathMode,
    motionTypeFilter,
    onConstraintPresetChange,
    onHandPathModeChange,
    onMotionTypeFilterChange,
    color = "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
    shadowColor = "190deg 75% 50%",
    cardIndex = 0,
    headerFontSize = "9px",
  } = $props<{
    constraintPreset: "smooth" | "mixed" | "high-reversal";
    handPathMode: "smooth" | "mixed" | "high";
    motionTypeFilter: "no-dash" | "prefer-dash" | null;
    onConstraintPresetChange: (v: "smooth" | "mixed" | "high-reversal") => void;
    onHandPathModeChange: (v: "smooth" | "mixed" | "high") => void;
    onMotionTypeFilterChange: (v: "no-dash" | "mixed" | "prefer-dash") => void;
    color?: string;
    shadowColor?: string;
    cardIndex?: number;
    headerFontSize?: string;
  }>();

  let hapticService: IHapticFeedback | null = $state(null);
  let expanded = $state(false);

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  let displayValue = $derived.by(() => {
    const presetLabel = constraintPreset === "smooth" ? "Smooth"
      : constraintPreset === "high-reversal" ? "High" : "Mixed";
    const handLabel = handPathMode === "smooth" ? "Smooth"
      : handPathMode === "high" ? "High" : "Mixed";
    const dashLabel = motionTypeFilter === "no-dash" ? "Low"
      : motionTypeFilter === "prefer-dash" ? "High" : "Mixed";

    if (presetLabel === handLabel && handLabel === dashLabel) return presetLabel;
    return "Custom";
  });

  function toggleExpand() {
    hapticService?.trigger("selection");
    expanded = !expanded;
  }

</script>

{#if expanded}
  <!-- Expanded: show 3-axis style panel inline -->
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="style-card expanded"
    style="--card-color: {color}; --shadow-color: {shadowColor}; --card-index: {cardIndex};"
  >
    <button class="collapse-btn" onclick={toggleExpand} aria-label="Collapse style panel">
      <CardHeader title="Style" {headerFontSize} />
      <span class="collapse-icon"><i class="fas fa-chevron-up" aria-hidden="true"></i></span>
    </button>
    <div class="expand-content">
      <StyleExpandPanel
        {constraintPreset}
        {handPathMode}
        {motionTypeFilter}
        haptic={hapticService}
        onPropsChange={onConstraintPresetChange}
        onHandsChange={onHandPathModeChange}
        onDashesChange={onMotionTypeFilterChange}
      />
    </div>
  </div>
{:else}
  <!-- Collapsed: show summary value -->
  <button
    class="style-card collapsed"
    style="--card-color: {color}; --shadow-color: {shadowColor}; --card-index: {cardIndex};"
    onclick={toggleExpand}
    aria-label="Style: {displayValue}. Click to expand."
  >
    <CardHeader title="Style" {headerFontSize} />
    <div class="card-value">{displayValue}</div>
  </button>
{/if}

<style>
  .style-card {
    container-type: size;
    container-name: style-card;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    border-radius: 16px;
    background: var(--card-color);
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.12),
      0 1px 2px hsl(var(--shadow-color) / 0.15),
      0 2px 4px hsl(var(--shadow-color) / 0.12),
      0 4px 8px hsl(var(--shadow-color) / 0.1),
      inset 0 1px 0 var(--theme-stroke);
    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    color: white;
    text-align: center;
    border: none;
    cursor: pointer;
    font-family: inherit;
  }

  /* Glossy sheen overlay */
  .style-card::after {
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

  .style-card.collapsed {
    justify-content: space-between;
    padding: clamp(6px, 2cqh, 12px) clamp(4px, 1.5cqw, 8px);
  }

  @media (hover: hover) {
    .style-card.collapsed:hover {
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

  .style-card.collapsed:active {
    transform: translateY(0) scale(0.98);
    transition: all var(--duration-instant) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .style-card.expanded {
    cursor: default;
    padding: clamp(4px, 1cqh, 8px) clamp(4px, 1.5cqw, 8px);
    justify-content: flex-start;
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
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
    margin: clamp(2px, 0.5cqh, 4px) 0;
  }

  .collapse-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 2px 4px;
    font-family: inherit;
    position: relative;
    z-index: 2;
  }

  .collapse-icon {
    font-size: 10px;
    opacity: 0.7;
  }

  .expand-content {
    flex: 1;
    width: 100%;
    min-height: 0;
    display: flex;
    position: relative;
    z-index: 2;
  }

  .style-card:focus-visible {
    outline: 2px solid var(--theme-stroke-strong);
    outline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    .style-card {
      transition: none;
    }
  }
</style>
