export type StageSelection =
  | { kind: "none" }
  | {
      kind: "performers";
      performerIds: readonly string[];
      anchorId: string;
    }
  | { kind: "formation"; formationId: string }
  | { kind: "spot"; formationId: string; performerId: string }
  | { kind: "travel"; formationId: string; performerId: string }
  | { kind: "clip"; performerId: string; clipId: string };

export interface StageEditMode {
  readonly selection: StageSelection;
  readonly selectedPerformerId: string | null;
  readonly selectedFormationId: string | null;
  readonly selectedClipId: string | null;
  readonly multiSelectedPerformerIds: Set<string>;
  isDragging: boolean;
  selectPerformer(id: string, addToSelection?: boolean): void;
  selectPerformers(ids: readonly string[], anchorId?: string): void;
  selectFormation(formationId: string | null): void;
  selectSpot(formationId: string, performerId: string): void;
  selectTravel(formationId: string, performerId: string): void;
  selectClip(performerId: string, clipId: string): void;
  clearSelection(): void;
}

function performerIdForSelection(selection: StageSelection): string | null {
  switch (selection.kind) {
    case "performers":
      return selection.anchorId;
    case "spot":
    case "travel":
    case "clip":
      return selection.performerId;
    default:
      return null;
  }
}

function formationIdForSelection(selection: StageSelection): string | null {
  switch (selection.kind) {
    case "formation":
    case "spot":
    case "travel":
      return selection.formationId;
    default:
      return null;
  }
}

export function createStageEditMode(): StageEditMode {
  let selection = $state<StageSelection>({ kind: "none" });
  let isDragging = $state(false);

  function selectPerformer(id: string, addToSelection = false) {
    if (!addToSelection) {
      selection = { kind: "performers", performerIds: [id], anchorId: id };
      return;
    }

    const selected =
      selection.kind === "performers" ? [...selection.performerIds] : [];
    const existingIndex = selected.indexOf(id);
    if (existingIndex >= 0) selected.splice(existingIndex, 1);
    else selected.push(id);

    selection =
      selected.length === 0
        ? { kind: "none" }
        : {
            kind: "performers",
            performerIds: selected,
            anchorId: existingIndex >= 0 ? selected.at(-1)! : id,
          };
  }

  function selectPerformers(ids: readonly string[], anchorId?: string) {
    const performerIds = [...new Set(ids)].filter(Boolean);
    if (performerIds.length === 0) {
      selection = { kind: "none" };
      return;
    }
    const anchor =
      anchorId && performerIds.includes(anchorId)
        ? anchorId
        : performerIds.at(-1)!;
    selection = { kind: "performers", performerIds, anchorId: anchor };
  }

  function selectFormation(formationId: string | null) {
    selection = formationId
      ? { kind: "formation", formationId }
      : { kind: "none" };
  }

  function selectSpot(formationId: string, performerId: string) {
    selection = { kind: "spot", formationId, performerId };
  }

  function selectTravel(formationId: string, performerId: string) {
    selection = { kind: "travel", formationId, performerId };
  }

  function selectClip(performerId: string, clipId: string) {
    selection = { kind: "clip", performerId, clipId };
  }

  function clearSelection() {
    selection = { kind: "none" };
  }

  return {
    get selection() {
      return selection;
    },
    get selectedPerformerId() {
      return performerIdForSelection(selection);
    },
    get selectedFormationId() {
      return formationIdForSelection(selection);
    },
    get selectedClipId() {
      return selection.kind === "clip" ? selection.clipId : null;
    },
    get multiSelectedPerformerIds() {
      return new Set(
        selection.kind === "performers" ? selection.performerIds : []
      );
    },
    get isDragging() {
      return isDragging;
    },
    set isDragging(value: boolean) {
      isDragging = value;
    },
    selectPerformer,
    selectPerformers,
    selectFormation,
    selectSpot,
    selectTravel,
    selectClip,
    clearSelection,
  };
}
