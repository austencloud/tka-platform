/**
 * Mandala Controller
 *
 * Handles all actions and business logic for the mandala generator.
 * Uses the MandalaState for reactive data and DI services for operations.
 */

import type { MandalaState } from "./mandala-state.svelte";
import type {
  Point,
  ArrowSpec,
} from "../domain/models/mandala-element";
import type { MandalaPreset } from "../domain/models/mandala-preset";
import type {
  SymmetryFold,
  MirrorAxis,
  ArrowMotionType,
  ArrowTurns,
} from "../domain/enums/mandala-enums";
import { createMandalaElement } from "../domain/models/mandala-element";

export class MandalaController {
  constructor(private state: MandalaState) {}

  // ============================================================
  // ELEMENT ACTIONS
  // ============================================================

  /**
   * Add a new element to the canvas at the specified position.
   */
  addElement(
    type: "arrow" | "staff" | "gridDot",
    position: Point,
    options: {
      color?: string;
      rotation?: number;
      scale?: number;
      arrowSpec?: { motionType: string; turns?: number };
      svgContent?: string;
      viewBox?: { width: number; height: number };
      center?: { x: number; y: number };
    } = {}
  ) {
    this.state.pushHistory();

    // Convert string-based arrowSpec to properly typed ArrowSpec
    let typedArrowSpec: ArrowSpec | undefined;
    if (options.arrowSpec) {
      typedArrowSpec = {
        motionType: options.arrowSpec.motionType as ArrowMotionType,
        turns: (options.arrowSpec.turns ?? 0) as ArrowTurns,
      };
    }

    const element = createMandalaElement(type, position, {
      color: options.color ?? this.state.config.colorScheme.primary,
      rotation: options.rotation ?? 0,
      scale: options.scale ?? 1,
      arrowSpec: typedArrowSpec,
      svgContent: options.svgContent,
      viewBox: options.viewBox,
      center: options.center,
    });

    this.state.addElement(element);
    this.state.setSelectedElementId(element.id);
  }

  /**
   * Remove an element from the canvas.
   */
  removeElement(id: string) {
    this.state.pushHistory();
    this.state.removeElement(id);
  }

  /**
   * Remove the currently selected element.
   */
  removeSelectedElement() {
    if (this.state.selectedElementId) {
      this.removeElement(this.state.selectedElementId);
    }
  }

  /**
   * Duplicate an element.
   */
  duplicateElement(id: string, offset: Point = { x: 20, y: 20 }) {
    const element = this.state.elements.find((e) => e.id === id);
    if (!element) return;

    this.state.pushHistory();

    const duplicate = createMandalaElement(
      element.type,
      {
        x: element.position.x + offset.x,
        y: element.position.y + offset.y,
      },
      {
        color: element.color,
        rotation: element.rotation,
        scale: element.scale,
        arrowSpec: element.arrowSpec,
        svgContent: element.svgContent,
      }
    );

    this.state.addElement(duplicate);
    this.state.setSelectedElementId(duplicate.id);
  }

  /**
   * Duplicate the currently selected element.
   */
  duplicateSelectedElement() {
    if (this.state.selectedElementId) {
      this.duplicateElement(this.state.selectedElementId);
    }
  }

  /**
   * Move an element to a new position.
   */
  moveElement(id: string, position: Point) {
    this.state.updateElement(id, { position });
  }

  /**
   * Rotate an element by a specified angle.
   */
  rotateElement(id: string, rotation: number) {
    this.state.updateElement(id, { rotation: rotation % 360 });
  }

  /**
   * Scale an element.
   */
  scaleElement(id: string, scale: number) {
    this.state.updateElement(id, { scale: Math.max(0.1, Math.min(5, scale)) });
  }

  /**
   * Change an element's color.
   */
  setElementColor(id: string, color: string) {
    this.state.updateElement(id, { color });
  }

  /**
   * Commit a drag operation to history.
   */
  commitDrag() {
    this.state.pushHistory();
    this.state.setDragMode("none");
  }

  /**
   * Clear all elements from the canvas.
   */
  clearCanvas() {
    this.state.pushHistory();
    this.state.clearElements();
  }

  // ============================================================
  // SELECTION ACTIONS
  // ============================================================

  selectElement(id: string | null) {
    this.state.setSelectedElementId(id);
  }

  hoverElement(id: string | null) {
    this.state.setHoveredElementId(id);
  }

  clearSelection() {
    this.state.setSelectedElementId(null);
  }

  // ============================================================
  // SYMMETRY CONFIG ACTIONS
  // ============================================================

  setFoldCount(foldCount: SymmetryFold) {
    this.state.setFoldCount(foldCount);
    this.state.setActivePresetId(null); // Custom config, no preset active
  }

  toggleMirror() {
    this.state.setEnableMirror(!this.state.config.enableMirror);
    this.state.setActivePresetId(null);
  }

  setMirrorAxis(axis: MirrorAxis) {
    this.state.setMirrorAxis(axis);
    this.state.setActivePresetId(null);
  }

  toggleGridDots() {
    this.state.setShowGridDots(!this.state.config.showGridDots);
  }

  setPrimaryColor(color: string) {
    this.state.setColorScheme({
      ...this.state.config.colorScheme,
      primary: color,
    });
  }

  setSecondaryColor(color: string) {
    this.state.setColorScheme({
      ...this.state.config.colorScheme,
      secondary: color,
    });
  }

  swapColors() {
    const { primary, secondary } = this.state.config.colorScheme;
    this.state.setColorScheme({ primary: secondary, secondary: primary });
  }

  // ============================================================
  // PRESET ACTIONS
  // ============================================================

  applyPreset(preset: MandalaPreset) {
    this.state.applyPreset(preset);
  }

  applyPresetById(id: string) {
    const preset = this.state.presets.find((p) => p.id === id);
    if (preset) {
      this.applyPreset(preset);
    }
  }

  // ============================================================
  // HISTORY ACTIONS
  // ============================================================

  undo() {
    if (this.state.canUndo) {
      this.state.restoreFromHistory(this.state.historyIndex - 1);
    }
  }

  redo() {
    if (this.state.canRedo) {
      this.state.restoreFromHistory(this.state.historyIndex + 1);
    }
  }

  // ============================================================
  // UI ACTIONS
  // ============================================================

  openFavoritesDrawer() {
    this.state.setShowFavoritesDrawer(true);
  }

  closeFavoritesDrawer() {
    this.state.setShowFavoritesDrawer(false);
  }

  openExportSheet() {
    this.state.setShowExportSheet(true);
  }

  closeExportSheet() {
    this.state.setShowExportSheet(false);
  }

  toggleColorPicker() {
    this.state.setShowColorPicker(!this.state.showColorPicker);
  }

  togglePresetPanel() {
    this.state.setShowPresetPanel(!this.state.showPresetPanel);
  }

  setAssetLibraryTab(tab: "arrows" | "staffs") {
    this.state.setAssetLibraryTab(tab);
  }

  setAssetLibraryFilter(filter: string | null) {
    this.state.setAssetLibraryFilter(filter);
  }

  // ============================================================
  // KEYBOARD SHORTCUTS
  // ============================================================

  handleKeyDown(event: KeyboardEvent) {
    // Don't handle if typing in an input
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    const key = event.key.toLowerCase();
    const ctrl = event.ctrlKey || event.metaKey;

    // Undo: Ctrl+Z
    if (ctrl && key === "z" && !event.shiftKey) {
      event.preventDefault();
      this.undo();
      return;
    }

    // Redo: Ctrl+Shift+Z or Ctrl+Y
    if ((ctrl && key === "z" && event.shiftKey) || (ctrl && key === "y")) {
      event.preventDefault();
      this.redo();
      return;
    }

    // Delete: Delete or Backspace
    if (
      (key === "delete" || key === "backspace") &&
      this.state.selectedElementId
    ) {
      event.preventDefault();
      this.removeSelectedElement();
      return;
    }

    // Duplicate: Ctrl+D
    if (ctrl && key === "d" && this.state.selectedElementId) {
      event.preventDefault();
      this.duplicateSelectedElement();
      return;
    }

    // Rotate 90°: R
    if (key === "r" && this.state.selectedElementId) {
      event.preventDefault();
      const element = this.state.selectedElement;
      if (element) {
        this.state.pushHistory();
        this.rotateElement(element.id, element.rotation + 90);
      }
      return;
    }

    // Escape: Deselect
    if (key === "escape") {
      this.clearSelection();
      return;
    }
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  cleanup() {
    if (this.state.unsubscribe) {
      this.state.unsubscribe();
      this.state.setUnsubscribe(null);
    }
  }
}
