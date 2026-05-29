import { browser } from "$app/environment";
import { LAYOUT_PRESETS, resetCellIdCounter, findPresetById } from "../services/layout-presets";
import { solveConstraints, GRID_SIZE } from "../services/constraint-solver";
import {
  saveLayoutState,
  loadLayoutState,
  loadCustomPresets,
  saveCustomPreset,
  deleteCustomPreset,
  customPresetToLayoutPreset,
  exportLayoutAsJSON,
  type CustomPreset,
} from "../services/layout-persistence";
import type {
  ConstraintCell,
  ContainerBounds,
  LayoutPreset,
  Constraint,
  SizeConstraint,
  CellMediaType,
} from "../domain/types";

export const ICON_OPTIONS = [
  "bookmark",
  "star",
  "heart",
  "folder",
  "layer-group",
  "th-large",
  "border-all",
  "object-group",
] as const;

const MAX_HISTORY = 50;

const MEDIA_CYCLE: ReadonlyArray<{
  label: string;
  type: CellMediaType;
  color: string;
}> = [
  { label: "Video", type: "video", color: "#ef4444" },
  { label: "Animation", type: "animation", color: "#8b5cf6" },
  { label: "Image", type: "image", color: "#10b981" },
  { label: "Choreo Card", type: "choreo-card", color: "#3b82f6" },
  { label: "3D Viewer", type: "viewer-3d", color: "#f59e0b" },
];

export function createCompositionLabState(initialPresetId?: string) {
  // ── Core layout state ──
  let cells = $state<ConstraintCell[]>([]);
  let selectedCellIds = $state<Set<string>>(new Set());
  let containerBounds = $state<ContainerBounds>({ width: 800, height: 600 });

  // ── Initialization tracking ──
  let initialized = $state(false);
  let initialPresetApplied = $state(false);

  // ── Custom presets ──
  let customPresets = $state<CustomPreset[]>([]);

  // ── Save preset dialog state ──
  let showSaveDialog = $state(false);
  let newPresetName = $state("");
  let newPresetDescription = $state("");
  let newPresetIcon = $state("bookmark");

  // ── Export status ──
  let exportStatus = $state<"idle" | "copied" | "error">("idle");

  // ── Undo/Redo stacks (not reactive — plain arrays) ──
  const undoStack: ConstraintCell[][] = [];
  let redoStack: ConstraintCell[][] = [];

  // ── Derived values ──
  const selectedCell = $derived(
    selectedCellIds.size === 1
      ? cells.find((c) => selectedCellIds.has(c.id)) ?? null
      : null,
  );

  const selectedCount = $derived(selectedCellIds.size);

  const allPresets = $derived<LayoutPreset[]>([
    ...LAYOUT_PRESETS,
    ...customPresets.map(customPresetToLayoutPreset),
  ]);

  // ── Constraint solver helper ──
  function updateComputedPositions() {
    const solved = solveConstraints(cells, containerBounds);
    cells = cells.map((cell) => {
      const computed = solved.get(cell.id);
      if (computed) {
        return { ...cell, computed };
      }
      return cell;
    });
  }

  // ── Undo/Redo ──
  function pushUndo() {
    undoStack.push($state.snapshot(cells) as ConstraintCell[]);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
  }

  function undo() {
    if (undoStack.length === 0) return;
    redoStack.push($state.snapshot(cells) as ConstraintCell[]);
    cells = undoStack.pop()!;
    selectedCellIds = new Set();
  }

  function redo() {
    if (redoStack.length === 0) return;
    undoStack.push($state.snapshot(cells) as ConstraintCell[]);
    cells = redoStack.pop()!;
    selectedCellIds = new Set();
  }

  // ── Selection ──
  function handleSelectCell(cellId: string | null, additive: boolean = false) {
    if (cellId === null) {
      selectedCellIds = new Set();
    } else if (additive) {
      const newSet = new Set(selectedCellIds);
      if (newSet.has(cellId)) {
        newSet.delete(cellId);
      } else {
        newSet.add(cellId);
      }
      selectedCellIds = newSet;
    } else {
      selectedCellIds = new Set([cellId]);
    }
  }

  // ── Cell mutation handlers ──
  function handleUpdateCellPosition(cellId: string, x: number, y: number) {
    cells = cells.map((cell) => {
      if (cell.id !== cellId) return cell;

      const newConstraints: Constraint[] = [
        {
          id: `${cellId}-left-abs`,
          cellId,
          anchor: "left",
          target: { type: "parent", anchor: "left" },
          offset: x,
          priority: "required",
          relation: "equal",
        },
        {
          id: `${cellId}-top-abs`,
          cellId,
          anchor: "top",
          target: { type: "parent", anchor: "top" },
          offset: y,
          priority: "required",
          relation: "equal",
        },
      ];

      const sizeConstraints: SizeConstraint[] =
        cell.sizeConstraints.length > 0
          ? cell.sizeConstraints
          : [
              {
                id: `${cellId}-width`,
                cellId,
                dimension: "width",
                value: cell.computed.width,
                priority: "required",
                relation: "equal",
              },
              {
                id: `${cellId}-height`,
                cellId,
                dimension: "height",
                value: cell.computed.height,
                priority: "required",
                relation: "equal",
              },
            ];

      return {
        ...cell,
        constraints: newConstraints,
        sizeConstraints,
        computed: { ...cell.computed, x, y },
      };
    });
  }

  function handleUpdateCellSize(
    cellId: string,
    width: number,
    height: number,
    x?: number,
    y?: number,
  ) {
    cells = cells.map((cell) => {
      if (cell.id !== cellId) return cell;

      const newX = x ?? cell.computed.x;
      const newY = y ?? cell.computed.y;

      const newConstraints: Constraint[] = [
        {
          id: `${cellId}-left-abs`,
          cellId,
          anchor: "left",
          target: { type: "parent", anchor: "left" },
          offset: newX,
          priority: "required",
          relation: "equal",
        },
        {
          id: `${cellId}-top-abs`,
          cellId,
          anchor: "top",
          target: { type: "parent", anchor: "top" },
          offset: newY,
          priority: "required",
          relation: "equal",
        },
      ];

      const newSizeConstraints: SizeConstraint[] = [
        {
          id: `${cellId}-width`,
          cellId,
          dimension: "width",
          value: width,
          priority: "required",
          relation: "equal",
        },
        {
          id: `${cellId}-height`,
          cellId,
          dimension: "height",
          value: height,
          priority: "required",
          relation: "equal",
        },
      ];

      return {
        ...cell,
        constraints: newConstraints,
        sizeConstraints: newSizeConstraints,
        computed: { x: newX, y: newY, width, height },
      };
    });
  }

  function handleUpdateLabel(label: string) {
    if (selectedCellIds.size === 0) return;
    pushUndo();
    cells = cells.map((cell) =>
      selectedCellIds.has(cell.id) ? { ...cell, label } : cell,
    );
  }

  function handleUpdateZIndex(zIndex: number) {
    if (selectedCellIds.size === 0) return;
    pushUndo();
    cells = cells.map((cell) =>
      selectedCellIds.has(cell.id) ? { ...cell, zIndex } : cell,
    );
  }

  function handleUpdateColor(color: string) {
    if (selectedCellIds.size === 0) return;
    pushUndo();
    cells = cells.map((cell) =>
      selectedCellIds.has(cell.id) ? { ...cell, color } : cell,
    );
  }

  function handleUpdateMediaType(mediaType: CellMediaType) {
    if (selectedCellIds.size === 0) return;
    pushUndo();
    cells = cells.map((cell) =>
      selectedCellIds.has(cell.id) ? { ...cell, mediaType } : cell,
    );
  }

  function handleDeleteCell() {
    if (selectedCellIds.size === 0) return;
    pushUndo();
    cells = cells.filter((c) => !selectedCellIds.has(c.id));
    selectedCellIds = new Set();
  }

  /** Duplicate cell at specific position (used by Alt+drag) - returns new cell ID */
  function handleDuplicateCellAt(
    cellId: string,
    x: number,
    y: number,
  ): string {
    const sourceCell = cells.find((c) => c.id === cellId);
    if (!sourceCell) return cellId;

    const newId = `cell-dup-${Date.now()}`;

    const newCell: ConstraintCell = {
      ...sourceCell,
      id: newId,
      label: `${sourceCell.label} Copy`,
      zIndex: Math.max(...cells.map((c) => c.zIndex)) + 1,
      mediaType: sourceCell.mediaType,
      constraints: [
        {
          id: `${newId}-left-abs`,
          cellId: newId,
          anchor: "left",
          target: { type: "parent", anchor: "left" },
          offset: x,
          priority: "required",
          relation: "equal",
        },
        {
          id: `${newId}-top-abs`,
          cellId: newId,
          anchor: "top",
          target: { type: "parent", anchor: "top" },
          offset: y,
          priority: "required",
          relation: "equal",
        },
      ],
      sizeConstraints: [
        {
          id: `${newId}-width`,
          cellId: newId,
          dimension: "width",
          value: sourceCell.computed.width,
          priority: "required",
          relation: "equal",
        },
        {
          id: `${newId}-height`,
          cellId: newId,
          dimension: "height",
          value: sourceCell.computed.height,
          priority: "required",
          relation: "equal",
        },
      ],
      computed: {
        x,
        y,
        width: sourceCell.computed.width,
        height: sourceCell.computed.height,
      },
    };

    cells = [...cells, newCell];
    return newId;
  }

  /** Duplicate selected cell with offset (used by button) */
  function handleDuplicateCell() {
    if (!selectedCell) return;
    pushUndo();

    const offset = GRID_SIZE;
    const newId = handleDuplicateCellAt(
      selectedCell.id,
      selectedCell.computed.x + offset,
      selectedCell.computed.y + offset,
    );
    selectedCellIds = new Set([newId]);
  }

  function handleAddCell() {
    pushUndo();
    const newId = `cell-new-${Date.now()}`;
    const size = GRID_SIZE * 2;
    const x =
      Math.round((containerBounds.width - size) / 2 / GRID_SIZE) * GRID_SIZE;
    const y =
      Math.round((containerBounds.height - size) / 2 / GRID_SIZE) * GRID_SIZE;

    const media = MEDIA_CYCLE[cells.length % MEDIA_CYCLE.length]!;

    const newCell: ConstraintCell = {
      id: newId,
      label: media.label,
      zIndex: cells.length + 1,
      color: media.color,
      mediaType: media.type,
      constraints: [
        {
          id: `${newId}-left`,
          cellId: newId,
          anchor: "left",
          target: { type: "parent", anchor: "left" },
          offset: x,
          priority: "required",
          relation: "equal",
        },
        {
          id: `${newId}-top`,
          cellId: newId,
          anchor: "top",
          target: { type: "parent", anchor: "top" },
          offset: y,
          priority: "required",
          relation: "equal",
        },
      ],
      sizeConstraints: [
        {
          id: `${newId}-width`,
          cellId: newId,
          dimension: "width",
          value: size,
          priority: "required",
          relation: "equal",
        },
        {
          id: `${newId}-height`,
          cellId: newId,
          dimension: "height",
          value: size,
          priority: "required",
          relation: "equal",
        },
      ],
      computed: { x, y, width: size, height: size },
    };

    cells = [...cells, newCell];
    selectedCellIds = new Set([newId]);
  }

  // ── Preset management ──
  function applyPreset(preset: LayoutPreset) {
    pushUndo();
    resetCellIdCounter();
    cells = preset.createCells(containerBounds);
    updateComputedPositions();
    selectedCellIds = new Set();
  }

  function handleSaveAsPreset() {
    if (!newPresetName.trim()) return;

    const preset = saveCustomPreset(
      newPresetName.trim(),
      newPresetDescription.trim() || `Custom layout with ${cells.length} cells`,
      newPresetIcon,
      cells,
      containerBounds,
    );

    customPresets = [...customPresets, preset];

    showSaveDialog = false;
    newPresetName = "";
    newPresetDescription = "";
    newPresetIcon = "bookmark";
  }

  function handleDeletePreset(presetId: string) {
    deleteCustomPreset(presetId);
    customPresets = customPresets.filter((p) => p.id !== presetId);
  }

  function handleCancelSaveDialog() {
    showSaveDialog = false;
    newPresetName = "";
    newPresetDescription = "";
    newPresetIcon = "bookmark";
  }

  // ── Export ──
  async function handleExportLayout() {
    if (cells.length === 0) return;

    const exported = exportLayoutAsJSON(
      cells,
      containerBounds,
      "Exported Layout",
      `${cells.length} cells`,
      "bookmark",
    );

    const json = JSON.stringify(exported, null, 2);

    try {
      await navigator.clipboard.writeText(json);
      exportStatus = "copied";
      setTimeout(() => {
        exportStatus = "idle";
      }, 2000);
    } catch {
      exportStatus = "error";
      setTimeout(() => {
        exportStatus = "idle";
      }, 2000);
    }
  }

  // ── Drag start (for undo snapshot) ──
  function handleDragStart() {
    pushUndo();
  }

  // ── Container bounds setter ──
  function setContainerBounds(bounds: ContainerBounds) {
    containerBounds = bounds;
    updateComputedPositions();
  }

  // ── Keyboard shortcuts ──
  function handleGlobalKeyDown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedCellIds.size > 0) {
        e.preventDefault();
        handleDeleteCell();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "y") {
      e.preventDefault();
      redo();
      return;
    }
  }

  // ── Effects (persistence, initialization, keyboard) ──
  function setupEffects() {
    // Load persisted state on mount
    $effect(() => {
      if (!browser || initialized) return;

      customPresets = loadCustomPresets();

      if (
        initialPresetId &&
        !initialPresetApplied &&
        containerBounds.width > 0
      ) {
        let preset = findPresetById(initialPresetId);
        if (!preset) {
          const customPreset = customPresets.find(
            (p) => p.id === initialPresetId,
          );
          if (customPreset) {
            preset = customPresetToLayoutPreset(customPreset);
          }
        }

        if (preset) {
          resetCellIdCounter();
          cells = preset.createCells(containerBounds);
          updateComputedPositions();
          selectedCellIds = new Set();
          initialPresetApplied = true;
          initialized = true;
          return;
        }
      }

      const savedState = loadLayoutState();
      if (savedState && savedState.cells.length > 0) {
        cells = savedState.cells;
        selectedCellIds = savedState.selectedCellId
          ? new Set([savedState.selectedCellId])
          : new Set();
        initialized = true;
      } else if (containerBounds.width > 0) {
        cells = [];
        initialized = true;
      }
    });

    // Save state whenever cells or selection changes
    $effect(() => {
      if (!browser || !initialized) return;
      const firstSelected =
        selectedCellIds.size > 0 ? [...selectedCellIds][0] : null;
      saveLayoutState(cells, firstSelected ?? null);
    });

    // Keyboard shortcuts
    $effect(() => {
      window.addEventListener("keydown", handleGlobalKeyDown);
      return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    });
  }

  // Run effects immediately during factory creation (inside component context)
  setupEffects();

  // ── Public surface ──
  return {
    // Reactive state (getters so reads track dependencies)
    get cells() {
      return cells;
    },
    get selectedCellIds() {
      return selectedCellIds;
    },
    get containerBounds() {
      return containerBounds;
    },
    get selectedCell() {
      return selectedCell;
    },
    get selectedCount() {
      return selectedCount;
    },
    get allPresets() {
      return allPresets;
    },
    get customPresets() {
      return customPresets;
    },
    get initialized() {
      return initialized;
    },
    get showSaveDialog() {
      return showSaveDialog;
    },
    set showSaveDialog(v: boolean) {
      showSaveDialog = v;
    },
    get newPresetName() {
      return newPresetName;
    },
    set newPresetName(v: string) {
      newPresetName = v;
    },
    get newPresetDescription() {
      return newPresetDescription;
    },
    set newPresetDescription(v: string) {
      newPresetDescription = v;
    },
    get newPresetIcon() {
      return newPresetIcon;
    },
    set newPresetIcon(v: string) {
      newPresetIcon = v;
    },
    get exportStatus() {
      return exportStatus;
    },

    // Handlers
    handleSelectCell,
    handleUpdateCellPosition,
    handleUpdateCellSize,
    handleUpdateLabel,
    handleUpdateZIndex,
    handleUpdateColor,
    handleUpdateMediaType,
    handleDeleteCell,
    handleDuplicateCell,
    handleDuplicateCellAt,
    handleAddCell,
    handleDragStart,
    handleExportLayout,
    handleSaveAsPreset,
    handleDeletePreset,
    handleCancelSaveDialog,
    applyPreset,
    setContainerBounds,
    undo,
    redo,
  };
}

export type CompositionLabState = ReturnType<typeof createCompositionLabState>;
