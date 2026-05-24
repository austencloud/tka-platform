<script lang="ts">
  /**
   * Achievement Notification Toast
   *
   * Displays toast notifications for achievement unlocks, level-ups, etc.
   * Automatically appears and disappears with smooth animations.
   */

  import { onMount } from "svelte";
  import type { AchievementNotification } from "../domain/models/achievement-models";
  import {
    notificationQueue,
    removeNotification,
  } from "../state/notification-state.svelte";

  // State
  let activeNotification = $state<AchievementNotification | null>(null);
  let isVisible = $state(false);
  let timeout: ReturnType<typeof setTimeout> | null = null;

  // Watch notification queue
  $effect(() => {
    if (notificationQueue.length > 0 && !activeNotification) {
      showNextNotification();
    }
  });

  function showNextNotification() {
    if (notificationQueue.length === 0) return;

    // Get next notification
    const notification = removeNotification();
    if (!notification) return;

    activeNotification = notification;
    isVisible = true;

    // Auto-hide after 5 seconds
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      hideNotification();
    }, 5000);
  }

  function hideNotification() {
    isVisible = false;

    // Wait for animation to complete before clearing
    setTimeout(() => {
      activeNotification = null;
      // Show next notification if any
      if (notificationQueue.length > 0) {
        setTimeout(showNextNotification, 300);
      }
    }, 300);
  }

  function handleClick() {
    hideNotification();
  }

  onMount(() => {
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  });
</script>

{#if activeNotification}
  <div class="toast-container" class:visible={isVisible}>
    <div
      class="toast glass-surface {activeNotification.type}"
      onclick={handleClick}
      onkeydown={(e) => (e.key === "Enter" || e.key === " ") && handleClick()}
      role="button"
      aria-live="polite"
      aria-label="Dismiss notification: {activeNotification.title}"
      tabindex="0"
    >
      <div class="toast-icon">
        <i
          class="fas {activeNotification.icon || 'fa-party-horn'}"
          aria-hidden="true"
        ></i>
      </div>
      <div class="toast-content">
        <div class="toast-title">{activeNotification.title}</div>
        <div class="toast-message">{activeNotification.message}</div>
      </div>
      <button
        class="toast-close"
        onclick={hideNotification}
        aria-label="Dismiss">×</button
      >
    </div>
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%) translateY(-120%);
    z-index: var(--z-toast);
    transition: transform var(--duration-dramatic) cubic-bezier(0.68, -0.55, 0.265, 1.55);
    pointer-events: none;
  }

  .toast-container.visible {
    transform: translateX(-50%) translateY(0);
    pointer-events: auto;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--radius-xl);
    min-width: 320px;
    max-width: 480px;
    cursor: pointer;
    box-shadow: 0 8px 32px var(--theme-shadow);
    border: 1px solid var(--theme-stroke-strong);
    animation: glow 2s ease-in-out infinite alternate;
  }

  @keyframes glow {
    from {
      box-shadow:
        0 8px 32px var(--theme-shadow),
        0 0 20px
          color-mix(
            in srgb,
            var(--theme-accent, var(--theme-accent)) 30%,
            transparent
          );
    }
    to {
      box-shadow:
        0 8px 32px var(--theme-shadow),
        0 0 40px
          color-mix(
            in srgb,
            var(--theme-accent, var(--theme-accent)) 50%,
            transparent
          );
    }
  }

  .toast.achievement {
    border-color: color-mix(in srgb, var(--semantic-warning) 50%, transparent);
  }

  .toast.level_up {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 50%,
      transparent
    );
  }

  .toast.challenge_complete {
    border-color: color-mix(in srgb, var(--semantic-success) 50%, transparent);
  }

  .toast.streak_milestone {
    border-color: color-mix(in srgb, var(--semantic-error) 50%, transparent);
  }

  .toast-icon {
    font-size: var(--font-size-3xl);
    flex-shrink: 0;
    animation: bounce 1s ease-in-out;
  }

  @keyframes bounce {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.2);
    }
  }

  .toast-content {
    flex: 1;
    min-width: 0;
  }

  .toast-title {
    font-size: var(--font-size-base);
    font-weight: 700;
    color: color-mix(in srgb, var(--theme-text, white) 95%, transparent);
    margin-bottom: 4px;
  }

  .toast-message {
    font-size: var(--font-size-sm);
    color: color-mix(in srgb, var(--theme-text, white) 80%, transparent);
    line-height: 1.4;
  }

  .toast-close {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 50%;
    border: none;
    background: var(--theme-card-bg);
    color: color-mix(in srgb, var(--theme-text, white) 70%, transparent);
    font-size: var(--font-size-xl);
    line-height: 1;
    cursor: pointer;
    flex-shrink: 0;
    transition: all var(--duration-normal) ease;
  }

  .toast-close:hover {
    background: var(--theme-stroke-strong);
    transform: rotate(90deg);
  }

  /* Mobile */
  @media (max-width: 768px) {
    .toast-container {
      top: 70px;
      left: var(--spacing-md);
      right: var(--spacing-md);
      transform: translateX(0) translateY(-120%);
    }

    .toast-container.visible {
      transform: translateX(0) translateY(0);
    }

    .toast {
      min-width: auto;
      width: 100%;
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .toast-container,
    .toast-icon,
    .toast-close {
      animation: none;
      transition: opacity var(--duration-normal) ease;
    }

    .toast-container:not(.visible) {
      opacity: 0;
    }

    .toast-container.visible {
      opacity: 1;
    }
  }
</style>
