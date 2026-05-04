<!-- FeedbackKanbanBoard - Kanban board layout for feedback management -->
<script lang="ts">
  import { onMount } from "svelte";
  import type { FeedbackManageState } from "../../state/feedback-manage-state.svelte";
  import type { KanbanBoardState } from "../../state/kanban-board-state.svelte";
  import { createKanbanBoardState } from "../../state/kanban-board-state.svelte";
  import { getFeedbackSorter } from "$lib/features/feedback/getFeedbackSorter";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import { STATUS_CONFIG } from "../../domain/models/feedback-models";
  import KanbanMobileView from "./KanbanMobileView.svelte";
  import KanbanDesktopView from "./KanbanDesktopView.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  interface Props {
    manageState: FeedbackManageState;
    onOpenArchive?: () => void;
  }

  const { manageState, onOpenArchive }: Props = $props();

  // Resolve services
  let boardState = $state<KanbanBoardState | null>(null);
  const sortingService = getFeedbackSorter();

  // Get claim status deriver for UI indicators
  import { FeedbackSorter } from "../../services/implementations/FeedbackSorter";
  const claimStatusDeriver = sortingService instanceof FeedbackSorter
    ? sortingService.getClaimStatusDeriver()
    : undefined;

  // Debounce flag to prevent rapid undo/redo
  let isProcessingUndoRedo = false;

  // Handle undo keyboard shortcut
  async function handleUndo() {
    if (!boardState?.canUndo || isProcessingUndoRedo) return;

    const action = boardState.popUndo();
    if (!action) return;

    // Check if item still exists
    const itemExists = manageState.allItems.some(
      (item) => item.id === action.feedbackId
    );
    if (!itemExists) {
      toast.warning(t("feedback_item_no_longer_exists"));
      return;
    }

    isProcessingUndoRedo = true;

    try {
      await manageState.updateStatus(action.feedbackId, action.previousStatus);
      // Push to redo stack (with swapped statuses for redo)
      boardState.pushRedo({
        feedbackId: action.feedbackId,
        previousStatus: action.newStatus,
        newStatus: action.previousStatus,
        timestamp: Date.now(),
      });
      const statusLabel = STATUS_CONFIG[action.previousStatus]?.label || action.previousStatus;
      toast.info(t("feedback_moved_back_to", { status: statusLabel }));
    } catch (err) {
      console.error("[FeedbackKanbanBoard] Failed to undo:", err);
      toast.error(t("feedback_failed_undo"));
    } finally {
      isProcessingUndoRedo = false;
    }
  }

  // Handle redo keyboard shortcut
  async function handleRedo() {
    if (!boardState?.canRedo || isProcessingUndoRedo) return;

    const action = boardState.popRedo();
    if (!action) return;

    // Check if item still exists
    const itemExists = manageState.allItems.some(
      (item) => item.id === action.feedbackId
    );
    if (!itemExists) {
      toast.warning(t("feedback_item_no_longer_exists"));
      return;
    }

    isProcessingUndoRedo = true;

    try {
      await manageState.updateStatus(action.feedbackId, action.previousStatus);
      // Push back to undo stack without clearing redo (we're in redo mode)
      boardState.pushUndo(
        {
          feedbackId: action.feedbackId,
          previousStatus: action.newStatus,
          newStatus: action.previousStatus,
          timestamp: Date.now(),
        },
        false // Don't clear redo stack
      );
      const statusLabel = STATUS_CONFIG[action.previousStatus]?.label || action.previousStatus;
      toast.info(t("feedback_restored_to", { status: statusLabel }));
    } catch (err) {
      console.error("[FeedbackKanbanBoard] Failed to redo:", err);
      toast.error(t("feedback_failed_redo"));
    } finally {
      isProcessingUndoRedo = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    // Only handle if we're not in an input/textarea
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      return;
    }

    // Ctrl+Shift+Z or Cmd+Shift+Z = Redo
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
      e.preventDefault();
      handleRedo();
      return;
    }

    // Ctrl+Z or Cmd+Z = Undo
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
    }
  }

  onMount(() => {
    let resizeObserver: ResizeObserver | null = null;

    async function initializeBoard() {
      try {
        boardState = createKanbanBoardState(
          manageState,
          sortingService,
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

    // Add keyboard listener for undo/redo
    document.addEventListener("keydown", handleKeydown);

    return () => {
      resizeObserver?.disconnect();
      document.removeEventListener("keydown", handleKeydown);
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

  async function handleTrashConfirm() {
    if (!boardState || !boardState.itemToTrash) return;

    boardState.setIsSubmittingTrash(true);

    try {
      await manageState.deleteFeedback(boardState.itemToTrash.id);
      toast.info(t("feedback_deleted"));
      boardState.resetTrashDialog();
    } catch (err) {
      console.error("Failed to delete feedback:", err);
      toast.error(t("feedback_failed_delete"));
    } finally {
      boardState.setIsSubmittingTrash(false);
    }
  }

  function handleTrashCancel() {
    boardState?.resetTrashDialog();
  }
</script>

<div
  class="kanban-board"
  style="--active-color: {boardState?.activeStatusColor}"
>
  {#if boardState}
    {#if boardState.isMobileView}
      <KanbanMobileView {boardState} {manageState} {claimStatusDeriver} {onOpenArchive} />
    {:else}
      <KanbanDesktopView {boardState} {manageState} {claimStatusDeriver} {onOpenArchive} />
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
            <h3 class="dialog-title" id="defer-dialog-title">{t("feedback_defer_title")}</h3>
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
              <span class="preview-label">{t("feedback_defer_item_label")}</span>
              <span class="preview-title"
                >{boardState.itemToDefer.title ||
                  boardState.itemToDefer.description.substring(0, 60)}</span
              >
            </div>

            <div class="form-field">
              <label for="defer-date" class="field-label">
                <i class="fas fa-calendar" aria-hidden="true"></i>
                {t("feedback_defer_reactivate_on")}
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
                {t("feedback_defer_reason")}
              </label>
              <textarea
                id="defer-notes"
                class="notes-input"
                value={boardState.deferNotes}
                onchange={(e) =>
                  boardState?.setDeferNotes(e.currentTarget.value)}
                placeholder={t("feedback_defer_placeholder")}
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
              {t("feedback_cancel")}
            </button>
            <button
              type="button"
              class="submit-button"
              onclick={handleDeferSubmit}
              disabled={!boardState.deferDate || boardState.isSubmittingDefer}
            >
              {#if boardState.isSubmittingDefer}
                <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                {t("feedback_deferring")}
              {:else}
                <i class="fas fa-clock" aria-hidden="true"></i>
                {t("feedback_defer")}
              {/if}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Trash Confirmation Dialog -->
    {#if boardState.showTrashDialog && boardState.itemToTrash}
      <div
        class="trash-dialog-overlay"
        onclick={handleTrashCancel}
        onkeydown={(e) => e.key === "Escape" && handleTrashCancel()}
        role="button"
        tabindex="0"
        aria-label="Close trash dialog"
      >
        <div
          class="trash-dialog"
          onclick={(e) => e.stopPropagation()}
          onkeydown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="trash-dialog-title"
          tabindex="-1"
        >
          <div class="dialog-header trash-header">
            <div class="dialog-icon trash-icon">
              <i class="fas fa-trash-alt" aria-hidden="true"></i>
            </div>
            <h3 class="dialog-title" id="trash-dialog-title">{t("feedback_delete_title")}</h3>
            <button
              type="button"
              class="close-button"
              onclick={handleTrashCancel}
              aria-label="Close dialog"
            >
              <i class="fas fa-times" aria-hidden="true"></i>
            </button>
          </div>

          <div class="dialog-body">
            <div class="feedback-preview trash-preview">
              <span class="preview-label">{t("feedback_defer_item_label")}</span>
              <span class="preview-title"
                >{boardState.itemToTrash.title ||
                  boardState.itemToTrash.description.substring(0, 60)}</span
              >
            </div>

            <p class="trash-warning">
              {t("feedback_delete_warning")}
            </p>
          </div>

          <div class="dialog-footer">
            <button
              type="button"
              class="cancel-button"
              onclick={handleTrashCancel}
              disabled={boardState.isSubmittingTrash}
            >
              {t("feedback_cancel")}
            </button>
            <button
              type="button"
              class="submit-button trash-submit"
              onclick={handleTrashConfirm}
              disabled={boardState.isSubmittingTrash}
            >
              {#if boardState.isSubmittingTrash}
                <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                {t("feedback_deleting")}
              {:else}
                <i class="fas fa-trash-alt" aria-hidden="true"></i>
                {t("feedback_delete")}
              {/if}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Undo/Redo Hint - shows briefly after drag operations -->
    {#if boardState.showUndoHint}
      <div
        class="undo-hint"
        onclick={() => boardState?.dismissUndoHint()}
        onkeydown={(e) =>
          (e.key === "Escape" || e.key === "Enter" || e.key === " ") &&
          boardState?.dismissUndoHint()}
        role="button"
        aria-live="polite"
        tabindex="0"
      >
        <i class="fas fa-undo" aria-hidden="true"></i>
        <span>{t("feedback_undo_hint")}</span>
        <button
          type="button"
          class="undo-hint-dismiss"
          onclick={(e) => {
            e.stopPropagation();
            boardState?.dismissUndoHint();
          }}
          aria-label="Dismiss hint"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
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
    animation: fadeIn var(--duration-normal) ease;
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
    animation: slideUp var(--duration-emphasis) cubic-bezier(0.34, 1.56, 0.64, 1);
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
    transition: all var(--duration-normal) ease;
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
    transition: all var(--duration-normal) ease;
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
    transition: all var(--duration-normal) ease;
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

  /* ===== TRASH DIALOG ===== */
  .trash-dialog-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    z-index: 1000;
    animation: fadeIn var(--duration-normal) ease;
  }

  .trash-dialog {
    display: flex;
    flex-direction: column;
    width: clamp(320px, 90vw, 460px);
    max-height: 90vh;
    background: linear-gradient(
      180deg,
      var(--theme-panel-elevated-bg) 0%,
      var(--theme-panel-bg) 100%
    );
    border: 1px solid var(--theme-stroke);
    border-radius: clamp(16px, 4cqi, 24px);
    box-shadow:
      0 20px 60px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 var(--theme-stroke);
    animation: slideUp var(--duration-emphasis) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .trash-header {
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--semantic-error) 10%, transparent) 0%,
      transparent 100%
    );
  }

  .trash-icon {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--semantic-error) 40%, transparent) 0%,
      color-mix(in srgb, var(--semantic-error) 20%, transparent) 100%
    );
    color: var(--semantic-error);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--semantic-error) 30%, transparent);
  }

  .trash-preview {
    border-left-color: var(--semantic-error);
  }

  .trash-warning {
    margin: 0;
    font-size: clamp(0.875rem, 2.5cqi, 1rem);
    color: var(--theme-text-dim);
    line-height: 1.5;
  }

  .trash-submit {
    background: linear-gradient(
      135deg,
      var(--semantic-error) 0%,
      #b91c1c 100%
    );
    color: #fff;
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--semantic-error) 30%, transparent);
  }

  .trash-submit:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      var(--semantic-error) 0%,
      var(--semantic-error) 100%
    );
    box-shadow: 0 6px 16px
      color-mix(in srgb, var(--semantic-error) 40%, transparent);
    transform: translateY(-1px);
  }

  /* ===== UNDO HINT ===== */
  .undo-hint {
    position: absolute;
    bottom: clamp(16px, 4cqi, 24px);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: clamp(8px, 2cqi, 12px);
    padding: clamp(10px, 2.5cqi, 14px) clamp(16px, 4cqi, 20px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--kb-radius-full);
    box-shadow:
      0 8px 24px rgba(0, 0, 0, 0.3),
      0 2px 8px rgba(0, 0, 0, 0.2);
    font-size: var(--kb-text-sm);
    color: var(--theme-text);
    cursor: pointer;
    animation: slideUpFade 0.3s var(--spring-bounce);
    z-index: 100;
  }

  .undo-hint i {
    font-size: clamp(14px, 3.5cqi, 16px);
    color: var(--theme-accent);
  }

  .undo-hint span {
    font-weight: 500;
  }

  .undo-hint-dismiss {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(20px, 5cqi, 24px);
    height: clamp(20px, 5cqi, 24px);
    margin-left: clamp(4px, 1cqi, 8px);
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--theme-text-dim);
    font-size: clamp(10px, 2.5cqi, 12px);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .undo-hint-dismiss:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  @keyframes slideUpFade {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
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
    .trash-dialog-overlay {
      animation: none;
    }
    .trash-dialog {
      animation: none;
    }
    .undo-hint {
      animation: none;
    }
  }
</style>
