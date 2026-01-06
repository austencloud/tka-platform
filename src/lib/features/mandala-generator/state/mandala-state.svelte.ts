/**
 * Mandala Generator State
 *
 * Pure data container with reactive state using Svelte 5 runes.
 * Manages canvas elements, symmetry configuration, and saved mandalas.
 */

import type { MandalaElement } from "../domain/models/mandala-element";
import type { MandalaConfig } from "../domain/models/mandala-config";
import type { SavedMandala } from "../domain/models/mandala-preset";
import type { MandalaPreset } from "../domain/models/mandala-preset";
import { DEFAULT_MANDALA_CONFIG } from "../domain/models/mandala-config";
import { MANDALA_PRESETS } from "../domain/constants/preset-definitions";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";
export type DragMode = "none" | "move" | "rotate" | "scale";

interface HistoryEntry {
  elements: MandalaElement[];
  config: MandalaConfig;
}

interface MandalaStateData {
  // Canvas elements
  elements: MandalaElement[];
  selectedElementId: string | null;
  hoveredElementId: string | null;
  dragMode: DragMode;

  // Configuration
  config: MandalaConfig;

  // Presets
  presets: MandalaPreset[];
  activePresetId: string | null;

  // History (undo/redo)
  history: HistoryEntry[];
  historyIndex: number;
  maxHistoryLength: number;

  // Saved mandalas (Firebase)
  savedMandalas: SavedMandala[];

  // UI state
  loading: boolean;
  syncStatus: SyncStatus;
  showFavoritesDrawer: boolean;
  showExportSheet: boolean;
  showColorPicker: boolean;
  showPresetPanel: boolean;

  // Asset library state
  assetLibraryTab: "arrows" | "staffs";
  assetLibraryFilter: string | null;

  // Cleanup handlers
  unsubscribe: (() => void) | null;
}

export class MandalaState {
  private data = $state<MandalaStateData>(this.getInitialState());
  private wasRestoredFromHMR = false;

  // ============================================================
  // INITIALIZATION
  // ============================================================

  private getInitialState(): MandalaStateData {
    if (import.meta.hot?.data.MandalaState) {
      this.wasRestoredFromHMR = true;
      return import.meta.hot.data.MandalaState;
    }

    return {
      elements: [],
      selectedElementId: null,
      hoveredElementId: null,
      dragMode: "none",

      config: { ...DEFAULT_MANDALA_CONFIG },

      presets: [...MANDALA_PRESETS],
      activePresetId: null,

      history: [],
      historyIndex: -1,
      maxHistoryLength: 50,

      savedMandalas: [],

      loading: false,
      syncStatus: "idle",
      showFavoritesDrawer: false,
      showExportSheet: false,
      showColorPicker: false,
      showPresetPanel: false,

      assetLibraryTab: "arrows",
      assetLibraryFilter: null,

      unsubscribe: null,
    };
  }

  // ============================================================
  // GETTERS (simple property access)
  // ============================================================

  get elements() {
    return this.data.elements;
  }
  get selectedElementId() {
    return this.data.selectedElementId;
  }
  get hoveredElementId() {
    return this.data.hoveredElementId;
  }
  get dragMode() {
    return this.data.dragMode;
  }
  get config() {
    return this.data.config;
  }
  get presets() {
    return this.data.presets;
  }
  get activePresetId() {
    return this.data.activePresetId;
  }
  get history() {
    return this.data.history;
  }
  get historyIndex() {
    return this.data.historyIndex;
  }
  get savedMandalas() {
    return this.data.savedMandalas;
  }
  get loading() {
    return this.data.loading;
  }
  get syncStatus() {
    return this.data.syncStatus;
  }
  get showFavoritesDrawer() {
    return this.data.showFavoritesDrawer;
  }
  get showExportSheet() {
    return this.data.showExportSheet;
  }
  get showColorPicker() {
    return this.data.showColorPicker;
  }
  get showPresetPanel() {
    return this.data.showPresetPanel;
  }
  get assetLibraryTab() {
    return this.data.assetLibraryTab;
  }
  get assetLibraryFilter() {
    return this.data.assetLibraryFilter;
  }
  get unsubscribe() {
    return this.data.unsubscribe;
  }
  get isHMRRestored() {
    return this.wasRestoredFromHMR;
  }

  // ============================================================
  // DERIVED GETTERS
  // ============================================================

  get selectedElement(): MandalaElement | null {
    if (!this.data.selectedElementId) return null;
    return (
      this.data.elements.find((e) => e.id === this.data.selectedElementId) ??
      null
    );
  }

  get hoveredElement(): MandalaElement | null {
    if (!this.data.hoveredElementId) return null;
    return (
      this.data.elements.find((e) => e.id === this.data.hoveredElementId) ??
      null
    );
  }

  get hasElements(): boolean {
    return this.data.elements.length > 0;
  }

  get elementCount(): number {
    return this.data.elements.length;
  }

  get canUndo(): boolean {
    return this.data.historyIndex > 0;
  }

  get canRedo(): boolean {
    return this.data.historyIndex < this.data.history.length - 1;
  }

  get activePreset(): MandalaPreset | null {
    if (!this.data.activePresetId) return null;
    return (
      this.data.presets.find((p) => p.id === this.data.activePresetId) ?? null
    );
  }

  get hasSavedMandalas(): boolean {
    return this.data.savedMandalas.length > 0;
  }

  // ============================================================
  // ELEMENT SETTERS (called by Controller)
  // ============================================================

  setElements(elements: MandalaElement[]) {
    this.data.elements = elements;
  }

  addElement(element: MandalaElement) {
    this.data.elements = [...this.data.elements, element];
  }

  updateElement(id: string, updates: Partial<MandalaElement>) {
    this.data.elements = this.data.elements.map((e) =>
      e.id === id ? { ...e, ...updates } : e
    );
  }

  removeElement(id: string) {
    this.data.elements = this.data.elements.filter((e) => e.id !== id);
    if (this.data.selectedElementId === id) {
      this.data.selectedElementId = null;
    }
  }

  clearElements() {
    this.data.elements = [];
    this.data.selectedElementId = null;
  }

  // ============================================================
  // SELECTION SETTERS
  // ============================================================

  setSelectedElementId(id: string | null) {
    this.data.selectedElementId = id;
  }

  setHoveredElementId(id: string | null) {
    this.data.hoveredElementId = id;
  }

  setDragMode(mode: DragMode) {
    this.data.dragMode = mode;
  }

  // ============================================================
  // CONFIG SETTERS
  // ============================================================

  setConfig(config: MandalaConfig) {
    this.data.config = config;
  }

  updateConfig(updates: Partial<MandalaConfig>) {
    this.data.config = { ...this.data.config, ...updates };
  }

  setFoldCount(foldCount: MandalaConfig["foldCount"]) {
    this.data.config = { ...this.data.config, foldCount };
  }

  setEnableMirror(enableMirror: boolean) {
    this.data.config = { ...this.data.config, enableMirror };
  }

  setMirrorAxis(mirrorAxis: MandalaConfig["mirrorAxis"]) {
    this.data.config = { ...this.data.config, mirrorAxis };
  }

  setShowGridDots(showGridDots: boolean) {
    this.data.config = { ...this.data.config, showGridDots };
  }

  setColorScheme(colorScheme: MandalaConfig["colorScheme"]) {
    this.data.config = { ...this.data.config, colorScheme };
  }

  // ============================================================
  // PRESET SETTERS
  // ============================================================

  setPresets(presets: MandalaPreset[]) {
    this.data.presets = presets;
  }

  setActivePresetId(id: string | null) {
    this.data.activePresetId = id;
  }

  applyPreset(preset: MandalaPreset) {
    // Merge preset config overrides with current config
    this.data.config = {
      ...this.data.config,
      ...preset.config,
    };
    this.data.activePresetId = preset.id;
  }

  // ============================================================
  // HISTORY MANAGEMENT
  // ============================================================

  pushHistory() {
    const entry: HistoryEntry = {
      elements: JSON.parse(JSON.stringify(this.data.elements)),
      config: { ...this.data.config },
    };

    // If we're not at the end of history, truncate forward history
    if (this.data.historyIndex < this.data.history.length - 1) {
      this.data.history = this.data.history.slice(
        0,
        this.data.historyIndex + 1
      );
    }

    this.data.history = [...this.data.history, entry];

    // Limit history length
    if (this.data.history.length > this.data.maxHistoryLength) {
      this.data.history = this.data.history.slice(-this.data.maxHistoryLength);
    }

    this.data.historyIndex = this.data.history.length - 1;
  }

  restoreFromHistory(index: number) {
    if (index < 0 || index >= this.data.history.length) return;

    const entry = this.data.history[index];
    if (!entry) return;

    this.data.elements = JSON.parse(JSON.stringify(entry.elements));
    this.data.config = { ...entry.config };
    this.data.historyIndex = index;
    this.data.selectedElementId = null;
  }

  setHistoryIndex(index: number) {
    this.data.historyIndex = index;
  }

  clearHistory() {
    this.data.history = [];
    this.data.historyIndex = -1;
  }

  // ============================================================
  // SAVED MANDALAS SETTERS
  // ============================================================

  setSavedMandalas(mandalas: SavedMandala[]) {
    this.data.savedMandalas = mandalas;
  }

  addSavedMandala(mandala: SavedMandala) {
    this.data.savedMandalas = [...this.data.savedMandalas, mandala];
  }

  removeSavedMandala(id: string) {
    this.data.savedMandalas = this.data.savedMandalas.filter(
      (m) => m.id !== id
    );
  }

  updateSavedMandala(id: string, updates: Partial<SavedMandala>) {
    this.data.savedMandalas = this.data.savedMandalas.map((m) =>
      m.id === id ? { ...m, ...updates } : m
    );
  }

  // ============================================================
  // UI STATE SETTERS
  // ============================================================

  setLoading(loading: boolean) {
    this.data.loading = loading;
  }

  setSyncStatus(status: SyncStatus) {
    this.data.syncStatus = status;
  }

  setShowFavoritesDrawer(show: boolean) {
    this.data.showFavoritesDrawer = show;
  }

  setShowExportSheet(show: boolean) {
    this.data.showExportSheet = show;
  }

  setShowColorPicker(show: boolean) {
    this.data.showColorPicker = show;
  }

  setShowPresetPanel(show: boolean) {
    this.data.showPresetPanel = show;
  }

  setAssetLibraryTab(tab: "arrows" | "staffs") {
    this.data.assetLibraryTab = tab;
  }

  setAssetLibraryFilter(filter: string | null) {
    this.data.assetLibraryFilter = filter;
  }

  setUnsubscribe(fn: (() => void) | null) {
    this.data.unsubscribe = fn;
  }

  // ============================================================
  // RESET
  // ============================================================

  reset() {
    this.data = {
      elements: [],
      selectedElementId: null,
      hoveredElementId: null,
      dragMode: "none",

      config: { ...DEFAULT_MANDALA_CONFIG },

      presets: [...MANDALA_PRESETS],
      activePresetId: null,

      history: [],
      historyIndex: -1,
      maxHistoryLength: 50,

      savedMandalas: [],

      loading: false,
      syncStatus: "idle",
      showFavoritesDrawer: false,
      showExportSheet: false,
      showColorPicker: false,
      showPresetPanel: false,

      assetLibraryTab: "arrows",
      assetLibraryFilter: null,

      unsubscribe: null,
    };
  }

  // ============================================================
  // HMR DATA EXPORT
  // ============================================================

  getHMRData(): MandalaStateData {
    return {
      ...this.data,
      unsubscribe: null,
    };
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

export const mandalaState = new MandalaState();

// ============================================================
// HMR SUPPORT
// ============================================================

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    import.meta.hot!.data.MandalaState = mandalaState.getHMRData();
  });
}
