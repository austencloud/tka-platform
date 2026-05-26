/**
 * Export Options State Manager
 *
 * Manages export options for the sequence viewer with localStorage persistence.
 * Options are scoped by export type (video/image) and view mode (split/animation).
 */

// Video FPS options
export type VideoFps = 30 | 60 | 120;

// Video resolution options
export type VideoResolution = 720 | 1080 | 2160 | 4320;

// Video quality tier.
// - "standard": one render per output frame, native resolution.
// - "cinema": 2× supersampling + 4× temporal motion blur. 3D exports only.
//             Roughly 4-8× slower than standard but produces a notably
//             smoother, sharper result - the right choice for finished
//             cuts, portfolio pieces, and anything you plan to share.
export type VideoQuality = "standard" | "cinema";

// Effect overrides for video export
export interface EffectOverride {
  fire: boolean;
  led: boolean;
  trails: boolean;
  charcoal: boolean;
}

// Grid step size options (pixels)
export type GridStepSize = 80 | 120 | 160;

// Composite orientation
export type CompositeOrientation = "horizontal" | "vertical";

export interface VideoExportOptions {
  fps: VideoFps;
  loopCount: number;
  resolution: VideoResolution;
  effectOverrides: EffectOverride | null; // null = use viewer state
  includeStartPosition: boolean;
  includeEndHold: boolean;
  quality: VideoQuality;
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
  showQRCode: boolean;
  darkMode: boolean;
  columnCount: number | null;  // null = auto
}

interface ExportOptionsState {
  video: VideoExportOptions;
  split: SplitExportOptions;
  image: ImageExportOptions;
}

const STORAGE_KEY = "tka_export_options";

// Default values
const DEFAULT_VIDEO_OPTIONS: VideoExportOptions = {
  fps: 60,
  loopCount: 1,
  resolution: 1080,
  effectOverrides: null,
  includeStartPosition: true,
  includeEndHold: true, // Overridden to false for loopable sequences at runtime
  quality: "standard",
};

const DEFAULT_SPLIT_OPTIONS: SplitExportOptions = {
  fps: 60,
  loopCount: 1,
  resolution: 1080,
  effectOverrides: null,
  includeStartPosition: true,
  includeEndHold: true,
  compositeOrientation: "horizontal",
  gridStepSize: 120,
  showStepNumbers: true,
  quality: "standard",
};

const DEFAULT_IMAGE_OPTIONS: ImageExportOptions = {
  includeStartPosition: true,
  showStepNumbers: true,
  showWord: true,
  showDifficulty: true,
  showCreatorName: true,
  showNotes: true,
  showQRCode: true,
  darkMode: true,
  columnCount: null,
};

/**
 * Effects are mutually exclusive. If multiple are persisted from an older
 * version, keep only the first active one.
 */
function sanitizeEffectOverrides(overrides: EffectOverride | null): EffectOverride | null {
  if (!overrides) return null;
  const keys: (keyof EffectOverride)[] = ["fire", "led", "trails", "charcoal"];
  const activeKeys = keys.filter((k) => overrides[k]);
  if (activeKeys.length <= 1) return overrides;
  // Keep only the first active effect
  const sanitized: EffectOverride = { fire: false, led: false, trails: false, charcoal: false };
  sanitized[activeKeys[0]!] = true;
  return sanitized;
}

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
      const video = { ...DEFAULT_VIDEO_OPTIONS, ...parsed.video };
      const split = { ...DEFAULT_SPLIT_OPTIONS, ...parsed.split };
      // Sanitize any stale multi-effect state
      video.effectOverrides = sanitizeEffectOverrides(video.effectOverrides);
      split.effectOverrides = sanitizeEffectOverrides(split.effectOverrides);
      return {
        video,
        split,
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
  let videoResolution = $state<VideoResolution>(stored.video.resolution ?? 1080);
  let videoEffectOverrides = $state<EffectOverride | null>(stored.video.effectOverrides ?? null);
  let videoIncludeStartPosition = $state(stored.video.includeStartPosition ?? true);
  let videoIncludeEndHold = $state(stored.video.includeEndHold ?? true);
  let videoQuality = $state<VideoQuality>(stored.video.quality ?? "standard");

  // Split export options (animation + grid composite)
  let splitFps = $state<VideoFps>(stored.split.fps);
  let splitLoopCount = $state(stored.split.loopCount);
  let splitResolution = $state<VideoResolution>(stored.split.resolution ?? 1080);
  let splitEffectOverrides = $state<EffectOverride | null>(stored.split.effectOverrides ?? null);
  let splitOrientation = $state<CompositeOrientation>(stored.split.compositeOrientation);
  let splitGridStepSize = $state<GridStepSize>(stored.split.gridStepSize);
  let splitShowStepNumbers = $state(stored.split.showStepNumbers);
  let splitIncludeStartPosition = $state(stored.split.includeStartPosition);
  let splitIncludeEndHold = $state(stored.split.includeEndHold ?? true);

  // Image export options
  let imageIncludeStartPosition = $state(stored.image.includeStartPosition);
  let imageShowStepNumbers = $state(stored.image.showStepNumbers);
  let imageShowWord = $state(stored.image.showWord);
  let imageShowDifficulty = $state(stored.image.showDifficulty);
  let imageShowCreatorName = $state(stored.image.showCreatorName);
  let imageShowNotes = $state(stored.image.showNotes);
  let imageShowQRCode = $state(stored.image.showQRCode ?? true);
  let imageDarkMode = $state(stored.image.darkMode);
  let imageColumnCount = $state<number | null>(stored.image.columnCount ?? null);

  // Persist changes on any update
  function persist() {
    saveToStorage({
      video: {
        fps: videoFps,
        loopCount: videoLoopCount,
        resolution: videoResolution,
        effectOverrides: videoEffectOverrides,
        includeStartPosition: videoIncludeStartPosition,
        includeEndHold: videoIncludeEndHold,
        quality: videoQuality,
      },
      split: {
        fps: splitFps,
        loopCount: splitLoopCount,
        resolution: splitResolution,
        effectOverrides: splitEffectOverrides,
        compositeOrientation: splitOrientation,
        gridStepSize: splitGridStepSize,
        showStepNumbers: splitShowStepNumbers,
        includeStartPosition: splitIncludeStartPosition,
        includeEndHold: splitIncludeEndHold,
        quality: "standard",
      },
      image: {
        includeStartPosition: imageIncludeStartPosition,
        showStepNumbers: imageShowStepNumbers,
        showWord: imageShowWord,
        showDifficulty: imageShowDifficulty,
        showCreatorName: imageShowCreatorName,
        showNotes: imageShowNotes,
        showQRCode: imageShowQRCode,
        darkMode: imageDarkMode,
        columnCount: imageColumnCount,
      },
    });
  }

  return {
    // Video options (getters)
    get videoFps() { return videoFps; },
    get videoLoopCount() { return videoLoopCount; },
    get videoResolution() { return videoResolution; },
    get videoEffectOverrides() { return videoEffectOverrides; },
    get videoIncludeStartPosition() { return videoIncludeStartPosition; },
    get videoIncludeEndHold() { return videoIncludeEndHold; },
    get videoQuality() { return videoQuality; },

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
    get imageShowQRCode() { return imageShowQRCode; },
    get imageDarkMode() { return imageDarkMode; },
    get imageColumnCount() { return imageColumnCount; },

    // Video setters
    setVideoFps(fps: VideoFps) {
      videoFps = fps;
      persist();
    },
    setVideoLoopCount(count: number) {
      videoLoopCount = Math.max(1, Math.min(10, count));
      persist();
    },
    setVideoResolution(res: VideoResolution) {
      videoResolution = res;
      persist();
    },
    setVideoEffectOverrides(overrides: EffectOverride | null) {
      videoEffectOverrides = overrides;
      persist();
    },
    setVideoIncludeStartPosition(include: boolean) {
      videoIncludeStartPosition = include;
      persist();
    },
    setVideoIncludeEndHold(include: boolean) {
      videoIncludeEndHold = include;
      persist();
    },
    setVideoQuality(q: VideoQuality) {
      videoQuality = q;
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
    setImageShowQRCode(show: boolean) {
      imageShowQRCode = show;
      persist();
    },
    setImageDarkMode(dark: boolean) {
      imageDarkMode = dark;
      persist();
    },
    setImageColumnCount(count: number | null) {
      imageColumnCount = count;
      persist();
    },

    // Bulk getters for export functions
    getVideoOptions(): VideoExportOptions {
      return {
        fps: videoFps,
        loopCount: videoLoopCount,
        resolution: videoResolution,
        effectOverrides: videoEffectOverrides,
        includeStartPosition: videoIncludeStartPosition,
        includeEndHold: videoIncludeEndHold,
        quality: videoQuality,
      };
    },

    getSplitOptions(): SplitExportOptions {
      return {
        fps: splitFps,
        loopCount: splitLoopCount,
        resolution: splitResolution,
        effectOverrides: splitEffectOverrides,
        includeStartPosition: splitIncludeStartPosition,
        includeEndHold: splitIncludeEndHold,
        compositeOrientation: splitOrientation,
        gridStepSize: splitGridStepSize,
        showStepNumbers: splitShowStepNumbers,
        quality: "standard",
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
        showQRCode: imageShowQRCode,
        darkMode: imageDarkMode,
        columnCount: imageColumnCount,
      };
    },

    // Reset to defaults
    resetToDefaults() {
      videoFps = DEFAULT_VIDEO_OPTIONS.fps;
      videoLoopCount = DEFAULT_VIDEO_OPTIONS.loopCount;
      videoResolution = DEFAULT_VIDEO_OPTIONS.resolution;
      videoEffectOverrides = DEFAULT_VIDEO_OPTIONS.effectOverrides;
      videoIncludeStartPosition = DEFAULT_VIDEO_OPTIONS.includeStartPosition;
      videoIncludeEndHold = DEFAULT_VIDEO_OPTIONS.includeEndHold;
      videoQuality = DEFAULT_VIDEO_OPTIONS.quality;
      splitFps = DEFAULT_SPLIT_OPTIONS.fps;
      splitLoopCount = DEFAULT_SPLIT_OPTIONS.loopCount;
      splitResolution = DEFAULT_SPLIT_OPTIONS.resolution;
      splitEffectOverrides = DEFAULT_SPLIT_OPTIONS.effectOverrides;
      splitOrientation = DEFAULT_SPLIT_OPTIONS.compositeOrientation;
      splitGridStepSize = DEFAULT_SPLIT_OPTIONS.gridStepSize;
      splitShowStepNumbers = DEFAULT_SPLIT_OPTIONS.showStepNumbers;
      splitIncludeStartPosition = DEFAULT_SPLIT_OPTIONS.includeStartPosition;
      splitIncludeEndHold = DEFAULT_SPLIT_OPTIONS.includeEndHold;
      imageIncludeStartPosition = DEFAULT_IMAGE_OPTIONS.includeStartPosition;
      imageShowStepNumbers = DEFAULT_IMAGE_OPTIONS.showStepNumbers;
      imageShowWord = DEFAULT_IMAGE_OPTIONS.showWord;
      imageShowDifficulty = DEFAULT_IMAGE_OPTIONS.showDifficulty;
      imageShowCreatorName = DEFAULT_IMAGE_OPTIONS.showCreatorName;
      imageShowNotes = DEFAULT_IMAGE_OPTIONS.showNotes;
      imageShowQRCode = DEFAULT_IMAGE_OPTIONS.showQRCode;
      imageDarkMode = DEFAULT_IMAGE_OPTIONS.darkMode;
      imageColumnCount = DEFAULT_IMAGE_OPTIONS.columnCount;
      persist();
    },
  };
}

/** The return type of createExportOptionsState - used for typing the state object */
export type ExportOptionsStateManager = ReturnType<typeof createExportOptionsState>;

// Singleton for global access (created once per app)
let singletonInstance: ExportOptionsStateManager | null = null;

export function getExportOptionsState(): ExportOptionsStateManager {
  if (!singletonInstance) {
    singletonInstance = createExportOptionsState();
  }
  return singletonInstance;
}
