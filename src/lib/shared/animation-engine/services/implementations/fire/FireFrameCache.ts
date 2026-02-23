/**
 * FireFrameCache — Record & Playback for Looping Fire Sequences
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

import { VERTEX_SHADER } from "./FluidShaderSources";

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

  // Cache textures (RGBA8, one per frame)
  private frames: WebGLTexture[] = [];
  private frameIndex = 0;
  private totalFrames = 0;

  // Recording FBO: display shader renders here during recording
  private recordingFBO: WebGLFramebuffer | null = null;
  private recordingTexture: WebGLTexture | null = null;
  private cacheWidth = 0;
  private cacheHeight = 0;

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
  commitFrame(): void {
    if (this.state !== "recording") return;
    const gl = this.gl;

    // Copy recording FBO to a new cache texture
    const cacheTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, cacheTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      this.cacheWidth, this.cacheHeight, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, null
    );

    // Copy from recording FBO to cache texture via framebuffer blit
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.recordingFBO);
    // Create a temp FBO to copy into the cache texture
    const tempFBO = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, tempFBO);
    gl.framebufferTexture2D(
      gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D, cacheTex, 0
    );
    gl.blitFramebuffer(
      0, 0, this.cacheWidth, this.cacheHeight,
      0, 0, this.cacheWidth, this.cacheHeight,
      gl.COLOR_BUFFER_BIT, gl.NEAREST
    );
    gl.deleteFramebuffer(tempFBO);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

    this.frames.push(cacheTex);
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
      this.state = "warm";
      this.frameIndex = 0;
      // Destroy recording FBO — no longer needed during playback
      this.destroyRecordingFBO();
    } else if (this.state === "warm") {
      // Reset playback to start of cached loop
      this.frameIndex = 0;
    }
  }

  /**
   * Blit a cached frame to the screen during playback.
   * Advances the frame index for the next call.
   * Returns true if a frame was blitted, false if cache exhausted (shouldn't happen).
   */
  blitCachedFrame(): boolean {
    if (this.state !== "warm" || this.totalFrames === 0) return false;

    // Wrap around if we exceed recorded frames (safety)
    const idx = this.frameIndex % this.totalFrames;
    const tex = this.frames[idx];
    if (!tex) return false;

    this.blitToScreen(tex);
    this.frameIndex++;

    return true;
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
    this.state = "idle";
    this.frameIndex = 0;
    this.totalFrames = 0;
    this.configHash = "";
  }

  /**
   * Clean up all GL resources.
   */
  dispose(): void {
    this.releaseFrames();
    this.destroyRecordingFBO();
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
    const gl = this.gl;
    for (const tex of this.frames) {
      gl.deleteTexture(tex);
    }
    this.frames.length = 0;
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
