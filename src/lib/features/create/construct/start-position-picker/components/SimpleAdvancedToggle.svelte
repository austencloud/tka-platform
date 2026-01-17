<!--
SimpleAdvancedToggle.svelte - Single-button toggle showing opposite view mode
Action-oriented pattern: Shows the mode you can switch TO (not current mode)
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";

  const { isAdvanced = false, onToggle } = $props<{
    isAdvanced?: boolean;
    onToggle?: (isAdvanced: boolean) => void;
  }>();

  // Resolve haptic feedback service
  const hapticService = container.items.hapticFeedback;

  // Action-oriented: Show the mode you can switch TO
  const oppositeLabel = $derived(isAdvanced ? "Simple" : "Advanced");

  function handleToggle() {
    hapticService?.trigger("selection");
    onToggle?.(!isAdvanced);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggle();
    }
  }
</script>

<button
  class="view-mode-toggle"
  onclick={handleToggle}
  onkeydown={handleKeyDown}
  role="switch"
  aria-checked={isAdvanced}
  aria-label={`Switch to ${oppositeLabel} view`}
  title={`Switch to ${oppositeLabel} view`}
>
  <span class="mode-label">{oppositeLabel}</span>
</button>

<style>
  .view-mode-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    /* Bigger touch target */
    min-height: var(--min-touch-target);
    padding: 10px 20px;

    /* Glass morphism styling */
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 24px;

    /* Typography */
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text);
    letter-spacing: 0.3px;

    /* Interaction */
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;

    /* Smooth transitions */
    transition: all var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);

    /* Shadow */
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 var(--theme-stroke);
  }

  .mode-label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    white-space: nowrap;
  }

  /* Hover state */
  @media (hover: hover) {
    .view-mode-toggle:hover {
      background: var(--theme-card-hover-bg);
      border-color: rgba(255, 255, 255, 0.3);
      transform: translateY(-2px);
      box-shadow:
        0 4px 12px rgba(0, 0, 0, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
    }
  }

  /* Active/pressed state */
  .view-mode-toggle:active {
    transform: translateY(0) scale(0.98);
    transition: transform var(--duration-instant) cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Focus state */
  .view-mode-toggle:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .view-mode-toggle {
      transition: none;
    }

    .view-mode-toggle:hover {
      transform: none;
    }

    .view-mode-toggle:active {
      transform: scale(0.98);
    }
  }

  /* Mobile responsive */
  @media (max-width: 600px) {
    .view-mode-toggle {
      min-height: var(--min-touch-target);
      padding: 8px 16px;
      gap: 6px;
    }

    .mode-label {
      font-size: var(--font-size-sm);
    }
  }
</style>
