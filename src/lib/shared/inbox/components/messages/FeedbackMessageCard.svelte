<script lang="ts">
  /**
   * FeedbackMessageCard
   *
   * Renders a feedback submission as a tappable card within a message.
   * Links directly to the feedback item for viewing/responding.
   * Shows deleted state if the feedback no longer exists.
   */

  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { onMount } from "svelte";
  import {
    TYPE_CONFIG,
    STATUS_CONFIG,
  } from "$lib/shared/feedback/domain/models/feedback-models";
  import type { MessageAttachment } from "$lib/shared/messaging/domain/models/message-models";
  import { feedbackService } from "$lib/shared/feedback/services/implementations/FeedbackRepository";
  import { inboxState } from "../../state/inbox-state.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import { setNotificationTargetFeedback } from "$lib/shared/feedback/state/notification-action-state.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";

  interface Props {
    attachment: MessageAttachment;
    isOwn: boolean;
  }

  let { attachment, isOwn }: Props = $props();

  // Track if feedback still exists
  let isDeleted = $state(false);
  let isChecking = $state(true);

  // Haptic feedback service
  let hapticService: HapticFeedback | undefined;

  const feedbackType = $derived(attachment.metadata?.feedbackType || "general");
  const feedbackStatus = $derived(attachment.metadata?.feedbackStatus || "new");
  const typeConfig = $derived(TYPE_CONFIG[feedbackType]);
  const statusConfig = $derived(
    STATUS_CONFIG[feedbackStatus as keyof typeof STATUS_CONFIG]
  );

  // Check if feedback exists on mount
  onMount(async () => {
    hapticService = getHapticFeedback();

    const feedbackId = attachment.metadata?.feedbackId;
    if (!feedbackId) {
      isChecking = false;
      return;
    }

    try {
      const feedback = await feedbackService.getFeedback(feedbackId);
      isDeleted = feedback === null;
    } catch (err) {
      console.error(
        "[FeedbackMessageCard] Error checking feedback existence:",
        err
      );
      // On error, assume it exists to avoid false negatives
      isDeleted = false;
    } finally {
      isChecking = false;
    }
  });

  async function handleClick() {
    if (isDeleted) return;

    hapticService?.trigger("selection");

    const feedbackId = attachment.metadata?.feedbackId;
    if (!feedbackId) {
      return;
    }

    // Close the inbox drawer first
    inboxState.close();

    // Admin goes to manage tab, regular users go to my-feedback
    const isAdmin = authState.role === "admin";
    const tab = isAdmin ? "manage" : "my-feedback";

    // Set the notification target BEFORE navigation so the target component can find it
    setNotificationTargetFeedback(feedbackId);
    await handleModuleChange("feedback", tab);
  }
</script>

<div
  class="feedback-card"
  class:own={isOwn}
  class:deleted={isDeleted}
  class:clickable={!isDeleted && !isChecking}
>
  {#if isDeleted}
    <!-- Deleted state -->
    <div class="card-header">
      <div class="deleted-badge">
        <i class="fas fa-trash-alt" aria-hidden="true"></i>
        <span>Deleted</span>
      </div>
    </div>
    <h4 class="feedback-title deleted-title">
      {attachment.metadata?.feedbackTitle || "Untitled Feedback"}
    </h4>
    <p class="deleted-notice">This feedback item no longer exists</p>
  {:else}
    <!-- Normal state -->
    <button
      class="card-content"
      onclick={handleClick}
      type="button"
      disabled={isChecking}
    >
      <div class="card-header">
        <div class="type-badge" style:--badge-color={typeConfig.color}>
          <i class="fas {typeConfig.icon}" aria-hidden="true"></i>
          <span>{typeConfig.label}</span>
        </div>
        <div class="status-badge" style:--status-color={statusConfig.color}>
          <i class="fas {statusConfig.icon}" aria-hidden="true"></i>
          <span>{statusConfig.label}</span>
        </div>
      </div>

      <h4 class="feedback-title">
        {attachment.metadata?.feedbackTitle || "Untitled Feedback"}
      </h4>

      {#if attachment.metadata?.feedbackDescription}
        <p class="feedback-preview">
          {attachment.metadata.feedbackDescription.slice(0, 120)}{attachment
            .metadata.feedbackDescription.length > 120
            ? "..."
            : ""}
        </p>
      {/if}

      <div class="card-footer">
        {#if isChecking}
          <span class="checking-hint">
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            Checking...
          </span>
        {:else}
          <span class="tap-hint">
            <i class="fas fa-external-link-alt" aria-hidden="true"></i>
            Tap to view
          </span>
        {/if}
      </div>
    </button>
  {/if}
</div>

<style>
  .feedback-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    text-align: left;
    width: 100%;
    min-width: 200px;
    max-width: 280px;
    transition: all var(--duration-normal) ease;
  }

  .feedback-card.clickable:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-accent, var(--semantic-info));
    transform: translateY(-1px);
  }

  .feedback-card.own {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .feedback-card.own.clickable:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  /* Deleted state */
  .feedback-card.deleted {
    opacity: 0.6;
    border-style: dashed;
  }

  .deleted-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    background: rgba(239, 68, 68, 0.15);
    color: var(--semantic-error);
  }

  .deleted-badge i {
    font-size: var(--font-size-compact);
  }

  .deleted-title {
    text-decoration: line-through;
    opacity: 0.7;
  }

  .deleted-notice {
    margin: 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-style: italic;
  }

  /* Inner button for clickable state */
  .card-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    text-align: left;
    width: 100%;
    color: inherit;
  }

  .card-content:disabled {
    cursor: default;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .type-badge,
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: var(--font-size-compact);
    font-weight: 500;
  }

  .type-badge {
    background: color-mix(in srgb, var(--badge-color) 20%, transparent);
    color: var(--badge-color);
  }

  .status-badge {
    background: color-mix(in srgb, var(--status-color) 20%, transparent);
    color: var(--status-color);
  }

  .type-badge i,
  .status-badge i {
    font-size: var(--font-size-compact);
  }

  .feedback-title {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text);
    line-height: 1.3;
  }

  .own .feedback-title {
    color: white;
  }

  .feedback-preview {
    margin: 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
    line-height: 1.4;
  }

  .own .feedback-preview {
    color: rgba(255, 255, 255, 0.8);
  }

  .card-footer {
    display: flex;
    justify-content: flex-end;
    padding-top: 4px;
    border-top: 1px solid var(--theme-stroke);
  }

  .tap-hint,
  .checking-hint {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact);
    color: var(--theme-accent, var(--semantic-info));
    opacity: 0.8;
  }

  .checking-hint {
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .own .tap-hint {
    color: var(--theme-text-dim);
  }

  .tap-hint i,
  .checking-hint i {
    font-size: var(--font-size-compact);
  }
</style>
