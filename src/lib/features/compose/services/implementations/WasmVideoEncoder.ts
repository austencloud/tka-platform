/**
 * WASM Video Encoder (Firefox Fallback)
 *
 * Uses h264-mp4-encoder for browsers that don't support WebCodecs.
 * This provides the same frame-by-frame encoding with explicit timing.
 */

// h264-mp4-encoder types
type H264MP4Encoder = {
  width: number;
  height: number;
  frameRate: number;
  kbps: number;
  groupOfPictures: number;
  initialize: () => void;
  addFrameRgba: (data: Uint8ClampedArray) => void;
  finalize: () => void;
  FS: { readFile: (filename: string) => Uint8Array };
  outputFilename: string;
  delete: () => void;
};

export interface WasmEncoderOptions {
  width: number;
  height: number;
  fps: number;
  bitrate?: number;
}

export class WasmVideoEncoder {
  private encoder: H264MP4Encoder | null = null;
  private width: number;
  private height: number;
  private fps: number;
  private isFinished = false;
  private resizeCanvas: HTMLCanvasElement | null = null;
  private resizeCtx: CanvasRenderingContext2D | null = null;
  private encoderWidth: number;
  private encoderHeight: number;

  constructor(private options: WasmEncoderOptions) {
    // Round to integers - canvas dimensions can be decimals from CSS calculations
    this.width = Math.round(options.width);
    this.height = Math.round(options.height);
    this.fps = options.fps;
    // h264-mp4-encoder expects dimensions divisible by 2
    this.encoderWidth = this.width % 2 === 0 ? this.width : this.width + 1;
    this.encoderHeight = this.height % 2 === 0 ? this.height : this.height + 1;
  }

  async initialize(): Promise<void> {
    // Dynamically import to avoid ESM/CommonJS interop issues at module load time
    const h264Mp4Encoder = await import("h264-mp4-encoder");
    const createEncoder =
      h264Mp4Encoder.createH264MP4Encoder ??
      (h264Mp4Encoder.default as { createH264MP4Encoder: () => Promise<H264MP4Encoder> })?.createH264MP4Encoder;

    if (!createEncoder) {
      throw new Error("Failed to load h264-mp4-encoder: createH264MP4Encoder not found");
    }

    // Load the WASM encoder
    this.encoder = await createEncoder();

    // Configure encoder
    this.encoder.width = this.encoderWidth;
    this.encoder.height = this.encoderHeight;
    this.encoder.frameRate = this.fps;
    this.encoder.kbps = Math.round((this.options.bitrate ?? 5_000_000) / 1000);
    this.encoder.groupOfPictures = 30; // Keyframe every 30 frames

    this.encoder.initialize();

    // Create a canvas for resizing if dimensions need adjustment
    if (
      this.encoderWidth !== this.width ||
      this.encoderHeight !== this.height
    ) {
      this.resizeCanvas = document.createElement("canvas");
      this.resizeCanvas.width = this.encoderWidth;
      this.resizeCanvas.height = this.encoderHeight;
      this.resizeCtx = this.resizeCanvas.getContext("2d");
    }

    this.isFinished = false;
  }

  async addFrame(sourceCanvas: HTMLCanvasElement): Promise<void> {
    if (!this.encoder || this.isFinished) {
      throw new Error("Encoder not initialized or already finished");
    }

    // Get the canvas to encode from (resize if needed)
    let canvasToEncode = sourceCanvas;
    if (this.resizeCanvas && this.resizeCtx) {
      this.resizeCtx.drawImage(
        sourceCanvas,
        0,
        0,
        this.resizeCanvas.width,
        this.resizeCanvas.height
      );
      canvasToEncode = this.resizeCanvas;
    }

    // Get pixel data
    const ctx = canvasToEncode.getContext("2d");
    if (!ctx) {
      throw new Error("Could not get canvas context");
    }

    const imageData = ctx.getImageData(
      0,
      0,
      canvasToEncode.width,
      canvasToEncode.height
    );

    // h264-mp4-encoder expects RGBA data
    this.encoder.addFrameRgba(imageData.data);
  }

  async finish(): Promise<Blob> {
    if (!this.encoder || this.isFinished) {
      throw new Error("Encoder not initialized or already finished");
    }

    this.isFinished = true;

    // Finalize encoding
    this.encoder.finalize();

    // Get the output buffer from the virtual file system
    const buffer = this.encoder.FS.readFile(this.encoder.outputFilename);

    // Clean up
    this.encoder.delete();
    this.encoder = null;
    this.resizeCanvas = null;
    this.resizeCtx = null;

    // Create a copy to ensure it's a proper ArrayBuffer
    const arrayBuffer = new Uint8Array(buffer).buffer;
    return new Blob([arrayBuffer], { type: "video/mp4" });
  }

  cancel(): void {
    if (this.encoder && !this.isFinished) {
      try {
        this.encoder.delete();
      } catch {
        // Ignore errors on cancel
      }
    }
    this.encoder = null;
    this.resizeCanvas = null;
    this.resizeCtx = null;
    this.isFinished = true;
  }
}
