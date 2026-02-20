<!--
  TIKA Header

  Header bar with title, review badge, and action buttons.
-->
<script lang="ts">
  import CopyAsImageButton from "$lib/shared/foundation/ui/CopyAsImageButton.svelte";
  import TikaModelSwitcher from "./TikaModelSwitcher.svelte";
  import TikaActionMenu from "./TikaActionMenu.svelte";
  import type { ModelOption } from "../types";
  import type { ReviewStatus, ReviewMetadata } from "../domain/models/tika-conversation-models";

  let {
    reviewStatus,
    reviewMetadata,
    selectedModel = "sonnet-4",
    availableModels = [],
    onModelChange,
    onNewChat,
    onOpenHistory,
    onOpenReview,
    sessionId,
    isFlagged = false,
    onFlagForReview,
    hasMessages = false,
    chatContainer,
    showToolDetails = false,
    onToggleToolDetails,
    generateCopyForAI,
  }: {
    reviewStatus?: ReviewStatus;
    reviewMetadata?: ReviewMetadata;
    selectedModel?: string;
    availableModels?: ModelOption[];
    onModelChange?: (modelId: string) => void;
    onNewChat?: () => void;
    onOpenHistory?: () => void;
    onOpenReview?: () => void;
    sessionId?: string | null;
    isFlagged?: boolean;
    onFlagForReview?: (flagged: boolean) => void;
    hasMessages?: boolean;
    chatContainer?: HTMLElement | null;
    showToolDetails?: boolean;
    onToggleToolDetails?: () => void;
    generateCopyForAI?: () => string;
  } = $props();

  // Derived: review badge display
  const reviewBadge = $derived(() => {
    if (!reviewStatus || reviewStatus === "pending") return null;

    switch (reviewStatus) {
      case "approved":
        return {
          label: reviewMetadata?.grade ? `Reviewed: ${reviewMetadata.grade}` : "Approved",
          icon: "fa-check-circle",
          color: "green",
        };
      case "needs-correction":
        return {
          label: "Needs Correction",
          icon: "fa-exclamation-circle",
          color: "red",
        };
      case "claimed":
        return {
          label: "Being Reviewed",
          icon: "fa-spinner fa-spin",
          color: "blue",
        };
      case "in-review":
        return {
          label: "In Review",
          icon: "fa-eye",
          color: "purple",
        };
      case "archived":
        return {
          label: reviewMetadata?.grade ? `Archived: ${reviewMetadata.grade}` : "Archived",
          icon: "fa-archive",
          color: "gray",
        };
      default:
        return null;
    }
  });
</script>

<header class="panel-header">
  <div class="header-left">
    <div class="header-title">
      <div class="title-icon">
        <i class="fas fa-robot" aria-hidden="true"></i>
      </div>
      <div class="title-text">
        <span class="title-main">Tika</span>
        <span class="title-subtitle">TKA Intelligent Knowledge Assistant</span>
      </div>
    </div>
    <!-- Review Status Badge -->
    {#if reviewBadge()}
      {@const badge = reviewBadge()}
      {#if badge}
        <button
          class="review-badge review-badge-{badge.color}"
          title={reviewMetadata?.aiNotes || `Status: ${reviewStatus}`}
          aria-label={`Review status: ${badge.label}`}
        >
          <i class="fas {badge.icon}" aria-hidden="true"></i>
          <span>{badge.label}</span>
        </button>
      {/if}
    {/if}
  </div>
  <div class="header-actions">
    <!-- Primary Actions: Always visible -->
    {#if availableModels.length > 1 && onModelChange}
      <TikaModelSwitcher
        currentModel={selectedModel}
        {availableModels}
        {onModelChange}
      />
    {/if}
    {#if onNewChat}
      <button
        class="action-btn new-chat-btn"
        onclick={onNewChat}
        title="New conversation"
        aria-label="Start new conversation"
      >
        <i class="fas fa-plus" aria-hidden="true"></i>
      </button>
    {/if}
    {#if onOpenHistory}
      <button
        class="action-btn history-btn"
        onclick={onOpenHistory}
        title="Chat history"
        aria-label="Open chat history"
      >
        <i class="fas fa-history" aria-hidden="true"></i>
      </button>
    {/if}

    <!-- Flag for Review: Shows when there's a saved session -->
    {#if sessionId && onFlagForReview}
      <button
        class="action-btn flag-btn"
        class:flagged={isFlagged}
        onclick={() => onFlagForReview(!isFlagged)}
        title={isFlagged ? "Remove from review queue" : "Flag for review"}
        aria-label={isFlagged ? "Remove from review queue" : "Flag conversation for review"}
        aria-pressed={isFlagged}
      >
        <i class="fas fa-flag" aria-hidden="true"></i>
      </button>
    {/if}

    <!-- Copy as image - always visible when there are messages -->
    {#if hasMessages && chatContainer}
      <CopyAsImageButton
        targetElement={chatContainer}
        ariaLabel="Copy conversation as image"
      />
    {/if}

    <!-- Secondary Actions: In overflow menu -->
    <TikaActionMenu
      actions={[
        ...(hasMessages && onToggleToolDetails
          ? [
              {
                id: "tools",
                label: showToolDetails ? "Hide tool details" : "Show tool details",
                icon: "fa-wrench",
                onClick: onToggleToolDetails,
                active: showToolDetails,
              },
            ]
          : []),
        ...(hasMessages && generateCopyForAI
          ? [
              {
                id: "copy-ai",
                label: "Copy for AI review",
                icon: "fa-copy",
                onClick: () => {
                  const data = generateCopyForAI();
                  navigator.clipboard.writeText(data);
                },
              },
            ]
          : []),
        ...(onOpenReview
          ? [
              {
                id: "review-panel",
                label: "Review panel",
                icon: "fa-clipboard-check",
                onClick: onOpenReview,
              },
            ]
          : []),
      ]}
    />
  </div>
</header>

<style>
  .panel-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: rgba(15, 20, 30, 0.95);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  /* Review Status Badge */
  .review-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 16px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid;
    cursor: help;
    transition: all var(--duration-normal, 0.3s) ease;
  }

  .review-badge i {
    font-size: 12px;
  }

  .review-badge-green {
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.4);
    color: #22c55e;
  }

  .review-badge-green:hover {
    background: rgba(34, 197, 94, 0.25);
  }

  .review-badge-red {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.4);
    color: #ef4444;
  }

  .review-badge-red:hover {
    background: rgba(239, 68, 68, 0.25);
  }

  .review-badge-blue {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.4);
    color: #3b82f6;
  }

  .review-badge-blue:hover {
    background: rgba(59, 130, 246, 0.25);
  }

  .review-badge-purple {
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(168, 85, 247, 0.4);
    color: #a855f7;
  }

  .review-badge-purple:hover {
    background: rgba(168, 85, 247, 0.25);
  }

  .review-badge-gray {
    background: rgba(156, 163, 175, 0.15);
    border-color: rgba(156, 163, 175, 0.4);
    color: #9ca3af;
  }

  .review-badge-gray:hover {
    background: rgba(156, 163, 175, 0.25);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .title-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: linear-gradient(135deg, #818cf8 0%, #6366f1 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  }

  .title-icon i {
    font-size: 18px;
    color: white;
  }

  .title-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .title-main {
    font-size: 18px;
    font-weight: 700;
    color: var(--theme-text, #ffffff);
    letter-spacing: -0.01em;
  }

  .title-subtitle {
    font-size: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Action buttons - circular with proper touch targets */
  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 48px);
    height: var(--min-touch-target, 48px);
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 50%;
    color: #ffffff;
    font-size: 16px;
    cursor: pointer;
    transition: all var(--duration-normal, 0.3s) ease;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .action-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .action-btn:active {
    transform: scale(0.95);
    transition: transform 0.1s ease;
  }

  .action-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* New chat button - green gradient for "create new" action */
  .new-chat-btn {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9));
    border-color: rgba(34, 197, 94, 0.3);
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.25);
  }

  .new-chat-btn:hover {
    background: linear-gradient(135deg, rgba(34, 197, 94, 1), rgba(22, 163, 74, 1));
    box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);
  }

  /* History button - indigo gradient for navigation */
  .history-btn {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(79, 70, 229, 0.9));
    border-color: rgba(99, 102, 241, 0.3);
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
  }

  .history-btn:hover {
    background: linear-gradient(135deg, rgba(99, 102, 241, 1), rgba(79, 70, 229, 1));
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
  }

  /* Flag button - amber/yellow when not flagged, red when flagged */
  .flag-btn {
    background: linear-gradient(135deg, rgba(100, 100, 120, 0.85), rgba(70, 70, 90, 0.85));
    border-color: rgba(255, 255, 255, 0.1);
  }

  .flag-btn:hover {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(217, 119, 6, 0.9));
    border-color: rgba(245, 158, 11, 0.3);
    box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);
  }

  .flag-btn.flagged {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.95), rgba(217, 119, 6, 0.95));
    border-color: rgba(245, 158, 11, 0.4);
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.35);
  }

  .flag-btn.flagged:hover {
    background: linear-gradient(135deg, rgba(245, 158, 11, 1), rgba(217, 119, 6, 1));
    box-shadow: 0 4px 14px rgba(245, 158, 11, 0.5);
  }

  /* Responsive: hide subtitle on very narrow screens */
  @media (max-width: 480px) {
    .title-subtitle {
      display: none;
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .action-btn {
      transition: none;
    }

    .action-btn:hover,
    .action-btn:active {
      transform: none;
    }
  }
</style>
