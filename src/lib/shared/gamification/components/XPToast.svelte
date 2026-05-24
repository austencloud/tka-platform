<script lang="ts">
  /**
   * XP Toast
   *
   * Lightweight, subtle notification for XP gains.
   * Appears briefly (2.5 seconds) with a gentle fade animation.
   */

  import { xpToastQueue, removeXPToast } from "../state/xp-toast-state.svelte";

  // Track which toasts are currently animating out
  let exitingToasts = $state<Set<string>>(new Set());

  // Auto-remove toasts after display time
  $effect(() => {
    for (const toast of xpToastQueue) {
      if (!exitingToasts.has(toast.id)) {
        // Start exit animation after 2.5 seconds
        setTimeout(() => {
          exitingToasts.add(toast.id);
          exitingToasts = new Set(exitingToasts);

          // Actually remove after animation completes
          setTimeout(() => {
            removeXPToast(toast.id);
            exitingToasts.delete(toast.id);
            exitingToasts = new Set(exitingToasts);
          }, 300);
        }, 1500);
      }
    }
  });
</script>

<div class="xp-toast-container">
  {#each xpToastQueue as toast (toast.id)}
    <div
      class="xp-toast"
      class:exiting={exitingToasts.has(toast.id)}
      role="status"
      aria-live="polite"
    >
      <span class="xp-icon">+</span>
      <span class="xp-amount">{toast.amount}</span>
      <span class="xp-label">XP</span>
    </div>
  {/each}
</div>

<style>
  .xp-toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: var(--z-toast);
    display: flex;
    flex-direction: column-reverse;
    gap: 6px;
    pointer-events: none;
  }

  .xp-toast {
    display: flex;
    align-items: center;
    gap: 1px;
    padding: 6px 12px;
    background: color-mix(in srgb, var(--theme-shadow) 75%, transparent);
    border-radius: 16px;
    border: 1px solid
      color-mix(
        in srgb,
        var(--theme-accent, var(--theme-accent)) 40%,
        transparent
      );
    box-shadow: 0 2px 8px var(--theme-shadow, var(--theme-shadow));
    animation: fadeInUp var(--duration-emphasis) ease-out;
  }

  .xp-toast.exiting {
    animation: fadeOutDown var(--duration-emphasis) ease-in forwards;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeOutDown {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-4px);
    }
  }

  .xp-icon {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 90%,
      transparent
    );
  }

  .xp-amount {
    font-size: var(--font-size-base);
    font-weight: 700;
    color: color-mix(in srgb, var(--theme-text, white) 95%, transparent);
  }

  .xp-label {
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: var(--theme-text-dim, var(--theme-text-dim));
    margin-left: 2px;
  }

  /* Mobile positioning */
  @media (max-width: 768px) {
    .xp-toast-container {
      bottom: 80px; /* Above mobile nav */
      right: 16px;
    }

    .xp-toast {
      padding: 5px 10px;
    }

    .xp-amount {
      font-size: var(--font-size-sm);
    }

    .xp-label {
      font-size: var(--font-size-compact);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .xp-toast {
      animation: fadeIn var(--duration-fast) ease;
    }

    .xp-toast.exiting {
      animation: fadeOut var(--duration-fast) ease forwards;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes fadeOut {
      from {
        opacity: 1;
      }
      to {
        opacity: 0;
      }
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .xp-toast {
      animation: none;
    }
    .exiting {
      animation: none;
    }
  }
</style>
