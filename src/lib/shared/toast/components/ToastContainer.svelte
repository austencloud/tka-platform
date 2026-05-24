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
    { icon: string; color: string; bg: string; textColor?: string }
  > = {
    info: {
      icon: "fa-info-circle",
      color: "var(--semantic-info)",
      bg: "rgba(30, 58, 95, 0.95)",
    },
    success: {
      icon: "fa-check-circle",
      color: "#10b981",
      bg: "rgba(6, 78, 59, 0.95)",
      textColor: "#a7f3d0",
    },
    warning: {
      icon: "fa-exclamation-triangle",
      color: "var(--semantic-warning)",
      bg: "rgba(92, 59, 13, 0.95)",
    },
    error: {
      icon: "fa-times-circle",
      color: "var(--semantic-error)",
      bg: "rgba(95, 30, 30, 0.95)",
    },
  };

  function getConfig(type: string): {
    icon: string;
    color: string;
    bg: string;
    textColor?: string;
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
        class:has-image={toast.imageUrl}
        style="--toast-color: {config.color}; --toast-bg: {config.bg}; --toast-text: {config.textColor || 'var(--theme-text)'}"
        role="alert"
      >
        {#if toast.imageUrl}
          <img
            src={toast.imageUrl}
            alt="Captured preview"
            class="toast-thumbnail"
          />
        {/if}
        <div class="toast-content">
          <div class="toast-header">
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
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    top: max(24px, env(safe-area-inset-top, 0px));
    right: 24px;
    z-index: var(--z-toast);
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
    padding: 14px 18px;
    background: var(--toast-bg);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1.5px solid var(--toast-color);
    border-radius: 12px;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.4),
      0 2px 8px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    animation: slideIn var(--duration-normal) cubic-bezier(0.34, 1.56, 0.64, 1);
    pointer-events: auto;
  }

  /* Toast with image - vertical layout */
  .toast.has-image {
    flex-direction: column;
    align-items: stretch;
    padding: 12px;
    max-width: 280px;
  }

  .toast-thumbnail {
    width: 100%;
    max-height: 200px;
    object-fit: contain;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.3);
    margin-bottom: 8px;
  }

  .toast-content {
    display: contents;
  }

  .has-image .toast-content {
    display: block;
  }

  .toast-header {
    display: contents;
  }

  .has-image .toast-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .toast-icon {
    font-size: 1.25rem;
    color: var(--toast-color);
    flex-shrink: 0;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
  }

  .toast-message {
    flex: 1;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--toast-text, var(--theme-text, white));
    line-height: 1.4;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
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
    transition: all var(--duration-fast);
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
      top: max(12px, env(safe-area-inset-top, 0px));
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
  }
</style>
