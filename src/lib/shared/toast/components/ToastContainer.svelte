<!--
  ToastContainer - Displays toast notifications

  Place this component once at the app root level.
-->
<script lang="ts">
  import {
    toastQueue,
    removeToast,
    type Toast,
  } from "../state/toast-state.svelte";

  const typeConfig: Record<
    string,
    { icon: string; color: string; bg: string }
  > = {
    info: {
      icon: "fa-info-circle",
      color: "var(--semantic-info)",
      bg: "rgba(59, 130, 246, 0.15)",
    },
    success: {
      icon: "fa-check-circle",
      color: "#34d399",
      bg: "rgba(16, 185, 129, 0.15)",
    },
    warning: {
      icon: "fa-exclamation-triangle",
      color: "var(--semantic-warning)",
      bg: "rgba(245, 158, 11, 0.15)",
    },
    error: {
      icon: "fa-times-circle",
      color: "var(--semantic-error)",
      bg: "rgba(239, 68, 68, 0.15)",
    },
  };

  function getConfig(type: string): {
    icon: string;
    color: string;
    bg: string;
  } {
    return typeConfig[type] ?? typeConfig.info!;
  }
</script>

{#if toastQueue.length > 0}
  <div class="toast-container">
    {#each toastQueue as toast (toast.id)}
      {@const config = getConfig(toast.type)}
      <div
        class="toast"
        style="--toast-color: {config.color}; --toast-bg: {config.bg}"
        role="alert"
      >
        <i class="fas {config.icon} toast-icon" aria-hidden="true"></i>
        <span class="toast-message">{toast.message}</span>
        <button
          class="toast-close"
          onclick={() => removeToast(toast.id)}
          aria-label="Dismiss"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 400px;
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--toast-bg);
    border: 1px solid var(--toast-color);
    border-radius: 10px;
    box-shadow: 0 4px 20px var(--theme-shadow, var(--theme-shadow));
    animation: slideIn 0.25s ease-out;
    pointer-events: auto;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .toast-icon {
    font-size: var(--font-size-lg);
    color: var(--toast-color);
    flex-shrink: 0;
  }

  .toast-message {
    flex: 1;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: color-mix(in srgb, var(--theme-text, white) 95%, transparent);
    line-height: 1.4;
  }

  .toast-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .toast-close:hover {
    background: var(--theme-card-bg);
    color: color-mix(in srgb, var(--theme-text, white) 90%, transparent);
  }

  /* Mobile positioning */
  @media (max-width: 480px) {
    .toast-container {
      left: 12px;
      right: 12px;
      bottom: 80px; /* Above mobile nav */
      max-width: none;
    }

    .toast {
      padding: 10px 14px;
    }

    .toast-message {
      font-size: var(--font-size-compact);
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation: none;
    }
    /* Disable local keyframe animations */
    [style*="slideIn"] {
      animation: none;
    }
  }
</style>
