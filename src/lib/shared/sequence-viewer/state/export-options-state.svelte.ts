/**
 * Export Options State Manager
 *
 * Manages export options for SequenceDetailsModal with localStorage persistence.
 * Options are scoped by export type (video/image) and view mode (split/animation).
 */

// Video FPS options
export type VideoFps = 30 | 50 | 60;

// Grid step size options (pixels)
export type GridStepSize = 80 | 120 | 160;

// Composite orientation
export type CompositeOrientation = "horizontal" | "vertical";

export interface VideoExportOptions {
  fps: VideoFps;
  loopCount: number;
}

export interface SplitExportOptions extends VideoExportOptions {
  compositeOrientation: CompositeOrientation;
  gridStepSize: GridStepSize;
  showStepNumbers: boolean;
  includeStartPosition: boolean;
}

export interface ImageExportOptions {
  includeStartPosition: boolean;
  showStepNumbers: boolean;
  showWord: boolean;
  showDifficulty: boolean;
  showCreatorName: boolean;
  showNotes: boolean;
  darkMode: boolean;
}

interface ExportOptionsState {
  video: VideoExportOptions;
  split: SplitExportOptions;
  image: ImageExportOptions;
}

const STORAGE_KEY = "tka_export_options";

// Default values
const DEFAULT_VIDEO_OPTIONS: VideoExportOptions = {
  fps: 30,
  loopCount: 1,
};

const DEFAULT_SPLIT_OPTIONS: SplitExportOptions = {
  fps: 30,
  loopCount: 1,
  compositeOrientation: "horizontal",
  gridStepSize: 120,
  showStepNumbers: true,
  includeStartPosition: true,
};

const DEFAULT_IMAGE_OPTIONS: ImageExportOptions = {
  includeStartPosition: true,
  showStepNumbers: true,
  showWord: true,
  showDifficulty: true,
  showCreatorName: true,
  showNotes: true,
  darkMode: false,
};

function loadFromStorage(): ExportOptionsState {
  if (typeof localStorage === "undefined") {
    return {
      video: { ...DEFAULT_VIDEO_OPTIONS },
      split: { ...DEFAULT_SPLIT_OPTIONS },
      image: { ...DEFAULT_IMAGE_OPTIONS },
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<ExportOptionsState>;
      return {
        video: { ...DEFAULT_VIDEO_OPTIONS, ...parsed.video },
        split: { ...DEFAULT_SPLIT_OPTIONS, ...parsed.split },
        image: { ...DEFAULT_IMAGE_OPTIONS, ...parsed.image },
      };
    }
  } catch (e) {
    console.warn("[ExportOptionsState] Failed to load from storage:", e);
  }

  return {
    video: { ...DEFAULT_VIDEO_OPTIONS },
    split: { ...DEFAULT_SPLIT_OPTIONS },
    image: { ...DEFAULT_IMAGE_OPTIONS },
  };
}

function saveToStorage(state: ExportOptionsState): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("[ExportOptionsState] Failed to save to storage:", e);
  }
}

/**
 * Creates export options state with Svelte 5 runes and localStorage persistence.
 */
export function createExportOptionsState() {
  const stored = loadFromStorage();

  // Video export options (animation-only mode)
  let videoFps = $state<VideoFps>(stored.video.fps);
  let videoLoopCount = $state(stored.video.loopCount);

  // Split export options (animation + grid composite)
  let splitFps = $state<VideoFps>(stored.split.fps);
  let splitLoopCount = $state(stored.split.loopCount);
  let splitOrientation = $state<CompositeOrientation>(stored.split.compositeOrientation);
  let splitGridStepSize = $state<GridStepSize>(stored.split.gridStepSize);
  let splitShowStepNumbers = $state(stored.split.showStepNumbers);
  let splitIncludeStartPosition = $state(stored.split.includeStartPosition);

  // Image export options
  let imageIncludeStartPosition = $state(stored.image.includeStartPosition);
  let imageShowStepNumbers = $state(stored.image.showStepNumbers);
  let imageShowWord = $state(stored.image.showWord);
  let imageShowDifficulty = $state(stored.image.showDifficulty);
  let imageShowCreatorName = $state(stored.image.showCreatorName);
  let imageShowNotes = $state(stored.image.showNotes);
  let imageDarkMode = $state(stored.image.darkMode);

  // Persist changes on any update
  function persist() {
    saveToStorage({
      video: {
        fps: videoFps,
        loopCount: videoLoopCount,
      },
      split: {
        fps: splitFps,
        loopCount: splitLoopCount,
        compositeOrientation: splitOrientation,
        gridStepSize: splitGridStepSize,
        showStepNumbers: splitShowStepNumbers,
        includeStartPosition: splitIncludeStartPosition,
      },
      image: {
        includeStartPosition: imageIncludeStartPosition,
        showStepNumbers: imageShowStepNumbers,
        showWord: imageShowWord,
        showDifficulty: imageShowDifficulty,
        showCreatorName: imageShowCreatorName,
        showNotes: imageShowNotes,
        darkMode: imageDarkMode,
      },
    });
  }

  return {
    // Video options (getters)
    get videoFps() { return videoFps; },
    get videoLoopCount() { return videoLoopCount; },

    // Split options (getters)
    get splitFps() { return splitFps; },
    get splitLoopCount() { return splitLoopCount; },
    get splitOrientation() { return splitOrientation; },
    get splitGridStepSize() { return splitGridStepSize; },
    get splitShowStepNumbers() { return splitShowStepNumbers; },
    get splitIncludeStartPosition() { return splitIncludeStartPosition; },

    // Image options (getters)
    get imageIncludeStartPosition() { return imageIncludeStartPosition; },
    get imageShowStepNumbers() { return imageShowStepNumbers; },
    get imageShowWord() { return imageShowWord; },
    get imageShowDifficulty() { return imageShowDifficulty; },
    get imageShowCreatorName() { return imageShowCreatorName; },
    get imageShowNotes() { return imageShowNotes; },
    get imageDarkMode() { return imageDarkMode; },

    // Video setters
    setVideoFps(fps: VideoFps) {
      videoFps = fps;
      persist();
    },
    setVideoLoopCount(count: number) {
      videoLoopCount = Math.max(1, Math.min(10, count));
      persist();
    },

    // Split setters
    setSplitFps(fps: VideoFps) {
      splitFps = fps;
      persist();
    },
    setSplitLoopCount(count: number) {
      splitLoopCount = Math.max(1, Math.min(10, count));
      persist();
    },
    setSplitOrientation(orientation: CompositeOrientation) {
      splitOrientation = orientation;
      persist();
    },
    setSplitGridStepSize(size: GridStepSize) {
      splitGridStepSize = size;
      persist();
    },
    setSplitShowStepNumbers(show: boolean) {
      splitShowStepNumbers = show;
      persist();
    },
    setSplitIncludeStartPosition(include: boolean) {
      splitIncludeStartPosition = include;
      persist();
    },

    // Image setters
    setImageIncludeStartPosition(include: boolean) {
      imageIncludeStartPosition = include;
      persist();
    },
    setImageShowStepNumbers(show: boolean) {
      imageShowStepNumbers = show;
      persist();
    },
    setImageShowWord(show: boolean) {
      imageShowWord = show;
      persist();
    },
    setImageShowDifficulty(show: boolean) {
      imageShowDifficulty = show;
      persist();
    },
    setImageShowCreatorName(show: boolean) {
      imageShowCreatorName = show;
      persist();
    },
    setImageShowNotes(show: boolean) {
      imageShowNotes = show;
      persist();
    },
    setImageDarkMode(dark: boolean) {
      imageDarkMode = dark;
      persist();
    },

    // Bulk getters for export functions
    getVideoOptions(): VideoExportOptions {
      return {
        fps: videoFps,
        loopCount: videoLoopCount,
      };
    },

    getSplitOptions(): SplitExportOptions {
      return {
        fps: splitFps,
        loopCount: splitLoopCount,
        compositeOrientation: splitOrientation,
        gridStepSize: splitGridStepSize,
        showStepNumbers: splitShowStepNumbers,
        includeStartPosition: splitIncludeStartPosition,
      };
    },

    getImageOptions(): ImageExportOptions {
      return {
        includeStartPosition: imageIncludeStartPosition,
        showStepNumbers: imageShowStepNumbers,
        showWord: imageShowWord,
        showDifficulty: imageShowDifficulty,
        showCreatorName: imageShowCreatorName,
        showNotes: imageShowNotes,
        darkMode: imageDarkMode,
      };
    },

    // Reset to defaults
    resetToDefaults() {
      videoFps = DEFAULT_VIDEO_OPTIONS.fps;
      videoLoopCount = DEFAULT_VIDEO_OPTIONS.loopCount;
      splitFps = DEFAULT_SPLIT_OPTIONS.fps;
      splitLoopCount = DEFAULT_SPLIT_OPTIONS.loopCount;
      splitOrientation = DEFAULT_SPLIT_OPTIONS.compositeOrientation;
      splitGridStepSize = DEFAULT_SPLIT_OPTIONS.gridStepSize;
      splitShowStepNumbers = DEFAULT_SPLIT_OPTIONS.showStepNumbers;
      splitIncludeStartPosition = DEFAULT_SPLIT_OPTIONS.includeStartPosition;
      imageIncludeStartPosition = DEFAULT_IMAGE_OPTIONS.includeStartPosition;
      imageShowStepNumbers = DEFAULT_IMAGE_OPTIONS.showStepNumbers;
      imageShowWord = DEFAULT_IMAGE_OPTIONS.showWord;
      imageShowDifficulty = DEFAULT_IMAGE_OPTIONS.showDifficulty;
      imageShowCreatorName = DEFAULT_IMAGE_OPTIONS.showCreatorName;
      imageShowNotes = DEFAULT_IMAGE_OPTIONS.showNotes;
      imageDarkMode = DEFAULT_IMAGE_OPTIONS.darkMode;
      persist();
    },
  };
}

// Singleton for global access (created once per app)
let singletonInstance: ReturnType<typeof createExportOptionsState> | null = null;

export function getExportOptionsState() {
  if (!singletonInstance) {
    singletonInstance = createExportOptionsState();
  }
  return singletonInstance;
}
