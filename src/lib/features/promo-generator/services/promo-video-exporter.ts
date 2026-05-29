/**
 * Promo Video Exporter Implementation
 *
 * Handles rendering the 3D scene animation to video format.
 * Uses WebCodecs VideoEncoder and mediabunny for high-quality MP4 output.
 */

import { Output, Mp4OutputFormat, BufferTarget, EncodedVideoPacketSource, EncodedPacket } from "mediabunny";
import type * as THREE from "three";
import type {
  ExportProgressCallback,
  ExportResult,
} from "./types";
import type {
  ExportConfig,
  ExportResolution,
  ExportFormat,
} from "../domain/promo-models";
import { RESOLUTION_DIMENSIONS } from "../domain/promo-models";

export class PromoVideoExporter {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private _isExporting: boolean = false;
  private abortController: AbortController | null = null;
  private lastExportBlob: Blob | null = null;
  private lastExportUrl: string | null = null;

  initialize(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera
  ): void {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
  }

  async export(
    config: ExportConfig,
    animationDuration: number,
    renderFrame: (normalizedTime: number) => void,
    onProgress?: ExportProgressCallback
  ): Promise<ExportResult> {
    if (!this.renderer || !this.scene || !this.camera) {
      return {
        success: false,
        error: "Exporter not initialized. Call initialize() first.",
      };
    }

    if (this._isExporting) {
      return {
        success: false,
        error: "Export already in progress",
      };
    }

    // Check WebCodecs support
    if (typeof VideoEncoder === "undefined") {
      return {
        success: false,
        error:
          "WebCodecs API not supported. Please use a modern browser (Chrome 94+, Edge 94+).",
      };
    }

    this._isExporting = true;
    this.abortController = new AbortController();
    const startTime = performance.now();

    const { width, height } = RESOLUTION_DIMENSIONS[config.resolution];
    const totalFrames = Math.ceil(animationDuration * config.fps);
    const frameTime = 1 / config.fps;

    // Store original renderer size
    const originalSize = this.renderer.getSize(new (await import("three")).Vector2());
    const originalPixelRatio = this.renderer.getPixelRatio();

    try {
      onProgress?.(0, "preparing");

      // Resize renderer for export
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(1);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();

      // Create offscreen canvas for encoding
      const offscreenCanvas = new OffscreenCanvas(width, height);
      const offscreenCtx = offscreenCanvas.getContext("2d");
      if (!offscreenCtx) {
        throw new Error("Failed to create offscreen canvas context");
      }

      // Calculate bitrate (auto if not specified)
      const bitrate =
        config.bitrate ||
        this.calculateBitrate(config.resolution, config.fps);

      // Set up mediabunny MP4 output
      const videoSource = new EncodedVideoPacketSource("avc");
      const output = new Output({
        format: new Mp4OutputFormat({ fastStart: "in-memory" }),
        target: new BufferTarget(),
      });
      output.addVideoTrack(videoSource, { frameRate: config.fps });
      await output.start();

      // Set up video encoder
      let encodedFrameCount = 0; // eslint-disable-line @typescript-eslint/no-unused-vars

      const encoder = new VideoEncoder({
        output: async (chunk, meta) => {
          const packet = EncodedPacket.fromEncodedChunk(chunk);
          await videoSource.add(packet, meta);
          encodedFrameCount++;
        },
        error: (error) => {
          console.error("[PromoVideoExporter] Encoder error:", error);
        },
      });

      encoder.configure({
        codec: "avc1.640028", // H.264 High Profile Level 4.0
        width,
        height,
        bitrate,
        framerate: config.fps,
      });

      onProgress?.(5, "rendering");

      // Render and encode frames
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        // Check for cancellation
        if (this.abortController.signal.aborted) {
          encoder.close();
          throw new Error("Export cancelled");
        }

        // Calculate normalized time (0-1)
        const normalizedTime = frameIndex / (totalFrames - 1);

        // Render frame via callback
        renderFrame(normalizedTime);

        // Render to canvas
        this.renderer.render(this.scene!, this.camera!);

        // Copy to offscreen canvas
        const rendererCanvas = this.renderer.domElement;
        offscreenCtx.drawImage(rendererCanvas, 0, 0, width, height);

        // Create video frame
        const videoFrame = new VideoFrame(offscreenCanvas, {
          timestamp: frameIndex * frameTime * 1_000_000, // microseconds
          duration: frameTime * 1_000_000,
        });

        // Encode frame (keyframe every 30 frames)
        encoder.encode(videoFrame, {
          keyFrame: frameIndex % 30 === 0,
        });

        videoFrame.close();

        // Report progress
        const renderProgress = 5 + (frameIndex / totalFrames) * 80;
        onProgress?.(renderProgress, "rendering");

        // Yield to event loop periodically
        if (frameIndex % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      onProgress?.(85, "encoding");

      // Flush encoder
      await encoder.flush();
      encoder.close();

      onProgress?.(95, "finalizing");

      // Finalize output
      videoSource.close();
      await output.finalize();
      const videoBuffer = (output.target as BufferTarget).buffer!;

      // Create blob
      const blob = new Blob([videoBuffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);

      // Clean up previous export
      if (this.lastExportUrl) {
        URL.revokeObjectURL(this.lastExportUrl);
      }

      this.lastExportBlob = blob;
      this.lastExportUrl = url;

      const duration = performance.now() - startTime;

      onProgress?.(100, "complete");

      return {
        success: true,
        blob,
        url,
        duration,
        fileSize: blob.size,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown export error";
      console.error("[PromoVideoExporter] Export failed:", error);
      return {
        success: false,
        error: message,
      };
    } finally {
      // Restore original renderer size
      this.renderer.setSize(originalSize.x, originalSize.y);
      this.renderer.setPixelRatio(originalPixelRatio);
      this.camera.aspect = originalSize.x / originalSize.y;
      this.camera.updateProjectionMatrix();

      this._isExporting = false;
      this.abortController = null;
    }
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  isExporting(): boolean {
    return this._isExporting;
  }

  estimateFileSize(config: ExportConfig, duration: number): number {
    const bitrate = config.bitrate || this.calculateBitrate(config.resolution, config.fps);
    // Estimate: bitrate * duration with some overhead
    return Math.ceil((bitrate * duration) / 8 * 1.1);
  }

  getSupportedFormats(): ExportFormat[] {
    return ["mp4"]; // WebCodecs primarily supports H.264/MP4
  }

  getSupportedResolutions(): ExportResolution[] {
    return ["720p", "1080p", "4k"];
  }

  downloadLastExport(filename?: string): void {
    if (!this.lastExportBlob || !this.lastExportUrl) {
      console.warn("[PromoVideoExporter] No export to download");
      return;
    }

    const downloadFilename = filename || "promo-video.mp4";
    const link = document.createElement("a");
    link.href = this.lastExportUrl;
    link.download = downloadFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  dispose(): void {
    if (this.lastExportUrl) {
      URL.revokeObjectURL(this.lastExportUrl);
    }

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.lastExportBlob = null;
    this.lastExportUrl = null;
  }

  private calculateBitrate(
    resolution: ExportResolution,
    fps: number
  ): number {
    // Base bitrates for different resolutions (in bps)
    const baseBitrates: Record<ExportResolution, number> = {
      "720p": 5_000_000, // 5 Mbps
      "1080p": 10_000_000, // 10 Mbps
      "4k": 35_000_000, // 35 Mbps
    };

    // Adjust for framerate
    const fpsMultiplier = fps === 60 ? 1.5 : 1;

    return Math.round(baseBitrates[resolution] * fpsMultiplier);
  }
}
