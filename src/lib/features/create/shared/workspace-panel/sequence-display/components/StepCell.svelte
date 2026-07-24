<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { BuildModeId } from "$lib/shared/foundation/ui/ui-types";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { onMount } from "svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import PictographContextMenuHost from "$lib/shared/pictograph/shared/components/context-menu/PictographContextMenuHost.svelte";
  import ArrowLayerModal from "../../../components/arrow-adjustment/ArrowLayerModal.svelte";
  import { practiceAnimationStyle } from "../../../state/practice-animation-style.svelte";
  import { createStepCellAnimationManager } from "../services/step-cell-animation-manager";
  import { isAdmin } from "$lib/shared/auth/state/auth-state.svelte";


  let {
    step,
    index = 0,
    onClick,
    onDelete,
    onLongPress,
    shouldAnimate = false,
    isSelected = false,
    isPracticeStep = false,
    // Active mode for context-aware messaging
    activeMode = null,
    // Custom highlight style (for multi-select, section highlighting, etc.)
    highlightStyle = null,
    // Musical position string (e.g., "1", "1.5", "2e") for beat number display
    musicalPosition = undefined,
    // Timeline mode: skip selection/practice classes (parent handles them at cell level)
    isTimelineMode = false,
    // Width multiplier for expanded timeline cells (1 = normal, 2 = double width, etc.)
    widthMultiplier = 1,
    // Animation epoch - increments when a new sequence animation starts
    // Used to reset hasAnimated even when step.id stays the same
    animationEpoch = 0,
    // Prop type overrides for demo/preview rendering (bypasses global settings)
    bluePropTypeOverride = undefined,
    redPropTypeOverride = undefined,
  } = $props<{
    step: StepData;
    index?: number;
    onClick?: (modifiers?: { range: boolean; toggle: boolean }) => void;
    onDelete?: () => void;
    onLongPress?: () => void;
    shouldAnimate?: boolean;
    isSelected?: boolean;
    isPracticeStep?: boolean;
    // Active mode
    activeMode?: BuildModeId | null;
    // Custom highlight style
    highlightStyle?: { bg: string; border: string } | null;
    // Musical position string (e.g., "1", "1.5", "2e") for beat number display
    musicalPosition?: string;
    // Timeline mode: skip selection/practice classes (parent handles them at cell level)
    isTimelineMode?: boolean;
    // Width multiplier for expanded timeline cells (1 = normal, 2 = double width, etc.)
    widthMultiplier?: number;
    // Animation epoch - increments when a new sequence animation starts
    animationEpoch?: number;
    /** Override prop type for blue hand. Bypasses global settings for demo/preview rendering. */
    bluePropTypeOverride?: PropType;
    /** Override prop type for red hand. Bypasses global settings for demo/preview rendering. */
    redPropTypeOverride?: PropType;
  }>();

  // Services
  const hapticService = getHapticFeedback();

  // Animation state manager (per-instance, not a DI singleton)
  const animationManager = createStepCellAnimationManager();

  // Reactive state from animation manager
  let animationState = $state(animationManager.getState());

  const isStartPosition = $derived.by(() => {
    return step.stepNumber === 0;
  });

  const displayStepNumber = $derived.by(() => {
    return step.stepNumber || index + 1;
  });

  const ariaLabel = $derived.by(() => {
    if (isStartPosition) {
      return "Start Position";
    }
    return `Step ${displayStepNumber} ${step.isBlank ? "Empty" : "Pictograph"}`;
  });

  // Create step data with selection state for the Pictograph component
  const stepDataWithSelection = $derived.by(() => {
    return {
      ...step,
      isSelected,
    };
  });

  // Long-press detection
  const LONG_PRESS_DURATION = 500; // ms
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let isLongPressing = $state(false);
  let longPressTriggered = $state(false);

  // Element ref for focus management
  let cellElement: HTMLDivElement;

  // Context menu state
  let contextMenuHost: PictographContextMenuHost;

  // Arrow layer adjustment modal state
  let arrowModalOpen = $state(false);
  let arrowModalColor = $state<"blue" | "red">("blue");

  // Show arrow adjustment in context menu for admin users on non-blank beats
  const showArrowAdjustment = $derived(isAdmin() && !step.isBlank && step.stepNumber !== 0);

  function handleAdjustArrow(color: "blue" | "red") {
    arrowModalColor = color;
    arrowModalOpen = true;
  }

  // Sync animation manager with prop changes via effects
  $effect(() => {
    animationManager.onEpochChanged(animationEpoch);
    animationState = animationManager.getState();
  });

  $effect(() => {
    animationManager.onStepChanged(step.id);
    animationState = animationManager.getState();
  });

  $effect(() => {
    animationManager.onDataChanged(step);
    animationState = animationManager.getState();
  });

  // Derived values using reactive animationState (NOT non-reactive class methods)
  // animationManager methods read plain `hasAnimated` which Svelte can't track.
  // We inline the logic here using animationState.hasAnimated which IS reactive.
  const shouldAnimateIn = $derived.by(() => {
    return shouldAnimate && !animationState.hasAnimated && !step.isBlank;
  });

  const isVisible = $derived.by(() => {
    if (shouldAnimate && !animationState.hasAnimated) return false;
    if (index === -1) return true;
    if (step.isBlank) return false;
    return true;
  });

  const enableTransitionsForNewData = $derived.by(() => {
    return animationState.enableTransitions;
  });

  const currentAnimationName = $derived.by(() => {
    return animationState.animationName;
  });

  function handleAnimationEnd() {
    animationManager.onAnimationEnd(shouldAnimateIn);
    animationState = animationManager.getState();
  }

  // Listen for animation changes from the AnimationSelector
  onMount(() => {
    const handleAnimationChange = (event: CustomEvent) => {
      animationManager.setAnimationName(event.detail.animation);
      animationState = animationManager.getState();
    };

    window.addEventListener(
      "animation-change",
      handleAnimationChange as EventListener
    );

    return () => {
      window.removeEventListener(
        "animation-change",
        handleAnimationChange as EventListener
      );
    };
  });

  // Auto-focus when this cell becomes selected (e.g., after deleting another step)
  // This enables continuous Delete key presses to delete steps one by one
  // Use null as sentinel to detect first run and initialize to isSelected's value
  let wasSelected: boolean | null = null;
  let hasMounted = false;
  onMount(() => {
    hasMounted = true;
  });

  $effect(() => {
    // First run: initialize wasSelected to current isSelected to avoid focus on mount
    if (wasSelected === null) {
      wasSelected = isSelected;
      return;
    }
    if (hasMounted && isSelected && !wasSelected && cellElement) {
      // Small delay to ensure DOM is settled after deletion animation
      requestAnimationFrame(() => {
        // Use preventScroll to avoid pulling user's viewport during animation playback
        cellElement?.focus({ preventScroll: true });
      });
    }
    wasSelected = isSelected;
  });

  function handleClick(event: MouseEvent) {
    // Trigger haptic feedback for step selection
    hapticService?.trigger("selection");
    // Shift = range-select, Ctrl/Cmd = toggle. Plain click = single-select.
    onClick?.({
      range: event.shiftKey,
      toggle: event.ctrlKey || event.metaKey,
    });
    // Focus the cell so keyboard events (Delete/Backspace) work immediately
    cellElement?.focus();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      // Enter activates the step (accessibility)
      event.preventDefault();
      hapticService?.trigger("selection");
      onClick?.();
    } else if (event.key === " ") {
      // Space is reserved for animation controls (play/pause)
      // Prevent browser default (which would trigger a click on this button-like element)
      // but let the event bubble up to global keyboard shortcut handler
      event.preventDefault();
      // Don't call onClick - let global shortcuts handle Space
      return;
    } else if (event.key === "Delete" || event.key === "Backspace") {
      // Allow deletion if step is selected (including start position)
      if (isSelected) {
        event.preventDefault();
        // Trigger warning haptic feedback for deletion
        hapticService?.trigger("warning");
        onDelete?.();
      }
    }
  }

  // Long-press handlers
  function handlePointerDown(event: PointerEvent) {
    if (!onLongPress) return;

    isLongPressing = true;
    longPressTriggered = false;

    longPressTimer = setTimeout(() => {
      if (isLongPressing) {
        longPressTriggered = true;
        hapticService?.trigger("success");
        onLongPress();
      }
    }, LONG_PRESS_DURATION);
  }

  function handlePointerUp() {
    cancelLongPress();

    // If long press was triggered, don't also trigger click
    if (longPressTriggered) {
      longPressTriggered = false;
      return;
    }
  }

  function handlePointerLeave() {
    cancelLongPress();
  }

  function handlePointerCancel() {
    cancelLongPress();
  }

  function cancelLongPress() {
    isLongPressing = false;
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    contextMenuHost?.openContextMenu(event.clientX, event.clientY);
  }
</script>

<div
  bind:this={cellElement}
  class="step-cell"
  class:invisible={!isVisible}
  class:animate={shouldAnimateIn}
  class:expanded={widthMultiplier > 1}
  class:timeline-mode={isTimelineMode}
  class:selected={isSelected && !isTimelineMode}
  class:practice-step={isPracticeStep && !isTimelineMode}
  class:practice-intense={isPracticeStep &&
    !isTimelineMode &&
    practiceAnimationStyle.current === "intense"}
  class:practice-subtle={isPracticeStep &&
    !isTimelineMode &&
    practiceAnimationStyle.current === "subtle"}
  class:practice-glow-only={isPracticeStep &&
    !isTimelineMode &&
    practiceAnimationStyle.current === "glow-only"}
  class:practice-minimal={isPracticeStep &&
    !isTimelineMode &&
    practiceAnimationStyle.current === "minimal"}
  class:practice-wave={isPracticeStep &&
    !isTimelineMode &&
    practiceAnimationStyle.current === "wave"}
  class:highlighted={!!highlightStyle}
  class:long-pressing={isLongPressing}
  class:anim-gentleBloom={currentAnimationName === "gentleBloom"}
  class:anim-softCascade={currentAnimationName === "softCascade"}
  class:anim-springPop={currentAnimationName === "springPop"}
  class:anim-microFade={currentAnimationName === "microFade"}
  class:anim-glassBlur={currentAnimationName === "glassBlur"}
  style:--highlight-bg={highlightStyle?.bg}
  style:--highlight-border={highlightStyle?.border}
  onclick={handleClick}
  onkeydown={handleKeyDown}
  onpointerdown={handlePointerDown}
  onpointerup={handlePointerUp}
  onpointerleave={handlePointerLeave}
  onpointercancel={handlePointerCancel}
  oncontextmenu={handleContextMenu}
  onanimationend={handleAnimationEnd}
  role="button"
  tabindex="0"
  aria-label={ariaLabel}
>
  <!-- Normal pictograph (will show empty grid when step.isBlank) -->
  <!-- Always disable Svelte transitions to allow CSS transitions on props/arrows -->
  <!-- Duration is now rendered INSIDE the pictograph via DurationGlyph -->
  <PictographContainer
    pictographData={stepDataWithSelection}
    disableTransitions={true}
    propRenderContext="editor"
    {musicalPosition}
    {widthMultiplier}
    cellIndex={index}
    {bluePropTypeOverride}
    {redPropTypeOverride}
  />
</div>

<PictographContextMenuHost
  bind:this={contextMenuHost}
  onAdjustArrow={handleAdjustArrow}
  {showArrowAdjustment}
/>

{#if arrowModalOpen}
  <ArrowLayerModal
    bind:open={arrowModalOpen}
    stepData={step}
    arrowColor={arrowModalColor}
  />
{/if}

<style>
  .step-cell {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: 0;
    cursor: pointer;
    margin: 0;
    padding: 0;
    /* Fill parent container completely */
    width: 100%;
    height: 100%;

    /* Smooth deselection animation - morphs back from selected state */
    transform: scale(1);
    box-shadow: none;
    background: transparent;
    transition:
      transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 0.35s ease-out,
      border 0.35s ease-out,
      background 0.35s ease-out,
      opacity 0.25s ease-out;

    /* Prevent text selection during long-press */
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    touch-action: manipulation;
  }

  /* Default: pictograph maintains square aspect ratio */
  .step-cell :global(.pictograph-container) {
    aspect-ratio: 1;
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
  }

  /* Timeline mode: pictograph fills container, SVG viewBox handles aspect ratio */
  .step-cell.timeline-mode :global(.pictograph-container) {
    aspect-ratio: auto;
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
  }

  /* Disable transitions during entry animations to prevent conflicts */
  .step-cell.animate {
    transition: none;
  }

  /* Invisible state - step takes up space but pictograph is hidden */
  .step-cell.invisible {
    opacity: 0;
    pointer-events: none;
    /* Start smaller when invisible - animation will scale up from here */
    transform: scale(0.3);
  }

  /* Default animation (Spring Pop) */
  .step-cell.animate {
    animation: springPop var(--duration-dramatic)
      cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  /* Animation overrides based on selected animation */
  .step-cell.animate.anim-gentleBloom {
    animation: gentleBloom 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  }

  .step-cell.animate.anim-softCascade {
    animation: softCascade 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .step-cell.animate.anim-springPop {
    animation: springPop var(--duration-dramatic)
      cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  .step-cell.animate.anim-microFade {
    animation: microFade var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1)
      both;
  }

  .step-cell.animate.anim-glassBlur {
    animation: glassBlur 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  }

  .step-cell:hover {
    opacity: 0.9;
    transform: scale(1.02);
  }

  /* Subtle focus indicator for keyboard navigation */
  .step-cell:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.4);
    outline-offset: 2px;
  }

  /* Selected cells already have gold border - no additional outline needed */
  .step-cell.selected:focus-visible {
    outline: none;
  }

  /* Visual feedback during long-press */
  .step-cell.long-pressing {
    transform: scale(0.95);
    opacity: 0.8;
    transition:
      transform 0.15s ease-out,
      opacity 0.15s ease-out;
  }

  /* Elevated Luxury - 2025/2026 Selection State */
  .step-cell.selected {
    /* Ensure it appears above other steps */
    z-index: 10;
    position: relative;

    /* Gold gradient border - no background to keep pictograph visible */
    border: 3px solid transparent;
    background:
      linear-gradient(transparent, transparent) padding-box,
      linear-gradient(
          135deg,
          var(--semantic-warning),
          var(--semantic-warning),
          #d97706
        )
        border-box;
    border-radius: 12px;

    /* Layered shadows for depth and premium glow */
    box-shadow:
      0 0 20px rgba(251, 191, 36, 0.5),
      0 8px 32px rgba(251, 191, 36, 0.3),
      0 0 0 1px rgba(251, 191, 36, 0.2);

    /* Scale effect - expands equally on all sides */
    transform: scale(1.08);

    /* NO transparency - keep selected step fully opaque */
    opacity: 1;

    /* Smooth spring animation - longer duration for more noticeable fade-in */
    transition:
      transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 0.35s ease-out,
      border 0.35s ease-out,
      background 0.35s ease-out;
  }

  /* Selection fade-in animation using a pseudo-element for the glow */
  .step-cell.selected::before {
    content: "";
    position: absolute;
    inset: -6px;
    border: 3px solid transparent;
    background:
      linear-gradient(transparent, transparent) padding-box,
      linear-gradient(
          135deg,
          rgba(251, 191, 36, 0.8),
          rgba(251, 191, 36, 0.6),
          rgba(217, 119, 6, 0.6)
        )
        border-box;
    border-radius: 16px;
    opacity: 0;
    animation: selectionGlowIn 0.4s ease-out forwards;
    pointer-events: none;
    z-index: -1;
  }

  @keyframes selectionGlowIn {
    0% {
      opacity: 0;
      transform: scale(0.95);
    }
    50% {
      opacity: 0.8;
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* Selection styling DURING animation - border/glow visible while step animates in */
  .step-cell.animate.selected {
    z-index: 10;
    border: 3px solid transparent;
    background:
      linear-gradient(transparent, transparent) padding-box,
      linear-gradient(
          135deg,
          var(--semantic-warning),
          var(--semantic-warning),
          #d97706
        )
        border-box;
    border-radius: 12px;
    box-shadow:
      0 0 20px rgba(251, 191, 36, 0.5),
      0 8px 32px rgba(251, 191, 36, 0.3),
      0 0 0 1px rgba(251, 191, 36, 0.2);
    /* Let animation control transform/opacity, but show selection border/glow */
  }

  .step-cell.selected:hover {
    /* Keep fully opaque even on hover */
    opacity: 1;
    /* Hovered cell reads as closest, matching the non-selected hover tier */
    z-index: 11;
    transform: scale(1.12);
    box-shadow:
      0 0 30px rgba(251, 191, 36, 0.7),
      0 12px 48px rgba(251, 191, 36, 0.4),
      0 0 0 1px rgba(251, 191, 36, 0.3);
  }

  /* Custom highlight styling (multi-select, section highlighting, etc.) */
  .step-cell.highlighted {
    position: relative;
    z-index: 5;
    border: 3px solid var(--highlight-border, rgba(59, 130, 246, 0.8));
    border-radius: 8px;
    box-shadow: 0 0 16px var(--highlight-border, rgba(59, 130, 246, 0.5));
  }

  /* Colored overlay on top of pictograph content */
  .step-cell.highlighted::after {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--highlight-bg, rgba(59, 130, 246, 0.35));
    border-radius: 6px;
    pointer-events: none;
    z-index: 1;
  }

  .step-cell.highlighted:hover::after {
    background: var(--highlight-bg, rgba(59, 130, 246, 0.45));
  }

  /* =========================================================================
     PRACTICE STEP ANIMATION STYLES (TEMPORARY - for A/B testing)
     Toggle between styles using the button in ButtonPanel
     ========================================================================= */

  /* Base practice step styling - shared by all variants */
  .step-cell.practice-step {
    border: 3px solid var(--semantic-warning);
    border-radius: 8px;
    z-index: 10;
  }

  /* STYLE 1: INTENSE - pop with glow bloom (toned down to 80%) */
  .step-cell.practice-intense {
    background: rgba(251, 191, 36, 0.08);
    animation:
      practiceEnterIntense 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
      practiceGlowIntense 2s ease-in-out 0.25s infinite;
  }

  @keyframes practiceEnterIntense {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 rgba(251, 191, 36, 0);
    }
    50% {
      transform: scale(1.1);
      box-shadow:
        0 0 28px rgba(251, 191, 36, 0.8),
        0 0 56px rgba(251, 191, 36, 0.35);
    }
    100% {
      transform: scale(1.05);
      box-shadow:
        0 0 18px rgba(251, 191, 36, 0.55),
        0 0 36px rgba(251, 191, 36, 0.22);
    }
  }

  @keyframes practiceGlowIntense {
    0%,
    100% {
      box-shadow:
        0 0 18px rgba(251, 191, 36, 0.55),
        0 0 36px rgba(251, 191, 36, 0.22);
      transform: scale(1.05);
    }
    50% {
      box-shadow:
        0 0 24px rgba(251, 191, 36, 0.65),
        0 0 44px rgba(251, 191, 36, 0.28);
      transform: scale(1.07);
    }
  }

  /* STYLE 2: SUBTLE - gentle fade with slight scale */
  .step-cell.practice-subtle {
    background: rgba(251, 191, 36, 0.08);
    animation: practiceEnterSubtle var(--duration-emphasis) ease-out forwards;
    box-shadow:
      0 0 16px rgba(251, 191, 36, 0.5),
      0 0 32px rgba(251, 191, 36, 0.2);
    transform: scale(1.04);
  }

  @keyframes practiceEnterSubtle {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 rgba(251, 191, 36, 0);
      opacity: 0.7;
    }
    100% {
      transform: scale(1.04);
      box-shadow:
        0 0 16px rgba(251, 191, 36, 0.5),
        0 0 32px rgba(251, 191, 36, 0.2);
      opacity: 1;
    }
  }

  /* STYLE 3: GLOW-ONLY - no scale, just glow appears */
  .step-cell.practice-glow-only {
    background: transparent;
    transform: scale(1);
    animation: practiceEnterGlow var(--duration-normal) ease-out forwards;
  }

  @keyframes practiceEnterGlow {
    0% {
      box-shadow: 0 0 0 rgba(251, 191, 36, 0);
    }
    100% {
      box-shadow:
        0 0 20px rgba(251, 191, 36, 0.6),
        0 0 40px rgba(251, 191, 36, 0.25);
    }
  }

  /* STYLE 4: MINIMAL - quick fade, almost instant */
  .step-cell.practice-minimal {
    background: transparent;
    transform: scale(1.02);
    box-shadow: 0 0 12px rgba(251, 191, 36, 0.5);
    animation: practiceEnterMinimal var(--duration-instant) ease-out;
  }

  @keyframes practiceEnterMinimal {
    0% {
      opacity: 0.8;
    }
    100% {
      opacity: 1;
    }
  }

  /* STYLE 5: WAVE - expanding ring effect */
  .step-cell.practice-wave {
    background: rgba(251, 191, 36, 0.05);
    transform: scale(1.05);
    box-shadow: 0 0 16px rgba(251, 191, 36, 0.5);
    animation: practiceEnterWave var(--duration-dramatic) ease-out forwards;
  }

  .step-cell.practice-wave::before {
    content: "";
    position: absolute;
    inset: -4px;
    border: 2px solid rgba(251, 191, 36, 0.6);
    border-radius: 12px;
    animation: practiceRing 0.5s ease-out forwards;
    pointer-events: none;
  }

  @keyframes practiceEnterWave {
    0% {
      transform: scale(0.98);
      box-shadow: 0 0 0 rgba(251, 191, 36, 0);
    }
    100% {
      transform: scale(1.05);
      box-shadow: 0 0 16px rgba(251, 191, 36, 0.5);
    }
  }

  @keyframes practiceRing {
    0% {
      transform: scale(0.9);
      opacity: 1;
    }
    100% {
      transform: scale(1.15);
      opacity: 0;
    }
  }

  .step-cell.practice-step:hover {
    box-shadow:
      0 0 24px rgba(251, 191, 36, 0.7),
      0 0 48px rgba(251, 191, 36, 0.3);
  }

  /* FAVORITE: Gentle Bloom - soft float-up with blur */
  @keyframes gentleBloom {
    0% {
      transform: scale(0.7) translateY(10px);
      opacity: 0;
      filter: blur(2px);
    }
    60% {
      opacity: 0.8;
      filter: blur(0px);
    }
    100% {
      transform: scale(1) translateY(0);
      opacity: 1;
      filter: blur(0px);
    }
  }

  /* OPTION 2: Soft Cascade - smooth slide from left with fade */
  @keyframes softCascade {
    0% {
      transform: translateX(-20px) scale(0.9);
      opacity: 0;
    }
    50% {
      opacity: 0.6;
    }
    100% {
      transform: translateX(0) scale(1);
      opacity: 1;
    }
  }

  /* OPTION 3: Spring Pop - elastic bounce (TRENDY 2025!) */
  @keyframes springPop {
    0% {
      transform: scale(0.3);
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* OPTION 4: Micro Fade - minimal, fast, modern */
  @keyframes microFade {
    0% {
      transform: scale(0.95);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* OPTION 5: Glass Blur - glassmorphism trend */
  @keyframes glassBlur {
    0% {
      transform: scale(0.8);
      opacity: 0;
      filter: blur(8px);
      backdrop-filter: blur(0px);
    }
    100% {
      transform: scale(1);
      opacity: 1;
      filter: blur(0px);
      backdrop-filter: blur(4px);
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .animate {
      animation: none;
    }
    .step-cell.selected::before {
      animation: none;
      opacity: 1;
    }
    .anim-gentleBloom {
      animation: none;
    }
    .anim-softCascade {
      animation: none;
    }
    .anim-springPop {
      animation: none;
    }
    .anim-microFade {
      animation: none;
    }
    .anim-glassBlur {
      animation: none;
    }
    .practice-intense {
      animation: none;
    }
    .practice-subtle {
      animation: none;
    }
    .practice-glow-only {
      animation: none;
    }
    .practice-minimal {
      animation: none;
    }
    .practice-wave {
      animation: none;
    }
  }
</style>
