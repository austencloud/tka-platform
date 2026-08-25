// src/lib/features/stage/state/stage-edit-mode.svelte.ts

export type CameraMode = "orbit" | "top-down";

export interface StageEditMode {
  readonly cameraMode: CameraMode;
  readonly selectedPerformerId: string | null;
  readonly selectedFormationId: string | null;
  readonly selectedClipId: string | null;
  readonly multiSelectedPerformerIds: Set<string>;
  isDragging: boolean;
  toggleCameraMode(): void;
  selectPerformer(id: string, addToSelection?: boolean): void;
  selectFormation(formationId: string | null): void;
  selectSpot(formationId: string, performerId: string): void;
  selectClip(performerId: string, clipId: string): void;
  clearSelection(): void;
}

export function createStageEditMode(): StageEditMode {
  let cameraMode = $state<CameraMode>("orbit");
  let selectedPerformerId = $state<string | null>(null);
  let selectedFormationId = $state<string | null>(null);
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
    selectedFormationId = null;
    selectedClipId = null;
  }

  function selectFormation(formationId: string | null) {
    selectedFormationId = formationId;
    selectedPerformerId = null;
    selectedClipId = null;
    multiSelectedPerformerIds = new Set();
  }

  function selectSpot(formationId: string, performerId: string) {
    selectedFormationId = formationId;
    selectedPerformerId = performerId;
    selectedClipId = null;
    multiSelectedPerformerIds = new Set([performerId]);
  }

  function selectClip(performerId: string, clipId: string) {
    selectedPerformerId = performerId;
    selectedFormationId = null;
    selectedClipId = clipId;
    multiSelectedPerformerIds = new Set([performerId]);
  }

  function clearSelection() {
    selectedPerformerId = null;
    selectedFormationId = null;
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
    get selectedFormationId() {
      return selectedFormationId;
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
    selectFormation,
    selectSpot,
    selectClip,
    clearSelection,
  };
}
