/**
 * Video Thumbnail Extractor
 *
 * Client-side utility to extract a thumbnail frame from a video file.
 * Uses canvas to capture a frame and export as JPEG blob.
 */

export interface ThumbnailOptions {
  /** Time in seconds to capture the frame (default: 1) */
  captureTime?: number;
  /** Max width of thumbnail (default: 320) */
  maxWidth?: number;
  /** Max height of thumbnail (default: 180) */
  maxHeight?: number;
  /** JPEG quality 0-1 (default: 0.85) */
  quality?: number;
}

export interface ThumbnailResult {
  blob: Blob;
  width: number;
  height: number;
  dataUrl: string;
}

/**
 * Extract a thumbnail frame from a video file
 */
export async function extractVideoThumbnail(
  videoFile: File | Blob,
  options: ThumbnailOptions = {}
): Promise<ThumbnailResult> {
  const {
    captureTime = 1,
    maxWidth = 320,
    maxHeight = 180,
    quality = 0.85,
  } = options;

  return new Promise((resolve, reject) => {
    // Create video element
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    // Create object URL for the video file
    const videoUrl = URL.createObjectURL(videoFile);

    const cleanup = () => {
      URL.revokeObjectURL(videoUrl);
      video.remove();
    };

    video.onloadedmetadata = () => {
      // Seek to capture time (or halfway if video is shorter)
      const seekTime = Math.min(captureTime, video.duration / 2);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      try {
        // Calculate scaled dimensions maintaining aspect ratio
        let width = video.videoWidth;
        let height = video.videoHeight;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        width = Math.round(width);
        height = Math.round(height);

        // Create canvas and draw frame
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(video, 0, 0, width, height);

        // Get data URL for preview
        const dataUrl = canvas.toDataURL("image/jpeg", quality);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (blob) {
              resolve({ blob, width, height, dataUrl });
            } else {
              reject(new Error("Failed to create thumbnail blob"));
            }
          },
          "image/jpeg",
          quality
        );
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to load video for thumbnail extraction"));
    };

    // Start loading video
    video.src = videoUrl;
    video.load();
  });
}

/**
 * Get video duration without loading the entire file
 */
export async function getVideoDuration(
  videoFile: File | Blob
): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;

    const videoUrl = URL.createObjectURL(videoFile);

    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(videoUrl);
      video.remove();
      resolve(duration);
    };

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      video.remove();
      reject(new Error("Failed to load video metadata"));
    };

    video.src = videoUrl;
    video.load();
  });
}
