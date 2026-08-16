import { effect_root } from "svelte/internal/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { OrchestratorContext } from "$lib/shared/sequence-viewer/domain/viewer-orchestrator-context";
import { createViewerEditModeState } from "$lib/shared/sequence-viewer/state/viewer-edit-mode-state.svelte";
import { createViewerShellLayoutState } from "$lib/shared/sequence-viewer/state/viewer-shell-layout-state.svelte";
import type {
  ExportContext,
  SplitConfig,
  ViewerMode,
} from "$lib/shared/sequence-viewer/state/viewer-state.svelte";

const sequence = {
  id: "card-playback",
  word: "AB",
  steps: [],
} as unknown as SequenceData;

function createHarness(initialPlaying: boolean) {
  let playing = initialPlaying;
  let viewerMode: ViewerMode = "animation";
  let exportContext: ExportContext = "animation-export";
  let videoUploadOpen = false;
  let splitConfig: SplitConfig = {
    leftPane: "animation",
    rightPane: "card",
  };

  const togglePlayback = vi.fn(() => {
    playing = !playing;
  });
  const viewerState = {
    get viewerMode() {
      return viewerMode;
    },
    get exportContext() {
      return exportContext;
    },
    get videoUploadOpen() {
      return videoUploadOpen;
    },
    get splitConfig() {
      return splitConfig;
    },
    enterExport(
      type: "animation-export" | "image-export",
      contentType?: "animation" | "animation-3d"
    ) {
      viewerMode =
        type === "image-export" ? "card" : (contentType ?? "animation");
      exportContext = type;
      videoUploadOpen = false;
    },
    exitExport() {
      exportContext = null;
    },
    setViewerMode(mode: ViewerMode) {
      viewerMode = mode;
      videoUploadOpen = false;
    },
    openVideoUpload() {
      viewerMode = "videos";
      exportContext = null;
      videoUploadOpen = true;
    },
    closeVideoUpload() {
      videoUploadOpen = false;
    },
    setSplitConfig(config: SplitConfig) {
      splitConfig = config;
    },
  };

  const editMode = createViewerEditModeState({
    viewerState: viewerState as never,
    playback: {
      get isPlayingLocal() {
        return playing;
      },
    } as never,
    interactive: {
      playbackController: { togglePlayback },
      hapticService: null,
    } as never,
    exportCoordinator: { dismissPreview: vi.fn() } as never,
    modalAnimationState: {} as never,
    accessibilityHelper: { announce: vi.fn() } as never,
    getEditingPane: () =>
      exportContext === "image-export"
        ? "image"
        : exportContext === "animation-export"
          ? "animation"
          : null,
    getEffectiveSequence: () => sequence,
    getIsHandPath: () => false,
    getResolvedCardAutoLayout: () => null,
  });

  const context = {
    viewerState,
    get editingPane() {
      return exportContext === "image-export"
        ? "image"
        : exportContext === "animation-export"
          ? "animation"
          : null;
    },
    get isPlayingLocal() {
      return playing;
    },
    get bpmLocal() {
      return 60;
    },
    get currentStepLocal() {
      return 3;
    },
    get cardReady() {
      return false;
    },
    ensureInteractiveServices: vi.fn(),
    enterEditMode: editMode.enterEditMode,
    exitEditMode: editMode.exitEditMode,
    handlePlaybackToggle: togglePlayback,
  } as unknown as OrchestratorContext;

  let layout!: ReturnType<typeof createViewerShellLayoutState>;
  const dispose = effect_root(() => {
    layout = createViewerShellLayoutState(
      {
        getContext: () => context,
        getSequence: () => sequence,
        getIsMobile: () => true,
        startInSplit: false,
        startInCardThenSplit: false,
      },
      {
        getDeviceDetector: vi.fn(),
        captureScanSettingChanged: vi.fn(),
        captureScanViewChanged: vi.fn(),
        captureScanViewerOpened: vi.fn(),
        captureScanPlaybackChanged: vi.fn(),
      }
    );
  });

  return {
    layout,
    editMode,
    dispose,
    togglePlayback,
    get playing() {
      return playing;
    },
    get viewerMode() {
      return viewerMode;
    },
    get exportContext() {
      return exportContext;
    },
    get videoUploadOpen() {
      return videoUploadOpen;
    },
  };
}

const disposals: Array<() => void> = [];

afterEach(() => {
  while (disposals.length > 0) disposals.pop()?.();
});

describe("sequence viewer Card playback", () => {
  it("pauses for Card and resumes when the running animation returns", () => {
    const harness = createHarness(true);
    disposals.push(harness.dispose);

    harness.layout.selectViewerMode("card");
    expect(harness.viewerMode).toBe("card");
    expect(harness.playing).toBe(false);

    harness.layout.selectViewerMode("animation");
    expect(harness.viewerMode).toBe("animation");
    expect(harness.playing).toBe(true);
    expect(harness.togglePlayback).toHaveBeenCalledTimes(2);
  });

  it("keeps an intentionally paused animation paused across Card", () => {
    const harness = createHarness(false);
    disposals.push(harness.dispose);

    harness.layout.selectViewerMode("card");
    harness.layout.selectViewerMode("animation");

    expect(harness.playing).toBe(false);
    expect(harness.togglePlayback).not.toHaveBeenCalled();
  });

  it("does not cancel the restored playback when the card QR opens animation", () => {
    const harness = createHarness(true);
    disposals.push(harness.dispose);

    harness.layout.selectViewerMode("card");
    harness.layout.playFromQr();

    expect(harness.viewerMode).toBe("animation");
    expect(harness.playing).toBe(true);
    expect(harness.togglePlayback).toHaveBeenCalledTimes(2);
  });

  it("opens the video workspace even when animation export was already active", () => {
    const harness = createHarness(false);
    disposals.push(harness.dispose);

    expect(harness.exportContext).toBe("animation-export");
    harness.editMode.enterEditMode("video-upload");

    expect(harness.exportContext).toBeNull();
    expect(harness.viewerMode).toBe("videos");
    expect(harness.videoUploadOpen).toBe(true);
  });

  it("returns from the video upload panel to the video gallery", () => {
    const harness = createHarness(false);
    disposals.push(harness.dispose);

    harness.editMode.enterEditMode("video-upload");
    harness.editMode.exitEditMode();

    expect(harness.viewerMode).toBe("videos");
    expect(harness.exportContext).toBeNull();
    expect(harness.videoUploadOpen).toBe(false);
  });

  it("opens the video gallery without leaving an export inspector active", () => {
    const harness = createHarness(false);
    disposals.push(harness.dispose);

    harness.layout.selectViewerMode("videos");

    expect(harness.viewerMode).toBe("videos");
    expect(harness.exportContext).toBeNull();
    expect(harness.videoUploadOpen).toBe(false);
  });
});
