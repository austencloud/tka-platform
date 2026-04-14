/**
 * Offline 3D Exporter
 *
 * Renders every frame deterministically by setting performer state and
 * camera position, then waiting for Threlte's normal frame pipeline
 * (useTask → IK → effects → render) to complete via requestAnimationFrame.
 *
 * Key insight: Threlte's advance() does NOT run useTask callbacks
 * synchronously — it schedules them. Calling advance() 200 times in a
 * loop only triggers ~8 task executions. Instead, we stay in "always"
 * render mode and use rAF to pace one export frame per browser frame.
 * This guarantees every frame gets the full pipeline: puppet loop
 * distributes state, IK solves arm poses, effects tick, scene renders.
 *
 * Output quality is independent of real-time scene performance — a scene
 * that renders at 8.5fps live will still produce smooth 30fps export,
 * it just takes proportionally longer to render.
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

    // Signal export mode. The puppet loop reads exportCurrentStep
    // instead of the live component prop.
    deps.setExporting(true);

    // Stay in "always" render mode — Threlte's normal rAF loop handles
    // task execution (puppet loop, IK, effects) and rendering. We pace
    // the export with requestAnimationFrame, setting state before each
    // browser frame and capturing after Threlte renders.
    // DO NOT switch to manual mode — advance() doesn't run tasks reliably.

    try {
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        if (this.shouldCancel) {
          throw new Error("Export cancelled");
        }

        diag.startFrame();

        const animationTime = frameIndex / fps;
        const currentStep = animationTime * deps.beatsPerSecond;

        // 1. Set the animation step for the puppet loop to distribute.
        //    The puppet loop runs in Threlte's useTask during the next
        //    rAF tick and calls goToStep/setProgress on performers.
        deps.setExportCurrentStep(currentStep);

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

        // 3. Wait for Threlte's next frame to complete. This ensures:
        //    - Puppet loop distributes exportCurrentStep to performers
        //    - Avatar3D's IK solves arm poses toward prop targets
        //    - EffectOrchestrator ticks fire/LED/trail effects
        //    - Three.js renders the complete scene to the canvas
        // We wait for TWO rAF ticks: the first lets Svelte flush the
        // $state changes into component props, the second lets Threlte
        // run its full pipeline with the updated props.
        await this.waitForRender();

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
      // Always restore live state
      deps.setExportCurrentStep(null);
      deps.setExporting(false);
    }
  }

  /**
   * Wait for two requestAnimationFrame callbacks to ensure:
   * 1. First rAF: Svelte flushes $state → $derived → component props
   * 2. Second rAF: Threlte runs useTask (puppet loop, IK, effects) + renders
   * The canvas contains the fully rendered frame after this resolves.
   */
  private waitForRender(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
  }

  cancel(): void {
    this.shouldCancel = true;
    this.backgroundEncoder.cancel();
  }
}
