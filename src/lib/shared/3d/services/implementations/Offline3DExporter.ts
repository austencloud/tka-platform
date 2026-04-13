/**
 * Offline 3D Exporter
 *
 * Renders every frame deterministically by setting performer state and camera
 * position, then calling Threlte's advance() to run the full pipeline (puppet
 * loop, IK solve, effects, render) for one frame. Output quality is independent
 * of real-time scene performance — a scene that renders at 8.5fps live will
 * still produce a smooth 30fps export, it just takes longer.
 *
 * Lifecycle:
 *   1. Switch Threlte to 'manual' render mode
 *   2. For each frame: set state, advance(), capture, encode
 *   3. Restore 'always' render mode
 */

import type { IBackgroundVideoEncoder } from "$lib/features/compose/services/contracts/IBackgroundVideoEncoder";
import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
import type {
  IOffline3DExporter,
  Offline3DExportDependencies,
  Offline3DExportOptions,
} from "../contracts/IOffline3DExporter";
import {
  getExportDimensions,
  calculateBitrate,
} from "$lib/features/compose/shared/domain/video-export-calculations";
import type { ICanvasFrameCapturer } from "$lib/shared/video-export/services/contracts/ICanvasFrameCapturer";
import type { ICameraKeyframeInterpolator } from "$lib/shared/video-export/services/contracts/ICameraKeyframeInterpolator";
import { ExportDiagnostics } from "$lib/shared/video-export/domain/ExportDiagnostics";

const KEYFRAME_INTERVAL = 30;
const FALLBACK_ASPECT_RATIO = 16 / 9;

export class Offline3DExporter implements IOffline3DExporter {
  private shouldCancel = false;

  constructor(
    private readonly backgroundEncoder: IBackgroundVideoEncoder,
    private readonly capturer: ICanvasFrameCapturer,
    private readonly cameraInterpolator: ICameraKeyframeInterpolator
  ) {}

  async exportOffline(
    deps: Offline3DExportDependencies,
    onProgress: (progress: VideoExportProgress) => void,
    options: Offline3DExportOptions
  ): Promise<Blob> {
    this.shouldCancel = false;

    const { fps, resolution, loopCount } = options;

    const liveWidth = deps.webglCanvas.width;
    const liveHeight = deps.webglCanvas.height;
    const aspectRatio =
      liveWidth > 0 && liveHeight > 0
        ? liveWidth / liveHeight
        : FALLBACK_ASPECT_RATIO;

    const { width, height } = getExportDimensions(resolution, aspectRatio);
    const bitrate = calculateBitrate(width, height, fps);

    const totalDurationSec = deps.totalDurationSeconds * loopCount;
    const totalFrames = Math.ceil(totalDurationSec * fps);

    if (totalFrames <= 0) {
      throw new Error(
        `Cannot export: computed 0 frames (duration=${totalDurationSec}s, fps=${fps})`
      );
    }

    // Initialize the background encoder (spins up the Web Worker)
    await this.backgroundEncoder.initialize({
      width,
      height,
      fps,
      bitrate,
      totalFrames,
    });

    this.backgroundEncoder.onProgress = (frameIndex, total) => {
      onProgress({
        progress: frameIndex / total,
        stage: "encoding",
        currentFrame: frameIndex,
        totalFrames: total,
      });
    };

    const diag = new ExportDiagnostics(
      width,
      height,
      fps,
      totalFrames,
      this.capturer.preferredKind
    );

    const keyframes = deps.cameraKeyframes.keyframes;

    // Tell the puppet loop to stop overwriting performer state — we drive
    // performers deterministically. IK and effects still run during advance().
    deps.setExporting(true);

    // Switch Threlte to manual render mode. In this mode, only advance()
    // triggers a frame — RAF-driven rendering stops completely. The full
    // pipeline (useTask callbacks for IK, effects + render) runs exactly
    // once per advance() call.
    deps.setRenderMode("manual");

    try {
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        if (this.shouldCancel) {
          throw new Error("Export cancelled");
        }

        diag.startFrame();

        const animationTime = frameIndex / fps;
        const currentStep = animationTime * deps.beatsPerSecond;

        // 1. Set animation state for every performer
        const beatIndex = Math.floor(currentStep);
        const subBeatProgress = currentStep - beatIndex;

        for (const performer of deps.performers) {
          if (beatIndex >= performer.totalSteps) {
            performer.goToStep(performer.totalSteps - 1);
            performer.setProgress(1);
          } else {
            performer.goToStep(beatIndex);
            performer.setProgress(subBeatProgress);
          }
        }

        // 2. Interpolate camera from recorded keyframes
        const cam = this.cameraInterpolator.interpolate(keyframes, animationTime);
        deps.camera.position.set(cam.position[0], cam.position[1], cam.position[2]);
        deps.camera.quaternion.set(
          cam.quaternion[0],
          cam.quaternion[1],
          cam.quaternion[2],
          cam.quaternion[3]
        );
        deps.camera.fov = cam.fov;
        deps.camera.updateProjectionMatrix();

        diag.markDrawImage();

        // 3. Advance one full Threlte frame. This runs every useTask
        //    callback (Viewer3DScene puppet loop reads our performer
        //    state, Avatar3D runs IK, EffectOrchestrator ticks effects)
        //    then renders the scene. The result is a complete frame with
        //    correct poses, effects, and lighting — identical to what
        //    the live viewer produces.
        deps.advance();

        // 4. Capture the rendered frame
        const timestampMicros = Math.round(animationTime * 1_000_000);
        const isKeyframe = frameIndex % KEYFRAME_INTERVAL === 0;
        const frame = this.capturer.capture(deps.webglCanvas, timestampMicros);
        diag.markCapture();

        this.backgroundEncoder.addFrameCaptured(frame, frameIndex, isKeyframe);
        diag.markAddFrame();

        // 5. Report progress
        onProgress({
          progress: frameIndex / totalFrames,
          stage: "capturing",
          currentFrame: frameIndex,
          totalFrames,
        });

        // 6. Yield to event loop so the browser can paint progress
        //    updates and handle cancel button clicks.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }

      diag.finish();

      // Finalize encoding
      const blob = await this.backgroundEncoder.finish();
      onProgress({ progress: 1, stage: "complete", totalFrames });
      return blob;
    } catch (err) {
      diag.finish();
      if ((err as Error).message !== "Export cancelled") {
        onProgress({
          progress: 0,
          stage: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
      throw err;
    } finally {
      // Always restore live rendering
      deps.setExporting(false);
      deps.setRenderMode("always");
    }
  }

  cancel(): void {
    this.shouldCancel = true;
    this.backgroundEncoder.cancel();
  }
}
