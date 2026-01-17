<script lang="ts">
  import type { StepData } from "../../../domain/models/StepData";
  import type { BuildModeId } from "$lib/shared/foundation/ui/UITypes";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { practiceAnimationStyle } from "../../../state/practice-animation-style.svelte";

  let {
    beat,
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
  } = $props<{
    beat: StepData;
    index?: number;
    onClick?: () => void;
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
  }>();

  // Services
  const hapticService = container.items.hapticFeedback;

  const isStartPosition = $derived.by(() => {
    return beat.stepNumber === 0;
  });

  const displayBeatNumber = $derived.by(() => {
    return beat.stepNumber || index + 1;
  });

  const ariaLabel = $derived.by(() => {
    if (isStartPosition) {
      return "Start Position";
    }
    return `Beat ${displayBeatNumber} ${beat.isBlank ? "Empty" : "Pictograph"}`;
  });

  // Create beat data with selection state for the Pictograph component
  const stepDataWithSelection = $derived.by(() => {
    return {
      ...beat,
      isSelected,
    };
  });

  let hasAnimated = $state(false);
  let currentAnimationName = $state("gentleBloom");
  // Track previous beat ID for change detection
  let previousBeatId = "";

  // Long-press detection
  const LONG_PRESS_DURATION = 500; // ms
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let isLongPressing = $state(false);
  let longPressTriggered = $state(false);

  // Element ref for focus management
  let cellElement: HTMLDivElement;

  // Track when new pictograph data arrives for fade-in animation
  let enableTransitionsForNewData = $state(false);

  // Create a pictograph signature that represents the fundamental structure
  // independent of transformations (which only change arrow locations/rotations)
  function getPictographSignature(stepData: StepData): string {
    if (stepData.isBlank) return "blank";

    // Core structure: letter + which motion colors are present
    const hasBlue = !!stepData.motions?.blue;
    const hasRed = !!stepData.motions?.red;
    const motionStructure = `${hasBlue ? "B" : ""}${hasRed ? "R" : ""}`;

    return `${stepData.letter || "null"}-${motionStructure}`;
  }

  // Track previous signature for change detection
  let previousSignature = "";

  // Reset hasAnimated ONLY when the beat data itself changes (different beat loaded)
  // This prevents re-animating all steps when only one beat should animate
  $effect(() => {
    if (beat.id !== previousBeatId) {
      hasAnimated = false;
      previousBeatId = beat.id;
    }
  });

  // Enable fade transitions ONLY when loading a DIFFERENT beat (id changes)
  // Do NOT enable for transforms on the SAME beat (id stays same, letter/positions change)
  // Transforms should use CSS animations on props/arrows, not fade transitions
  let previousIdForTransitions = "";
  $effect(() => {
    const currentSignature = getPictographSignature(beat);
    const signatureChanged = currentSignature !== previousSignature;
    const idChanged = beat.id !== previousIdForTransitions;

    // Only enable fade transitions when loading genuinely different content
    // (id changed AND signature changed). Transforms keep same id.
    if (idChanged && signatureChanged && !beat.isBlank) {
      enableTransitionsForNewData = true;

      // Disable transitions after animation completes
      setTimeout(() => {
        enableTransitionsForNewData = false;
      }, 350); // Match pictograph fade-in duration
    }

    previousSignature = currentSignature;
    previousIdForTransitions = beat.id;
  });

  const shouldAnimateIn = $derived.by(() => {
    return shouldAnimate && !hasAnimated && !beat.isBlank;
  });

  // Steps should be invisible ONLY if they're waiting to animate
  const isVisible = $derived.by(() => {
    // If it should animate but hasn't yet, hide it (will become visible via animation)
    // This applies to ALL steps, including start position during generation
    if (shouldAnimate && !hasAnimated) return false;

    // Special case: Start position tile (index -1) should be visible even when blank
    // This shows the "Start" placeholder before a start position is selected
    if (index === -1) return true;

    // If it's a blank beat in the main grid, never show it
    if (beat.isBlank) return false;

    // Otherwise, show it (either it has animated, or it doesn't need to animate)
    return true;
  });

  function handleAnimationEnd() {
    hasAnimated = true;
  }

  // Listen for animation changes from the AnimationSelector
  onMount(() => {
    const handleAnimationChange = (event: CustomEvent) => {
      currentAnimationName = event.detail.animation;
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

  // Auto-focus when this cell becomes selected (e.g., after deleting another beat)
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

  function handleClick() {
    // Trigger haptic feedback for beat selection
    hapticService?.trigger("selection");
    onClick?.();
    // Focus the cell so keyboard events (Delete/Backspace) work immediately
    cellElement?.focus();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      // Enter activates the beat (accessibility)
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
      // Allow deletion if beat is selected (including start position)
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

  // Prevent context menu when long-press handler is active
  function handleContextMenu(event: MouseEvent) {
    if (onLongPress) {
      event.preventDefault();
    }
  }
</script>

<div
  bind:this={cellElement}
  class="beat-cell"
  class:invisible={!isVisible}
  class:animate={shouldAnimateIn}
  class:expanded={widthMultiplier > 1}
  class:timeline-mode={isTimelineMode}
  class:selected={isSelected && !isTimelineMode}
  class:practice-beat={isPracticeStep && !isTimelineMode}
  class:practice-intense={isPracticeStep && !isTimelineMode && practiceAnimationStyle.current === 'intense'}
  class:practice-subtle={isPracticeStep && !isTimelineMode && practiceAnimationStyle.current === 'subtle'}
  class:practice-glow-only={isPracticeStep && !isTimelineMode && practiceAnimationStyle.current === 'glow-only'}
  class:practice-minimal={isPracticeStep && !isTimelineMode && practiceAnimationStyle.current === 'minimal'}
  class:practice-wave={isPracticeStep && !isTimelineMode && practiceAnimationStyle.current === 'wave'}
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
  <!-- Normal pictograph (will show empty grid when beat.isBlank) -->
  <PictographContainer
    pictographData={stepDataWithSelection}
    disableTransitions={!enableTransitionsForNewData}
    {musicalPosition}
    {widthMultiplier}
  />
</div>

<style>
  .beat-cell {
    position: relative;
    display: flex;
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
    transition:
      transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 0.25s ease-out,
      opacity 0.15s ease-out;

    /* Prevent text selection during long-press */
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    touch-action: manipulation;
  }

  /* Default: pictograph maintains square aspect ratio */
  .beat-cell :global(.pictograph-container) {
    aspect-ratio: 1;
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
  }

  /* Timeline mode: pictograph fills container, SVG viewBox handles aspect ratio */
  .beat-cell.timeline-mode :global(.pictograph-container) {
    aspect-ratio: auto;
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
  }

  /* Disable transitions during entry animations to prevent conflicts */
  .beat-cell.animate {
    transition: none;
  }

  /* Invisible state - beat takes up space but pictograph is hidden */
  .beat-cell.invisible {
    opacity: 0;
    pointer-events: none;
    /* Start smaller when invisible - animation will scale up from here */
    transform: scale(0.3);
  }

  /* Default animation (Spring Pop) */
  .beat-cell.animate {
    animation: springPop var(--duration-dramatic) cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  /* Animation overrides based on selected animation */
  .beat-cell.animate.anim-gentleBloom {
    animation: gentleBloom 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  }

  .beat-cell.animate.anim-softCascade {
    animation: softCascade 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .beat-cell.animate.anim-springPop {
    animation: springPop var(--duration-dramatic) cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  .beat-cell.animate.anim-microFade {
    animation: microFade var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1) both;
  }

  .beat-cell.animate.anim-glassBlur {
    animation: glassBlur 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  }

  .beat-cell:hover {
    opacity: 0.9;
    transform: scale(1.02);
  }

  /* Override global focus-visible outline - selection styling is sufficient */
  .beat-cell:focus-visible {
    outline: none;
  }

  /* Visual feedback during long-press */
  .beat-cell.long-pressing {
    transform: scale(0.95);
    opacity: 0.8;
    transition:
      transform 0.15s ease-out,
      opacity 0.15s ease-out;
  }

  /* Elevated Luxury - 2025/2026 Selection State */
  .beat-cell.selected {
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

    /* NO transparency - keep selected beat fully opaque */
    opacity: 1;

    /* Smooth spring animation */
    transition: all var(--duration-emphasis) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  /* Selection styling DURING animation - border/glow visible while beat animates in */
  .beat-cell.animate.selected {
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

  .beat-cell.selected:hover {
    /* Keep fully opaque even on hover */
    opacity: 1;
    transform: scale(1.12);
    box-shadow:
      0 0 30px rgba(251, 191, 36, 0.7),
      0 12px 48px rgba(251, 191, 36, 0.4),
      0 0 0 1px rgba(251, 191, 36, 0.3);
  }

  /* Custom highlight styling (multi-select, section highlighting, etc.) */
  .beat-cell.highlighted {
    position: relative;
    z-index: 5;
    border: 3px solid var(--highlight-border, rgba(59, 130, 246, 0.8));
    border-radius: 8px;
    box-shadow: 0 0 16px var(--highlight-border, rgba(59, 130, 246, 0.5));
  }

  /* Colored overlay on top of pictograph content */
  .beat-cell.highlighted::after {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--highlight-bg, rgba(59, 130, 246, 0.35));
    border-radius: 6px;
    pointer-events: none;
    z-index: 1;
  }

  .beat-cell.highlighted:hover::after {
    background: var(--highlight-bg, rgba(59, 130, 246, 0.45));
  }

  /* =========================================================================
     PRACTICE STEP ANIMATION STYLES (TEMPORARY - for A/B testing)
     Toggle between styles using the button in ButtonPanel
     ========================================================================= */

  /* Base practice beat styling - shared by all variants */
  .beat-cell.practice-beat {
    border: 3px solid var(--semantic-warning);
    border-radius: 8px;
    z-index: 10;
  }

  /* STYLE 1: INTENSE - pop with glow bloom (toned down to 80%) */
  .beat-cell.practice-intense {
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
      transform: scale(1.10);
      box-shadow: 0 0 28px rgba(251, 191, 36, 0.8), 0 0 56px rgba(251, 191, 36, 0.35);
    }
    100% {
      transform: scale(1.05);
      box-shadow: 0 0 18px rgba(251, 191, 36, 0.55), 0 0 36px rgba(251, 191, 36, 0.22);
    }
  }

  @keyframes practiceGlowIntense {
    0%, 100% {
      box-shadow: 0 0 18px rgba(251, 191, 36, 0.55), 0 0 36px rgba(251, 191, 36, 0.22);
      transform: scale(1.05);
    }
    50% {
      box-shadow: 0 0 24px rgba(251, 191, 36, 0.65), 0 0 44px rgba(251, 191, 36, 0.28);
      transform: scale(1.07);
    }
  }

  /* STYLE 2: SUBTLE - gentle fade with slight scale */
  .beat-cell.practice-subtle {
    background: rgba(251, 191, 36, 0.08);
    animation: practiceEnterSubtle var(--duration-emphasis) ease-out forwards;
    box-shadow: 0 0 16px rgba(251, 191, 36, 0.5), 0 0 32px rgba(251, 191, 36, 0.2);
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
      box-shadow: 0 0 16px rgba(251, 191, 36, 0.5), 0 0 32px rgba(251, 191, 36, 0.2);
      opacity: 1;
    }
  }

  /* STYLE 3: GLOW-ONLY - no scale, just glow appears */
  .beat-cell.practice-glow-only {
    background: transparent;
    transform: scale(1);
    animation: practiceEnterGlow var(--duration-normal) ease-out forwards;
  }

  @keyframes practiceEnterGlow {
    0% {
      box-shadow: 0 0 0 rgba(251, 191, 36, 0);
    }
    100% {
      box-shadow: 0 0 20px rgba(251, 191, 36, 0.6), 0 0 40px rgba(251, 191, 36, 0.25);
    }
  }

  /* STYLE 4: MINIMAL - quick fade, almost instant */
  .beat-cell.practice-minimal {
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
  .beat-cell.practice-wave {
    background: rgba(251, 191, 36, 0.05);
    transform: scale(1.05);
    box-shadow: 0 0 16px rgba(251, 191, 36, 0.5);
    animation: practiceEnterWave var(--duration-dramatic) ease-out forwards;
  }

  .beat-cell.practice-wave::before {
    content: '';
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

  .beat-cell.practice-beat:hover {
    box-shadow: 0 0 24px rgba(251, 191, 36, 0.7), 0 0 48px rgba(251, 191, 36, 0.3);
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
    /* Disable local keyframe animations */
    [style*="practiceEnterIntense"] {
      animation: none;
    }
    [style*="practiceGlowIntense"] {
      animation: none;
    }
    [style*="practiceEnterSubtle"] {
      animation: none;
    }
    [style*="practiceEnterGlow"] {
      animation: none;
    }
    [style*="practiceEnterMinimal"] {
      animation: none;
    }
    [style*="practiceEnterWave"] {
      animation: none;
    }
    [style*="practiceRing"] {
      animation: none;
    }
    [style*="gentleBloom"] {
      animation: none;
    }
    [style*="softCascade"] {
      animation: none;
    }
    [style*="springPop"] {
      animation: none;
    }
    [style*="microFade"] {
      animation: none;
    }
    [style*="glassBlur"] {
      animation: none;
    }
  }
</style>
