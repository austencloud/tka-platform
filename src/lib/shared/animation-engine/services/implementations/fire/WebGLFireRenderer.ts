/**
 * WebGLFireRenderer
 *
 * Creates a transparent WebGL2 canvas overlaid on the Canvas2D animation canvas.
 * Renders procedural fire at prop tip positions using FBM fragment shaders.
 *
 * The overlay canvas is positioned absolutely with pointer-events: none
 * so it doesn't interfere with user interaction on the animation canvas.
 */

import type { IFireOverlayRenderer } from "../../contracts/IFireOverlayRenderer";
import type { FireFrameInput, FireOverlayConfig } from "../../../domain/types/FireTypes";
import { FIRE_VERTEX_SHADER, FIRE_FRAGMENT_SHADER } from "./FireShaderSource";

/** Max DPR to prevent excessive fragment shader work on high-res displays */
const MAX_DPR = 2;

export class WebGLFireRenderer implements IFireOverlayRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private initialized = false;

  // Uniform locations (cached after program link)
  private uniforms: {
    u_time: WebGLUniformLocation | null;
    u_resolution: WebGLUniformLocation | null;
    u_tipCount: WebGLUniformLocation | null;
    u_tipPositions: WebGLUniformLocation | null;
    u_tipVelocities: WebGLUniformLocation | null;
    u_tipSpeeds: WebGLUniformLocation | null;
    u_intensity: WebGLUniformLocation | null;
    u_flameHeight: WebGLUniformLocation | null;
    u_quality: WebGLUniformLocation | null;
  } = {
    u_time: null,
    u_resolution: null,
    u_tipCount: null,
    u_tipPositions: null,
    u_tipVelocities: null,
    u_tipSpeeds: null,
    u_intensity: null,
    u_flameHeight: null,
    u_quality: null,
  };

  // Reusable typed arrays for uniform uploads (avoid allocation each frame)
  private tipPositionsArray = new Float32Array(16); // 8 tips * 2 floats
  private tipVelocitiesArray = new Float32Array(16);
  private tipSpeedsArray = new Float32Array(8);

  private dpr = 1;
  private cssWidth = 0;
  private cssHeight = 0;
  private quality = 4; // FBM octaves

  // Start time for animation
  private startTime = 0;

  // Reduced motion: slow time to 20% speed
  private reducedMotion = false;

  initialize(container: HTMLElement, width: number, height: number): boolean {
    // Create overlay canvas
    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.zIndex = "2";
    this.canvas.setAttribute("aria-hidden", "true");

    // DPR capped for performance
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.cssWidth = width;
    this.cssHeight = height;
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);

    container.appendChild(this.canvas);

    // Initialize WebGL2
    this.gl = this.canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });

    if (!this.gl) {
      console.warn("WebGL2 not available for fire overlay");
      this.cleanup();
      return false;
    }

    // Compile and link shaders
    if (!this.compileProgram()) {
      this.cleanup();
      return false;
    }

    // Cache uniform locations
    this.cacheUniforms();

    // Configure blending: premultiplied alpha source-over compositing
    // The shader outputs premultiplied alpha (rgb * a, a).
    // For transparent overlay on Canvas2D, we need standard source-over:
    //   result.rgb = src.rgb + dst.rgb * (1 - src.a)
    //   result.a   = src.a  + dst.a  * (1 - src.a)
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.ONE,                 // src RGB (already premultiplied)
      gl.ONE_MINUS_SRC_ALPHA, // dst RGB
      gl.ONE,                 // src Alpha
      gl.ONE_MINUS_SRC_ALPHA  // dst Alpha
    );

    // Disable depth test (2D overlay)
    gl.disable(gl.DEPTH_TEST);

    // Set viewport
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    this.startTime = performance.now() / 1000;

    // Check reduced motion preference
    if (typeof window !== "undefined" && window.matchMedia) {
      this.reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
    }

    this.initialized = true;
    return true;
  }

  resize(width: number, height: number): void {
    if (!this.canvas || !this.gl) return;

    this.cssWidth = width;
    this.cssHeight = height;
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  renderFire(input: FireFrameInput, config: FireOverlayConfig): void {
    const gl = this.gl;
    if (!gl || !this.program || !this.initialized) return;
    if (input.tips.length === 0) {
      // Nothing to render — clear the canvas
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }

    gl.useProgram(this.program);

    // Clear with transparent
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Time uniform (relative to start, slowed for reduced motion)
    const rawTime = input.currentTime / 1000 - this.startTime;
    const time = this.reducedMotion ? rawTime * 0.2 : rawTime;
    gl.uniform1f(this.uniforms.u_time, time);

    // Resolution must match the tip position coordinate space (e.g. 950x950 viewbox)
    // NOT the CSS pixel dimensions of the canvas element
    gl.uniform2f(
      this.uniforms.u_resolution,
      input.canvasWidth,
      input.canvasHeight
    );

    // Tip count
    const tipCount = Math.min(input.tips.length, 8);
    gl.uniform1i(this.uniforms.u_tipCount, tipCount);

    // Fill tip data arrays
    for (let i = 0; i < tipCount; i++) {
      const tip = input.tips[i]!;
      this.tipPositionsArray[i * 2] = tip.x;
      this.tipPositionsArray[i * 2 + 1] = tip.y;
      this.tipVelocitiesArray[i * 2] = tip.velocityX;
      this.tipVelocitiesArray[i * 2 + 1] = tip.velocityY;
      this.tipSpeedsArray[i] = tip.speed;
    }

    // Upload tip arrays
    gl.uniform2fv(this.uniforms.u_tipPositions, this.tipPositionsArray);
    gl.uniform2fv(this.uniforms.u_tipVelocities, this.tipVelocitiesArray);
    gl.uniform1fv(this.uniforms.u_tipSpeeds, this.tipSpeedsArray);

    // Configuration uniforms
    const darkBoost = input.darkMode ? 1.2 : 1.0;
    gl.uniform1f(this.uniforms.u_intensity, config.intensity * darkBoost);
    gl.uniform1f(this.uniforms.u_flameHeight, config.flameHeight);
    // Use config quality if provided, otherwise fall back to instance quality
    const effectiveQuality = Math.max(2, Math.min(4, config.quality ?? this.quality));
    gl.uniform1i(this.uniforms.u_quality, effectiveQuality);

    // Draw full-screen quad (vertex shader uses gl_VertexID)
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  setQuality(octaves: number): void {
    this.quality = Math.max(2, Math.min(4, octaves));
  }

  dispose(): void {
    this.cleanup();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private compileProgram(): boolean {
    const gl = this.gl;
    if (!gl) return false;

    const vertShader = this.compileShader(gl, gl.VERTEX_SHADER, FIRE_VERTEX_SHADER);
    const fragShader = this.compileShader(gl, gl.FRAGMENT_SHADER, FIRE_FRAGMENT_SHADER);
    if (!vertShader || !fragShader) return false;

    const program = gl.createProgram();
    if (!program) return false;

    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Fire shader link error:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
      return false;
    }

    // Shaders can be detached after linking
    gl.detachShader(program, vertShader);
    gl.detachShader(program, fragShader);
    gl.deleteShader(vertShader);
    gl.deleteShader(fragShader);

    this.program = program;
    return true;
  }

  private compileShader(
    gl: WebGL2RenderingContext,
    type: number,
    source: string
  ): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const typeName = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
      console.error(`Fire ${typeName} shader error:`, gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private cacheUniforms(): void {
    const gl = this.gl;
    const program = this.program;
    if (!gl || !program) return;

    this.uniforms.u_time = gl.getUniformLocation(program, "u_time");
    this.uniforms.u_resolution = gl.getUniformLocation(program, "u_resolution");
    this.uniforms.u_tipCount = gl.getUniformLocation(program, "u_tipCount");
    this.uniforms.u_tipPositions = gl.getUniformLocation(program, "u_tipPositions");
    this.uniforms.u_tipVelocities = gl.getUniformLocation(program, "u_tipVelocities");
    this.uniforms.u_tipSpeeds = gl.getUniformLocation(program, "u_tipSpeeds");
    this.uniforms.u_intensity = gl.getUniformLocation(program, "u_intensity");
    this.uniforms.u_flameHeight = gl.getUniformLocation(program, "u_flameHeight");
    this.uniforms.u_quality = gl.getUniformLocation(program, "u_quality");
  }

  private cleanup(): void {
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program);
      this.program = null;
    }

    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
    }

    this.gl = null;
    this.initialized = false;
  }
}
