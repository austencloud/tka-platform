/**
 * WebGL Direct Renderer
 *
 * Renders pictographs using WebGL for GPU-accelerated drawing.
 * Uses a texture atlas approach:
 * 1. Pre-render all arrow variants to a texture atlas at init
 * 2. Draw pictographs by compositing textured quads
 *
 * Performance target: ~80-120ms per fresh render
 */

import type {
  IDirectRenderer,
  DirectRenderOptions,
  RenderTiming,
  ArrowPathsData,
} from "./IDirectRenderer";
import type { PictographData } from "../../pictograph/shared/domain/models/PictographData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { MotionData } from "../../pictograph/shared/domain/models/MotionData";
import { MotionColor } from "../../pictograph/shared/domain/enums/pictograph-enums";
import { drawPathCommands, type PathCommand } from "../utils/svg-path-parser";

// Vertex shader - transforms vertices and passes texture coordinates
const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;

  uniform vec2 u_resolution;
  uniform vec2 u_translation;
  uniform vec2 u_scale;
  uniform float u_rotation;

  varying vec2 v_texCoord;

  void main() {
    // Apply rotation
    float c = cos(u_rotation);
    float s = sin(u_rotation);
    vec2 rotated = vec2(
      a_position.x * c - a_position.y * s,
      a_position.x * s + a_position.y * c
    );

    // Apply scale and translation
    vec2 position = rotated * u_scale + u_translation;

    // Convert to clip space
    vec2 clipSpace = (position / u_resolution) * 2.0 - 1.0;

    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    v_texCoord = a_texCoord;
  }
`;

// Fragment shader - samples texture with color tinting
const FRAGMENT_SHADER = `
  precision mediump float;

  uniform sampler2D u_texture;
  uniform vec4 u_color;
  uniform bool u_useTexture;

  varying vec2 v_texCoord;

  void main() {
    if (u_useTexture) {
      vec4 texColor = texture2D(u_texture, v_texCoord);
      // Tint the texture with the color
      gl_FragColor = vec4(u_color.rgb * texColor.a, texColor.a);
    } else {
      gl_FragColor = u_color;
    }
  }
`;

// Colors
const BLUE_COLOR = [0.18, 0.19, 0.57, 1.0]; // #2E3192
const RED_COLOR = [0.93, 0.11, 0.14, 1.0]; // #ED1C24
const GRID_COLOR_DARK = [0.5, 0.5, 0.5, 1.0];
const GRID_COLOR_LIGHT = [0.25, 0.25, 0.25, 1.0];

// Atlas configuration
const ATLAS_SIZE = 2048;
const ARROW_TILE_SIZE = 256;

interface ArrowAtlasEntry {
  x: number;
  y: number;
  width: number;
  height: number;
  u1: number; // Texture coordinate (left)
  v1: number; // Texture coordinate (top)
  u2: number; // Texture coordinate (right)
  v2: number; // Texture coordinate (bottom)
}

export class WebGLDirectRenderer implements IDirectRenderer {
  private gl: WebGLRenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private program: WebGLProgram | null = null;

  // Shader uniforms
  private uniforms: {
    resolution: WebGLUniformLocation | null;
    translation: WebGLUniformLocation | null;
    scale: WebGLUniformLocation | null;
    rotation: WebGLUniformLocation | null;
    texture: WebGLUniformLocation | null;
    color: WebGLUniformLocation | null;
    useTexture: WebGLUniformLocation | null;
  } = {
    resolution: null,
    translation: null,
    scale: null,
    rotation: null,
    texture: null,
    color: null,
    useTexture: null,
  };

  // Vertex buffers
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;

  // Texture atlas
  private atlasTexture: WebGLTexture | null = null;
  private atlasEntries: Map<string, ArrowAtlasEntry> = new Map();

  // Arrow path data
  private arrowPaths: ArrowPathsData | null = null;
  private initialized = false;
  private memoryUsage = 0;

  getName(): string {
    return "webgl";
  }

  isSupported(): boolean {
    if (typeof document === "undefined") return false;
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return !!gl;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create WebGL context
    this.canvas = document.createElement("canvas");
    this.canvas.width = ATLAS_SIZE;
    this.canvas.height = ATLAS_SIZE;

    this.gl = this.canvas.getContext("webgl") as WebGLRenderingContext;
    if (!this.gl) {
      throw new Error("WebGL not supported");
    }

    // Create shader program
    this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
    if (!this.program) {
      throw new Error("Failed to create shader program");
    }

    // Get uniform locations
    this.uniforms = {
      resolution: this.gl.getUniformLocation(this.program, "u_resolution"),
      translation: this.gl.getUniformLocation(this.program, "u_translation"),
      scale: this.gl.getUniformLocation(this.program, "u_scale"),
      rotation: this.gl.getUniformLocation(this.program, "u_rotation"),
      texture: this.gl.getUniformLocation(this.program, "u_texture"),
      color: this.gl.getUniformLocation(this.program, "u_color"),
      useTexture: this.gl.getUniformLocation(this.program, "u_useTexture"),
    };

    // Create buffers
    this.positionBuffer = this.gl.createBuffer();
    this.texCoordBuffer = this.gl.createBuffer();

    // Load arrow paths
    try {
      const response = await fetch("/src/lib/shared/render/data/arrow-paths.json");
      if (response.ok) {
        this.arrowPaths = await response.json();
      } else {
        const altResponse = await fetch("/data/arrow-paths.json");
        if (altResponse.ok) {
          this.arrowPaths = await altResponse.json();
        }
      }
    } catch (err) {
      console.warn("[WebGL] Failed to load arrow paths:", err);
    }

    // Build texture atlas
    if (this.arrowPaths) {
      await this.buildTextureAtlas();
    }

    this.initialized = true;
  }

  /**
   * Build texture atlas from arrow path data
   */
  private async buildTextureAtlas(): Promise<void> {
    if (!this.arrowPaths || !this.gl) return;

    // Create a 2D canvas to render arrows to
    const atlasCanvas = document.createElement("canvas");
    atlasCanvas.width = ATLAS_SIZE;
    atlasCanvas.height = ATLAS_SIZE;
    const ctx = atlasCanvas.getContext("2d");
    if (!ctx) return;

    // Clear atlas
    ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

    // Render each arrow variant to the atlas
    let tileX = 0;
    let tileY = 0;
    const _tilesPerRow = Math.floor(ATLAS_SIZE / ARROW_TILE_SIZE);

    for (const [arrowId, arrowData] of Object.entries(this.arrowPaths.arrows)) {
      // Render arrow to tile position
      ctx.save();
      ctx.translate(tileX, tileY);

      // Calculate scale based on viewBox
      const viewBox = arrowData.viewBox || { x: 0, y: 0, width: 100, height: 100 };
      const scale = ARROW_TILE_SIZE / Math.max(viewBox.width, viewBox.height);
      const offsetX = -viewBox.x;
      const offsetY = -viewBox.y;

      ctx.fillStyle = "#FFFFFF"; // White for tinting

      for (const path of arrowData.paths) {
        if (path.commands && path.commands.length > 0) {
          drawPathCommands(ctx, path.commands as PathCommand[], offsetX, offsetY, scale);
          ctx.fill();
        }
      }

      ctx.restore();

      // Store atlas entry
      this.atlasEntries.set(arrowId, {
        x: tileX,
        y: tileY,
        width: ARROW_TILE_SIZE,
        height: ARROW_TILE_SIZE,
        u1: tileX / ATLAS_SIZE,
        v1: tileY / ATLAS_SIZE,
        u2: (tileX + ARROW_TILE_SIZE) / ATLAS_SIZE,
        v2: (tileY + ARROW_TILE_SIZE) / ATLAS_SIZE,
      });

      // Move to next tile
      tileX += ARROW_TILE_SIZE;
      if (tileX >= ATLAS_SIZE) {
        tileX = 0;
        tileY += ARROW_TILE_SIZE;
      }
    }

    // Create WebGL texture from atlas
    this.atlasTexture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.atlasTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      atlasCanvas
    );
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    this.memoryUsage = ATLAS_SIZE * ATLAS_SIZE * 4; // RGBA
  }

  async renderPictograph(
    pictograph: PictographData | StepData,
    options: DirectRenderOptions
  ): Promise<HTMLCanvasElement> {
    const { canvas } = await this.renderPictographWithTiming(pictograph, options);
    return canvas;
  }

  async renderPictographWithTiming(
    pictograph: PictographData | StepData,
    options: DirectRenderOptions
  ): Promise<{ canvas: HTMLCanvasElement; timing: RenderTiming }> {
    const timing: RenderTiming = {
      totalMs: 0,
      setupMs: 0,
      drawMs: 0,
      finalizeMs: 0,
    };

    const totalStart = performance.now();

    // Setup - resize canvas
    const setupStart = performance.now();
    if (!this.gl || !this.canvas || !this.program) {
      throw new Error("WebGL not initialized");
    }

    this.canvas.width = options.size;
    this.canvas.height = options.size;
    this.gl.viewport(0, 0, options.size, options.size);
    this.gl.useProgram(this.program);

    timing.setupMs = performance.now() - setupStart;

    // Draw
    const drawStart = performance.now();
    this.drawPictograph(pictograph, options);
    timing.drawMs = performance.now() - drawStart;

    // Finalize - copy to output canvas
    const finalizeStart = performance.now();
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = options.size;
    outputCanvas.height = options.size;
    const outputCtx = outputCanvas.getContext("2d");
    if (outputCtx) {
      outputCtx.drawImage(this.canvas, 0, 0);
    }
    timing.finalizeMs = performance.now() - finalizeStart;

    timing.totalMs = performance.now() - totalStart;

    return { canvas: outputCanvas, timing };
  }

  /**
   * Main drawing function
   */
  private drawPictograph(
    pictograph: PictographData | StepData,
    options: DirectRenderOptions
  ): void {
    if (!this.gl || !this.program) return;

    const { size, visibility } = options;
    const isDarkMode = visibility.darkMode ?? true;

    // Clear with background color
    if (isDarkMode) {
      this.gl.clearColor(0, 0, 0, 1);
    } else {
      this.gl.clearColor(1, 1, 1, 1);
    }
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // Set resolution uniform
    this.gl.uniform2f(this.uniforms.resolution, size, size);

    // Enable blending for transparency
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    // Draw grid
    this.drawGrid(size, isDarkMode);

    // Get motion data from the motions object
    const blueMotion = pictograph.motions?.[MotionColor.BLUE];
    const redMotion = pictograph.motions?.[MotionColor.RED];

    const showBlue = options.visibility.showBlueMotion ?? true;
    const showRed = options.visibility.showRedMotion ?? true;

    // Draw arrows
    if (blueMotion && showBlue) {
      const arrowId = this.getArrowId(blueMotion);
      if (arrowId) {
        this.drawArrow(arrowId, size, BLUE_COLOR, blueMotion);
      }
    }

    if (redMotion && showRed) {
      const arrowId = this.getArrowId(redMotion);
      if (arrowId) {
        this.drawArrow(arrowId, size, RED_COLOR, redMotion);
      }
    }

    // TODO: Draw TKA glyph (requires text rendering solution)
    // TODO: Draw turn numbers
    // TODO: Draw reversal indicators
  }

  /**
   * Draw grid lines
   */
  private drawGrid(size: number, isDarkMode: boolean): void {
    if (!this.gl) return;

    const color = isDarkMode ? GRID_COLOR_DARK : GRID_COLOR_LIGHT;
    this.gl.uniform4fv(this.uniforms.color, color);
    this.gl.uniform1i(this.uniforms.useTexture, 0);

    const center = size / 2;
    const radius = size * 0.4;

    // Draw lines as thin quads
    const lineWidth = 1;

    // Vertical line
    this.drawQuad(center - lineWidth / 2, center - radius, lineWidth, radius * 2);

    // Horizontal line
    this.drawQuad(center - radius, center - lineWidth / 2, radius * 2, lineWidth);

    // Diagonal lines
    const _diag = radius * 0.707;
    // Would need to rotate quads for diagonal lines - simplified for now
  }

  /**
   * Draw an arrow from the texture atlas
   */
  private drawArrow(
    arrowId: string,
    size: number,
    color: number[],
    _motion: MotionData
  ): void {
    if (!this.gl || !this.atlasTexture) return;

    const entry = this.atlasEntries.get(arrowId);
    if (!entry) return;

    // Bind texture and set uniforms
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.atlasTexture);
    this.gl.uniform1i(this.uniforms.texture, 0);
    this.gl.uniform4fv(this.uniforms.color, color);
    this.gl.uniform1i(this.uniforms.useTexture, 1);

    // Draw textured quad
    const arrowSize = size * 0.5;
    const x = (size - arrowSize) / 2;
    const y = (size - arrowSize) / 2;

    this.drawTexturedQuad(x, y, arrowSize, arrowSize, entry);
  }

  /**
   * Draw a solid color quad
   */
  private drawQuad(x: number, y: number, width: number, height: number): void {
    if (!this.gl || !this.positionBuffer) return;

    const positions = [
      x, y,
      x + width, y,
      x, y + height,
      x, y + height,
      x + width, y,
      x + width, y + height,
    ];

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

    const positionLocation = this.gl.getAttribLocation(this.program!, "a_position");
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

    // Set default transforms
    this.gl.uniform2f(this.uniforms.translation, 0, 0);
    this.gl.uniform2f(this.uniforms.scale, 1, 1);
    this.gl.uniform1f(this.uniforms.rotation, 0);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  }

  /**
   * Draw a textured quad from the atlas
   */
  private drawTexturedQuad(
    x: number,
    y: number,
    width: number,
    height: number,
    entry: ArrowAtlasEntry
  ): void {
    if (!this.gl || !this.positionBuffer || !this.texCoordBuffer) return;

    // Vertex positions
    const positions = [
      x, y,
      x + width, y,
      x, y + height,
      x, y + height,
      x + width, y,
      x + width, y + height,
    ];

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);

    const positionLocation = this.gl.getAttribLocation(this.program!, "a_position");
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

    // Texture coordinates
    const texCoords = [
      entry.u1, entry.v1,
      entry.u2, entry.v1,
      entry.u1, entry.v2,
      entry.u1, entry.v2,
      entry.u2, entry.v1,
      entry.u2, entry.v2,
    ];

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(texCoords), this.gl.STATIC_DRAW);

    const texCoordLocation = this.gl.getAttribLocation(this.program!, "a_texCoord");
    this.gl.enableVertexAttribArray(texCoordLocation);
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);

    // Set default transforms
    this.gl.uniform2f(this.uniforms.translation, 0, 0);
    this.gl.uniform2f(this.uniforms.scale, 1, 1);
    this.gl.uniform1f(this.uniforms.rotation, 0);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  }

  /**
   * Create shader program
   */
  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram | null {
    if (!this.gl) return null;

    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) return null;

    const program = this.gl.createProgram();
    if (!program) return null;

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error("Program link error:", this.gl.getProgramInfoLog(program));
      return null;
    }

    return program;
  }

  /**
   * Create individual shader
   */
  private createShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;

    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  /**
   * Get arrow ID from motion data
   */
  private getArrowId(motion: MotionData): string | null {
    const type = motion.motionType.toLowerCase();
    const turns = motion.turns;
    // Map orientation to radial/nonradial for arrow lookup
    const isRadial = motion.startOrientation === "in" || motion.startOrientation === "out";
    const orientationStr = isRadial ? "radial" : "nonradial";

    if (type === "float") return "float";
    if (type === "dash") return "dash_base";
    if (type === "static") return `static_${turns}_${orientationStr}`;

    return `${type}_${turns}_${orientationStr}`;
  }

  getMemoryUsage(): number {
    return this.memoryUsage;
  }

  dispose(): void {
    if (this.gl) {
      if (this.atlasTexture) this.gl.deleteTexture(this.atlasTexture);
      if (this.positionBuffer) this.gl.deleteBuffer(this.positionBuffer);
      if (this.texCoordBuffer) this.gl.deleteBuffer(this.texCoordBuffer);
      if (this.program) this.gl.deleteProgram(this.program);
    }

    this.gl = null;
    this.canvas = null;
    this.program = null;
    this.atlasTexture = null;
    this.positionBuffer = null;
    this.texCoordBuffer = null;
    this.atlasEntries.clear();
    this.arrowPaths = null;
    this.initialized = false;
    this.memoryUsage = 0;
  }
}
