// src/lib/shared/video-export/domain/CapturedFrame.ts
/**
 * Captured Frame
 *
 * A frame that has been pulled from a canvas and is ready to hand to the
 * video encoder worker. Two transport forms are supported:
 *
 *   - "video-frame": a WebCodecs VideoFrame constructed directly from the
 *     canvas. Zero-copy, GPU-resident, preferred path. The receiver owns
 *     the VideoFrame and MUST call .close() exactly once.
 *   - "image-data": a legacy ImageData readback. Main-thread pixel copy,
 *     slow, only used on browsers that lack WebCodecs (Firefox <133).
 *
 * Timestamp and dimensions are carried alongside the handle so the worker
 * has everything it needs without peeking inside.
 */

export type CapturedFrame =
  | {
      readonly kind: "video-frame";
      readonly frame: VideoFrame;
      readonly timestampMicros: number;
      readonly width: number;
      readonly height: number;
    }
  | {
      readonly kind: "image-data";
      readonly data: ImageData;
      readonly timestampMicros: number;
      readonly width: number;
      readonly height: number;
    };
