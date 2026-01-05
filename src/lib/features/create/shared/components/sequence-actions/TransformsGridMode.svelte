<!--
  TransformsGridMode.svelte

  Grid of transform action buttons: Mirror, Swap, Rotate, Reverse, Preview, Edit.
  Supports help mode where clicking buttons shows educational content instead of applying transforms.
-->
<script lang="ts">
  type TransformId = "mirror" | "flip" | "invert" | "rotate" | "swap" | "rewind";

  interface Props {
    hasSequence: boolean;
    hasSelection: boolean;
    isTransforming: boolean;
    canExtend?: boolean;
    isExtending?: boolean;
    canShiftStart?: boolean;
    /** Disable swap button (only works when both hands are selected) */
    swapDisabled?: boolean;
    showEditInConstructor: boolean;
    /** True when panel is desktop side-panel (2 cols), false for mobile bottom drawer (3 cols) */
    isDesktopPanel?: boolean;
    /** True to use compact horizontal layout (icon left, text right) for very small screens */
    compactMode?: boolean;
    /** True when help mode is active - buttons show help instead of applying transforms */
    helpMode?: boolean;
    /** Callback when a transform is selected in help mode */
    onHelpSelect?: (transformId: TransformId) => void;
    onTurns: () => void;
    onMirror: () => void;
    onFlip: () => void;
    onInvert: () => void;
    onRotateCW: () => void;
    onRotateCCW: () => void;
    onSwap: () => void;
    onRewind: () => void;
    onTurnPattern: () => void;
    onRotationDirection: () => void;
    onExtend?: () => void;
    onShiftStart?: () => void;
    onEditInConstructor: () => void;
  }

  let {
    hasSequence,
    hasSelection = false,
    isTransforming,
    canExtend = false,
    isExtending = false,
    canShiftStart = false,
    swapDisabled = false,
    showEditInConstructor,
    isDesktopPanel = false,
    compactMode = false,
    helpMode = false,
    onHelpSelect,
    onTurns,
    onMirror,
    onFlip,
    onInvert,
    onRotateCW,
    onRotateCCW,
    onSwap,
    onRewind,
    onTurnPattern,
    onRotationDirection,
    onExtend,
    onShiftStart,
    onEditInConstructor,
  }: Props = $props();

  // In help mode, clicking a transform button shows help instead of applying
  function handleTransformClick(transformId: TransformId, normalAction: () => void) {
    if (helpMode && onHelpSelect) {
      onHelpSelect(transformId);
    } else {
      normalAction();
    }
  }

  const disabled = $derived(isTransforming || isExtending || !hasSequence);

  // Calculate how many items are in each section for dynamic flex ratios
  // Transform: always 6 items
  const transformItemCount = 6;

  // Patterns: Turn Pattern + Direction + Rewind (always) + Extend (conditional) + Shift Start (conditional)
  const patternsItemCount = $derived(
    3 + // Turn Pattern, Direction, Rewind (always present)
      (onExtend && canExtend ? 1 : 0) +
      (onShiftStart ? 1 : 0)
  );

  // Edit: Edit Turns (always) + Constructor (conditional)
  const editItemCount = $derived(1 + (showEditInConstructor ? 1 : 0));

  // Calculate row counts based on grid columns
  // Desktop: 2 columns, Mobile: 3 columns
  const getRowCount = (items: number, cols: number) => Math.ceil(items / cols);

  // Column count depends on mode (mobile=3, desktop=2)
  const gridCols = $derived(isDesktopPanel ? 2 : 3);

  // Dynamic flex values based on row counts
  const transformFlex = $derived(getRowCount(transformItemCount, gridCols));
  const patternsFlex = $derived(getRowCount(patternsItemCount, gridCols));
  const editFlex = $derived(getRowCount(editItemCount, gridCols));
</script>

<div
  class="actions-container"
  class:disabled
  class:desktop={isDesktopPanel}
  class:mobile={!isDesktopPanel}
  class:compact={compactMode}
>
  <!-- TRANSFORM Section -->
  <section class="section transform-section" style:flex={transformFlex}>
    <span class="section-label">Transform</span>
    <div class="section-grid">
      <button
        class="grid-btn mirror"
        class:help-active={helpMode}
        onclick={() => handleTransformClick("mirror", onMirror)}
        disabled={disabled && !helpMode}
        aria-label={helpMode ? "Learn about Mirror" : "Mirror sequence: flip left and right"}
      >
        <div class="btn-icon">
          <i class="fas fa-left-right" aria-hidden="true"></i>
        </div>
        <div class="btn-text">
          <span class="btn-label">Mirror</span>
          <span class="btn-desc">Flip left & right</span>
        </div>
      </button>
      <button
        class="grid-btn flip"
        class:help-active={helpMode}
        onclick={() => handleTransformClick("flip", onFlip)}
        disabled={disabled && !helpMode}
        aria-label={helpMode ? "Learn about Flip" : "Flip sequence: flip up and down"}
      >
        <div class="btn-icon">
          <i class="fas fa-up-down" aria-hidden="true"></i>
        </div>
        <div class="btn-text">
          <span class="btn-label">Flip</span>
          <span class="btn-desc">Flip up & down</span>
        </div>
      </button>
      <button
        class="grid-btn swap"
        class:unavailable={swapDisabled && !helpMode}
        class:help-active={helpMode}
        onclick={() => handleTransformClick("swap", onSwap)}
        disabled={(disabled || swapDisabled) && !helpMode}
        aria-label={helpMode
          ? "Learn about Swap Hands"
          : swapDisabled
            ? "Swap requires both hands selected"
            : "Swap hands in sequence"}
      >
        <div class="btn-icon">
          <i class="fas fa-arrows-rotate" aria-hidden="true"></i>
        </div>
        <div class="btn-text">
          <span class="btn-label">Swap</span>
          <span class="btn-desc"
            >{swapDisabled ? "Needs both hands" : "Switch hands"}</span
          >
        </div>
      </button>
      <button
        class="grid-btn invert"
        class:help-active={helpMode}
        onclick={() => handleTransformClick("invert", onInvert)}
        disabled={disabled && !helpMode}
        aria-label={helpMode ? "Learn about Invert" : "Invert sequence: reverse turn directions"}
      >
        <div class="btn-icon">
          <i class="fas fa-repeat" aria-hidden="true"></i>
        </div>
        <div class="btn-text">
          <span class="btn-label">Invert</span>
          <span class="btn-desc">Reverse turns</span>
        </div>
      </button>
      <button
        class="grid-btn rotate-ccw"
        class:help-active={helpMode}
        onclick={() => handleTransformClick("rotate", onRotateCCW)}
        disabled={disabled && !helpMode}
        aria-label={helpMode ? "Learn about Rotate" : "Rotate sequence left 45 degrees"}
      >
        <div class="btn-icon">
          <i class="fas fa-rotate-left" aria-hidden="true"></i>
        </div>
        <div class="btn-text">
          <span class="btn-label">Rotate L</span>
          <span class="btn-desc">Pivot 45°</span>
        </div>
      </button>
      <button
        class="grid-btn rotate-cw"
        class:help-active={helpMode}
        onclick={() => handleTransformClick("rotate", onRotateCW)}
        disabled={disabled && !helpMode}
        aria-label={helpMode ? "Learn about Rotate" : "Rotate sequence right 45 degrees"}
      >
        <div class="btn-icon">
          <i class="fas fa-rotate-right" aria-hidden="true"></i>
        </div>
        <div class="btn-text">
          <span class="btn-label">Rotate R</span>
          <span class="btn-desc">Pivot 45°</span>
        </div>
      </button>
    </div>
  </section>

  <!-- PATTERNS Section -->
  <section class="section patterns-section" style:flex={patternsFlex}>
    <span class="section-label">Patterns</span>
    <div class="section-grid">
      <button
        class="grid-btn turn-pattern"
        onclick={onTurnPattern}
        disabled={!hasSequence}
        aria-label="Apply turn pattern to sequence"
      >
        <div class="btn-icon">
          <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
        </div>
        <div class="btn-text">
          <span class="btn-label">Turn Pattern</span>
          <span class="btn-desc">Apply patterns</span>
        </div>
      </button>
      <button
        class="grid-btn direction"
        onclick={onRotationDirection}
        disabled={!hasSequence}
        aria-label="Apply rotation direction pattern (clockwise or counter-clockwise)"
      >
        <div class="btn-icon">
          <i class="fas fa-compass" aria-hidden="true"></i>
        </div>
        <div class="btn-text">
          <span class="btn-label">Direction</span>
          <span class="btn-desc">CW/CCW patterns</span>
        </div>
      </button>
      {#if onExtend && canExtend}
        <button
          class="grid-btn extend"
          onclick={onExtend}
          disabled={!hasSequence || isExtending}
          aria-label={isExtending
            ? "Extending sequence"
            : "Extend sequence back to starting position"}
        >
          <div class="btn-icon">
            {#if isExtending}
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            {:else}
              <i class="fas fa-circle-check" aria-hidden="true"></i>
            {/if}
          </div>
          <div class="btn-text">
            <span class="btn-label">{isExtending ? "..." : "Extend"}</span>
            <span class="btn-desc">Complete to start</span>
          </div>
        </button>
      {/if}
      {#if onShiftStart}
        <button
          class="grid-btn shift-start"
          class:unavailable={!canShiftStart}
          onclick={onShiftStart}
          disabled={!hasSequence || isTransforming || !canShiftStart}
          aria-label="Pick new first beat: change where the sequence starts"
        >
          <div class="btn-icon">
            <i class="fas fa-forward" aria-hidden="true"></i>
          </div>
          <div class="btn-text">
            <span class="btn-label">First Beat</span>
            <span class="btn-desc">Pick new beat 1</span>
          </div>
        </button>
      {/if}
      <button
        class="grid-btn rewind"
        class:help-active={helpMode}
        onclick={() => handleTransformClick("rewind", onRewind)}
        disabled={disabled && !helpMode}
        aria-label={helpMode ? "Learn about Rewind" : "Rewind: add reversed sequence to the end"}
      >
        <div class="btn-icon">
          <i class="fas fa-backward" aria-hidden="true"></i>
        </div>
        <div class="btn-text">
          <span class="btn-label">Rewind</span>
          <span class="btn-desc">Add reverse to end</span>
        </div>
      </button>
    </div>
  </section>

  <!-- EDIT Section -->
  <section class="section edit-section" style:flex={editFlex}>
    <span class="section-label">Edit</span>
    <div class="section-grid">
      <button
        class="grid-btn edit-turns"
        class:highlighted={hasSelection}
        onclick={onTurns}
        disabled={!hasSelection}
        aria-label={hasSelection
          ? "Edit turns for selected beat"
          : "Edit turns: select a beat first"}
      >
        <div class="btn-icon">
          <i class="fas fa-sliders-h" aria-hidden="true"></i>
        </div>
        <div class="btn-text">
          <span class="btn-label">Edit Turns</span>
          <span class="btn-desc"
            >{hasSelection ? "Adjust rotation" : "Select beat first"}</span
          >
        </div>
      </button>
      {#if showEditInConstructor}
        <button
          class="grid-btn constructor"
          onclick={onEditInConstructor}
          disabled={!hasSequence}
          data-testid="edit-in-constructor"
          aria-label="Open sequence in constructor for full editing"
        >
          <div class="btn-icon">
            <i class="fas fa-pen-to-square" aria-hidden="true"></i>
          </div>
          <div class="btn-text">
            <span class="btn-label">Constructor</span>
            <span class="btn-desc">Full editor</span>
          </div>
        </button>
      {/if}
    </div>
  </section>
</div>

<style>
  /* ===== CONTAINER - Flex column with uniform button heights ===== */
  .actions-container {
    --button-row-height: 1fr;
    display: flex;
    flex-direction: column;
    gap: 6px;
    height: 100%;
    overflow: hidden;
  }

  .actions-container.disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  /* ===== SECTIONS ===== */
  .section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 0;
    /* flex is applied dynamically via inline style based on item count */
  }

  .section-label {
    font-size: var(--font-size-compact);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(255, 255, 255, 0.35);
    padding-left: 4px;
    flex-shrink: 0;
  }

  /* ===== SECTION GRID ===== */
  .section-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-auto-rows: 1fr;
    gap: 6px;
    flex: 1;
    min-height: 0;
  }

  /* ===== MOBILE MODE: 3 columns, compact buttons ===== */
  /* Note: flex values are applied dynamically via inline styles based on item count */
  .actions-container.mobile .section-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }

  /* ===== BUTTON BASE STYLES ===== */
  .grid-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 8px;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: center;
    min-height: var(--min-touch-target, 44px);
    container-type: size;
  }

  .grid-btn:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .grid-btn:active:not(:disabled) {
    transform: scale(0.97);
    transition-duration: 50ms;
  }

  .btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 10px;
    font-size: var(--font-size-lg);
    flex-shrink: 0;
    color: white;
  }

  .btn-text {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
    width: 100%;
  }

  .btn-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .btn-desc {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.65);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  /* Mobile mode: hide descriptions, smaller icons */
  .actions-container.mobile .grid-btn {
    padding: 8px 4px;
    gap: 4px;
  }
  .actions-container.mobile .btn-desc {
    display: none;
  }
  .actions-container.mobile .btn-icon {
    width: 36px;
    height: 36px;
    font-size: var(--font-size-base);
  }
  .actions-container.mobile .btn-label {
    font-size: var(--font-size-compact, 12px);
  }

  /* Taller buttons: larger icons and text */
  @container (min-height: 90px) {
    .btn-icon {
      width: 48px;
      height: 48px;
      font-size: var(--font-size-xl);
    }
    .btn-label {
      font-size: var(--font-size-md, 16px);
    }
    .btn-desc {
      font-size: var(--font-size-compact, 12px);
    }
  }

  /* ===== BUTTON COLORS - CSS custom properties for each button ===== */
  .grid-btn.mirror {
    --btn-color: 139, 92, 246;
  } /* Purple */
  .grid-btn.flip {
    --btn-color: 99, 102, 241;
  } /* Indigo */
  .grid-btn.swap {
    --btn-color: 16, 185, 129;
  } /* Emerald */
  .grid-btn.invert {
    --btn-color: 245, 158, 11;
  } /* Amber */
  .grid-btn.rotate-ccw,
  .grid-btn.rotate-cw {
    --btn-color: 249, 115, 22;
  } /* Orange */
  .grid-btn.rewind {
    --btn-color: 244, 63, 94;
  } /* Rose */
  .grid-btn.turn-pattern {
    --btn-color: 20, 184, 166;
  } /* Teal */
  .grid-btn.direction {
    --btn-color: 14, 165, 233;
  } /* Sky */
  .grid-btn.extend {
    --btn-color: 34, 197, 94;
  } /* Green */
  .grid-btn.shift-start {
    --btn-color: 6, 182, 212;
  } /* Cyan */
  .grid-btn.edit-turns {
    --btn-color: 59, 130, 246;
  } /* Blue */
  .grid-btn.constructor {
    --btn-color: 124, 58, 237;
  } /* Violet */

  /* ===== SHARED COLOR APPLICATION - applies --btn-color to all buttons ===== */
  .grid-btn[class] {
    background: linear-gradient(
      135deg,
      rgba(var(--btn-color), 0.15),
      rgba(var(--btn-color), 0.05)
    );
    border: 1px solid rgba(var(--btn-color), 0.3);
  }

  .grid-btn[class]:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      rgba(var(--btn-color), 0.25),
      rgba(var(--btn-color), 0.1)
    );
    border-color: rgba(var(--btn-color), 0.5);
    box-shadow: 0 4px 16px rgba(var(--btn-color), 0.2);
  }

  .grid-btn[class] .btn-icon {
    background: rgb(var(--btn-color));
  }

  /* ===== SPECIAL STATES ===== */

  /* Shift Start unavailable */
  .grid-btn.shift-start.unavailable {
    --btn-color: 100, 100, 100;
    opacity: 0.5;
  }
  .grid-btn.shift-start.unavailable .btn-icon {
    background: rgba(100, 100, 100, 0.4);
  }

  /* Swap unavailable (single-hand mode) */
  .grid-btn.swap.unavailable {
    --btn-color: 100, 100, 100;
    opacity: 0.5;
  }
  .grid-btn.swap.unavailable .btn-icon {
    background: rgba(100, 100, 100, 0.4);
  }

  /* Edit Turns highlighted (beat selected) */
  .grid-btn.edit-turns.highlighted {
    background: linear-gradient(
      135deg,
      rgba(var(--btn-color), 0.25),
      rgba(var(--btn-color), 0.12)
    );
    border: 2px solid rgba(var(--btn-color), 0.6);
    box-shadow: 0 0 16px rgba(var(--btn-color), 0.2);
  }
  .grid-btn.edit-turns.highlighted:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      rgba(var(--btn-color), 0.35),
      rgba(var(--btn-color), 0.18)
    );
    border-color: rgba(var(--btn-color), 0.8);
  }

  @media (prefers-reduced-motion: reduce) {
    .grid-btn {
      transition: none;
    }
    .grid-btn:active:not(:disabled) {
      transform: none;
    }
  }

  /* ===== HELP MODE ACTIVE STATE ===== */
  .grid-btn.help-active {
    opacity: 1 !important;
    cursor: help;
    animation: help-pulse 1.5s ease-in-out infinite;
    position: relative;
  }

  .grid-btn.help-active::after {
    content: "";
    position: absolute;
    inset: -2px;
    border-radius: 14px;
    border: 2px solid rgba(59, 130, 246, 0.5);
    pointer-events: none;
    animation: border-pulse 1.5s ease-in-out infinite;
  }

  @keyframes help-pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.3);
    }
    50% {
      box-shadow: 0 0 12px 2px rgba(59, 130, 246, 0.4);
    }
  }

  @keyframes border-pulse {
    0%,
    100% {
      border-color: rgba(59, 130, 246, 0.3);
    }
    50% {
      border-color: rgba(59, 130, 246, 0.7);
    }
  }

  /* ===== COMPACT MODE: Horizontal layout for very small screens ===== */
  .actions-container.compact .grid-btn {
    flex-direction: row;
    justify-content: flex-start;
    text-align: left;
    gap: 8px;
    padding: 6px 10px;
  }

  .actions-container.compact .btn-text {
    align-items: flex-start;
  }

  .actions-container.compact .btn-icon {
    width: 26px;
    height: 26px;
    font-size: var(--font-size-compact);
    border-radius: 6px;
  }

  .actions-container.compact .btn-label {
    font-size: 0.7rem;
  }

  /* Compact mode: TRANSFORM section uses 3 columns */
  .actions-container.compact .transform-section .section-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  /* Compact mode: PATTERNS section uses mixed grid for long labels */
  .actions-container.compact .patterns-section .section-grid {
    grid-template-columns: repeat(6, 1fr);
  }

  .actions-container.compact .patterns-section .grid-btn {
    grid-column: span 2;
    order: 1;
  }

  /* Long labels get more space and appear last */
  .actions-container.compact .patterns-section .grid-btn.turn-pattern,
  .actions-container.compact .patterns-section .grid-btn.extend {
    grid-column: span 3;
    order: 2;
  }

  /* Compact mode: EDIT section uses 2 columns */
  .actions-container.compact .edit-section .section-grid {
    grid-template-columns: repeat(2, 1fr);
  }
</style>
