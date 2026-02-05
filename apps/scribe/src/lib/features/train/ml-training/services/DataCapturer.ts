/**
 * Data Capture Service
 *
 * Captures frames from the webcam at a configurable FPS
 * and stores them in IndexedDB for later labeling.
 */

import {
  getMLTrainingStorage,
  type MLTrainingStorageManager,
} from "./MLTrainingStorageManager";
import type { CaptureSession, CapturedFrame, PropType } from "../domain/models";

export interface CaptureConfig {
  /** Frames per second to capture (default: 10) */
  fps: number;
  /** Resolution width (default: 640) */
  width: number;
  /** Resolution height (default: 480) */
  height: number;
  /** Type of prop being captured */
  propType: PropType;
  /** Session name/notes */
  name: string;
}

const DEFAULT_CONFIG: CaptureConfig = {
  fps: 10,
  width: 640,
  height: 480,
  propType: "club",
  name: "Capture Session",
};

export interface CaptureState {
  isRecording: boolean;
  isPaused: boolean;
  currentSession: CaptureSession | null;
  frameCount: number;
  elapsedMs: number;
  lastError: string | null;
  queueDepth?: number;
  isBackpressured?: boolean;
}

/**
 * Generates a unique ID for sessions and frames.
 */
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Data Capture Service
 *
 * Manages webcam capture, frame extraction, and storage.
 */
export class DataCapturer {
  private storage: MLTrainingStorageManager;
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private canvas: OffscreenCanvas | null = null;
  private canvasCtx:
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null = null;

  private config: CaptureConfig = { ...DEFAULT_CONFIG };
  private state: CaptureState = {
    isRecording: false,
    isPaused: false,
    currentSession: null,
    frameCount: 0,
    elapsedMs: 0,
    lastError: null,
    queueDepth: 0,
    isBackpressured: false,
  };

  private captureIntervalId: number | null = null;
  private startTime: number = 0;
  private pendingFrames: Array<{ frame: CapturedFrame; imageBlob: Blob }> = [];
  private flushIntervalId: number | null = null;
  private readonly MAX_PENDING_FRAMES = 120;
  private backpressureMessage: string | null = null;

  // State change callbacks
  private stateListeners: Set<(state: CaptureState) => void> = new Set();

  constructor() {
    this.storage = getMLTrainingStorage();
  }

  /**
   * Subscribe to state changes.
   */
  onStateChange(callback: (state: CaptureState) => void): () => void {
    this.stateListeners.add(callback);
    // Immediately call with current state
    callback({ ...this.state });
    return () => this.stateListeners.delete(callback);
  }

  private notifyStateChange(): void {
    const stateCopy = { ...this.state };
    for (const listener of this.stateListeners) {
      listener(stateCopy);
    }
  }

  /**
   * Get current capture state.
   */
  getState(): CaptureState {
    return { ...this.state };
  }

  /**
   * Initialize camera and prepare for capture.
   */
  async initialize(config?: Partial<CaptureConfig>): Promise<HTMLVideoElement> {
    this.config = { ...DEFAULT_CONFIG, ...config };

    try {
      await this.storage.initialize();

      // Create video element
      this.videoElement = document.createElement("video");
      this.videoElement.setAttribute("playsinline", "true");
      this.videoElement.setAttribute("autoplay", "true");
      this.videoElement.muted = true;

      // Request camera access
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: "user",
          width: { ideal: this.config.width },
          height: { ideal: this.config.height },
          frameRate: { ideal: 30 }, // Capture at higher rate, sample at config.fps
        },
        audio: false,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();

      // Get actual video dimensions
      const actualWidth = this.videoElement.videoWidth || this.config.width;
      const actualHeight = this.videoElement.videoHeight || this.config.height;

      // Create canvas for frame capture with Offscreen fallback for Safari/iOS
      const supportsOffscreen = typeof OffscreenCanvas !== "undefined";
      if (supportsOffscreen) {
        this.canvas = new OffscreenCanvas(actualWidth, actualHeight);
      } else {
        const htmlCanvas = document.createElement("canvas");
        htmlCanvas.width = actualWidth;
        htmlCanvas.height = actualHeight;
        this.canvas = htmlCanvas as unknown as OffscreenCanvas;
      }

      this.canvas.width = actualWidth;
      this.canvas.height = actualHeight;
      this.canvasCtx = this.canvas.getContext("2d");

      this.state.lastError = null;
      this.notifyStateChange();

      return this.videoElement;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.state.lastError = `Camera initialization failed: ${message}`;
      this.notifyStateChange();
      throw error;
    }
  }

  /**
   * Start recording a new capture session.
   */
  async startRecording(): Promise<CaptureSession> {
    if (!this.videoElement || !this.canvas || !this.canvasCtx) {
      const message = "Not initialized. Call initialize() first.";
      this.state.lastError = message;
      this.notifyStateChange();
      throw new Error(message);
    }

    if (this.state.isRecording) {
      const message = "Already recording. Stop current session first.";
      this.state.lastError = message;
      this.notifyStateChange();
      throw new Error(message);
    }

    // Create new session
    const session: CaptureSession = {
      id: generateId("session"),
      name: this.config.name,
      createdAt: new Date(),
      updatedAt: new Date(),
      frameCount: 0,
      fps: this.config.fps,
      resolution: {
        width: this.canvas.width,
        height: this.canvas.height,
      },
      propType: this.config.propType,
      labeledCount: 0,
      verifiedCount: 0,
    };

    await this.storage.createSession(session);

    this.state.currentSession = session;
    this.state.isRecording = true;
    this.state.isPaused = false;
    this.state.frameCount = 0;
    this.state.elapsedMs = 0;
    this.state.lastError = null;
    this.state.isBackpressured = false;
    this.state.queueDepth = 0;
    this.startTime = performance.now();

    // Start capture interval
    const intervalMs = 1000 / this.config.fps;
    this.captureIntervalId = window.setInterval(() => {
      this.captureFrame();
    }, intervalMs);

    // Start flush interval (save pending frames every 2 seconds)
    this.flushIntervalId = window.setInterval(() => {
      this.flushPendingFrames();
    }, 2000);

    this.notifyStateChange();

    return session;
  }

  /**
   * Pause recording (keeps session active).
   */
  pause(): void {
    if (!this.state.isRecording || this.state.isPaused) return;

    this.state.isPaused = true;
    this.notifyStateChange();
  }

  /**
   * Resume recording after pause.
   */
  resume(): void {
    if (!this.state.isRecording || !this.state.isPaused) return;

    this.state.isPaused = false;
    this.notifyStateChange();
  }

  /**
   * Stop recording and finalize session.
   */
  async stopRecording(): Promise<CaptureSession | null> {
    if (!this.state.isRecording) return null;

    // Stop intervals
    if (this.captureIntervalId) {
      clearInterval(this.captureIntervalId);
      this.captureIntervalId = null;
    }
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }

    // Flush any remaining frames
    await this.flushPendingFrames();

    // Update session with final stats
    if (this.state.currentSession) {
      this.state.currentSession.frameCount = this.state.frameCount;
      this.state.currentSession.updatedAt = new Date();
      await this.storage.updateSession(this.state.currentSession);
    }

    const session = this.state.currentSession;

    this.state.isRecording = false;
    this.state.isPaused = false;
    this.notifyStateChange();

    return session;
  }

  /**
   * Capture a single frame from the video.
   */
  private async captureFrame(): Promise<void> {
    if (this.state.isPaused) return;
    if (
      !this.videoElement ||
      !this.canvas ||
      !this.canvasCtx ||
      !this.state.currentSession
    )
      return;

    // Backpressure: if queue is too large, skip frame and warn
    this.state.queueDepth = this.pendingFrames.length;
    if (this.pendingFrames.length >= this.MAX_PENDING_FRAMES) {
      this.state.isBackpressured = true;
      const message =
        "Storage is catching up; temporarily pausing frame capture.";
      this.backpressureMessage = message;
      this.state.lastError = message;
      this.notifyStateChange();
      return;
    }

    try {
      // Draw current video frame to canvas
      this.canvasCtx.drawImage(
        this.videoElement,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );

      const blob = await this.convertCanvasToBlob(this.canvas);
      if (!blob || !this.state.currentSession) return;

      const frameNumber = this.state.frameCount;
      const timestamp = performance.now() - this.startTime;

      const frame: CapturedFrame = {
        id: generateId("frame"),
        sessionId: this.state.currentSession.id,
        frameNumber,
        timestamp,
        imageKey: generateId("img"),
        status: "unlabeled",
      };

      // Queue for batch write
      this.pendingFrames.push({ frame, imageBlob: blob });

      this.state.frameCount++;
      this.state.elapsedMs = timestamp;
      this.state.queueDepth = this.pendingFrames.length;
      this.notifyStateChange();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Frame capture error";
      this.state.lastError = message;
      this.notifyStateChange();
      console.error("Frame capture error:", error);
    }
  }

  private async convertCanvasToBlob(
    canvas: OffscreenCanvas
  ): Promise<Blob | null> {
    if (typeof canvas.convertToBlob === "function") {
      return canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
    }

    // HTMLCanvasElement fallback
    const htmlCanvas: HTMLCanvasElement =
      canvas as unknown as HTMLCanvasElement;
    return new Promise<Blob | null>((resolve) => {
      htmlCanvas.toBlob((blob) => resolve(blob ?? null), "image/jpeg", 0.9);
    });
  }

  /**
   * Flush pending frames to storage.
   */
  private async flushPendingFrames(): Promise<void> {
    if (this.pendingFrames.length === 0) return;

    const framesToWrite = [...this.pendingFrames];
    this.pendingFrames = [];
    this.state.queueDepth = 0;

    try {
      await this.storage.addFramesBatch(framesToWrite);
      if (
        this.state.isBackpressured &&
        this.backpressureMessage &&
        this.state.lastError === this.backpressureMessage
      ) {
        this.state.lastError = null;
        this.state.isBackpressured = false;
        this.backpressureMessage = null;
      }
    } catch (error) {
      console.error("Failed to flush frames:", error);
      // Put frames back in queue
      this.pendingFrames = [...framesToWrite, ...this.pendingFrames];
      this.state.lastError = "Failed to save frames; will retry.";
      this.state.queueDepth = this.pendingFrames.length;
    }
  }

  /**
   * Take a single snapshot (useful for manual capture).
   */
  async takeSnapshot(): Promise<CapturedFrame | null> {
    if (
      !this.videoElement ||
      !this.canvas ||
      !this.canvasCtx ||
      !this.state.currentSession
    ) {
      const message = "Cannot take snapshot: not recording";
      this.state.lastError = message;
      this.notifyStateChange();
      return null;
    }

    // Draw current video frame to canvas
    this.canvasCtx.drawImage(
      this.videoElement,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    // Convert to blob
    const blob = await this.convertCanvasToBlob(this.canvas);
    if (!blob) {
      const message = "Snapshot failed: unable to read frame";
      this.state.lastError = message;
      this.notifyStateChange();
      return null;
    }

    const frameNumber = this.state.frameCount;
    const timestamp = performance.now() - this.startTime;

    const frame: CapturedFrame = {
      id: generateId("frame"),
      sessionId: this.state.currentSession.id,
      frameNumber,
      timestamp,
      imageKey: generateId("img"),
      status: "unlabeled",
    };

    await this.storage.addFrame(frame, blob);

    this.state.frameCount++;
    this.state.elapsedMs = timestamp;
    this.notifyStateChange();

    return frame;
  }

  /**
   * Clean up resources.
   */
  async dispose(): Promise<void> {
    await this.stopRecording();

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    this.videoElement = null;
    this.canvas = null;
    this.canvasCtx = null;
    this.stateListeners.clear();
  }

  /**
   * Get the video element for preview.
   */
  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  /**
   * Update configuration (only allowed when not recording).
   */
  setConfig(config: Partial<CaptureConfig>): void {
    if (this.state.isRecording) {
      throw new Error("Cannot change config while recording");
    }
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration.
   */
  getConfig(): CaptureConfig {
    return { ...this.config };
  }
}

// Singleton instance
let captureServiceInstance: DataCapturer | null = null;

/**
 * Get the singleton capture service instance.
 */
export function getDataCapturer(): DataCapturer {
  if (!captureServiceInstance) {
    captureServiceInstance = new DataCapturer();
  }
  return captureServiceInstance;
}
