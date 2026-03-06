<!--
  SyncErrorBanner.svelte

  Displays contextual error messages for sync-related errors.
  Provides specific messages for common error scenarios with
  retry button where applicable and dismissible functionality.

  Accessibility:
  - aria-live for screen reader announcements
  - role="alert" for error announcements
  - Keyboard accessible buttons (48px touch targets)
  - Respects prefers-reduced-motion
-->
<script lang="ts">
  import { deviceSyncState } from '../state/device-sync-state.svelte';

  /** Error type categorization for contextual messages */
  type SyncErrorType =
    | 'room-not-found'
    | 'peer-disconnected'
    | 'network-error'
    | 'timeout'
    | 'auth-required'
    | 'room-full'
    | 'unknown';

  interface Props {
    /** Error message from the system (will be parsed for type) */
    errorMessage?: string | null;
    /** Override error type for custom handling */
    errorType?: SyncErrorType;
    /** Callback when retry is clicked */
    onRetry?: () => void;
    /** Callback when dismiss is clicked */
    onDismiss?: () => void;
    /** Whether this banner can be dismissed */
    dismissible?: boolean;
  }

  let {
    errorMessage = null,
    errorType,
    onRetry,
    onDismiss,
    dismissible = true,
  }: Props = $props();

  // Internal state
  let isDismissed = $state(false);

  // Get error from deviceSyncState if not provided
  const stateErrorMessage = $derived(deviceSyncState.connectionState.errorMessage);
  const effectiveErrorMessage = $derived(errorMessage ?? stateErrorMessage);
  const isError = $derived(
    deviceSyncState.connectionState.status === 'error' || !!effectiveErrorMessage
  );

  // Detect error type from message
  const detectedErrorType = $derived.by((): SyncErrorType => {
    if (errorType) return errorType;

    const msg = effectiveErrorMessage?.toLowerCase() ?? '';

    if (msg.includes('not found') || msg.includes('room does not exist')) {
      return 'room-not-found';
    }
    if (msg.includes('peer') && (msg.includes('disconnect') || msg.includes('left'))) {
      return 'peer-disconnected';
    }
    if (msg.includes('network') || msg.includes('offline') || msg.includes('connection failed')) {
      return 'network-error';
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return 'timeout';
    }
    if (msg.includes('auth') || msg.includes('unauthorized') || msg.includes('sign in')) {
      return 'auth-required';
    }
    if (msg.includes('full') || msg.includes('capacity')) {
      return 'room-full';
    }
    return 'unknown';
  });

  // Get user-friendly error info based on type
  interface ErrorInfo {
    icon: string;
    title: string;
    message: string;
    canRetry: boolean;
    retryLabel: string;
  }

  const errorInfo = $derived.by((): ErrorInfo => {
    switch (detectedErrorType) {
      case 'room-not-found':
        return {
          icon: 'fa-door-open',
          title: 'Room Not Found',
          message: 'The room code may have expired or been entered incorrectly.',
          canRetry: true,
          retryLabel: 'Try Again',
        };
      case 'peer-disconnected':
        return {
          icon: 'fa-user-slash',
          title: 'Peer Disconnected',
          message: 'The other device has left the room.',
          canRetry: true,
          retryLabel: 'Wait for Peer',
        };
      case 'network-error':
        return {
          icon: 'fa-wifi-slash',
          title: 'Network Error',
          message: 'Check your internet connection and try again.',
          canRetry: true,
          retryLabel: 'Retry',
        };
      case 'timeout':
        return {
          icon: 'fa-clock',
          title: 'Connection Timeout',
          message: 'The connection took too long. The other device may be offline.',
          canRetry: true,
          retryLabel: 'Retry',
        };
      case 'auth-required':
        return {
          icon: 'fa-lock',
          title: 'Sign In Required',
          message: 'Please sign in to use sync features.',
          canRetry: false,
          retryLabel: 'Sign In',
        };
      case 'room-full':
        return {
          icon: 'fa-users',
          title: 'Room Full',
          message: 'This room has reached its maximum capacity.',
          canRetry: false,
          retryLabel: '',
        };
      case 'unknown':
      default:
        return {
          icon: 'fa-exclamation-triangle',
          title: 'Connection Error',
          message: effectiveErrorMessage || 'Something went wrong. Please try again.',
          canRetry: true,
          retryLabel: 'Retry',
        };
    }
  });

  // Reset dismissed state when error changes
  $effect(() => {
    if (effectiveErrorMessage) {
      isDismissed = false;
    }
  });

  function handleDismiss(): void {
    isDismissed = true;
    onDismiss?.();
  }

  function handleRetry(): void {
    isDismissed = true;
    onRetry?.();
  }

  const shouldShow = $derived(isError && !isDismissed);
</script>

{#if shouldShow}
  <div
    class="sync-error-banner"
    role="alert"
    aria-live="assertive"
    aria-atomic="true"
  >
    <div class="error-icon" aria-hidden="true">
      <i class="fas {errorInfo.icon}"></i>
    </div>

    <div class="error-content">
      <h3 class="error-title">{errorInfo.title}</h3>
      <p class="error-message">{errorInfo.message}</p>
    </div>

    <div class="error-actions">
      {#if errorInfo.canRetry && onRetry}
        <button
          type="button"
          class="action-btn retry-btn"
          onclick={handleRetry}
          aria-label={errorInfo.retryLabel}
        >
          <i class="fas fa-redo" aria-hidden="true"></i>
          <span>{errorInfo.retryLabel}</span>
        </button>
      {/if}

      {#if dismissible}
        <button
          type="button"
          class="action-btn dismiss-btn"
          onclick={handleDismiss}
          aria-label="Dismiss error message"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .sync-error-banner {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    background: rgba(239, 68, 68, 0.1);
    border: 1.5px solid rgba(239, 68, 68, 0.3);
    border-radius: 12px;
    animation: slideIn var(--duration-emphasis, 300ms) ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .error-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    min-width: 40px;
    background: rgba(239, 68, 68, 0.2);
    border-radius: 10px;
    color: var(--semantic-error, rgba(248, 113, 113, 1));
    font-size: 1rem;
  }

  .error-content {
    flex: 1;
    min-width: 0;
  }

  .error-title {
    margin: 0 0 4px 0;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--semantic-error, rgba(248, 113, 113, 1));
  }

  .error-message {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    line-height: 1.4;
  }

  .error-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--min-touch-target);
    padding: 0 16px;
    border-radius: 8px;
    font-size: var(--font-size-compact, 12px);
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
    background: rgba(239, 68, 68, 0.15);
    border: 1.5px solid rgba(239, 68, 68, 0.3);
    color: var(--semantic-error, rgba(248, 113, 113, 1));
  }

  .retry-btn:hover {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .dismiss-btn {
    min-width: var(--min-touch-target);
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .dismiss-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .sync-error-banner {
      animation: none;
    }

    .action-btn {
      transition: none;
    }
  }

  /* Mobile responsive */
  @media (max-width: 480px) {
    .sync-error-banner {
      flex-wrap: wrap;
      gap: 8px;
    }

    .error-content {
      flex-basis: calc(100% - 52px);
    }

    .error-actions {
      width: 100%;
      justify-content: flex-end;
      padding-top: 8px;
      border-top: 1px solid rgba(239, 68, 68, 0.2);
      margin-top: 4px;
    }

    .retry-btn {
      flex: 1;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .sync-error-banner {
      border-width: 2px;
      border-color: var(--semantic-error, rgba(248, 113, 113, 0.6));
    }

    .error-icon {
      border: 2px solid var(--semantic-error, rgba(248, 113, 113, 0.6));
    }

    .action-btn {
      border-width: 2px;
    }
  }
</style>
