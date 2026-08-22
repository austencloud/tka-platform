export type FeedbackManageLayoutMode =
  | "compact"
  | "queue"
  | "compact-height"
  | "kanban"
  | "wide-kanban";

export interface FeedbackManageContainerSize {
  width: number;
  height: number;
}

export const FEEDBACK_MANAGE_LAYOUT_THRESHOLDS = {
  compactWidth: 600,
  kanbanWidth: 1320,
  wideKanbanWidth: 2600,
  compactHeight: 480,
} as const;

/**
 * Chooses a workflow composition from the space the board actually receives.
 * Height wins because four lanes are not useful in a short landscape window.
 */
export function getFeedbackManageLayoutMode({
  width,
  height,
}: FeedbackManageContainerSize): FeedbackManageLayoutMode {
  if (height < FEEDBACK_MANAGE_LAYOUT_THRESHOLDS.compactHeight) {
    return "compact-height";
  }
  if (width < FEEDBACK_MANAGE_LAYOUT_THRESHOLDS.compactWidth) {
    return "compact";
  }
  if (width < FEEDBACK_MANAGE_LAYOUT_THRESHOLDS.kanbanWidth) {
    return "queue";
  }
  if (width < FEEDBACK_MANAGE_LAYOUT_THRESHOLDS.wideKanbanWidth) {
    return "kanban";
  }
  return "wide-kanban";
}

export function isFeedbackManageQueueMode(
  mode: FeedbackManageLayoutMode
): boolean {
  return mode === "compact" || mode === "queue" || mode === "compact-height";
}
