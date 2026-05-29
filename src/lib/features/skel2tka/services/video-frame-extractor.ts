/**
 * VideoFrameExtractor - Extract ImageData frames from a video file
 *
 * Creates a hidden video element, loads the file as an object URL,
 * seeks frame-by-frame at the configured FPS, and draws each frame
 * to an offscreen canvas to capture ImageData.
 *
 * Pattern borrowed from PropTrackingLab's video upload approach.
 */

import type { ExtractedFrame, ProgressCallback } from "../domain/models";
import type { FrameExtractionOptions } from "./types";

const DEFAULT_FPS = 15;

export async function extractFrames(
  file: File,
  options?: FrameExtractionOptions,
  onProgress?: ProgressCallback
): Promise<ExtractedFrame[]> {
  const fps = options?.fps ?? DEFAULT_FPS;
  const maxFrames = options?.maxFrames;
  const objectUrl = URL.createObjectURL(file);

  try {
    const { video, duration } = await loadVideo(objectUrl);
    const frameInterval = 1 / fps;
    const totalFrames = maxFrames
      ? Math.min(maxFrames, Math.floor(duration * fps))
      : Math.floor(duration * fps);

    const canvas = new OffscreenCanvas(video.videoWidth, video.videoHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to create OffscreenCanvas 2d context");
    }

    const frames: ExtractedFrame[] = [];

    for (let i = 0; i < totalFrames; i++) {
      const timestamp = i * frameInterval;
      // Don't seek past video duration
      if (timestamp >= duration) break;

      await seekTo(video, timestamp);

      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      frames.push({ index: i, timestamp, imageData });

      onProgress?.(i + 1, totalFrames, "Extracting frames");
    }

    return frames;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Load a video element from an object URL and wait for metadata */
function loadVideo(
  url: string
): Promise<{ video: HTMLVideoElement; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    // Needed to draw to canvas without CORS issues for local files
    video.crossOrigin = "anonymous";
    video.preload = "auto";

    video.onloadedmetadata = () => {
      if (!isFinite(video.duration) || video.duration <= 0) {
        reject(new Error("Video has invalid duration"));
        return;
      }
      resolve({ video, duration: video.duration });
    };

    video.onerror = () => {
      reject(
        new Error(`Failed to load video: ${video.error?.message ?? "unknown error"}`)
      );
    };

    video.src = url;
  });
}

/** Seek the video to a specific timestamp and wait for the frame to be ready */
function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    // If already at the right time (within 1ms), skip
    if (Math.abs(video.currentTime - time) < 0.001) {
      resolve();
      return;
    }

    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };

    video.addEventListener("seeked", onSeeked);
    video.currentTime = time;
  });
}
