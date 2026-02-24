<!--
  ReconnectionOverlay.svelte

  Displays a reconnection overlay when connection is lost.
  Shows countdown to retry with animated connection dots,
  cancel button, and auto-dismisses when reconnected.

  Accessibility:
  - aria-live for screen reader announcements
  - Keyboard accessible cancel button (48px touch target)
  - Respects prefers-reduced-motion
-->
<script lang="ts">
  import { deviceSyncState } from '../state/device-sync-state.svelte';

  interface Props {
    /** Time in seconds between reconnection attempts */
    retryIntervalSec?: number;
    /** Maximum number of retry attempts before giving up */
    maxRetries?: number;
    /** Callback when user cancels reconnection */
    onCancel?: () => void;
    /** Callback when max retries exceeded */
    onMaxRetriesExceeded?: () => void;
  }

  let {
    retryIntervalSec = 5,
    maxRetries = 5,
    onCancel,
    onMaxRetriesExceeded,
  }: Props = $props();

  // Internal state
  let countdown = $state(5);
  $effect.pre(() => { countdown = retryIntervalSec; });
  let retryCount = $state(0);
  let countdownInterval: ReturnType<typeof setInterval> | null = null;

  // Derived state from deviceSyncState
  const status = $derived(deviceSyncState.connectionState.status);
  const isReconnecting = $derived(status === 'reconnecting');
  const isConnected = $derived(status === 'connected');

  // Auto-dismiss when reconnected
  $effect(() => {
    if (isConnected) {
      stopCountdown();
      retryCount = 0;
    }
  });

  // Start countdown when entering reconnecting state
  $effect(() => {
    if (isReconnecting && !countdownInterval) {
      startCountdown();
    } else if (!isReconnecting && countdownInterval) {
      stopCountdown();
    }
  });

  // Cleanup on unmount
  $effect(() => {
    return () => {
      stopCountdown();
    };
  });

  function startCountdown(): void {
    countdown = retryIntervalSec;
    countdownInterval = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        handleRetry();
      }
    }, 1000);
  }

  function stopCountdown(): void {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  function handleRetry(): void {
    retryCount++;
    if (retryCount >= maxRetries) {
      stopCountdown();
      onMaxRetriesExceeded?.();
      return;
    }
    // Reset countdown for next attempt
    countdown = retryIntervalSec;
  }

  function handleCancel(): void {
    stopCountdown();
    onCancel?.();
  }

  function handleRetryNow(): void {
    // Trigger immediate retry by resetting countdown
    countdown = 0;
    handleRetry();
  }
</script>

{#if isReconnecting}
  <div
    class="reconnection-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="reconnection-title"
    aria-describedby="reconnection-description"
  >
    <div class="overlay-backdrop" aria-hidden="true"></div>

    <div class="overlay-content">
      <!-- Animated connection dots -->
      <div class="connection-animation" aria-hidden="true">
        <span class="dot dot-1"></span>
        <span class="dot dot-2"></span>
        <span class="dot dot-3"></span>
      </div>

      <h2 id="reconnection-title" class="overlay-title">
        Connection Lost
      </h2>

      <p id="reconnection-description" class="overlay-description" aria-live="polite">
        {#if retryCount >= maxRetries - 1}
          Final attempt...
        {:else}
          Reconnecting in {countdown}s...
        {/if}
      </p>

      <!-- Retry count indicator -->
      <div class="retry-indicator" aria-live="polite">
        <span class="retry-text">
          Attempt {retryCount + 1} of {maxRetries}
        </span>
        <div class="retry-progress">
          {#each Array(maxRetries) as _, i}
            <span
              class="retry-dot"
              class:filled={i <= retryCount}
              aria-hidden="true"
            ></span>
          {/each}
        </div>
      </div>

      <!-- Action buttons -->
      <div class="overlay-actions">
        <button
          type="button"
          class="action-btn retry-btn"
          onclick={handleRetryNow}
          aria-label="Retry connection now"
        >
          <i class="fas fa-sync-alt" aria-hidden="true"></i>
          <span>Retry Now</span>
        </button>

        <button
          type="button"
          class="action-btn cancel-btn"
          onclick={handleCancel}
          aria-label="Cancel reconnection and disconnect"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
          <span>Cancel</span>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .reconnection-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .overlay-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
  }

  .overlay-content {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 32px 40px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    max-width: 90vw;
    width: 360px;
    text-align: center;
  }

  /* Animated connection dots */
  .connection-animation {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--semantic-warning, #fbbf24);
    animation: pulse-dot 1.5s ease-in-out infinite;
  }

  .dot-1 {
    animation-delay: 0s;
  }

  .dot-2 {
    animation-delay: 0.3s;
  }

  .dot-3 {
    animation-delay: 0.6s;
  }

  @keyframes pulse-dot {
    0%, 100% {
      opacity: 0.3;
      transform: scale(0.8);
    }
    50% {
      opacity: 1;
      transform: scale(1);
    }
  }

  .overlay-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .overlay-description {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  /* Retry indicator */
  .retry-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .retry-text {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .retry-progress {
    display: flex;
    gap: 6px;
  }

  .retry-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    transition: background var(--duration-normal, 200ms) ease,
                transform var(--duration-normal, 200ms) ease;
  }

  .retry-dot.filled {
    background: var(--semantic-warning, #fbbf24);
    transform: scale(1.1);
  }

  /* Action buttons */
  .overlay-actions {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    min-width: 120px;
    padding: 0 20px;
    border-radius: 10px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal, 150ms) ease;
  }

  .action-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .action-btn:active {
    transform: scale(0.98);
  }

  .retry-btn {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-accent, #8b5cf6);
    color: var(--theme-accent, #8b5cf6);
  }

  .retry-btn:hover {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-accent, #8b5cf6);
  }

  .cancel-btn {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .cancel-btn:hover {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .dot {
      animation: none;
      opacity: 1;
      transform: scale(1);
    }

    .dot-1 { opacity: 0.4; }
    .dot-2 { opacity: 0.7; }
    .dot-3 { opacity: 1; }

    .overlay-backdrop {
      backdrop-filter: none;
    }

    .retry-dot {
      transition: none;
    }

    .action-btn {
      transition: none;
    }
  }

  /* Mobile responsive */
  @media (max-width: 480px) {
    .overlay-content {
      padding: 24px 20px;
      width: 320px;
    }

    .overlay-actions {
      flex-direction: column;
      width: 100%;
    }

    .action-btn {
      width: 100%;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .overlay-content {
      border-width: 2px;
      border-color: var(--theme-text, #ffffff);
    }

    .dot {
      border: 2px solid currentColor;
    }

    .action-btn {
      border-width: 2px;
    }
  }
</style>
