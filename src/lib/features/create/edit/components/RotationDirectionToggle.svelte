<!--
RotationDirectionToggle.svelte - Interactive toggle for rotation direction

Allows users to switch between:
- Clockwise (CW)
- Counter-Clockwise (CCW)

Based on legacy desktop app's prop_rot_dir_button_manager functionality.
Only shown when motion has turns > 0 and rotation direction is not NO_ROTATION.
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { onMount } from "svelte";

  // Props
  const {
    currentDirection,
    color,
    layoutMode = "comfortable",
    onDirectionChange,
  } = $props<{
    currentDirection: RotationDirection;
    color: "blue" | "red";
    layoutMode?: "compact" | "balanced" | "comfortable";
    onDirectionChange: (direction: RotationDirection) => void;
  }>();

  // Services
  let hapticService: IHapticFeedback;

  // Derived state
  const isClockwise = $derived(
    currentDirection === RotationDirection.CLOCKWISE
  );
  const isCounterClockwise = $derived(
    currentDirection === RotationDirection.COUNTER_CLOCKWISE
  );

  // Handlers
  function handleClockwiseClick() {
    if (currentDirection !== RotationDirection.CLOCKWISE) {
      hapticService?.trigger("selection");
      onDirectionChange(RotationDirection.CLOCKWISE);
    }
  }

  function handleCounterClockwiseClick() {
    if (currentDirection !== RotationDirection.COUNTER_CLOCKWISE) {
      hapticService?.trigger("selection");
      onDirectionChange(RotationDirection.COUNTER_CLOCKWISE);
    }
  }

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });
</script>

<div
  class="rotation-toggle"
  class:blue={color === "blue"}
  class:red={color === "red"}
  class:compact={layoutMode === "compact"}
  class:balanced={layoutMode === "balanced"}
  class:comfortable={layoutMode === "comfortable"}
  data-testid="rotation-direction-toggle"
>
  <!-- CCW Button on Left -->
  <button
    class="toggle-btn ccw"
    class:active={isCounterClockwise}
    onclick={handleCounterClockwiseClick}
    aria-label="Counter-clockwise rotation"
    aria-pressed={isCounterClockwise}
  >
    <i class="fas fa-undo" aria-hidden="true"></i>
    <span class="btn-text">CCW</span>
  </button>

  <!-- Label in Center -->
  <span class="toggle-label">Rotation</span>

  <!-- CW Button on Right -->
  <button
    class="toggle-btn cw"
    class:active={isClockwise}
    onclick={handleClockwiseClick}
    aria-label="Clockwise rotation"
    aria-pressed={isClockwise}
  >
    <i class="fas fa-redo" aria-hidden="true"></i>
    <span class="btn-text">CW</span>
  </button>
</div>

<style>
  .rotation-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(0, 0, 0, 0.08);
    border-radius: 8px;
    width: 100%;
  }

  /* Layout mode spacing */
  .rotation-toggle.compact {
    padding: 4px 8px;
    gap: 8px;
  }

  .rotation-toggle.balanced {
    padding: 6px 10px;
    gap: 10px;
  }

  .rotation-toggle.comfortable {
    padding: 8px 12px;
    gap: 12px;
  }

  .toggle-label {
    font-weight: 600;
    color: var(--theme-text-dim, #666);
    white-space: nowrap;
    flex: 1;
    text-align: center;
  }

  .rotation-toggle.compact .toggle-label {
    font-size: var(--font-size-compact);
  }

  .rotation-toggle.balanced .toggle-label {
    font-size: var(--font-size-compact);
  }

  .rotation-toggle.comfortable .toggle-label {
    font-size: var(--font-size-compact);
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 4px 10px;
    min-height: var(--min-touch-target, 48px); /* WCAG AAA touch target */
    border: 2px solid transparent;
    border-radius: 6px;
    background: var(--theme-card-bg, white);
    color: var(--theme-text-dim, #666);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .rotation-toggle.compact .toggle-btn {
    padding: 3px 8px;
    font-size: var(--font-size-compact);
    gap: 3px;
  }

  .rotation-toggle.balanced .toggle-btn {
    padding: 4px 9px;
    font-size: var(--font-size-compact);
    gap: 3px;
  }

  .rotation-toggle.comfortable .toggle-btn {
    padding: 4px 10px;
    font-size: var(--font-size-compact);
    gap: 4px;
  }

  /* Color-specific active states */
  .rotation-toggle.blue .toggle-btn.active {
    background: var(--semantic-info);
    border-color: var(--semantic-info);
    color: white;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  }

  .rotation-toggle.red .toggle-btn.active {
    background: var(--semantic-error);
    border-color: var(--semantic-error);
    color: white;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
  }

  .toggle-btn:hover:not(.active) {
    background: rgba(0, 0, 0, 0.05);
    transform: scale(1.05);
  }

  .toggle-btn:active {
    transform: scale(0.95);
  }

  .toggle-btn.active:hover {
    filter: brightness(1.1);
  }

  .toggle-btn i {
    font-size: 1em;
  }

  .btn-text {
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .toggle-btn:focus-visible {
    outline: 2px solid var(--theme-accent, rgba(139, 92, 246, 0.8));
    outline-offset: 2px;
  }

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .toggle-btn {
      transition: none;
    }

    .toggle-btn:hover:not(.active) {
      transform: none;
    }
  }

  /* Compact mode - hide text labels on very small screens */
  @container (max-width: 352px) {
    .btn-text {
      display: none;
    }

    .toggle-btn {
      padding: 6px 10px;
    }
  }
</style>
