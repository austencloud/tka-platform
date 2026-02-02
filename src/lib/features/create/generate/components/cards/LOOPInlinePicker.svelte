<!--
LOOPInlinePicker.svelte - Inline card with toggleable LOOP component chips

Replaces LOOPCard + modal flow with direct manipulation.
Toggle chips on/off, changes apply immediately. Info button opens help modal.
-->
<script lang="ts">
  import type { LOOPType } from "$lib/features/create/generate/circular/domain/models/circular-models";
  import { loopTypeResolver } from "$lib/features/create/generate/shared/services/implementations/LOOPTypeResolver";
  import { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
  import LOOPComponentLegend from "../modals/loop-selection/LOOPComponentLegend.svelte";
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";

  interface Props {
    currentLOOPType: LOOPType;
    onLOOPTypeChange: (loopType: LOOPType) => void;
    gridColumnSpan?: number;
    cardIndex?: number;
    headerFontSize?: string;
    onInfoClick?: () => void;
  }

  let {
    currentLOOPType,
    onLOOPTypeChange,
    gridColumnSpan = 6,
    cardIndex = 0,
    headerFontSize = "9px",
    onInfoClick,
  }: Props = $props();

  let hapticService: IHapticFeedback | null = null;

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Parse current LOOP type into component set
  const selectedComponents = $derived(
    loopTypeResolver.parseComponents(currentLOOPType)
  );

  // Toggle a component and immediately apply
  function handleToggle(component: LOOPComponent) {
    hapticService?.trigger("selection");

    const newSet = new Set(selectedComponents);
    if (newSet.has(component)) {
      newSet.delete(component);
    } else {
      newSet.add(component);
    }

    const newType = loopTypeResolver.generateLOOPType(newSet);
    onLOOPTypeChange(newType);
  }
</script>

<div
  class="loop-inline-picker"
  style="grid-column: span {gridColumnSpan}; --card-index: {cardIndex};"
>
  <!-- Header row: label + icon strip + info button -->
  <div class="picker-header">
    <span class="picker-label" style="font-size: {headerFontSize};">
      {t("generator_loop_type")}
    </span>

    <LOOPIconStrip activeComponents={selectedComponents} size={14} />

    {#if onInfoClick}
      <button
        class="info-btn"
        onclick={onInfoClick}
        aria-label="Learn about LOOP types"
      >
        <i class="fas fa-circle-question" aria-hidden="true"></i>
      </button>
    {/if}
  </div>

  <!-- Toggle grid: 3x2 chips -->
  <LOOPComponentLegend
    {selectedComponents}
    onToggle={handleToggle}
    layout="grid"
  />
</div>

<style>
  .loop-inline-picker {
    container-type: size;
    container-name: loop-picker;

    position: relative;
    border-radius: 16px;
    overflow: visible;
    padding: 12px 16px;

    /* Theme-aware gradient with accent color (matches LOOPCard wrapper) */
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 80%, var(--theme-card-bg)) 0%,
      color-mix(in srgb, var(--theme-accent, #818cf8) 60%, var(--theme-card-bg)) 50%,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 70%, var(--theme-card-bg)) 100%
    );
    background-size: 200% 200%;

    /* Subtle animated shimmer */
    animation:
      accentShimmer 6s ease-in-out infinite,
      cardEnter 0.4s ease-out;

    /* Accent glow shadow */
    box-shadow:
      0 2px 4px var(--theme-shadow),
      0 4px 12px color-mix(in srgb, var(--theme-accent) 20%, transparent),
      inset 0 1px 0 var(--theme-stroke-strong);

    /* Accent border */
    border: 1px solid color-mix(in srgb, var(--theme-accent) 40%, transparent);

    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .picker-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .picker-label {
    font-weight: 700;
    letter-spacing: var(--card-text-spacing, 0.3px);
    color: var(--theme-text, white);
    text-shadow:
      0 1px 2px var(--theme-shadow),
      0 2px 4px color-mix(in srgb, var(--theme-shadow) 20%, transparent);
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .info-btn {
    margin-left: auto;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    transition: all var(--duration-fast, 150ms) ease;
    flex-shrink: 0;
    padding: 0;
  }

  .info-btn:hover {
    background: rgba(255, 255, 255, 0.18);
    border-color: rgba(255, 255, 255, 0.3);
    color: var(--theme-text, white);
  }

  .info-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #818cf8);
    outline-offset: 2px;
  }

  .info-btn i {
    font-size: 14px;
  }

  /* Subtle shimmer animation (matches LOOPCard) */
  @keyframes accentShimmer {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  @keyframes cardEnter {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* Hover effect on capable devices */
  @media (hover: hover) {
    .loop-inline-picker:hover {
      box-shadow:
        0 2px 4px var(--theme-shadow),
        0 6px 16px color-mix(in srgb, var(--theme-accent) 30%, transparent),
        0 12px 24px color-mix(in srgb, var(--theme-accent) 15%, transparent),
        inset 0 1px 0 var(--theme-stroke-strong);
      border-color: color-mix(in srgb, var(--theme-accent) 60%, transparent);
      transition: all var(--duration-emphasis, 300ms) cubic-bezier(0.4, 0, 0.2, 1);
    }
  }

  /* Respect reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .loop-inline-picker {
      animation: none;
    }
  }
</style>
