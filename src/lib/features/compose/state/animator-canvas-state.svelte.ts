/**
 * animator-canvas-state.svelte.ts
 *
 * Centralized state management for the AnimatorCanvas component.
 * Follows the TKA state factory pattern with Svelte 5 runes.
 */

import type { TrailSettings } from "../shared/domain/types/TrailTypes";
import type { PreRenderProgress } from "../services/implementations/SequenceFramePreRenderer";
import type { AnimationPathCacheData } from "../services/implementations/AnimationPathCache";
import {
  loadTrailSettings,
  saveTrailSettings,
} from "../utils/animation-panel-persistence";
import type { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_CANVAS_SIZE = 500;

export const DEFAULT_PROP_DIMENSIONS = {
  width: 252.8,
  height: 77.8,
};

// ============================================================================
// STATE TYPE
// ============================================================================

export type AnimatorCanvasState = {
  // Canvas dimensions
  readonly canvasSize: number;
  readonly bluePropDimensions: { width: number; height: number };
  readonly redPropDimensions: { width: number; height: number };

  // Initialization
  readonly isInitialized: boolean;
  readonly needsRender: boolean;

  // Prop types (per-color support)
  readonly currentPropType: string;
  readonly currentBluePropType: string;
  readonly currentRedPropType: string;

  // Trail settings
  readonly trailSettings: TrailSettings;

  // Path cache state
  readonly pathCacheData: AnimationPathCacheData | null;
  readonly isCachePrecomputing: boolean;
  readonly cacheSequenceId: string | null;

  // Frame pre-render state
  readonly isPreRendering: boolean;
  readonly preRenderProgress: PreRenderProgress | null;
  readonly preRenderedFramesReady: boolean;

  // Grid mode tracking
  readonly previousGridMode: string | null;

  // Service lifecycle
  readonly servicesReady: boolean;
  readonly pixiLoading: boolean;
  readonly pixiError: string | null;

  // Visibility state (synced from AnimationVisibilityStateManager)
  readonly gridVisible: boolean;
  readonly stepNumbersVisible: boolean;
  readonly propsVisible: boolean;
  readonly trailsVisible: boolean;
  readonly tkaGlyphVisible: boolean; // TKA Glyph includes turn numbers
  readonly blueMotionVisible: boolean;
  readonly redMotionVisible: boolean;

  // Container reference (mutable for bind:this)
  containerElement: HTMLDivElement | null;

  // Mutators
  setCanvasSize: (size: number) => void;
  setBluePropDimensions: (dims: { width: number; height: number }) => void;
  setRedPropDimensions: (dims: { width: number; height: number }) => void;
  setPropDimensions: (
    blue: { width: number; height: number },
    red: { width: number; height: number }
  ) => void;
  setIsInitialized: (initialized: boolean) => void;
  setNeedsRender: (needs: boolean) => void;
  triggerRender: () => void;
  setCurrentPropType: (type: string) => void;
  setPropTypes: (blue: string, red: string) => void;
  setTrailSettings: (settings: TrailSettings) => void;
  updateTrailSettings: (updates: Partial<TrailSettings>) => void;
  setPathCacheData: (data: AnimationPathCacheData | null) => void;
  setIsCachePrecomputing: (computing: boolean) => void;
  setCacheSequenceId: (id: string | null) => void;
  setIsPreRendering: (rendering: boolean) => void;
  setPreRenderProgress: (progress: PreRenderProgress | null) => void;
  setPreRenderedFramesReady: (ready: boolean) => void;
  setPreviousGridMode: (mode: string | null) => void;
  setServicesReady: (ready: boolean) => void;
  setPixiLoading: (loading: boolean) => void;
  setPixiError: (error: string | null) => void;
  updateVisibility: (
    key: keyof AnimationVisibilitySettings,
    visible: boolean
  ) => void;
  syncVisibilityFromManager: (manager: AnimationVisibilityStateManager) => void;
  setContainerElement: (element: HTMLDivElement | null) => void;
  reset: () => void;
};

export type AnimationVisibilitySettings = {
  grid: boolean;
  stepNumbers: boolean;
  props: boolean;
  trails: boolean;
  tkaGlyph: boolean; // TKA Glyph includes turn numbers
  reversalIndicators: boolean;
  blueMotion: boolean;
  redMotion: boolean;
};

// ============================================================================
// STATE FACTORY
// ============================================================================

export function createAnimatorCanvasState(
  externalTrailSettings?: TrailSettings,
  visibilityManager?: AnimationVisibilityStateManager
): AnimatorCanvasState {
  // Canvas dimensions
  let canvasSize = $state(DEFAULT_CANVAS_SIZE);
  let bluePropDimensions = $state({ ...DEFAULT_PROP_DIMENSIONS });
  let redPropDimensions = $state({ ...DEFAULT_PROP_DIMENSIONS });

  // Initialization
  let isInitialized = $state(false);
  let needsRender = $state(true);

  // Prop types
  let currentPropType = $state("staff");
  let currentBluePropType = $state("staff");
  let currentRedPropType = $state("staff");

  // Trail settings - use external if provided, otherwise load from persistence
  let trailSettings = $state<TrailSettings>(
    externalTrailSettings ?? loadTrailSettings()
  );

  // Path cache state
  let pathCacheData = $state<AnimationPathCacheData | null>(null);
  let isCachePrecomputing = $state(false);
  let cacheSequenceId = $state<string | null>(null);

  // Frame pre-render state
  let isPreRendering = $state(false);
  let preRenderProgress = $state<PreRenderProgress | null>(null);
  let preRenderedFramesReady = $state(false);

  // Grid mode tracking
  let previousGridMode = $state<string | null>(null);

  // Service lifecycle
  let servicesReady = $state(false);
  let pixiLoading = $state(false);
  let pixiError = $state<string | null>(null);

  // Visibility state (initialized from manager if provided, otherwise defaults)
  let gridVisible = $state(visibilityManager?.isGridVisible() ?? true);
  let stepNumbersVisible = $state(
    visibilityManager?.getVisibility("stepNumbers") ?? true
  );
  let propsVisible = $state(visibilityManager?.getVisibility("props") ?? true);
  let trailsVisible = $state(visibilityManager?.isTrailsVisible() ?? true);
  let tkaGlyphVisible = $state(
    visibilityManager?.getVisibility("tkaGlyph") ?? true
  );
  let blueMotionVisible = $state(
    visibilityManager?.getVisibility("blueMotion") ?? true
  );
  let redMotionVisible = $state(
    visibilityManager?.getVisibility("redMotion") ?? true
  );

  // Container reference
  let containerElement = $state<HTMLDivElement | null>(null);

  return {
    // Getters
    get canvasSize() {
      return canvasSize;
    },
    get bluePropDimensions() {
      return bluePropDimensions;
    },
    get redPropDimensions() {
      return redPropDimensions;
    },
    get isInitialized() {
      return isInitialized;
    },
    get needsRender() {
      return needsRender;
    },
    get currentPropType() {
      return currentPropType;
    },
    get currentBluePropType() {
      return currentBluePropType;
    },
    get currentRedPropType() {
      return currentRedPropType;
    },
    get trailSettings() {
      return trailSettings;
    },
    get pathCacheData() {
      return pathCacheData;
    },
    get isCachePrecomputing() {
      return isCachePrecomputing;
    },
    get cacheSequenceId() {
      return cacheSequenceId;
    },
    get isPreRendering() {
      return isPreRendering;
    },
    get preRenderProgress() {
      return preRenderProgress;
    },
    get preRenderedFramesReady() {
      return preRenderedFramesReady;
    },
    get previousGridMode() {
      return previousGridMode;
    },
    get servicesReady() {
      return servicesReady;
    },
    get pixiLoading() {
      return pixiLoading;
    },
    get pixiError() {
      return pixiError;
    },
    get gridVisible() {
      return gridVisible;
    },
    get stepNumbersVisible() {
      return stepNumbersVisible;
    },
    get propsVisible() {
      return propsVisible;
    },
    get trailsVisible() {
      return trailsVisible;
    },
    get tkaGlyphVisible() {
      return tkaGlyphVisible;
    },
    get blueMotionVisible() {
      return blueMotionVisible;
    },
    get redMotionVisible() {
      return redMotionVisible;
    },
    get containerElement() {
      return containerElement;
    },
    set containerElement(element: HTMLDivElement | null) {
      containerElement = element;
    },

    // Mutators
    setCanvasSize(size: number) {
      canvasSize = size;
    },

    setBluePropDimensions(dims: { width: number; height: number }) {
      bluePropDimensions = { ...dims };
    },

    setRedPropDimensions(dims: { width: number; height: number }) {
      redPropDimensions = { ...dims };
    },

    setPropDimensions(
      blue: { width: number; height: number },
      red: { width: number; height: number }
    ) {
      bluePropDimensions = { ...blue };
      redPropDimensions = { ...red };
    },

    setIsInitialized(initialized: boolean) {
      isInitialized = initialized;
    },

    setNeedsRender(needs: boolean) {
      needsRender = needs;
    },

    triggerRender() {
      needsRender = true;
    },

    setCurrentPropType(type: string) {
      currentPropType = type;
    },

    setPropTypes(blue: string, red: string) {
      currentBluePropType = blue;
      currentRedPropType = red;
      currentPropType = blue; // Legacy compatibility
    },

    setTrailSettings(settings: TrailSettings) {
      trailSettings = { ...settings };
      saveTrailSettings(trailSettings);
    },

    updateTrailSettings(updates: Partial<TrailSettings>) {
      trailSettings = { ...trailSettings, ...updates };
      saveTrailSettings(trailSettings);
    },

    setPathCacheData(data: AnimationPathCacheData | null) {
      pathCacheData = data;
    },

    setIsCachePrecomputing(computing: boolean) {
      isCachePrecomputing = computing;
    },

    setCacheSequenceId(id: string | null) {
      cacheSequenceId = id;
    },

    setIsPreRendering(rendering: boolean) {
      isPreRendering = rendering;
    },

    setPreRenderProgress(progress: PreRenderProgress | null) {
      preRenderProgress = progress ? { ...progress } : null;
    },

    setPreRenderedFramesReady(ready: boolean) {
      preRenderedFramesReady = ready;
    },

    setPreviousGridMode(mode: string | null) {
      previousGridMode = mode;
    },

    setServicesReady(ready: boolean) {
      servicesReady = ready;
    },

    setPixiLoading(loading: boolean) {
      pixiLoading = loading;
    },

    setPixiError(error: string | null) {
      pixiError = error;
    },

    updateVisibility(key: string, visible: boolean | string) {
      // Handle boolean visibility settings
      if (key === "stepNumbers" && typeof visible === "boolean")
        stepNumbersVisible = visible;
      if (key === "props" && typeof visible === "boolean")
        propsVisible = visible;
      if (key === "tkaGlyph" && typeof visible === "boolean")
        tkaGlyphVisible = visible;
      if (key === "blueMotion" && typeof visible === "boolean")
        blueMotionVisible = visible;
      if (key === "redMotion" && typeof visible === "boolean")
        redMotionVisible = visible;
      // gridMode and trailStyle are now managed separately (string enums, not booleans)
      if (key === "gridMode" && typeof visible === "string") {
        gridVisible = visible !== "none";
      }
      if (key === "trailStyle" && typeof visible === "string") {
        trailsVisible = visible !== "off";
      }
    },

    syncVisibilityFromManager(manager: AnimationVisibilityStateManager) {
      gridVisible = manager.isGridVisible();
      stepNumbersVisible = manager.getVisibility("stepNumbers");
      propsVisible = manager.getVisibility("props");
      trailsVisible = manager.isTrailsVisible();
      tkaGlyphVisible = manager.getVisibility("tkaGlyph");
      blueMotionVisible = manager.getVisibility("blueMotion");
      redMotionVisible = manager.getVisibility("redMotion");
    },

    setContainerElement(element: HTMLDivElement | null) {
      containerElement = element;
    },

    reset() {
      canvasSize = DEFAULT_CANVAS_SIZE;
      bluePropDimensions = { ...DEFAULT_PROP_DIMENSIONS };
      redPropDimensions = { ...DEFAULT_PROP_DIMENSIONS };
      isInitialized = false;
      needsRender = true;
      currentPropType = "staff";
      currentBluePropType = "staff";
      currentRedPropType = "staff";
      trailSettings = loadTrailSettings();
      pathCacheData = null;
      isCachePrecomputing = false;
      cacheSequenceId = null;
      isPreRendering = false;
      preRenderProgress = null;
      preRenderedFramesReady = false;
      previousGridMode = null;
      servicesReady = false;
      pixiLoading = false;
      pixiError = null;
      gridVisible = true;
      stepNumbersVisible = true;
      propsVisible = true;
      trailsVisible = true;
      tkaGlyphVisible = true;
      blueMotionVisible = true;
      redMotionVisible = true;
      containerElement = null;
    },
  };
}
