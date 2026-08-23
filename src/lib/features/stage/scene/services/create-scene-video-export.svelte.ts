import { getExportOptionsState } from "$lib/shared/animation-panel/state/export-options-state.svelte";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  sanitizeFilename,
  shareOrDownloadBlob,
} from "$lib/shared/foundation/services/file-downloader";
import type { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
import { ensureFullAccountForExport } from "$lib/shared/auth/domain/export-gate";
import {
  sequenceModalExporter,
  type Video3DExportDependencies,
} from "$lib/shared/sequence-viewer/services/sequence-modal-exporter.svelte";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
import { CameraKeyframeBuffer } from "$lib/shared/video-export/domain/camera-keyframe";

type Viewer3DState = ReturnType<typeof createViewer3DState>;

/**
 * Scene Studio's export adapter. The offline renderer and export-option state
 * stay owned by the same production services used by Sequence Viewer; this
 * adapter only gathers the live scene handles and delivers the finished blob.
 */
export function createSceneVideoExport(viewer: Viewer3DState) {
  const options = getExportOptionsState();
  let localError = $state<string | null>(null);

  async function waitForScene(timeoutMs = 10_000): Promise<boolean> {
    const ready = () =>
      !!viewer.webglCanvas &&
      !!viewer.threlteCamera &&
      !!viewer.threlteRenderer &&
      !!viewer.threlteRunFrame &&
      !!viewer.threltePauseAutoLoop &&
      !!viewer.threlteResumeAutoLoop;

    const deadline = Date.now() + timeoutMs;
    while (!ready() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return ready();
  }

  async function render(sequence: SequenceData, bpm: number): Promise<boolean> {
    localError = null;
    if (sequenceModalExporter.state.isExporting) return false;
    if (!(await ensureFullAccountForExport())) return false;
    if (!(await waitForScene())) {
      localError = "The 3D scene is still loading. Wait a moment and try again.";
      return false;
    }

    const canvas = viewer.webglCanvas;
    const camera = viewer.threlteCamera as
      | Video3DExportDependencies["camera"]
      | null;
    const renderer = viewer.threlteRenderer as
      | Video3DExportDependencies["renderer"]
      | null;
    const runFrame = viewer.threlteRunFrame;
    const pauseAutoLoop = viewer.threltePauseAutoLoop;
    const resumeAutoLoop = viewer.threlteResumeAutoLoop;
    if (
      !canvas ||
      !camera ||
      !renderer ||
      !runFrame ||
      !pauseAutoLoop ||
      !resumeAutoLoop
    ) {
      localError = "The 3D scene is not ready to export yet.";
      return false;
    }

    const videoOptions = options.getVideoOptions();
    const beatsPerSecond = Math.max(1, bpm) / 60;
    const sequenceUnits = sequence.steps.reduce(
      (sum, step) => sum + (step.duration ?? 1),
      0
    );
    const holdUnits =
      (videoOptions.includeStartPosition ? 1 : 0) +
      (videoOptions.includeEndHold ? 1 : 0);
    const cameraKeyframes = new CameraKeyframeBuffer();
    cameraKeyframes.captureStatic(camera);

    await sequenceModalExporter.export3DAnimation(
      {
        fps: videoOptions.fps,
        loopCount: videoOptions.loopCount,
        resolution: videoOptions.resolution,
        includeStartPosition: videoOptions.includeStartPosition,
        includeEndHold: videoOptions.includeEndHold,
        quality: videoOptions.quality,
      },
      {
        webglCanvas: canvas,
        camera,
        beatsPerSecond,
        totalDurationSeconds: (sequenceUnits + holdUnits) / beatsPerSecond,
        cameraKeyframes,
        renderer,
        runFrame,
        pauseAutoLoop,
        resumeAutoLoop,
        setExporting: (value) => (viewer.isExporting = value),
        setExportCurrentStep: (step) => (viewer.exportCurrentStep = step),
      },
      {
        onSuccess: () => undefined,
        onError: () => undefined,
        onHaptic: () => undefined,
      }
    );

    return !!sequenceModalExporter.state.previewBlobUrl;
  }

  async function save(sequence: SequenceData): Promise<void> {
    const url = sequenceModalExporter.state.previewBlobUrl;
    if (!url) return;
    const blob = await (await fetch(url)).blob();
    const rawName =
      sequence.displayName ||
      sequence.intendedWord ||
      sequence.word ||
      "sequence";
    const filename =
      sanitizeFilename(simplifyRepeatedWord(rawName)) || "sequence";
    await shareOrDownloadBlob(blob, `${filename}-3d.mp4`, {
      title: "TKA 3D Scene",
    });
  }

  return {
    options,
    get state() {
      const sharedState = sequenceModalExporter.state;
      return {
        ...sharedState,
        error: localError ?? sharedState.error,
      };
    },
    render,
    save,
    cancel: () => sequenceModalExporter.cancel(),
    dismissPreview: () => sequenceModalExporter.dismissPreview(),
    clearError: () => {
      localError = null;
      sequenceModalExporter.clearError();
    },
  };
}

export type SceneVideoExportState = ReturnType<typeof createSceneVideoExport>;
