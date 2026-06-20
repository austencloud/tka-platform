/**
 * ExportCoordinator.svelte.ts
 *
 * Reactive module that owns export state and logic:
 * - 2D/3D export routing, recording countdown, progress tracking
 * - exportOptions, animationCanvas, isExporting, exportProgress
 * - 3D recording: camera keyframes, countdown, Pass 1/2 workflow
 * - viewer3DState management for recording
 *
 * Extracted from SequenceViewerOrchestrator.
 */

import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
import type { AnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
import { sequenceModalExporter, type Video3DExportDependencies } from "$lib/shared/sequence-viewer/services/sequence-modal-exporter.svelte";
import { getExportOptionsState } from "$lib/shared/animation-panel/state/export-options-state.svelte";
import { CameraKeyframeBuffer } from "$lib/shared/video-export/domain/camera-keyframe";
import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import { ensureFullAccountForExport } from "$lib/shared/auth/domain/export-gate";
import type { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
import type { createModalAccessibilityHelper } from "$lib/shared/sequence-viewer/services/modal-accessibility-helper.svelte";
type ExportType = "animation" | "image" | "both";

type Viewer3DState = ReturnType<typeof createViewer3DState>;
type AccessibilityHelper = ReturnType<typeof createModalAccessibilityHelper>;

export interface ExportCoordinatorDeps {
  viewer3DState: Viewer3DState;
  accessibilityHelper: AccessibilityHelper;
}

export function createExportCoordinator(deps: ExportCoordinatorDeps) {
  const { viewer3DState, accessibilityHelper } = deps;

  // ── Export options ──
  const exportOptions = getExportOptionsState();

  // ── Export state ──
  let animationCanvas = $state<HTMLCanvasElement | null>(null);

  // ── 3D recording UI state ──
  const countdownValue = $state(0);
  let isRecording3D = $state(false);
  let recordingElapsed = $state(0);
  let recordingTimer: ReturnType<typeof setInterval> | null = null;
  let resolveRecording: (() => void) | null = null;

  // ── Exit edit mode callback (set by orchestrator) ──
  let _exitEditModeCallback: (() => void) | null = null;

  function handleCanvasReady(canvas: HTMLCanvasElement | null) {
    animationCanvas = canvas;
  }

  function handleCancelExport() {
    sequenceModalExporter.cancel();
  }

  function handleRetryExport(handleExportFn: () => Promise<void>) {
    sequenceModalExporter.clearError();
    handleExportFn();
  }

  function autoDownloadVideo(effectiveSequence: SequenceData | null) {
    const url = sequenceModalExporter.state.previewBlobUrl;
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${effectiveSequence?.word || "sequence"}.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function dismissPreview() {
    sequenceModalExporter.dismissPreview();
    accessibilityHelper.announce("Ready to export again");
  }

  function handleStopRecording() {
    if (resolveRecording) resolveRecording();
  }

  async function handleExport(
    editingPane: 'animation' | 'image' | 'video-upload' | null,
    effectiveSequence: SequenceData | null,
    playbackController: AnimationPlaybackController | null,
    modalAnimationState: AnimationPanelState,
    hapticService: HapticFeedback | null,
    isPlayingLocal: boolean,
    bpmLocal: number,
    imgShowStartPos: boolean,
    imgShowWord: boolean,
    imgShowStepNumbers: boolean,
    imgShowDifficulty: boolean,
    imgShowCreatorName: boolean,
    imgShowNotes: boolean,
    imgShowQRCode: boolean,
  ) {
    const exportType: ExportType | null =
      editingPane === 'animation' ? 'animation' : editingPane === 'image' ? 'image' : null;

    if (sequenceModalExporter.state.isExporting || !exportType) return;

    // Take-it-home gate: guests play with export settings freely, but pulling
    // the actual file down requires a free account.
    if (!ensureFullAccountForExport()) return;

    hapticService?.trigger("selection");

    const isVideoExport = exportType === "animation";
    const callbacks = {
      onSuccess: (message: string) => {
        showToast(message, "success");
        accessibilityHelper.announce(message, "assertive");
        if (!isVideoExport) {
          _exitEditModeCallback?.();
        }
      },
      onError: (message: string) => {
        accessibilityHelper.announce(`Export failed: ${message}`, "assertive");
      },
      onHaptic: (type: "success" | "error" | "selection") => {
        hapticService?.trigger(type);
      },
    };

    // 3D mode: real-time capture from WebGL canvas
    const is3DMode = viewer3DState.renderMode === '3d';
    const webglCanvas = viewer3DState.webglCanvas;

    if (exportType === "animation" && is3DMode && webglCanvas && playbackController) {
      const opts = exportOptions.getVideoOptions();
      const secondsPerBeat = 1.0 / modalAnimationState.speed;
      const beatsPerSecond = modalAnimationState.speed;
      const steps = effectiveSequence?.steps ?? [];
      const totalDurationUnits = steps.reduce((sum, s) => sum + (s.duration ?? 1), 0);
      const startDur = opts.includeStartPosition ? 1 : 0;
      const endDur = opts.includeEndHold ? 1 : 0;
      const singleLoopSec = (startDur + totalDurationUnits + endDur) * secondsPerBeat;

      const threlteCamera = viewer3DState.threlteCamera as Video3DExportDependencies["camera"] | null;
      const threlteRenderer = viewer3DState.threlteRenderer as Video3DExportDependencies["renderer"] | null;
      const threlteRunFrame = viewer3DState.threlteRunFrame;
      const threltePauseAutoLoop = viewer3DState.threltePauseAutoLoop;
      const threlteResumeAutoLoop = viewer3DState.threlteResumeAutoLoop;
      if (!threlteCamera || !threlteRenderer || !threlteRunFrame || !threltePauseAutoLoop || !threlteResumeAutoLoop) {
        showToast("3D scene not ready for export. Please try again.", "error");
        return;
      }

      // ── Pass 1: Camera Performance Recording ──
      const cameraKeyframes = new CameraKeyframeBuffer();

      const choreography = viewer3DState.cameraChoreography;
      const useOrbit = choreography.activePresetId === "auto-orbit";

      const primaryAvatar = viewer3DState.performerManager.performers[0] ?? null;
      const orbitPreset = useOrbit ? choreography.activePreset : null;
      const presetTotalLoops = orbitPreset?.totalLoops ?? 1;
      const presetDurationSec = useOrbit ? singleLoopSec * presetTotalLoops : 0;

      const disposeDriver: (() => void) | null = useOrbit
        ? choreography.applyPreset("auto-orbit", {
            performers: viewer3DState.performerManager.performers,
            sequenceDurationSec: singleLoopSec,
          })
        : null;
      const driverActive = !!disposeDriver;

      const loopBefore = primaryAvatar?.loop ?? false;
      if (driverActive && primaryAvatar) primaryAvatar.loop = true;

      // Start camera recording
      cameraKeyframes.startRecording(threlteCamera);
      isRecording3D = true;
      recordingElapsed = 0;
      recordingTimer = setInterval(() => { recordingElapsed += 0.1; }, 100);

      let boundaryPoller: ReturnType<typeof setInterval> | null = null;
      let autoStopTimer: ReturnType<typeof setTimeout> | null = null;
      if (driverActive && primaryAvatar) {
        let prevProgress = primaryAvatar.progress;
        let completedLoops = 0; // eslint-disable-line @typescript-eslint/no-unused-vars
        boundaryPoller = setInterval(() => {
          const p = primaryAvatar.progress;
          if (prevProgress > 0.85 && p < 0.15) {
            completedLoops += 1;
            choreography.emitLoopBoundary();
          }
          prevProgress = p;
        }, 1000 / 60);
        autoStopTimer = setTimeout(() => {
          if (resolveRecording) resolveRecording();
        }, Math.round(presetDurationSec * 1000) + 200);
      }

      try {
        await new Promise<void>((resolve) => {
          resolveRecording = resolve;
        });
      } finally {
        if (boundaryPoller) clearInterval(boundaryPoller);
        if (autoStopTimer) clearTimeout(autoStopTimer);
        if (disposeDriver) disposeDriver();
        if (driverActive && primaryAvatar) primaryAvatar.loop = loopBefore;
      }

      cameraKeyframes.stopRecording();
      isRecording3D = false;
      resolveRecording = null;
      if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null; }

      // ── Pass 2: Deterministic Offline Render ──
      const recordedDuration = cameraKeyframes.duration;
      if (recordedDuration <= 0) {
        showToast("Recording too short. Please try again.", "error");
        return;
      }

      let exported3DOk = false;
      try {
        await sequenceModalExporter.export3DAnimation(
          {
            fps: opts.fps,
            loopCount: 1,
            resolution: opts.resolution,
            includeStartPosition: opts.includeStartPosition,
            includeEndHold: opts.includeEndHold,
            quality: opts.quality,
          },
          {
            webglCanvas,
            camera: threlteCamera,
            beatsPerSecond,
            totalDurationSeconds: recordedDuration,
            cameraKeyframes,
            renderer: threlteRenderer,
            runFrame: threlteRunFrame,
            pauseAutoLoop: threltePauseAutoLoop,
            resumeAutoLoop: threlteResumeAutoLoop,
            setExporting: (value: boolean) => { viewer3DState.isExporting = value; },
            setExportCurrentStep: (step: number | null) => { viewer3DState.exportCurrentStep = step; },
          },
          callbacks
        );
        exported3DOk = true;
      } finally {
        isRecording3D = false;
        recordingElapsed = 0;
        if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null; }
      }
      if (exported3DOk) autoDownloadVideo(effectiveSequence);
      return;
    }

    // 2D mode: frame-by-frame capture from PixiJS canvas
    if (exportType === "animation" && playbackController && animationCanvas) {
      const opts = exportOptions.getVideoOptions();
      await sequenceModalExporter.exportAnimation(
        {
          fps: opts.fps,
          loopCount: opts.loopCount,
          resolution: opts.resolution,
          includeStartPosition: opts.includeStartPosition,
          includeEndHold: opts.includeEndHold,
        },
        { canvas: animationCanvas, playbackController, panelState: modalAnimationState },
        callbacks
      );
      if (sequenceModalExporter.state.previewBlobUrl && !sequenceModalExporter.state.error) {
        autoDownloadVideo(effectiveSequence);
      }
    } else if (exportType === "animation" && (!playbackController || !animationCanvas)) {
      showToast("Animation not ready yet. Wait a moment and try again.", "error");
      return;
    } else if (exportType === "image" && effectiveSequence) {
      if (!effectiveSequence.steps || effectiveSequence.steps.length === 0) {
        showToast("Sequence has no beats to export.", "error");
        return;
      }
      const opts = {
        includeStartPosition: imgShowStartPos,
        showStepNumbers: imgShowStepNumbers,
        showWord: imgShowWord,
        showDifficulty: imgShowDifficulty,
        showCreatorName: imgShowCreatorName,
        showNotes: imgShowNotes,
        showQRCode: imgShowQRCode,
        darkMode: exportOptions.imageDarkMode,
        columnCount: exportOptions.imageColumnCount,
      };
      await sequenceModalExporter.exportImage(
        opts,
        { sequence: effectiveSequence, userName: authState.user?.displayName ?? "" },
        callbacks
      );
    }
  }

  function setExitEditModeCallback(cb: () => void) {
    _exitEditModeCallback = cb;
  }

  function dispose() {
    sequenceModalExporter.dispose();
    if (recordingTimer) { clearInterval(recordingTimer); recordingTimer = null; }
  }

  return {
    exportOptions,
    get animationCanvas() { return animationCanvas; },
    get isExporting() { return sequenceModalExporter.state.isExporting; },
    get exportProgress() { return sequenceModalExporter.state.progress; },
    get exportError() { return sequenceModalExporter.state.error; },
    get previewBlobUrl() { return sequenceModalExporter.state.previewBlobUrl; },
    get countdownValue() { return countdownValue; },
    get isRecording3D() { return isRecording3D; },
    get recordingElapsed() { return recordingElapsed; },
    handleCanvasReady,
    handleCancelExport,
    handleRetryExport,
    handleExport,
    handleStopRecording,
    dismissPreview,
    setExitEditModeCallback,
    dispose,
  };
}

export type ExportCoordinatorState = ReturnType<typeof createExportCoordinator>;
