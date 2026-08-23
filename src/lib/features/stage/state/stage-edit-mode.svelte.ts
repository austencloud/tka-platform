// src/lib/features/stage/state/stage-edit-mode.svelte.ts

export type CameraMode = "orbit" | "top-down";

export interface StageEditMode {
  readonly cameraMode: CameraMode;
  readonly selectedPerformerId: string | null;
  readonly selectedMarkId: string | null;
  readonly selectedClipId: string | null;
  readonly multiSelectedPerformerIds: Set<string>;
  isDragging: boolean;
  toggleCameraMode(): void;
  selectPerformer(id: string, addToSelection?: boolean): void;
  selectMark(performerId: string, markId: string): void;
  selectClip(performerId: string, clipId: string): void;
  clearSelection(): void;
}

export function createStageEditMode(): StageEditMode {
  let cameraMode = $state<CameraMode>("orbit");
  let selectedPerformerId = $state<string | null>(null);
  let selectedMarkId = $state<string | null>(null);
  let selectedClipId = $state<string | null>(null);
  let multiSelectedPerformerIds = $state<Set<string>>(new Set());
  let isDragging = $state(false);

  function toggleCameraMode() {
    cameraMode = cameraMode === "orbit" ? "top-down" : "orbit";
  }

  function selectPerformer(id: string, addToSelection = false) {
    if (addToSelection) {
      const next = new Set(multiSelectedPerformerIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      multiSelectedPerformerIds = next;
      selectedPerformerId = id;
    } else {
      multiSelectedPerformerIds = new Set([id]);
      selectedPerformerId = id;
    }
    selectedMarkId = null;
    selectedClipId = null;
  }

  function selectMark(performerId: string, markId: string) {
    selectedPerformerId = performerId;
    selectedMarkId = markId;
    multiSelectedPerformerIds = new Set([performerId]);
    selectedClipId = null;
  }

  function selectClip(performerId: string, clipId: string) {
    selectedPerformerId = performerId;
    selectedMarkId = null;
    selectedClipId = clipId;
    multiSelectedPerformerIds = new Set([performerId]);
  }

  function clearSelection() {
    selectedPerformerId = null;
    selectedMarkId = null;
    selectedClipId = null;
    multiSelectedPerformerIds = new Set();
  }

  return {
    get cameraMode() {
      return cameraMode;
    },
    get selectedPerformerId() {
      return selectedPerformerId;
    },
    get selectedMarkId() {
      return selectedMarkId;
    },
    get selectedClipId() {
      return selectedClipId;
    },
    get multiSelectedPerformerIds() {
      return multiSelectedPerformerIds;
    },
    get isDragging() {
      return isDragging;
    },
    set isDragging(v: boolean) {
      isDragging = v;
    },
    toggleCameraMode,
    selectPerformer,
    selectMark,
    selectClip,
    clearSelection,
  };
}
