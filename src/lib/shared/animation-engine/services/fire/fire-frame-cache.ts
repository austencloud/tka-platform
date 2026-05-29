/**
 * FireFrameCache - Record & Playback for Looping Fire Sequences
 *
 * During the first loop of a fire-enabled sequence, the full Navier-Stokes
 * simulation runs normally. This cache captures the display shader output
 * at simulation resolution (128-256px) into a ring of RGBA8 textures.
 *
 * Once one complete loop is recorded, subsequent loops blit from cache:
 * 1 draw call per frame instead of ~30 simulation passes.
 *
 * Cache invalidation: changing fuel source, intensity, transform, or quality
 * invalidates the cache and triggers a fresh recording on the next loop.
 */

import { VERTEX_SHADER } from "./fluid-shader-sources";

// ============================================================
// Blit shader: draw a cached texture to the screen
// ============================================================

const BLIT_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_frame;

void main() {
  fragColor = texture(u_frame, v_uv);
}
`;

type CacheState = "idle" | "recording" | "warm";

interface ShaderProgram {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation>;
}

export class FireFrameCache {
  private gl: WebGL2RenderingContext;
  private state: CacheState = "idle";

  // Cache textures (RGBA8, one per frame) - pre-allocated in batches
  private frames: WebGLTexture[] = [];
  /** Relative timestamps (ms since loop start) for each cached frame */
  private frameTimes: number[] = [];
  /** Total loop duration from recording (ms) */
  private loopDuration: number = 0;
  private frameIndex = 0;
  private totalFrames = 0;

  // Pre-allocated texture pool to avoid per-frame GPU resource creation
  private texturePool: WebGLTexture[] = [];
  private texturePoolSize = 0;
  private static readonly TEXTURE_BATCH_SIZE = 120;

  // Recording FBO: display shader renders here during recording
  private recordingFBO: WebGLFramebuffer | null = null;
  private recordingTexture: WebGLTexture | null = null;
  private cacheWidth = 0;
  private cacheHeight = 0;

  // Persistent copy FBO reused every frame during recording (avoids create/delete per frame)
  private copyFBO: WebGLFramebuffer | null = null;

  // Blit program for playback
  private blitProgram: ShaderProgram | null = null;

  // Config hash for invalidation
  private configHash = "";

  // Display dimensions for viewport during blit
  private displayWidth = 0;
  private displayHeight = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.blitProgram = this.compileBlitProgram();
  }

  /**
   * Start recording frames for a new loop.
   * @param width - Cache texture width (typically simulation resolution)
   * @param height - Cache texture height
   * @param displayWidth - Actual canvas width (for blit viewport)
   * @param displayHeight - Actual canvas height (for blit viewport)
   * @param configHash - Hash of fire config for invalidation
   */
  startRecording(
    width: number,
    height: number,
    displayWidth: number,
    displayHeight: number,
    configHash: string
  ): void {
    // Clean up any previous recording
    this.releaseFrames();

    this.cacheWidth = width;
    this.cacheHeight = height;
    this.displayWidth = displayWidth;
    this.displayHeight = displayHeight;
    this.configHash = configHash;
    this.frameIndex = 0;
    this.totalFrames = 0;
    this.state = "recording";

    // Create the recording FBO at cache resolution
    this.createRecordingFBO();

    // Pre-allocate texture pool and persistent copy FBO to avoid per-frame GPU resource creation
    this.ensureTexturePool(FireFrameCache.TEXTURE_BATCH_SIZE);
    this.ensureCopyFBO();
  }

  /**
   * Whether the cache has a complete loop recorded and ready for playback.
   */
  isWarm(): boolean {
    return this.state === "warm";
  }

  /**
   * Whether the cache is currently recording frames.
   */
  isRecording(): boolean {
    return this.state === "recording";
  }

  /**
   * Get the FBO to render the display pass into during recording.
   * The display pass should bind this FBO instead of the default framebuffer.
   */
  getRecordingFBO(): WebGLFramebuffer | null {
    return this.recordingFBO;
  }

  /** Cache resolution width (for viewport during recording) */
  getCacheWidth(): number {
    return this.cacheWidth;
  }

  /** Cache resolution height */
  getCacheHeight(): number {
    return this.cacheHeight;
  }

  /**
   * Called after the display pass renders to the recording FBO.
   * Copies the recording FBO content into a new cache texture,
   * then blits the recording to the screen.
   */
  commitFrame(relativeTime: number): void {
    if (this.state !== "recording") return;
    const gl = this.gl;

    // Grow texture pool if needed (amortized O(1) - only allocates every BATCH_SIZE frames)
    if (this.frameIndex >= this.texturePoolSize) {
      this.ensureTexturePool(this.texturePoolSize + FireFrameCache.TEXTURE_BATCH_SIZE);
    }

    // Grab pre-allocated texture from pool (zero GPU allocation this frame)
    const cacheTex = this.texturePool[this.frameIndex]!;

    // Blit recording FBO → cache texture using persistent copy FBO
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.recordingFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.copyFBO);
    gl.framebufferTexture2D(
      gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D, cacheTex, 0
    );
    gl.blitFramebuffer(
      0, 0, this.cacheWidth, this.cacheHeight,
      0, 0, this.cacheWidth, this.cacheHeight,
      gl.COLOR_BUFFER_BIT, gl.NEAREST
    );
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

    this.frames.push(cacheTex);
    this.frameTimes.push(relativeTime);
    this.frameIndex++;
    this.totalFrames = this.frameIndex;

    // Blit the recording FBO to screen
    this.blitToScreen(this.recordingTexture!);
  }

  /**
   * Called when the animation loop detects a sequence restart.
   * Finishes recording and switches to warm (playback) mode.
   */
  onLoopDetected(): void {
    if (this.state === "recording" && this.totalFrames > 0) {
      this.loopDuration = this.frameTimes[this.frameTimes.length - 1] ?? 0;
      this.state = "warm";
      this.frameIndex = 0;
      // Destroy recording resources - no longer needed during playback
      this.destroyRecordingFBO();
      this.destroyCopyFBO();
      // Trim excess pool textures beyond what was actually recorded
      this.trimTexturePool(this.totalFrames);
    } else if (this.state === "warm") {
      // Reset playback to start of cached loop
      this.frameIndex = 0;
    }
  }

  /**
   * Blit the cached frame nearest to the given relative time.
   * Uses binary search for O(log N) lookup.
   * @param relativeTime - Time since loop start (ms). Wraps via modulo.
   * @returns true if a frame was blitted
   */
  blitCachedFrame(relativeTime?: number): boolean {
    if (this.state !== "warm" || this.totalFrames === 0) return false;

    let idx: number;

    if (relativeTime !== undefined && this.loopDuration > 0) {
      // Timestamp-based lookup: find nearest frame
      const t = relativeTime % this.loopDuration;
      idx = this.findNearestFrame(t);
    } else {
      // Legacy fallback: sequential frame counter
      idx = this.frameIndex % this.totalFrames;
      this.frameIndex++;
    }

    const tex = this.frames[idx];
    if (!tex) return false;

    this.blitToScreen(tex);
    return true;
  }

  /**
   * Binary search for the cached frame nearest to the target time.
   */
  private findNearestFrame(targetTime: number): number {
    const times = this.frameTimes;
    const n = times.length;
    if (n <= 1) return 0;

    let lo = 0;
    let hi = n - 1;

    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid]! < targetTime) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    // lo is the first frame >= targetTime. Check if lo-1 is closer.
    if (lo > 0) {
      const diffLo = times[lo]! - targetTime;
      const diffPrev = targetTime - times[lo - 1]!;
      if (diffPrev <= diffLo) return lo - 1;
    }
    return lo;
  }

  /**
   * Check if the fire config has changed. If so, invalidate the cache.
   * @returns true if cache was invalidated
   */
  checkConfigHash(newHash: string): boolean {
    if (newHash !== this.configHash) {
      this.invalidate();
      return true;
    }
    return false;
  }

  /**
   * Invalidate the cache, forcing a fresh recording on the next loop.
   */
  invalidate(): void {
    this.releaseFrames();
    this.destroyRecordingFBO();
    this.destroyCopyFBO();
    this.releaseTexturePool();
    this.state = "idle";
    this.frameIndex = 0;
    this.totalFrames = 0;
    this.configHash = "";
    this.loopDuration = 0;
  }

  /**
   * Clean up all GL resources.
   */
  dispose(): void {
    this.releaseFrames();
    this.destroyRecordingFBO();
    this.destroyCopyFBO();
    this.releaseTexturePool();
    if (this.blitProgram) {
      this.gl.deleteProgram(this.blitProgram.program);
      this.blitProgram = null;
    }
    this.state = "idle";
  }

  // ============================================================
  // Internal
  // ============================================================

  private blitToScreen(texture: WebGLTexture): void {
    const gl = this.gl;
    if (!this.blitProgram) return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.displayWidth, this.displayHeight);
    gl.enable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.blitProgram.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.blitProgram.uniforms.get("u_frame")!, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private createRecordingFBO(): void {
    const gl = this.gl;

    this.recordingTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.recordingTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      this.cacheWidth, this.cacheHeight, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, null
    );

    this.recordingFBO = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.recordingFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D, this.recordingTexture, 0
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private destroyRecordingFBO(): void {
    const gl = this.gl;
    if (this.recordingFBO) {
      gl.deleteFramebuffer(this.recordingFBO);
      this.recordingFBO = null;
    }
    if (this.recordingTexture) {
      gl.deleteTexture(this.recordingTexture);
      this.recordingTexture = null;
    }
  }

  private releaseFrames(): void {
    // Frames reference textures from the pool - don't delete them here.
    // The pool owns their lifecycle. Just clear the reference array.
    this.frames.length = 0;
    this.frameTimes.length = 0;
  }

  /**
   * Pre-allocate textures up to the target size. Only allocates the delta.
   * Called once at recording start and again if recording exceeds initial estimate.
   */
  private ensureTexturePool(targetSize: number): void {
    const gl = this.gl;
    for (let i = this.texturePoolSize; i < targetSize; i++) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA,
        this.cacheWidth, this.cacheHeight, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null
      );
      this.texturePool.push(tex);
    }
    this.texturePoolSize = targetSize;
  }

  /** Delete unused pool textures beyond the recorded frame count */
  private trimTexturePool(keepCount: number): void {
    const gl = this.gl;
    for (let i = keepCount; i < this.texturePoolSize; i++) {
      gl.deleteTexture(this.texturePool[i]!);
    }
    this.texturePool.length = keepCount;
    this.texturePoolSize = keepCount;
  }

  /** Release all pool textures (GPU memory cleanup) */
  private releaseTexturePool(): void {
    const gl = this.gl;
    for (const tex of this.texturePool) {
      gl.deleteTexture(tex);
    }
    this.texturePool.length = 0;
    this.texturePoolSize = 0;
  }

  /** Create the persistent copy FBO reused during recording */
  private ensureCopyFBO(): void {
    if (this.copyFBO) return;
    this.copyFBO = this.gl.createFramebuffer();
  }

  /** Destroy the persistent copy FBO */
  private destroyCopyFBO(): void {
    if (this.copyFBO) {
      this.gl.deleteFramebuffer(this.copyFBO);
      this.copyFBO = null;
    }
  }

  private compileBlitProgram(): ShaderProgram | null {
    const gl = this.gl;

    const vertShader = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragShader = this.compileShader(gl.FRAGMENT_SHADER, BLIT_FRAG);
    if (!vertShader || !fragShader) return null;

    const program = gl.createProgram()!;
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Fire blit shader link error:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
      return null;
    }

    gl.detachShader(program, vertShader);
    gl.detachShader(program, fragShader);
    gl.deleteShader(vertShader);
    gl.deleteShader(fragShader);

    const uniforms = new Map<string, WebGLUniformLocation>();
    const loc = gl.getUniformLocation(program, "u_frame");
    if (loc) uniforms.set("u_frame", loc);

    return { program, uniforms };
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const typeName = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
      console.error(`Fire blit ${typeName} shader error:`, gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }
}
