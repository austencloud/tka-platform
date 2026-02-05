<!-- RotationOverrideButton.svelte - Toggle rotation override for DASH/STATIC arrows -->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { rotationOverrideManager } from "$lib/shared/pictograph/arrow/positioning/placement/services/implementations/RotationOverrideManager";
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import { onMount } from "svelte";

  let hapticService: IHapticFeedback;

  // Props
  const {
    stepData,
    arrowColor = "blue",
    disabled = false,
  } = $props<{
    stepData: StepData | null;
    arrowColor?: "red" | "blue";
    disabled?: boolean;
  }>();

  // State
  let isOverrideActive = $state(false);
  let isProcessing = $state(false);
  let canOverride = $state(false);

  // Check if override is allowed and active when beat data changes
  $effect(() => {
    if (stepData) {
      updateOverrideStatus();
    }
  });

  async function updateOverrideStatus() {
    if (!stepData || !rotationOverrideManager) return;

    const motion =
      arrowColor === "blue" ? stepData.motions?.blue : stepData.motions?.red;
    if (!motion) {
      canOverride = false;
      isOverrideActive = false;
      return;
    }

    // Check if this motion type supports rotation override (DASH/STATIC only)
    const motionType = motion.motionType?.toLowerCase();
    canOverride = motionType === "dash" || motionType === "static";

    if (canOverride) {
      try {
        isOverrideActive = await rotationOverrideManager.hasRotationOverride(
          motion,
          stepData
        );
      } catch (error) {
        console.error("Failed to check rotation override status:", error);
        isOverrideActive = false;
      }
    } else {
      isOverrideActive = false;
    }
  }

  async function handleToggleOverride() {
    if (!stepData || !canOverride || isProcessing || disabled) return;

    const motion =
      arrowColor === "blue" ? stepData.motions?.blue : stepData.motions?.red;
    if (!motion) return;

    isProcessing = true;
    hapticService?.trigger("selection");

    try {
      const newState = await rotationOverrideManager.toggleRotationOverride(
        motion,
        stepData
      );
      isOverrideActive = newState;

      // Force pictograph refresh by triggering a custom event
      window.dispatchEvent(
        new CustomEvent("rotation-override-changed", {
          detail: { stepData, arrowColor, isActive: newState },
        })
      );
    } catch (error) {
      console.error("Failed to toggle rotation override:", error);
    } finally {
      isProcessing = false;
    }
  }

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });
</script>

{#if canOverride}
  <button
    class="rotation-override-button"
    class:active={isOverrideActive}
    class:processing={isProcessing}
    disabled={disabled || isProcessing}
    onclick={handleToggleOverride}
    title={isOverrideActive
      ? "Rotation override active (press X to toggle)"
      : "Enable rotation override (press X)"}
    data-testid="rotation-override-button"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path
        d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
      ></path>
      <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
      <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
      <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
    <span class="label">Override</span>
    <span class="kbd-hint">X</span>
  </button>
{/if}

<style>
  .rotation-override-button {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--theme-card-bg);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--border-radius);
    color: var(--muted-foreground);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-size: var(--font-size-sm);
    font-weight: 500;
    min-height: var(--min-touch-target);
  }

  .rotation-override-button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
    color: var(--foreground);
  }

  .rotation-override-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .rotation-override-button.active {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-foreground);
  }

  .rotation-override-button.active:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 80%, white);
  }

  .rotation-override-button.processing {
    opacity: 0.6;
    cursor: wait;
  }

  .rotation-override-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .rotation-override-button svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .label {
    flex: 1;
    text-align: left;
  }

  .kbd-hint {
    font-size: var(--font-size-xs);
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    font-family: monospace;
    opacity: 0.7;
  }

  .rotation-override-button.active .kbd-hint {
    background: rgba(255, 255, 255, 0.2);
    opacity: 1;
  }

  .rotation-override-button:focus-visible {
    outline: 2px solid var(--theme-accent, rgba(139, 92, 246, 0.8));
    outline-offset: 2px;
  }

  /* Accessibility: Respect user's motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .rotation-override-button {
      transition: none;
    }

    .rotation-override-button:active:not(:disabled) {
      transform: none;
    }
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .kbd-hint {
      display: none;
    }
  }
</style>
