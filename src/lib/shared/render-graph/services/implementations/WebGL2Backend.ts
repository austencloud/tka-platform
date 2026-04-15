/**
 * WebGL2 render backend — Phase 1.
 *
 * Trail passes are rasterized from a per-tip leading-edge path by
 * smoothing with centripetal Catmull-Rom (see math/trail-mesh.ts),
 * building a tapered triangle-strip mesh, and drawing it onto a
 * ping-pong FBO that accumulates the trail across frames. Each frame
 * the accumulator is multiplicatively decayed and then has a constant
 * alpha subtracted — the combo matches Canvas2D's fade-plus-alpha-kick
 * pipeline and prevents the rgba8 precision floor from leaving a ghost
 * trail in the background.
 *
 * Glow is a separable Gaussian blur of the accumulator composited
 * additively on top of the sharp trail — the GPU analogue of Canvas2D
 * shadowBlur.
 *
 * Persistent GPU state:
 * - One ping-pong pair per tip, keyed off tipId
 * - Two shared blur scratch FBOs ("blur-temp", "blur-result")
 * - Compiled shader programs in ShaderLibrary
 * - One dynamic VBO reused across all tips per frame
 *
 * Per-tip FBO pairs are garbage-collected after
 * MAX_UNUSED_FRAMES_BEFORE_GC consecutive frames without seeing the tip.
 */

import type { RenderBackend, BackendStats } from "../../domain/Backend";
import type { FrameGraph } from "../../domain/FrameGraph";
import type {
  RenderPassDescriptor,
  RenderPassKind,
} from "../../domain/RenderPass";
import type {
  TrailPassPayload,
  TrailTipState,
  TrailBlendMode,
} from "../../domain/TrailPass";
import {
  adaptiveSubdivisions,
  buildTaperedMesh,
  createSmoothCurve,
  type Point2D,
} from "../../math/trail-mesh";
import { FBOPool, type FBO } from "./FBOPool";
import { ShaderLibrary } from "./ShaderLibrary";

const TRAIL_KEY_PREFIX = "trail-tip-";
const BLUR_TEMP_KEY = "blur-temp";
const BLUR_RESULT_KEY = "blur-result";
const DT_CLAMP_SECONDS = 0.1;
const MAX_UNUSED_FRAMES_BEFORE_GC = 30;
const AA_WIDTH = 0.05;
/** Subtract per-frame from every channel to escape the rgba8 1/255 floor. */
const ALPHA_SUBTRACT = 1.0 / 255.0;
/** Additive blur contribution in the final composite. 0.5 = balanced bloom. */
const GLOW_MIX = 0.6;

interface TipLiveness {
  lastSeenFrame: number;
}

export class WebGL2Backend implements RenderBackend {
  readonly kind = "webgl2" as const;

  private gl: WebGL2RenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private shaders: ShaderLibrary | null = null;
  private fbos: FBOPool | null = null;
  private emptyVAO: WebGLVertexArrayObject | null = null;
  private meshVAO: WebGLVertexArrayObject | null = null;
  private meshVBO: WebGLBuffer | null = null;

  private readonly smoothPathBuffer: Point2D[] = [];
  private previousTime = -1;
  private frameCount = 0;
  private lastFrameMs = 0;
  private longestPassMs = 0;
  private readonly tipLiveness = new Map<string, TipLiveness>();
  private readonly unsupportedKindsWarned = new Set<RenderPassKind>();

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    if (this.gl) return;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("WebGL2Backend: failed to acquire WebGL2 context");

    this.canvas = canvas;
    this.gl = gl;
    this.shaders = new ShaderLibrary(gl);
    this.fbos = new FBOPool(gl, canvas.width, canvas.height);

    this.emptyVAO = gl.createVertexArray();
    if (!this.emptyVAO) throw new Error("WebGL2Backend: createVertexArray null");

    this.meshVBO = gl.createBuffer();
    this.meshVAO = gl.createVertexArray();
    if (!this.meshVBO || !this.meshVAO) {
      throw new Error("WebGL2Backend: mesh VAO/VBO allocation failed");
    }

    this.shaders.precompile([
      "decay",
      "composite",
      "trail-mesh",
      "gaussian-blur",
      "trail-composite",
    ]);

    const mesh = this.shaders.get("trail-mesh");
    gl.bindVertexArray(this.meshVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshVBO);

    const aPos = mesh.attribs["a_position"];
    const aEdge = mesh.attribs["a_edge_t"];
    const aAlpha = mesh.attribs["a_alpha"];
    if (aPos === undefined || aEdge === undefined || aAlpha === undefined
        || aPos < 0 || aEdge < 0 || aAlpha < 0) {
      throw new Error("WebGL2Backend: trail-mesh shader attribute locations missing");
    }

    const stride = 4 * Float32Array.BYTES_PER_ELEMENT;
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aEdge);
    gl.vertexAttribPointer(aEdge, 1, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(aAlpha);
    gl.vertexAttribPointer(aAlpha, 1, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  executeFrame(graph: FrameGraph, time: number): void {
    const gl = this.gl;
    const fbos = this.fbos;
    const shaders = this.shaders;
    if (!gl || !fbos || !shaders) {
      throw new Error("WebGL2Backend: executeFrame before initialize");
    }

    const frameStart = performance.now();
    this.longestPassMs = 0;

    const dt = this.computeDt(time);
    this.frameCount += 1;

    const orderedPasses = [...graph.passes].sort((a, b) => a.order - b.order);

    for (const pass of orderedPasses) {
      const passStart = performance.now();
      this.dispatch(pass, dt);
      const passMs = performance.now() - passStart;
      if (passMs > this.longestPassMs) this.longestPassMs = passMs;
    }

    this.garbageCollectTips();
    this.lastFrameMs = performance.now() - frameStart;
  }

  resize(width: number, height: number): void {
    if (!this.gl || !this.fbos || !this.canvas) return;
    this.canvas.width = Math.max(1, width);
    this.canvas.height = Math.max(1, height);
    this.fbos.resize(width, height);
  }

  dispose(): void {
    if (!this.gl) return;
    const gl = this.gl;
    this.fbos?.dispose();
    this.shaders?.dispose();
    if (this.emptyVAO) gl.deleteVertexArray(this.emptyVAO);
    if (this.meshVAO) gl.deleteVertexArray(this.meshVAO);
    if (this.meshVBO) gl.deleteBuffer(this.meshVBO);
    this.emptyVAO = null;
    this.meshVAO = null;
    this.meshVBO = null;
    this.shaders = null;
    this.fbos = null;
    this.gl = null;
    this.canvas = null;
    this.tipLiveness.clear();
  }

  getStats(): BackendStats {
    return {
      lastFrameMs: this.lastFrameMs,
      longestPassMs: this.longestPassMs,
      fboCount: this.fbos?.count ?? 0,
    };
  }

  private dispatch(pass: RenderPassDescriptor, dt: number): void {
    switch (pass.kind) {
      case "trail":
        this.executeTrailPass(pass.payload as TrailPassPayload, dt);
        return;
      case "composite":
        return;
      default:
        this.warnUnsupportedOnce(pass.kind);
        return;
    }
  }

  private executeTrailPass(payload: TrailPassPayload, dt: number): void {
    const gl = this.gl!;
    const fbos = this.fbos!;
    const shaders = this.shaders!;

    // Prepare the default framebuffer once so each tip composites in order.
    const canvas = this.canvas!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    for (const tip of payload.tips) {
      this.markTipSeen(tip.tipId);
      this.advanceTip(tip, dt, gl, fbos, shaders);
      this.compositeTip(tip, gl, fbos, shaders);
    }
  }

  private advanceTip(
    tip: TrailTipState,
    dt: number,
    gl: WebGL2RenderingContext,
    fbos: FBOPool,
    shaders: ShaderLibrary,
  ): void {
    const key = TRAIL_KEY_PREFIX + tip.tipId;
    const pair = fbos.getOrAllocatePair(key, "rgba8");

    // --- Pass A: decay existing FBO into the write target, overwriting. ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, pair.write.framebuffer);
    gl.viewport(0, 0, pair.write.width, pair.write.height);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const decayFactor = tip.decayPerSecond > 0
      ? Math.exp(-tip.decayPerSecond * dt)
      : 1.0;

    const decay = shaders.get("decay");
    gl.useProgram(decay.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, pair.read.texture);
    gl.uniform1i(decay.uniforms["u_src"]!, 0);
    gl.uniform1f(decay.uniforms["u_alphaFactor"]!, decayFactor);
    gl.uniform1f(decay.uniforms["u_alphaSubtract"]!, ALPHA_SUBTRACT);
    gl.bindVertexArray(this.emptyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    // --- Pass B: draw the current leading-edge polygon on top. ---
    this.drawTipMesh(tip, gl, shaders);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    pair.swap();
  }

  private drawTipMesh(
    tip: TrailTipState,
    gl: WebGL2RenderingContext,
    shaders: ShaderLibrary,
  ): void {
    if (tip.path.length < 2) return;

    const buf = this.smoothPathBuffer;
    buf.length = tip.path.length;
    for (let i = 0; i < tip.path.length; i += 1) {
      const p = tip.path[i]!;
      const existing = buf[i];
      if (existing) {
        existing.x = p[0];
        existing.y = p[1];
      } else {
        buf[i] = { x: p[0], y: p[1] };
      }
    }

    const smooth = createSmoothCurve(buf, {
      subdivisionsPerSegment: adaptiveSubdivisions(buf.length),
    });
    if (smooth.length < 2) return;

    const mesh = buildTaperedMesh(smooth, {
      thickness: tip.thickness,
      taperTailRatio: tip.taperTailRatio,
      maxAlpha: tip.color[3],
      fadeExponent: tip.fadeExponent,
    });
    if (mesh.vertexCount < 2) return;

    const prog = shaders.get("trail-mesh");
    gl.useProgram(prog.program);
    gl.bindVertexArray(this.meshVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshVBO);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.DYNAMIC_DRAW);

    gl.uniform3f(
      prog.uniforms["u_color"]!,
      tip.color[0],
      tip.color[1],
      tip.color[2],
    );
    gl.uniform1f(prog.uniforms["u_aaWidth"]!, AA_WIDTH);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, mesh.vertexCount);
    gl.disable(gl.BLEND);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  private compositeTip(
    tip: TrailTipState,
    gl: WebGL2RenderingContext,
    fbos: FBOPool,
    shaders: ShaderLibrary,
  ): void {
    const key = TRAIL_KEY_PREFIX + tip.tipId;
    const pair = fbos.getOrAllocatePair(key, "rgba8");
    // After advanceTip().swap(), the fresh accumulator is in pair.read.
    const accumulator = pair.read;

    const canvas = this.canvas!;
    const glowPx = this.glowRadiusPixels(tip.glow, canvas.width, canvas.height);

    let blurResult: FBO | null = null;
    if (glowPx > 0.5) {
      blurResult = this.runSeparableBlur(accumulator, glowPx, gl, fbos, shaders);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    this.setBlendMode(gl, tip.blendMode);
    gl.bindVertexArray(this.emptyVAO);

    if (blurResult) {
      const prog = shaders.get("trail-composite");
      gl.useProgram(prog.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, accumulator.texture);
      gl.uniform1i(prog.uniforms["u_sharp"]!, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, blurResult.texture);
      gl.uniform1i(prog.uniforms["u_blur"]!, 1);
      gl.uniform1f(prog.uniforms["u_glowMix"]!, GLOW_MIX);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      const prog = shaders.get("composite");
      gl.useProgram(prog.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, accumulator.texture);
      gl.uniform1i(prog.uniforms["u_src"]!, 0);
      gl.uniform4f(prog.uniforms["u_tint"]!, 1, 1, 1, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
  }

  /**
   * Run a 2-pass separable Gaussian blur on the given source. Returns
   * the FBO holding the final vertical-pass result. Stride is tuned so
   * the 4-tap-each-side kernel spans roughly `radiusPx` pixels total.
   */
  private runSeparableBlur(
    source: FBO,
    radiusPx: number,
    gl: WebGL2RenderingContext,
    fbos: FBOPool,
    shaders: ShaderLibrary,
  ): FBO {
    const temp = fbos.getOrAllocate(BLUR_TEMP_KEY, "rgba8");
    const result = fbos.getOrAllocate(BLUR_RESULT_KEY, "rgba8");
    const prog = shaders.get("gaussian-blur");

    const strideX = radiusPx / 4 / source.width;
    const strideY = radiusPx / 4 / source.height;

    gl.useProgram(prog.program);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.emptyVAO);

    // Horizontal pass: source → temp
    gl.bindFramebuffer(gl.FRAMEBUFFER, temp.framebuffer);
    gl.viewport(0, 0, temp.width, temp.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source.texture);
    gl.uniform1i(prog.uniforms["u_src"]!, 0);
    gl.uniform2f(prog.uniforms["u_direction"]!, 1, 0);
    gl.uniform1f(prog.uniforms["u_stride"]!, strideX);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Vertical pass: temp → result
    gl.bindFramebuffer(gl.FRAMEBUFFER, result.framebuffer);
    gl.viewport(0, 0, result.width, result.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindTexture(gl.TEXTURE_2D, temp.texture);
    gl.uniform2f(prog.uniforms["u_direction"]!, 0, 1);
    gl.uniform1f(prog.uniforms["u_stride"]!, strideY);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return result;
  }

  private glowRadiusPixels(glowNdc: number, width: number, height: number): number {
    if (glowNdc <= 0) return 0;
    // NDC spans 2 across each axis; use the minor axis to keep halos
    // circular on non-square canvases.
    const minAxis = Math.min(width, height);
    return glowNdc * 0.5 * minAxis;
  }

  private setBlendMode(gl: WebGL2RenderingContext, mode: TrailBlendMode): void {
    gl.enable(gl.BLEND);
    switch (mode) {
      case "additive":
        gl.blendFunc(gl.ONE, gl.ONE);
        return;
      case "screen":
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
        return;
      case "alpha":
      default:
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        return;
    }
  }

  private computeDt(time: number): number {
    if (this.previousTime < 0) {
      this.previousTime = time;
      return 1 / 60;
    }
    const raw = (time - this.previousTime) / 1000;
    this.previousTime = time;
    if (raw <= 0) return 0;
    return raw > DT_CLAMP_SECONDS ? DT_CLAMP_SECONDS : raw;
  }

  private markTipSeen(tipId: string): void {
    this.tipLiveness.set(tipId, { lastSeenFrame: this.frameCount });
  }

  private garbageCollectTips(): void {
    const fbos = this.fbos;
    if (!fbos) return;
    for (const [tipId, info] of this.tipLiveness) {
      if (this.frameCount - info.lastSeenFrame > MAX_UNUSED_FRAMES_BEFORE_GC) {
        fbos.release(TRAIL_KEY_PREFIX + tipId);
        this.tipLiveness.delete(tipId);
      }
    }
  }

  private warnUnsupportedOnce(kind: RenderPassKind): void {
    if (this.unsupportedKindsWarned.has(kind)) return;
    this.unsupportedKindsWarned.add(kind);
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console -- one-shot dev warning
      console.warn(
        `[WebGL2Backend] pass kind "${kind}" not implemented yet — skipped`,
      );
    }
  }
}

export type { FBO };
