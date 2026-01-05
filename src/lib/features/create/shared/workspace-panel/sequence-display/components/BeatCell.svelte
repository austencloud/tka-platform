<script lang="ts">
  import type { BeatData } from "../../../domain/models/BeatData";
  import type { BuildModeId } from "$lib/shared/foundation/ui/UITypes";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";

  let {
    beat,
    index = 0,
    onClick,
    onDelete,
    onLongPress,
    shouldAnimate = false,
    isSelected = false,
    isPracticeBeat = false,
    // Active mode for context-aware messaging
    activeMode = null,
    // Custom highlight style (for multi-select, section highlighting, etc.)
    highlightStyle = null,
  } = $props<{
    beat: BeatData;
    index?: number;
    onClick?: () => void;
    onDelete?: () => void;
    onLongPress?: () => void;
    shouldAnimate?: boolean;
    isSelected?: boolean;
    isPracticeBeat?: boolean;
    // Active mode
    activeMode?: BuildModeId | null;
    // Custom highlight style
    highlightStyle?: { bg: string; border: string } | null;
  }>();

  // Services
  let hapticService: IHapticFeedback;

  onMount(() => {
    hapticService = resolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  const isStartPosition = $derived.by(() => {
    return beat.beatNumber === 0;
  });

  const displayBeatNumber = $derived.by(() => {
    return beat.beatNumber || index + 1;
  });

  const ariaLabel = $derived.by(() => {
    if (isStartPosition) {
      return "Start Position";
    }
    return `Beat ${displayBeatNumber} ${beat.isBlank ? "Empty" : "Pictograph"}`;
  });

  // Create beat data with selection state for the Pictograph component
  const beatDataWithSelection = $derived.by(() => {
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
  function getPictographSignature(beatData: BeatData): string {
    if (beatData.isBlank) return "blank";

    // Core structure: letter + which motion colors are present
    const hasBlue = !!beatData.motions?.blue;
    const hasRed = !!beatData.motions?.red;
    const motionStructure = `${hasBlue ? "B" : ""}${hasRed ? "R" : ""}`;

    return `${beatData.letter || "null"}-${motionStructure}`;
  }

  // Track previous signature for change detection
  let previousSignature = "";

  // Reset hasAnimated ONLY when the beat data itself changes (different beat loaded)
  // This prevents re-animating all beats when only one beat should animate
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

  // Beats should be invisible ONLY if they're waiting to animate
  const isVisible = $derived.by(() => {
    // If it should animate but hasn't yet, hide it (will become visible via animation)
    // This applies to ALL beats, including start position during generation
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
      console.log(`🎨 BeatCell: Animation changed to ${currentAnimationName}`);
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
  // This enables continuous Delete key presses to delete beats one by one
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
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      // Trigger haptic feedback for keyboard interaction
      hapticService?.trigger("selection");
      onClick?.();
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
  class:selected={isSelected}
  class:practice-beat={isPracticeBeat}
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
    pictographData={beatDataWithSelection}
    disableTransitions={!enableTransitionsForNewData}
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
    animation: springPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  /* Animation overrides based on selected animation */
  .beat-cell.animate.anim-gentleBloom {
    animation: gentleBloom 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  }

  .beat-cell.animate.anim-softCascade {
    animation: softCascade 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .beat-cell.animate.anim-springPop {
    animation: springPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  .beat-cell.animate.anim-microFade {
    animation: microFade 0.25s cubic-bezier(0.4, 0, 0.2, 1) both;
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
    /* Ensure it appears above other beats */
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
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
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

  /* Practice beat styling - gold border with pulse animation */
  .beat-cell.practice-beat {
    border: 3px solid var(--semantic-warning);
    border-radius: 8px;
    background: rgba(251, 191, 36, 0.15);
    box-shadow: 0 0 20px rgba(251, 191, 36, 0.6);
    transform: scale(1.1);
    animation: practicePulse 1s ease-in-out infinite;
    z-index: 10;
  }

  .beat-cell.practice-beat:hover {
    transform: scale(1.12);
    box-shadow: 0 0 24px rgba(251, 191, 36, 0.8);
  }

  @keyframes practicePulse {
    0%,
    100% {
      box-shadow: 0 0 20px rgba(251, 191, 36, 0.6);
      transform: scale(1.1);
    }
    50% {
      box-shadow: 0 0 30px rgba(251, 191, 36, 0.9);
      transform: scale(1.12);
    }
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
</style>
