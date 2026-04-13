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

    // Pause Threlte's render loop — we're taking manual control
    deps.pauseAutoRender();

    const dt = 1 / fps;
    const keyframes = deps.cameraKeyframes.keyframes;

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

        // 2. Update formation transitions with deterministic timestamp
        deps.updateFormationTransition(animationTime * 1000);

        // 3. Interpolate camera from recorded keyframes
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

        // 4. Tick effects with deterministic delta
        deps.updateEffects(dt);

        // 5. Force render
        deps.renderer.render(deps.scene, deps.camera);

        // 6. Capture frame
        const timestampMicros = Math.round(animationTime * 1_000_000);
        const isKeyframe = frameIndex % KEYFRAME_INTERVAL === 0;
        const frame = this.capturer.capture(deps.webglCanvas, timestampMicros);
        diag.markCapture();

        this.backgroundEncoder.addFrameCaptured(frame, frameIndex, isKeyframe);
        diag.markAddFrame();

        // 7. Report progress
        onProgress({
          progress: frameIndex / totalFrames,
          stage: "capturing",
          currentFrame: frameIndex,
          totalFrames,
        });

        // 8. Yield to event loop so the browser can paint progress and
        // handle cancel button clicks. Cost: ~4ms per frame.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }

      diag.finish();

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
      deps.resumeAutoRender();
    }
  }

  cancel(): void {
    this.shouldCancel = true;
    this.backgroundEncoder.cancel();
  }
}
