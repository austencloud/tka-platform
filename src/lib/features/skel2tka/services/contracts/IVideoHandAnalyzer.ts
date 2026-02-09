/**
 * IVideoHandAnalyzer - Run hand detection on extracted video frames
 *
 * Bridge between VideoFrameExtractor output and the existing
 * IPositionDetector.processFrame() pipeline (MediaPipe HandLandmarker).
 */

import type { ExtractedFrame, HandTimeline, ProgressCallback } from "../../domain/models";

export interface IVideoHandAnalyzer {
  /**
   * Analyze extracted frames to detect hand positions.
   *
   * Iterates through each frame and calls the position detector's
   * processFrame() method to get blue/red hand grid locations.
   *
   * @param frames - Extracted video frames with ImageData
   * @param fps - The frame rate used during extraction
   * @param duration - Total video duration in seconds
   * @param onProgress - Progress callback (current frame, total frames)
   * @returns HandTimeline with detection results per frame
   */
  analyze(
    frames: ExtractedFrame[],
    fps: number,
    duration: number,
    onProgress?: ProgressCallback
  ): Promise<HandTimeline>;
}
