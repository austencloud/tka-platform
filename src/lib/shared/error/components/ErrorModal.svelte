<!--
  ErrorModal - Global error display component

  Place this once at the app root. It listens to error state and displays
  a modal when errors occur, with options to dismiss or report as a bug.
-->
<script lang="ts">
  import { getCurrentError, dismissError } from "../state/error-state.svelte";
  import { container } from "$lib/shared/di";
  import type { IErrorHandler } from "$lib/shared/application/services/contracts/IErrorHandler";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  let showDetails = $state(false);
  let userComment = $state("");
  let isReporting = $state(false);

  const error = $derived(getCurrentError());

  const severityConfig: Record<
    string,
    { icon: string; color: string; bg: string; title: string }
  > = {
    info: {
      icon: "fa-info-circle",
      color: "var(--semantic-info)",
      bg: "rgba(59, 130, 246, 0.15)",
      title: "Notice",
    },
    warning: {
      icon: "fa-exclamation-triangle",
      color: "var(--semantic-warning)",
      bg: "rgba(245, 158, 11, 0.15)",
      title: "Warning",
    },
    error: {
      icon: "fa-times-circle",
      color: "var(--semantic-error)",
      bg: "rgba(239, 68, 68, 0.15)",
      title: "Error",
    },
    critical: {
      icon: "fa-skull-crossbones",
      color: "var(--semantic-error)",
      bg: "rgba(220, 38, 38, 0.2)",
      title: "Critical Error",
    },
  };

  function getConfig(severity: string): {
    icon: string;
    color: string;
    bg: string;
    title: string;
  } {
    return severityConfig[severity] ?? severityConfig.error!;
  }

  function handleDismiss() {
    showDetails = false;
    userComment = "";
    dismissError();
  }

  async function handleReportBug() {
    if (!error) return;

    isReporting = true;
    try {
      const errorService = container.items.errorHandler as IErrorHandler | undefined;
      if (!errorService) {
        toast.error("Unable to submit bug report - service unavailable");
        return;
      }

      const feedbackId = await errorService.reportBug(
        error.id,
        userComment || undefined
      );

      if (feedbackId) {
        toast.success("Bug report submitted. Thank you!");
        handleDismiss();
      } else {
        toast.error("Failed to submit bug report. Please try again.");
      }
    } catch (err) {
      console.error("Error reporting bug:", err);
      toast.error("Failed to submit bug report");
    } finally {
      isReporting = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && error) {
      handleDismiss();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if error}
  {@const config = getConfig(error.severity)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="error-overlay" onclick={handleDismiss} aria-hidden="true">
    <div
      class="error-modal"
      style="--error-color: {config.color}; --error-bg: {config.bg}"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="error-title"
      aria-describedby="error-message"
      tabindex="-1"
    >
      <div class="error-header">
        <div class="error-icon-wrapper">
          <i class="fas {config.icon} error-icon" aria-hidden="true"></i>
        </div>
        <h2 id="error-title" class="error-title">{config.title}</h2>
        <button
          class="close-button"
          onclick={handleDismiss}
          aria-label="Dismiss error"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>

      <div class="error-content">
        <p id="error-message" class="error-message">{error.message}</p>

        {#if error.context.module || error.context.action}
          <div class="error-context">
            {#if error.context.module}
              <span class="context-chip">
                <i class="fas fa-cube" aria-hidden="true"></i>
                {error.context.module}
              </span>
            {/if}
            {#if error.context.action}
              <span class="context-chip">
                <i class="fas fa-bolt" aria-hidden="true"></i>
                {error.context.action}
              </span>
            {/if}
          </div>
        {/if}

        {#if error.technicalDetails || error.stack}
          <button
            class="details-toggle"
            onclick={() => (showDetails = !showDetails)}
            aria-expanded={showDetails}
            aria-controls="error-technical-details"
          >
            <i
              class="fas fa-chevron-{showDetails ? 'up' : 'down'}"
              aria-hidden="true"
            ></i>
            {showDetails ? "Hide" : "Show"} technical details
          </button>

          {#if showDetails}
            <div id="error-technical-details" class="technical-details">
              {#if error.technicalDetails}
                <p class="detail-text">{error.technicalDetails}</p>
              {/if}
              {#if error.stack}
                <pre class="stack-trace">{error.stack}</pre>
              {/if}
            </div>
          {/if}
        {/if}

        {#if error.reportable}
          <div class="report-section">
            <p class="report-prompt">What were you trying to do?</p>
            <textarea
              class="comment-input"
              placeholder="e.g. I was saving a 16-beat sequence and clicked Save..."
              bind:value={userComment}
              rows="2"
            ></textarea>
          </div>
        {/if}
      </div>

      <div class="error-actions">
        <button class="action-button dismiss-button" onclick={handleDismiss}>
          Dismiss
        </button>
        {#if error.reportable}
          <button
            class="action-button report-button"
            onclick={handleReportBug}
            disabled={isReporting}
            aria-busy={isReporting}
          >
            {#if isReporting}
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              Reporting...
            {:else}
              <i class="fas fa-bug" aria-hidden="true"></i>
              Report Bug
            {/if}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .error-overlay {
    position: fixed;
    inset: 0;
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    animation: fadeIn var(--duration-normal) ease-out;
    padding: 20px;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .error-modal {
    background: linear-gradient(145deg, #1e1e2e 0%, #181825 100%);
    border: 1px solid var(--error-color);
    border-radius: 16px;
    box-shadow:
      0 0 30px rgba(0, 0, 0, 0.5),
      0 0 60px var(--error-bg);
    max-width: 480px;
    width: 100%;
    animation: slideUp var(--duration-normal) ease-out;
    overflow: hidden;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .error-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: var(--error-bg);
    border-bottom: 1px solid var(--theme-stroke);
  }

  .error-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--error-bg);
    border-radius: 10px;
    border: 1px solid var(--error-color);
  }

  .error-icon {
    font-size: var(--font-size-xl);
    color: var(--error-color);
  }

  .error-title {
    flex: 1;
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--error-color);
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target); /* WCAG AA touch target */
    height: var(--min-touch-target);
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .close-button:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text, var(--theme-text));
  }

  .error-content {
    padding: 20px;
  }

  .error-message {
    margin: 0 0 16px;
    font-size: var(--font-size-sm);
    line-height: 1.5;
    color: var(--theme-text, var(--theme-text));
  }

  .error-context {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  .context-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 6px;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .context-chip i {
    font-size: var(--font-size-compact);
    opacity: 0.7;
  }

  .details-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    background: transparent;
    border: none;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: var(--font-size-compact);
    cursor: pointer;
    transition: color var(--duration-fast);
  }

  .details-toggle:hover {
    color: var(--theme-text);
  }

  .technical-details {
    margin-top: 12px;
    padding: 12px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    border: 1px solid var(--theme-stroke);
  }

  .detail-text {
    margin: 0 0 8px;
    font-size: var(--font-size-compact);
    color: var(--theme-text, var(--theme-text-dim));
  }

  .stack-trace {
    margin: 0;
    padding: 8px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    font-family: "Fira Code", "Consolas", monospace;
    font-size: var(--font-size-compact);
    line-height: 1.4;
    color: var(--theme-text-dim, var(--theme-text-dim));
    overflow-x: auto;
    max-height: 150px;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .report-section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--theme-stroke);
  }

  .report-prompt {
    margin: 0 0 8px;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .comment-input {
    width: 100%;
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 8px;
    font-family: inherit;
    font-size: var(--font-size-sm);
    color: var(--theme-text, var(--theme-text));
    resize: vertical;
    min-height: 60px;
  }

  .comment-input::placeholder {
    color: var(--theme-text-dim);
  }

  .comment-input:focus {
    outline: none;
    border-color: var(--error-color);
  }

  .error-actions {
    display: flex;
    gap: 12px;
    padding: 16px 20px;
    background: rgba(0, 0, 0, 0.2);
    border-top: 1px solid var(--theme-stroke);
  }

  .action-button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    border: none;
    border-radius: 10px;
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .dismiss-button {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .dismiss-button:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text, white);
  }

  .report-button {
    background: var(--error-color);
    color: white;
  }

  .report-button:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .report-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .error-overlay {
      padding: 12px;
      align-items: flex-end;
    }

    .error-modal {
      border-radius: 16px 16px 0 0;
      max-height: 90vh;
      overflow-y: auto;
    }

    .error-header {
      padding: 14px 16px;
    }

    .error-content {
      padding: 16px;
    }

    .error-actions {
      padding: 14px 16px;
      padding-bottom: max(14px, env(safe-area-inset-bottom));
    }

    .action-button {
      padding: 14px 16px;
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .error-overlay {
      animation: none;
    }
    .error-modal {
      animation: none;
    }
  }
</style>
