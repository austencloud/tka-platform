<!-- FeedbackKanbanBoard - Kanban board layout for feedback management -->
<script lang="ts">
  import { onMount } from "svelte";
  import type { FeedbackManageState } from "../../state/feedback-manage-state.svelte";
  import type { KanbanBoardState } from "../../state/kanban-board-state.svelte";
  import { createKanbanBoardState } from "../../state/kanban-board-state.svelte";
  import type { IStorageManager } from "$lib/shared/foundation/services/contracts/IStorageManager";
  import type { IFeedbackSorter } from "../../services/contracts/IFeedbackSorter";
  import { container } from "$lib/shared/di";
  import KanbanMobileView from "./KanbanMobileView.svelte";
  import KanbanDesktopView from "./KanbanDesktopView.svelte";

  interface Props {
    manageState: FeedbackManageState;
    onOpenArchive?: () => void;
  }

  const { manageState, onOpenArchive }: Props = $props();

  // Resolve services
  let boardState = $state<KanbanBoardState | null>(null);
  const sortingService = container.items.feedbackSorter;
  const storageService = container.items.storageManager;

  onMount(() => {
    let resizeObserver: ResizeObserver | null = null;

    async function initializeBoard() {
      try {
        boardState = createKanbanBoardState(
          manageState,
          sortingService,
          storageService
        );

        // Set up ResizeObserver to detect mobile view (< 652px container width)
        const boardElement = document.querySelector(".kanban-board");
        if (!boardElement) return;

        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const width = entry.contentRect.width;
            boardState?.setIsMobileView(width < 652);
          }
        });

        resizeObserver.observe(boardElement);
      } catch (err) {
        console.error(`[FeedbackKanbanBoard] Error initializing board:`, err);
      }
    }

    initializeBoard();

    return () => {
      resizeObserver?.disconnect();
    };
  });

  async function handleDeferSubmit() {
    if (!boardState || !boardState.itemToDefer || !boardState.deferDate) return;

    boardState.setIsSubmittingDefer(true);

    try {
      await manageState.deferFeedback(
        boardState.itemToDefer.id,
        boardState.deferDate,
        boardState.deferNotes
      );
      boardState.resetDeferDialog();
    } catch (err) {
      console.error("Failed to defer feedback:", err);
    } finally {
      boardState.setIsSubmittingDefer(false);
    }
  }

  function handleDeferCancel() {
    boardState?.resetDeferDialog();
  }
</script>

<div
  class="kanban-board"
  style="--active-color: {boardState?.activeStatusColor}"
>
  {#if boardState}
    {#if boardState.isMobileView}
      <KanbanMobileView {boardState} {manageState} {onOpenArchive} />
    {:else}
      <KanbanDesktopView {boardState} {manageState} {onOpenArchive} />
    {/if}

    {#if manageState.isLoading && manageState.items.length === 0}
      <div class="loading-overlay">
        <div class="loading-skeletons">
          {#each Array(3) as _}
            <div class="skeleton-card">
              <div class="skeleton-header">
                <div class="skeleton-icon"></div>
                <div class="skeleton-title"></div>
              </div>
              <div class="skeleton-body"></div>
              <div class="skeleton-footer">
                <div class="skeleton-meta"></div>
                <div class="skeleton-badge"></div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Defer Dialog -->
    {#if boardState.showDeferDialog && boardState.itemToDefer}
      <div
        class="defer-dialog-overlay"
        onclick={handleDeferCancel}
        onkeydown={(e) => e.key === "Escape" && handleDeferCancel()}
        role="button"
        tabindex="0"
        aria-label="Close defer dialog"
      >
        <div
          class="defer-dialog"
          onclick={(e) => e.stopPropagation()}
          onkeydown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="defer-dialog-title"
          tabindex="-1"
        >
          <div class="dialog-header">
            <div class="dialog-icon">
              <i class="fas fa-clock" aria-hidden="true"></i>
            </div>
            <h3 class="dialog-title" id="defer-dialog-title">Defer Feedback</h3>
            <button
              type="button"
              class="close-button"
              onclick={handleDeferCancel}
              aria-label="Close dialog"
            >
              <i class="fas fa-times" aria-hidden="true"></i>
            </button>
          </div>

          <div class="dialog-body">
            <div class="feedback-preview">
              <span class="preview-label">Item:</span>
              <span class="preview-title"
                >{boardState.itemToDefer.title ||
                  boardState.itemToDefer.description.substring(0, 60)}</span
              >
            </div>

            <div class="form-field">
              <label for="defer-date" class="field-label">
                <i class="fas fa-calendar" aria-hidden="true"></i>
                Reactivate on
              </label>
              <input
                id="defer-date"
                type="date"
                class="date-input"
                value={boardState.deferDate}
                onchange={(e) =>
                  boardState?.setDeferDate(e.currentTarget.value)}
                min={new Date().toISOString().split("T")[0]}
                required
              />
            </div>

            <div class="form-field">
              <label for="defer-notes" class="field-label">
                <i class="fas fa-sticky-note" aria-hidden="true"></i>
                Reason (optional)
              </label>
              <textarea
                id="defer-notes"
                class="notes-input"
                value={boardState.deferNotes}
                onchange={(e) =>
                  boardState?.setDeferNotes(e.currentTarget.value)}
                placeholder="Why are you deferring this? (e.g., 'Wait for Svelte 6', 'Revisit after Q1')"
                rows="3"
              ></textarea>
            </div>
          </div>

          <div class="dialog-footer">
            <button
              type="button"
              class="cancel-button"
              onclick={handleDeferCancel}
              disabled={boardState.isSubmittingDefer}
            >
              Cancel
            </button>
            <button
              type="button"
              class="submit-button"
              onclick={handleDeferSubmit}
              disabled={!boardState.deferDate || boardState.isSubmittingDefer}
            >
              {#if boardState.isSubmittingDefer}
                <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                Deferring...
              {:else}
                <i class="fas fa-clock" aria-hidden="true"></i>
                Defer
              {/if}
            </button>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .kanban-board {
    /* ===== FLUID SPACING - All clamp() based ===== */
    --kb-space-2xs: clamp(4px, 1cqi, 8px);
    --kb-space-xs: clamp(6px, 1.5cqi, 12px);
    --kb-space-sm: clamp(10px, 2.5cqi, 16px);
    --kb-space-md: clamp(14px, 3.5cqi, 24px);
    --kb-space-lg: clamp(20px, 5cqi, 32px);
    --kb-space-xl: clamp(28px, 7cqi, 48px);

    /* ===== FLUID TYPOGRAPHY - Accessible minimum sizes ===== */
    --kb-text-xs: clamp(0.8125rem, 2cqi, 0.875rem); /* min 13px */
    --kb-text-sm: clamp(0.875rem, 2.5cqi, 1rem); /* min 14px */
    --kb-text-base: clamp(1rem, 3cqi, 1.125rem); /* min 16px */
    --kb-text-lg: clamp(1.125rem, 3.5cqi, 1.25rem); /* min 18px */

    /* ===== FLUID RADII ===== */
    --kb-radius-sm: clamp(6px, 1.5cqi, 10px);
    --kb-radius-md: clamp(10px, 2.5cqi, 16px);
    --kb-radius-lg: clamp(14px, 3.5cqi, 20px);
    --kb-radius-full: 999px;

    /* ===== COLORS ===== */
    --kb-text: var(--theme-text);
    --kb-text-muted: color-mix(in srgb, var(--theme-text) 75%, transparent);
    --kb-text-subtle: var(--theme-text-dim);

    /* ===== TRANSITIONS ===== */
    --spring-smooth: cubic-bezier(0.4, 0, 0.2, 1);
    --spring-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);

    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    container-type: inline-size;
    container-name: kanban;
    background: transparent;
    backdrop-filter: none;
    box-shadow: none;
    transition: background 0.5s ease;
  }

  /* ===== LOADING SKELETON ===== */
  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--kb-space-xl);
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
  }

  .loading-skeletons {
    display: flex;
    flex-direction: column;
    gap: var(--kb-space-md);
    width: 100%;
    max-width: clamp(280px, 70cqi, 400px);
  }

  .skeleton-card {
    display: flex;
    flex-direction: column;
    gap: var(--kb-space-sm);
    padding: var(--kb-space-md);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--kb-radius-lg);
    animation: skeleton-pulse 1.5s ease-in-out infinite;
  }

  .skeleton-header {
    display: flex;
    align-items: center;
    gap: var(--kb-space-sm);
  }

  .skeleton-icon {
    width: clamp(28px, 7cqi, 36px);
    height: clamp(28px, 7cqi, 36px);
    background: var(--theme-card-hover-bg);
    border-radius: var(--kb-radius-sm);
  }

  .skeleton-title {
    flex: 1;
    height: clamp(16px, 4cqi, 20px);
    background: var(--theme-stroke, var(--theme-card-hover-bg));
    border-radius: var(--kb-radius-sm);
  }

  .skeleton-body {
    height: clamp(36px, 9cqi, 48px);
    background: var(--theme-card-hover-bg, var(--theme-card-bg));
    border-radius: var(--kb-radius-sm);
  }

  .skeleton-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: var(--kb-space-sm);
    border-top: 1px solid var(--theme-stroke);
  }

  .skeleton-meta {
    width: clamp(80px, 20cqi, 120px);
    height: clamp(12px, 3cqi, 16px);
    background: var(--theme-card-hover-bg, var(--theme-card-bg));
    border-radius: var(--kb-radius-sm);
  }

  .skeleton-badge {
    width: clamp(24px, 6cqi, 32px);
    height: clamp(24px, 6cqi, 32px);
    background: var(--theme-card-hover-bg);
    border-radius: var(--kb-radius-sm);
  }

  @keyframes skeleton-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* ===== DEFER DIALOG ===== */
  .defer-dialog-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    z-index: 1000;
    animation: fadeIn 0.2s ease;
  }

  .defer-dialog {
    display: flex;
    flex-direction: column;
    width: clamp(320px, 90vw, 500px);
    max-height: 90vh;
    background: linear-gradient(
      180deg,
      var(--theme-panel-elevated-bg) 0%,
      var(--theme-panel-bg) 100%
    );
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: clamp(16px, 4cqi, 24px);
    box-shadow:
      0 20px 60px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 var(--theme-stroke, var(--theme-stroke));
    animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .dialog-header {
    display: flex;
    align-items: center;
    gap: clamp(12px, 3cqi, 16px);
    padding: clamp(16px, 4cqi, 24px);
    border-bottom: 1px solid var(--theme-stroke);
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--semantic-warning) 10%, transparent) 0%,
      transparent 100%
    );
  }

  .dialog-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(36px, 9cqi, 44px);
    height: clamp(36px, 9cqi, 44px);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--semantic-warning) 40%, transparent) 0%,
      color-mix(in srgb, var(--semantic-warning) 20%, transparent) 100%
    );
    border-radius: clamp(8px, 2cqi, 12px);
    color: var(--semantic-warning);
    font-size: clamp(16px, 4cqi, 20px);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--semantic-warning) 30%, transparent);
  }

  .dialog-title {
    flex: 1;
    margin: 0;
    font-size: clamp(1.125rem, 3.5cqi, 1.375rem);
    font-weight: 700;
    color: var(--theme-text);
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(32px, 8cqi, 40px);
    height: clamp(32px, 8cqi, 40px);
    background: transparent;
    border: none;
    border-radius: clamp(6px, 1.5cqi, 8px);
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: clamp(16px, 4cqi, 18px);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text, var(--theme-text));
  }

  .dialog-body {
    display: flex;
    flex-direction: column;
    gap: clamp(16px, 4cqi, 24px);
    padding: clamp(20px, 5cqi, 28px);
    overflow-y: auto;
  }

  .feedback-preview {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 1.5cqi, 8px);
    padding: clamp(12px, 3cqi, 16px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-left: 3px solid var(--semantic-warning);
    border-radius: clamp(8px, 2cqi, 12px);
  }

  .preview-label {
    font-size: clamp(0.75rem, 2cqi, 0.875rem);
    font-weight: 600;
    color: var(--theme-text-dim, var(--theme-text-dim));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .preview-title {
    font-size: clamp(0.875rem, 2.5cqi, 1rem);
    color: var(--theme-text, var(--theme-text));
    line-height: 1.4;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 2cqi, 12px);
  }

  .field-label {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2cqi, 10px);
    font-size: clamp(0.875rem, 2.5cqi, 1rem);
    font-weight: 600;
    color: var(--theme-text);
  }

  .field-label i {
    font-size: clamp(14px, 3.5cqi, 16px);
    color: var(--semantic-warning);
    opacity: 0.8;
  }

  .date-input,
  .notes-input {
    width: 100%;
    padding: clamp(10px, 2.5cqi, 14px) clamp(12px, 3cqi, 16px);
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: clamp(8px, 2cqi, 12px);
    color: var(--theme-text);
    font-size: clamp(0.875rem, 2.5cqi, 1rem);
    font-family: inherit;
    transition: all 0.2s ease;
  }

  .date-input:focus,
  .notes-input:focus {
    outline: none;
    background: var(--theme-card-hover-bg, var(--theme-card-bg));
    border-color: var(--semantic-warning);
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--semantic-warning) 15%, transparent);
  }

  .notes-input {
    resize: vertical;
    min-height: 80px;
  }

  .dialog-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: clamp(10px, 2.5cqi, 14px);
    padding: clamp(16px, 4cqi, 20px) clamp(20px, 5cqi, 28px);
    border-top: 1px solid var(--theme-stroke);
    background: rgba(0, 0, 0, 0.2);
  }

  .cancel-button,
  .submit-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(6px, 1.5cqi, 8px);
    padding: clamp(10px, 2.5cqi, 12px) clamp(16px, 4cqi, 24px);
    border: none;
    border-radius: clamp(8px, 2cqi, 12px);
    font-size: clamp(0.875rem, 2.5cqi, 1rem);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cancel-button {
    background: var(--theme-card-bg);
    color: var(--theme-text);
  }

  .cancel-button:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .submit-button {
    background: linear-gradient(
      135deg,
      var(--semantic-warning) 0%,
      #d97706 100%
    );
    color: rgba(0, 0, 0, 0.9);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--semantic-warning) 30%, transparent);
  }

  .submit-button:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      var(--semantic-warning) 0%,
      var(--semantic-warning) 100%
    );
    box-shadow: 0 6px 16px
      color-mix(in srgb, var(--semantic-warning) 40%, transparent);
    transform: translateY(-1px);
  }

  .submit-button:disabled,
  .cancel-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
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

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .skeleton-card {
      animation: none;
    }
    .defer-dialog-overlay {
      animation: none;
    }
    .defer-dialog {
      animation: none;
    }
    /* Disable local keyframe animations */
    [style*="skeleton-pulse"] {
      animation: none;
    }
  }
</style>
