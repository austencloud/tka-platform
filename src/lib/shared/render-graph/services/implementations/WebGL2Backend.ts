/**
 * WebGL2 render backend — Phase 1.
 *
 * Trail passes are rasterized from a per-tip leading-edge path by
 * smoothing with centripetal Catmull-Rom (see math/trail-mesh.ts),
 * building a tapered triangle-strip mesh, and drawing it onto a
 * ping-pong FBO with a soft-edge + halo-glow shader. The FBO is
 * decayed each frame so old trail pixels fade multiplicatively —
 * same visual pipeline as the Canvas2D trail overlay.
 *
 * Persistent GPU state:
 * - One ping-pong pair per tip, keyed off tipId
 * - Compiled shader programs in ShaderLibrary
 * - One dynamic VBO reused across all tips per frame
 *
 * All resources released on dispose(). Per-tip FBO pairs are
 * garbage-collected after MAX_UNUSED_FRAMES_BEFORE_GC consecutive
 * frames without seeing the tip.
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
const DT_CLAMP_SECONDS = 0.1;
const MAX_UNUSED_FRAMES_BEFORE_GC = 30;
const AA_WIDTH = 0.05;

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

    this.shaders.precompile(["decay", "composite", "trail-mesh"]);

    // Wire mesh VAO: interleaved (x, y, edge_t, alpha) = 4 floats per vertex.
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

    for (const tip of payload.tips) {
      this.markTipSeen(tip.tipId);
      this.advanceTip(tip, dt, gl, fbos, shaders);
    }
    this.compositeTips(payload.tips, gl, fbos, shaders);
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

    // Smooth the control points into a higher-density path.
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
      glow: tip.glow,
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
    gl.uniform1f(prog.uniforms["u_coreRatio"]!, mesh.coreRatio);
    gl.uniform1f(prog.uniforms["u_glowStrength"]!, tip.glow > 0 ? 0.9 : 0);
    gl.uniform1f(prog.uniforms["u_aaWidth"]!, AA_WIDTH);

    // Premultiplied alpha blend — shader emits (rgb*a, a).
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, mesh.vertexCount);
    gl.disable(gl.BLEND);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  private compositeTips(
    tips: readonly TrailTipState[],
    gl: WebGL2RenderingContext,
    fbos: FBOPool,
    shaders: ShaderLibrary,
  ): void {
    const canvas = this.canvas!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const composite = shaders.get("composite");
    gl.useProgram(composite.program);
    gl.bindVertexArray(this.emptyVAO);

    for (const tip of tips) {
      const key = TRAIL_KEY_PREFIX + tip.tipId;
      const pair = fbos.getOrAllocatePair(key, "rgba8");
      this.setBlendMode(gl, tip.blendMode);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, pair.read.texture);
      gl.uniform1i(composite.uniforms["u_src"]!, 0);
      gl.uniform4f(composite.uniforms["u_tint"]!, 1, 1, 1, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private setBlendMode(gl: WebGL2RenderingContext, mode: TrailBlendMode): void {
    gl.enable(gl.BLEND);
    switch (mode) {
      case "additive":
        // Premultiplied additive.
        gl.blendFunc(gl.ONE, gl.ONE);
        return;
      case "screen":
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
        return;
      case "alpha":
      default:
        // Premultiplied over.
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
