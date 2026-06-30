/**
 * GPU executor for overlay effects: echo, bloom, zap, pulse, ink, frost, silk.
 *
 * Three rendering strategies:
 *   A. Fullscreen SDF overlay (bloom, pulse, frost) — fragment shader evaluates
 *      SDFs at uniform-array source positions. No geometry needed.
 *   B. Trail-mesh geometry (echo, zap) — CPU-built tapered polygon strips
 *      rendered via the existing trail-mesh vertex/fragment shaders.
 *   C. Accumulator ribbon (ink, silk) — trail-mesh geometry drawn into
 *      ping-pong accumulator FBOs with per-frame decay for persistence.
 *
 * Frost uses strategy A + accumulator for growth persistence.
 */

import type {
  GhostPassPayload,
  BloomPassPayload,
  ZapPassPayload,
  PulsePassPayload,
  InkPassPayload,
  FrostPassPayload,
  SilkPassPayload,
} from "../domain/effect-passes";
import type { FBOPool } from "./fbo-pool";
import type { ShaderLibrary } from "./shader-library";
import {
  buildTaperedMesh,
  createSmoothCurve,
  adaptiveSubdivisions,
  TRAIL_VERTEX_STRIDE,
  type Point2D,
} from "../math/trail-mesh";

const MAX_SOURCES = 16;
const AA_WIDTH = 0.05;
const ALPHA_SUBTRACT = 1.0 / 255.0;

export class OverlayEffectsExecutor {
  private gl: WebGL2RenderingContext;
  private fbos: FBOPool;
  private shaders: ShaderLibrary;
  private emptyVAO: WebGLVertexArrayObject;
  private meshInitialized = false;

  private meshVBO: WebGLBuffer | null = null;
  private meshVAO: WebGLVertexArrayObject | null = null;

  private readonly srcPositions = new Float32Array(MAX_SOURCES * 2);
  private readonly srcColors = new Float32Array(MAX_SOURCES * 4);
  private readonly srcFloatsA = new Float32Array(MAX_SOURCES);
  private readonly srcFloatsB = new Float32Array(MAX_SOURCES);

  constructor(
    gl: WebGL2RenderingContext,
    fbos: FBOPool,
    shaders: ShaderLibrary,
    emptyVAO: WebGLVertexArrayObject,
  ) {
    this.gl = gl;
    this.fbos = fbos;
    this.shaders = shaders;
    this.emptyVAO = emptyVAO;
  }

  // ── Bloom (fullscreen Gaussian halos) ────────────────────────────────

  executeBloom(payload: BloomPassPayload): void {
    if (payload.sources.length === 0) return;
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    const prog = this.shaders.get("effect-halo");
    gl.useProgram(prog.program);

    const count = Math.min(payload.sources.length, MAX_SOURCES);
    for (let i = 0; i < count; i++) {
      const s = payload.sources[i]!;
      this.srcPositions[i * 2] = s.position[0];
      this.srcPositions[i * 2 + 1] = s.position[1];
      this.srcColors[i * 4] = s.color[0];
      this.srcColors[i * 4 + 1] = s.color[1];
      this.srcColors[i * 4 + 2] = s.color[2];
      this.srcColors[i * 4 + 3] = s.color[3];
      this.srcFloatsA[i] = s.radius;
      this.srcFloatsB[i] = s.pulseFactor;
    }

    gl.uniform2fv(prog.uniforms["u_sources"]!, this.srcPositions.subarray(0, count * 2));
    gl.uniform4fv(prog.uniforms["u_colors"]!, this.srcColors.subarray(0, count * 4));
    gl.uniform1fv(prog.uniforms["u_radii"]!, this.srcFloatsA.subarray(0, count));
    gl.uniform1fv(prog.uniforms["u_pulseFactors"]!, this.srcFloatsB.subarray(0, count));
    gl.uniform1i(prog.uniforms["u_sourceCount"]!, count);
    gl.uniform1f(prog.uniforms["u_intensity"]!, payload.intensity);
    const falloff = payload.falloff === "smooth" ? 0 : payload.falloff === "sharp" ? 1 : 2;
    gl.uniform1i(prog.uniforms["u_falloffMode"]!, falloff);

    gl.bindVertexArray(this.emptyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  // ── Pulse (fullscreen expanding ring SDFs) ───────────────────────────

  executePulse(payload: PulsePassPayload): void {
    if (payload.rings.length === 0) return;
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    const prog = this.shaders.get("effect-ring");
    gl.useProgram(prog.program);

    const count = Math.min(payload.rings.length, MAX_SOURCES);
    for (let i = 0; i < count; i++) {
      const r = payload.rings[i]!;
      this.srcPositions[i * 2] = r.center[0];
      this.srcPositions[i * 2 + 1] = r.center[1];
      this.srcFloatsA[i] = r.radius;
      this.srcFloatsB[i] = r.age;
      this.srcColors[i * 4] = r.color[0];
      this.srcColors[i * 4 + 1] = r.color[1];
      this.srcColors[i * 4 + 2] = r.color[2];
      this.srcColors[i * 4 + 3] = r.color[3];
    }

    gl.uniform2fv(prog.uniforms["u_centers"]!, this.srcPositions.subarray(0, count * 2));
    gl.uniform1fv(prog.uniforms["u_ringRadii"]!, this.srcFloatsA.subarray(0, count));
    gl.uniform1fv(prog.uniforms["u_ages"]!, this.srcFloatsB.subarray(0, count));
    gl.uniform4fv(prog.uniforms["u_ringColors"]!, this.srcColors.subarray(0, count * 4));
    gl.uniform1i(prog.uniforms["u_ringCount"]!, count);
    gl.uniform1f(prog.uniforms["u_intensity"]!, payload.intensity);
    gl.uniform1f(prog.uniforms["u_thickness"]!, payload.thickness);
    gl.uniform1i(prog.uniforms["u_style"]!, payload.style === "stroke" ? 0 : 1);

    gl.bindVertexArray(this.emptyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  // ── Ghost (phantom trail lines) ───────────────────────────────────────

  executeGhost(payload: GhostPassPayload): void {
    if (payload.phantoms.length === 0) return;
    this.ensureMesh();
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const prog = this.shaders.get("trail-mesh");
    gl.useProgram(prog.program);
    gl.uniform1f(prog.uniforms["u_aaWidth"]!, AA_WIDTH);
    gl.uniform3f(
      prog.uniforms["u_color"]!,
      payload.color[0], payload.color[1], payload.color[2],
    );

    gl.bindVertexArray(this.meshVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshVBO);

    for (const phantom of payload.phantoms) {
      if (phantom.age >= payload.maxAge) continue;
      const ageFade = 1 - phantom.age / payload.maxAge;
      const drawStaff = payload.shape === "staff" || payload.shape === "both";
      const drawTips = payload.shape === "tips" || payload.shape === "both";

      if (drawStaff) {
        this.drawLineSegment(
          gl, phantom.bluePos, phantom.redPos,
          payload.thickness, payload.color[3] * ageFade,
        );
      }

      if (drawTips) {
        const dotThickness = payload.thickness * (drawStaff ? 2 : 1);
        this.drawDot(gl, phantom.bluePos, dotThickness, payload.color[3] * ageFade);
        this.drawDot(gl, phantom.redPos, dotThickness, payload.color[3] * ageFade);
      }
    }

    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  // ── Zap (procedural lightning arcs) ──────────────────────────────────

  executeZap(payload: ZapPassPayload): void {
    if (payload.arcs.length === 0) return;
    this.ensureMesh();
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    const prog = this.shaders.get("trail-mesh");
    gl.useProgram(prog.program);
    gl.uniform1f(prog.uniforms["u_aaWidth"]!, AA_WIDTH);

    gl.bindVertexArray(this.meshVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshVBO);

    for (const arc of payload.arcs) {
      gl.uniform3f(prog.uniforms["u_color"]!, arc.color[0], arc.color[1], arc.color[2]);

      const segments = 12;
      const path = this.buildJaggedPath(
        arc.from, arc.to, segments, arc.seed,
      );

      const smooth = createSmoothCurve(path, { subdivisionsPerSegment: 3 });
      const mesh = buildTaperedMesh(smooth, {
        thickness: arc.thickness,
        maxAlpha: arc.color[3] * payload.intensity,
        taperTailRatio: 0.8,
      });
      if (mesh.vertexCount >= 2) {
        gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, mesh.vertexCount);
      }

      if (arc.branching > 0) {
        this.drawBranches(gl, path, arc, payload.intensity);
      }
    }

    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  // ── Ink (ribbon with accumulator persistence) ────────────────────────

  executeInk(payload: InkPassPayload, dt: number): void {
    if (payload.strokes.length === 0) return;
    this.ensureMesh();
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;

    const accum = this.fbos.getOrAllocatePair("ink-accum", "rgba8");
    this.decayAccumulator(accum, payload.decayPerSecond, dt);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const prog = this.shaders.get("trail-mesh");
    gl.useProgram(prog.program);
    gl.uniform1f(prog.uniforms["u_aaWidth"]!, AA_WIDTH);
    gl.bindVertexArray(this.meshVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshVBO);

    for (const stroke of payload.strokes) {
      if (stroke.path.length < 2) continue;
      gl.uniform3f(prog.uniforms["u_color"]!, stroke.color[0], stroke.color[1], stroke.color[2]);

      const points: Point2D[] = stroke.path.map(p => ({ x: p[0], y: p[1] }));
      const smooth = createSmoothCurve(points, {
        subdivisionsPerSegment: adaptiveSubdivisions(points.length),
      });
      if (smooth.length < 2) continue;

      let avgVel = 0;
      for (const v of stroke.velocities) avgVel += v;
      avgVel /= stroke.velocities.length || 1;
      const widthScale = 1 + avgVel * payload.viscosity;

      const mesh = buildTaperedMesh(smooth, {
        thickness: stroke.width * widthScale,
        maxAlpha: stroke.color[3],
        taperTailRatio: 0.5,
      });
      if (mesh.vertexCount < 2) continue;

      gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, mesh.vertexCount);
    }

    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    accum.swap();

    this.compositeAccumToScreen(accum.read, canvas.width, canvas.height);
  }

  // ── Silk (flutter ribbon with accumulator persistence) ───────────────

  executeSilk(payload: SilkPassPayload, dt: number): void {
    if (payload.ribbons.length === 0) return;
    this.ensureMesh();
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;

    const accum = this.fbos.getOrAllocatePair("silk-accum", "rgba8");
    this.decayAccumulator(accum, payload.decayPerSecond, dt);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const prog = this.shaders.get("trail-mesh");
    gl.useProgram(prog.program);
    gl.uniform1f(prog.uniforms["u_aaWidth"]!, AA_WIDTH);
    gl.bindVertexArray(this.meshVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshVBO);

    for (const ribbon of payload.ribbons) {
      if (ribbon.path.length < 2) continue;
      gl.uniform3f(prog.uniforms["u_color"]!, ribbon.color[0], ribbon.color[1], ribbon.color[2]);

      const points = this.applyFlutter(ribbon.path, ribbon.flutterOffsets);
      const smooth = createSmoothCurve(points, {
        subdivisionsPerSegment: adaptiveSubdivisions(points.length),
      });
      if (smooth.length < 2) continue;

      const mesh = buildTaperedMesh(smooth, {
        thickness: ribbon.width,
        maxAlpha: ribbon.color[3] * payload.intensity,
        taperTailRatio: 0.4,
      });
      if (mesh.vertexCount < 2) continue;

      gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, mesh.vertexCount);
    }

    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    accum.swap();

    this.compositeAccumToScreen(accum.read, canvas.width, canvas.height);
  }

  // ── Frost (crystal growth with accumulator) ──────────────────────────

  executeFrost(payload: FrostPassPayload, dt: number): void {
    if (payload.seeds.length === 0) return;
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;

    const accum = this.fbos.getOrAllocatePair("frost-accum", "rgba8");
    this.decayAccumulator(accum, payload.decayPerSecond, dt);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const prog = this.shaders.get("effect-frost");
    gl.useProgram(prog.program);

    const count = Math.min(payload.seeds.length, MAX_SOURCES);
    for (let i = 0; i < count; i++) {
      const s = payload.seeds[i]!;
      this.srcPositions[i * 2] = s.position[0];
      this.srcPositions[i * 2 + 1] = s.position[1];
      this.srcFloatsA[i] = s.radius;
      this.srcFloatsB[i] = s.crystallinity;
      this.srcColors[i * 4] = s.color[0];
      this.srcColors[i * 4 + 1] = s.color[1];
      this.srcColors[i * 4 + 2] = s.color[2];
      this.srcColors[i * 4 + 3] = s.color[3];
    }

    gl.uniform2fv(prog.uniforms["u_seeds"]!, this.srcPositions.subarray(0, count * 2));
    gl.uniform1fv(prog.uniforms["u_seedRadii"]!, this.srcFloatsA.subarray(0, count));
    gl.uniform1fv(prog.uniforms["u_crystallinity"]!, this.srcFloatsB.subarray(0, count));
    gl.uniform4fv(prog.uniforms["u_seedColors"]!, this.srcColors.subarray(0, count * 4));
    gl.uniform1i(prog.uniforms["u_seedCount"]!, count);
    gl.uniform1f(prog.uniforms["u_intensity"]!, payload.intensity * payload.spreadRate);

    gl.bindVertexArray(this.emptyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    gl.disable(gl.BLEND);
    accum.swap();

    this.compositeAccumToScreen(accum.read, canvas.width, canvas.height);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────

  dispose(): void {
    const gl = this.gl;
    if (this.meshVBO) gl.deleteBuffer(this.meshVBO);
    if (this.meshVAO) gl.deleteVertexArray(this.meshVAO);
    this.meshVBO = null;
    this.meshVAO = null;
    this.fbos.release("ink-accum");
    this.fbos.release("silk-accum");
    this.fbos.release("frost-accum");
    this.meshInitialized = false;
  }

  // ── Internal: mesh setup ─────────────────────────────────────────────

  private ensureMesh(): void {
    if (this.meshInitialized) return;
    this.meshInitialized = true;
    const gl = this.gl;

    this.meshVBO = gl.createBuffer();
    if (!this.meshVBO) throw new Error("OverlayEffectsExecutor: VBO alloc failed");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshVBO);
    gl.bufferData(gl.ARRAY_BUFFER, 8192 * TRAIL_VERTEX_STRIDE * 4, gl.DYNAMIC_DRAW);

    const prog = this.shaders.get("trail-mesh");
    this.meshVAO = gl.createVertexArray();
    if (!this.meshVAO) throw new Error("OverlayEffectsExecutor: VAO alloc failed");
    gl.bindVertexArray(this.meshVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshVBO);

    const stride = TRAIL_VERTEX_STRIDE * Float32Array.BYTES_PER_ELEMENT;
    const F = Float32Array.BYTES_PER_ELEMENT;

    const bind = (name: string, size: number, offset: number) => {
      const loc = prog.attribs[name];
      if (loc === undefined || loc < 0) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * F);
    };
    bind("a_position", 2, 0);
    bind("a_z", 1, 2);
    bind("a_edge_t", 1, 3);
    bind("a_alpha", 1, 4);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  // ── Internal: accumulator helpers ────────────────────────────────────

  private decayAccumulator(
    accum: { read: { texture: WebGLTexture }; write: { framebuffer: WebGLFramebuffer; width: number; height: number } },
    decayPerSecond: number,
    dt: number,
  ): void {
    const gl = this.gl;
    const factor = decayPerSecond > 0 ? Math.exp(-decayPerSecond * dt) : 1.0;

    gl.bindFramebuffer(gl.FRAMEBUFFER, accum.write.framebuffer);
    gl.viewport(0, 0, accum.write.width, accum.write.height);
    gl.disable(gl.BLEND);

    const decay = this.shaders.get("decay");
    gl.useProgram(decay.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, accum.read.texture);
    gl.uniform1i(decay.uniforms["u_src"]!, 0);
    gl.uniform1f(decay.uniforms["u_alphaFactor"]!, factor);
    gl.uniform1f(decay.uniforms["u_alphaSubtract"]!, ALPHA_SUBTRACT);

    gl.bindVertexArray(this.emptyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  private compositeAccumToScreen(
    source: { texture: WebGLTexture },
    canvasW: number,
    canvasH: number,
  ): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvasW, canvasH);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const composite = this.shaders.get("composite");
    gl.useProgram(composite.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source.texture);
    gl.uniform1i(composite.uniforms["u_src"]!, 0);
    gl.uniform4f(composite.uniforms["u_tint"]!, 1, 1, 1, 1);

    gl.bindVertexArray(this.emptyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  // ── Internal: geometry helpers ───────────────────────────────────────

  private drawLineSegment(
    gl: WebGL2RenderingContext,
    from: [number, number],
    to: [number, number],
    thickness: number,
    alpha: number,
  ): void {
    const path: Point2D[] = [
      { x: from[0], y: from[1] },
      { x: to[0], y: to[1] },
    ];
    const mesh = buildTaperedMesh(path, {
      thickness,
      maxAlpha: alpha,
      taperTailRatio: 1.0,
    });
    if (mesh.vertexCount < 2) return;
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, mesh.vertexCount);
  }

  private drawDot(
    gl: WebGL2RenderingContext,
    pos: [number, number],
    thickness: number,
    alpha: number,
  ): void {
    const d = 0.005;
    const path: Point2D[] = [
      { x: pos[0] - d, y: pos[1] },
      { x: pos[0] + d, y: pos[1] },
    ];
    const mesh = buildTaperedMesh(path, {
      thickness,
      maxAlpha: alpha,
      taperTailRatio: 1.0,
    });
    if (mesh.vertexCount < 2) return;
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, mesh.vertexCount);
  }

  private buildJaggedPath(
    from: [number, number],
    to: [number, number],
    segments: number,
    seed: number,
  ): Point2D[] {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy);
    const perpX = len > 1e-6 ? -dy / len : 0;
    const perpY = len > 1e-6 ? dx / len : 1;
    let s = seed | 0;

    const path: Point2D[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const endFade = Math.sin(t * Math.PI);
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const jitter = ((s / 0x7fffffff) - 0.5) * 2 * len * 0.15 * endFade;

      path.push({
        x: from[0] + dx * t + perpX * jitter,
        y: from[1] + dy * t + perpY * jitter,
      });
    }
    return path;
  }

  private drawBranches(
    gl: WebGL2RenderingContext,
    mainPath: Point2D[],
    arc: { from: [number, number]; to: [number, number]; thickness: number; color: [number, number, number, number]; branching: number; seed: number },
    intensity: number,
  ): void {
    const len = Math.hypot(arc.to[0] - arc.from[0], arc.to[1] - arc.from[1]);
    let s = (arc.seed * 7 + 13) | 0;

    for (let i = 2; i < mainPath.length - 2; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      if ((s / 0x7fffffff) > arc.branching) continue;

      const branchLen = len * 0.2;
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const angle = ((s / 0x7fffffff) - 0.5) * Math.PI * 0.8;
      const bx = Math.cos(angle) * branchLen;
      const by = Math.sin(angle) * branchLen;

      const branchPath: Point2D[] = [
        { x: mainPath[i]!.x, y: mainPath[i]!.y },
        { x: mainPath[i]!.x + bx * 0.5, y: mainPath[i]!.y + by * 0.5 },
        { x: mainPath[i]!.x + bx, y: mainPath[i]!.y + by },
      ];
      const mesh = buildTaperedMesh(branchPath, {
        thickness: arc.thickness * 0.5,
        maxAlpha: arc.color[3] * intensity * 0.6,
        taperTailRatio: 0.3,
      });
      if (mesh.vertexCount >= 2) {
        gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, mesh.vertexCount);
      }
    }
  }

  private applyFlutter(
    path: ReadonlyArray<[number, number]>,
    flutterOffsets: readonly number[],
  ): Point2D[] {
    return path.map((p, i) => {
      const flutter = flutterOffsets[i] ?? 0;
      if (Math.abs(flutter) < 1e-6) return { x: p[0], y: p[1] };

      const nextIdx = Math.min(i + 1, path.length - 1);
      const prevIdx = Math.max(i - 1, 0);
      const dx = path[nextIdx]![0] - path[prevIdx]![0];
      const dy = path[nextIdx]![1] - path[prevIdx]![1];
      const len = Math.hypot(dx, dy) || 1;

      return {
        x: p[0] + (-dy / len) * flutter,
        y: p[1] + (dx / len) * flutter,
      };
    });
  }
}
