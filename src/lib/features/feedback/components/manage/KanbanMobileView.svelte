<!-- Mobile view: tabs + active column -->
<script lang="ts">
  import type { FeedbackManageState } from "$lib/shared/feedback/state/feedback-manage-state.svelte";
  import type { KanbanBoardState } from "../../state/kanban-board-state.svelte";
  import type {
    FeedbackItem, FeedbackStatus, } from "$lib/shared/feedback/domain/models/feedback-models";
  import FeedbackKanbanColumn from "./FeedbackKanbanColumn.svelte";
  import KanbanStatusTab from "./KanbanStatusTab.svelte";
  import type { ClaimStatusDeriver } from "../../services/claim-status-deriver";

  interface Props {
    boardState: KanbanBoardState;
    manageState: FeedbackManageState;
    claimStatusDeriver?: ClaimStatusDeriver;
    onOpenArchive?: () => void;
  }

  const { boardState, manageState, claimStatusDeriver, onOpenArchive }: Props = $props();

  const KANBAN_STATUSES = [
    "new",
    "in-progress",
    "in-review",
    "completed",
  ] as const;

  function handleDragStart(item: FeedbackItem) {
    boardState.setDraggedItem(item);
  }

  function handleDragEnd() {
    if (boardState.touchDragPosition && boardState.draggedItem) {
      const targetColumn = boardState.getColumnAtPosition(
        boardState.touchDragPosition.x,
        boardState.touchDragPosition.y
      );
      if (targetColumn && targetColumn !== boardState.draggedItem.status) {
        handleDrop(targetColumn);
        return;
      }
    }
    boardState.setDraggedItem(null);
    boardState.setDragOverColumn(null);
    boardState.setTouchDragPosition(null);
  }

  function handleTouchDrag(item: FeedbackItem, x: number, y: number) {
    boardState.setTouchDragPosition({ x, y });
    const targetColumn = boardState.getColumnAtPosition(x, y);
    if (targetColumn && targetColumn !== item.status) {
      boardState.setDragOverColumn(targetColumn);
    } else {
      boardState.setDragOverColumn(null);
    }
  }

  function handleDragOver(status: FeedbackStatus | "deferred" | "trash") {
    if (boardState.draggedItem) {
      if (status === "deferred" || status === "trash" || boardState.draggedItem.status !== status) {
        boardState.setDragOverColumn(status);
      }
    }
  }

  function handleDragLeave() {
    boardState.setDragOverColumn(null);
  }

  async function handleDrop(status: FeedbackStatus | "deferred" | "trash") {
    if (!boardState.draggedItem) return;

    if (status === "deferred") {
      boardState.setItemToDefer(boardState.draggedItem);
      boardState.setShowDeferDialog(true);
      boardState.setDraggedItem(null);
      boardState.setDragOverColumn(null);
      return;
    }

    if (status === "trash") {
      boardState.setItemToTrash(boardState.draggedItem);
      boardState.setShowTrashDialog(true);
      boardState.setDraggedItem(null);
      boardState.setDragOverColumn(null);
      return;
    }

    if (boardState.draggedItem.status !== status) {
      // Record for undo BEFORE the update
      boardState.pushUndo({
        feedbackId: boardState.draggedItem.id,
        previousStatus: boardState.draggedItem.status,
        newStatus: status,
        timestamp: Date.now(),
      });

      try {
        await manageState.updateStatus(boardState.draggedItem.id, status);
      } catch {
        // Error is logged in state
      }
    }
    boardState.setDraggedItem(null);
    boardState.setDragOverColumn(null);
  }

  function handleCardClick(item: FeedbackItem) {
    manageState.selectItem(item);
  }
</script>

<!-- Mobile: Colorful Status Tabs -->
<div class="status-tabs" role="tablist" aria-label="Feedback status">
  {#each KANBAN_STATUSES as status}
    {@const count = boardState.itemsByStatus[status]?.length ?? 0}
    <KanbanStatusTab
      {status}
      isActive={boardState.activeStatus === status}
      {count}
      onClick={() => boardState.setActiveStatus(status)}
    />
  {/each}
</div>

<!-- Active column display -->
<div class="columns-container">
  {#each KANBAN_STATUSES as status}
    <FeedbackKanbanColumn
      {status}
      config={{ icon: "", label: "", color: "" }}
      items={boardState.itemsByStatus[status] ?? []}
      wipStatus={boardState.wipStatus[status]}
      {claimStatusDeriver}
      isDropTarget={boardState.dragOverColumn === status}
      isDragActive={boardState.draggedItem !== null}
      isActiveTab={boardState.activeStatus === status}
      selectedItemId={manageState.selectedItem?.id ?? null}
      disableDrag={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onTouchDrag={handleTouchDrag}
      onDragOver={() => handleDragOver(status)}
      onDragLeave={handleDragLeave}
      onDrop={() => handleDrop(status)}
      onCardClick={handleCardClick}
    />
  {/each}
</div>

<style>
  /* ===== STATUS TABS ===== */
  .status-tabs {
    display: flex;
    gap: clamp(6px, 1.5cqi, 12px);
    padding: clamp(10px, 2.5cqi, 16px) clamp(14px, 3.5cqi, 24px);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .status-tabs::-webkit-scrollbar {
    display: none;
  }

  /* ===== COLUMNS CONTAINER ===== */
  .columns-container {
    display: flex;
    gap: clamp(16px, 1cqi, 32px);
    flex: 1;
    width: 100%;
    margin: 0 auto;
    padding: clamp(16px, 1cqi, 32px);
    overflow-x: hidden;
    overflow-y: auto;
  }
</style>
