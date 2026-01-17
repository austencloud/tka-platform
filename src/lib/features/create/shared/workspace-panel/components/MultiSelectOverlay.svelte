<!--
MultiSelectOverlay.svelte - Visual indicator that you're in multi-select mode

Dims everything except the beat grid to make it obvious you're in a special mode.
Shows "Select Items" banner and makes escape prominent.
-->
<script lang="ts">
  const { onCancel } = $props<{
    onCancel: () => void;
  }>();

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onCancel();
    }
  }
</script>

<div class="multi-select-overlay">
  <!-- Dimming backdrop -->
  <div
    class="backdrop"
    onclick={onCancel}
    onkeydown={handleBackdropKeydown}
    role="button"
    tabindex="0"
    aria-label="Exit multi-select mode"
  ></div>

  <!-- Mode indicator banner -->
  <div class="mode-banner">
    <div class="mode-text">Select Items</div>
    <button class="cancel-button" onclick={onCancel} type="button">
      <i class="fas fa-times" aria-hidden="true"></i>
      Done
    </button>
  </div>
</div>

<style>
  .multi-select-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 5; /* Below beat grid (z-index: 10) to keep grid visible */
    pointer-events: none;
  }

  .backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    animation: fadeIn 0.3s ease-out;
    pointer-events: auto;
  }

  .mode-banner {
    position: fixed; /* Fixed positioning breaks out of overlay stacking context */
    top: var(--header-height, 64px); /* Below navigation */
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    padding: var(--spacing-md) var(--spacing-xl);
    background: linear-gradient(
      135deg,
      var(--semantic-warning),
      var(--semantic-warning)
    );
    color: white;
    border-radius: 12px;
    box-shadow:
      0 4px 16px rgba(251, 191, 36, 0.4),
      0 0 0 1px rgba(255, 255, 255, 0.2);
    animation: slideDown 0.3s ease-out;
    pointer-events: auto;
    z-index: 999; /* Very high to be above everything including containers with z-index */
  }

  .mode-text {
    font-size: var(--font-size-lg);
    font-weight: 600;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .cancel-button {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    padding: var(--spacing-sm) var(--spacing-lg);
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    min-height: var(--min-touch-target);
  }

  .cancel-button:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.05);
  }

  .cancel-button:active {
    transform: scale(0.98);
  }

  .cancel-button i {
    font-size: var(--font-size-lg);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translate(-50%, -20px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .mode-banner {
      top: 48px; /* Smaller header on mobile */
      padding: var(--spacing-sm) var(--spacing-md);
    }

    .mode-text {
      font-size: var(--font-size-md);
    }

    .cancel-button {
      padding: var(--spacing-xs) var(--spacing-md);
      font-size: var(--font-size-sm);
      min-height: var(--min-touch-target);
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .backdrop {
      animation: none;
    }
    .mode-banner {
      animation: none;
    }
  }
</style>
