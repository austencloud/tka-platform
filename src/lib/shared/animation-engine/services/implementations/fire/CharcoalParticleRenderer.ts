/**
 * CharcoalParticleRenderer
 *
 * CPU-driven particle system that renders spark showers via WebGL2 point sprites.
 * Each frame: emit new sparks at tip positions, integrate physics (gravity, drag,
 * cooling), kill dead particles, upload survivors to a VBO, and draw as GL_POINTS
 * with additive blending.
 *
 * Shares the same WebGL2 context as the fluid fire renderer. Carefully saves and
 * restores GL state to avoid corrupting the fluid pipeline.
 *
 * Particle pool: Pre-allocated array of 2048 particles. Dead particles are reused
 * via a free-list scan rather than allocating new objects.
 */

import type { ICharcoalRenderer } from "../../contracts/ICharcoalRenderer";
import type { FireFrameInput, FireOverlayConfig, PropTipData } from "../../../domain/types/FireTypes";
import type { CharcoalParams } from "../../../domain/types/FireTypes";
import { CHARCOAL_VERT, CHARCOAL_FRAG } from "./CharcoalShaderSources";

// ============================================================
// Constants
// ============================================================

const MAX_PARTICLES = 2048;
/** Floats per particle in the VBO: x, y, temperature, size */
const FLOATS_PER_PARTICLE = 4;
/** Bytes per float */
const BYTES_PER_FLOAT = 4;
/** Stride in bytes between consecutive particles in the VBO */
const STRIDE = FLOATS_PER_PARTICLE * BYTES_PER_FLOAT;
/** Maximum dt to prevent explosion after tab switch or long pause */
const MAX_DT_SECONDS = 0.033;

// ============================================================
// Particle struct (CPU-side, not exported)
// ============================================================

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  temperature: number;
  size: number;
  age: number;
  alive: boolean;
}

// ============================================================
// Default charcoal params (fallback if config.charcoalParams missing)
// ============================================================

const DEFAULT_CHARCOAL: CharcoalParams = {
  sparkRate: 120,
  sparkLifetime: 0.8,
  sparkInitialSpeed: 1.2,
  sparkScatter: 100,
  sparkSize: 3.0,
  sparkSizeVariance: 0.5,
  gravity: 150,
  dragCoefficient: 2.0,
  secondarySparkChance: 0.15,
  emberGlowDuration: 0.3,
  coolingRate: 0.002,
  initialTemperature: 1.0,
};

export class CharcoalParticleRenderer implements ICharcoalRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;

  // WebGL resources
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private vbo: WebGLBuffer | null = null;

  // Uniform locations
  private uDisplayIntensity: WebGLUniformLocation | null = null;

  // Attribute locations
  private aPosition = -1;
  private aTemperature = -1;
  private aSize = -1;

  // Particle pool
  private particles: Particle[] = [];
  private uploadBuffer: Float32Array = new Float32Array(MAX_PARTICLES * FLOATS_PER_PARTICLE);

  // Timing
  private lastTime = 0;

  // Fractional emission accumulator (one per tip, up to 16 tips)
  private emitAccumulators: number[] = [];

  // ============================================================
  // Initialization
  // ============================================================

  init(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext): void {
    this.canvas = canvas;
    this.gl = gl;

    this.initParticlePool();
    this.compileProgram();
    this.createBuffers();
    this.lastTime = 0;
  }

  private initParticlePool(): void {
    this.particles = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        temperature: 0,
        size: 0,
        age: 0,
        alive: false,
      });
    }
    this.emitAccumulators = new Array(16).fill(0);
  }

  private compileProgram(): void {
    const gl = this.gl!;

    const vertShader = this.compileShader(gl.VERTEX_SHADER, CHARCOAL_VERT);
    const fragShader = this.compileShader(gl.FRAGMENT_SHADER, CHARCOAL_FRAG);
    if (!vertShader || !fragShader) {
      console.error("CharcoalParticleRenderer: shader compilation failed");
      return;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("CharcoalParticleRenderer link error:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
      return;
    }

    // Shaders are linked into the program; GPU copies are no longer needed
    gl.detachShader(program, vertShader);
    gl.detachShader(program, fragShader);
    gl.deleteShader(vertShader);
    gl.deleteShader(fragShader);

    this.program = program;

    // Cache locations
    this.aPosition = gl.getAttribLocation(program, "a_position");
    this.aTemperature = gl.getAttribLocation(program, "a_temperature");
    this.aSize = gl.getAttribLocation(program, "a_size");
    this.uDisplayIntensity = gl.getUniformLocation(program, "u_displayIntensity");
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl!;
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const typeName = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
      console.error(`Charcoal ${typeName} shader error:`, gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private createBuffers(): void {
    const gl = this.gl!;

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_PARTICLES * STRIDE, gl.DYNAMIC_DRAW);

    // a_position: vec2 at offset 0
    if (this.aPosition >= 0) {
      gl.enableVertexAttribArray(this.aPosition);
      gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, STRIDE, 0);
    }

    // a_temperature: float at offset 8
    if (this.aTemperature >= 0) {
      gl.enableVertexAttribArray(this.aTemperature);
      gl.vertexAttribPointer(this.aTemperature, 1, gl.FLOAT, false, STRIDE, 2 * BYTES_PER_FLOAT);
    }

    // a_size: float at offset 12
    if (this.aSize >= 0) {
      gl.enableVertexAttribArray(this.aSize);
      gl.vertexAttribPointer(this.aSize, 1, gl.FLOAT, false, STRIDE, 3 * BYTES_PER_FLOAT);
    }

    // Unbind to avoid polluting shared state
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  // ============================================================
  // Per-frame render
  // ============================================================

  renderSparks(input: FireFrameInput, config: FireOverlayConfig): void {
    const gl = this.gl;
    if (!gl || !this.program || !this.vao || !this.vbo) return;

    const params = config.charcoalParams ?? DEFAULT_CHARCOAL;

    // Compute dt (capped to prevent explosion on tab return)
    const now = input.currentTime;
    if (this.lastTime === 0) this.lastTime = now;
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT_SECONDS);
    this.lastTime = now;
    if (dt <= 0) return;

    // --- CPU particle simulation ---
    this.emitSparks(input, params, config.intensity, dt);
    this.updateParticles(params, dt);
    const aliveCount = this.packUploadBuffer();

    if (aliveCount === 0) return;

    // --- Save GL state that might conflict with fluid renderer ---
    const prevProgram = gl.getParameter(gl.CURRENT_PROGRAM);
    const prevVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
    const prevBlendSrc = gl.getParameter(gl.BLEND_SRC_RGB);
    const prevBlendDst = gl.getParameter(gl.BLEND_DST_RGB);
    const prevBlendSrcA = gl.getParameter(gl.BLEND_SRC_ALPHA);
    const prevBlendDstA = gl.getParameter(gl.BLEND_DST_ALPHA);
    const blendEnabled = gl.isEnabled(gl.BLEND);

    // --- GPU upload + draw ---
    gl.viewport(0, 0, this.canvas!.width, this.canvas!.height);

    gl.useProgram(this.program);
    gl.uniform1f(this.uDisplayIntensity, config.intensity);

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.uploadBuffer, 0, aliveCount * FLOATS_PER_PARTICLE);

    // Additive blending for spark glow
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.drawArrays(gl.POINTS, 0, aliveCount);

    // --- Restore GL state ---
    if (blendEnabled) {
      gl.blendFuncSeparate(prevBlendSrc, prevBlendDst, prevBlendSrcA, prevBlendDstA);
    } else {
      gl.disable(gl.BLEND);
    }
    gl.bindVertexArray(prevVao);
    gl.useProgram(prevProgram);
  }

  // ============================================================
  // Particle emission
  // ============================================================

  private emitSparks(
    input: FireFrameInput,
    params: CharcoalParams,
    intensity: number,
    dt: number,
  ): void {
    const tips = input.tips;
    const canvasW = input.canvasWidth;
    const canvasH = input.canvasHeight;

    for (let ti = 0; ti < tips.length; ti++) {
      const tip = tips[ti]!;

      // Accumulate fractional emissions for smooth, frame-rate-independent spawn
      const rate = params.sparkRate * intensity;
      if (ti >= this.emitAccumulators.length) continue;
      const accumulated = (this.emitAccumulators[ti] ?? 0) + rate * dt;
      this.emitAccumulators[ti] = accumulated;

      const toEmit = Math.floor(accumulated);
      if (toEmit <= 0) continue;
      this.emitAccumulators[ti] = accumulated - toEmit;

      for (let e = 0; e < toEmit; e++) {
        const p = this.findDeadParticle();
        if (!p) break; // Pool exhausted

        this.spawnSpark(p, tip, params, canvasW, canvasH);
      }
    }
  }

  private spawnSpark(
    p: Particle,
    tip: PropTipData,
    params: CharcoalParams,
    canvasW: number,
    canvasH: number,
  ): void {
    // Tip UV coordinates — same transform as WebGLFireRenderer
    const uvX = tip.x / canvasW;
    const uvY = 1.0 - tip.y / canvasH;

    p.x = uvX;
    p.y = uvY;

    // Compute tangential direction (perpendicular to velocity = spin direction)
    const velLen = Math.sqrt(tip.velocityX * tip.velocityX + tip.velocityY * tip.velocityY);
    let dirX: number;
    let dirY: number;

    if (velLen > 0.01) {
      // Normalized velocity in UV space (note: velocityY sign flips due to UV y-inversion)
      const nvx = tip.velocityX / velLen;
      const nvy = -tip.velocityY / velLen;

      // Tangential = perpendicular to velocity (the spin direction)
      dirX = -nvy;
      dirY = nvx;
    } else {
      // No velocity — emit in random direction
      const angle = Math.random() * Math.PI * 2;
      dirX = Math.cos(angle);
      dirY = Math.sin(angle);
    }

    // Apply scatter cone around the tangential direction
    const scatterRad = (params.sparkScatter * Math.PI) / 180;
    const scatter = (Math.random() - 0.5) * scatterRad;
    const cosS = Math.cos(scatter);
    const sinS = Math.sin(scatter);
    const emitDirX = dirX * cosS - dirY * sinS;
    const emitDirY = dirX * sinS + dirY * cosS;

    // Speed in UV units/second
    const speed = (tip.speed * params.sparkInitialSpeed) / canvasW;
    p.vx = emitDirX * speed;
    p.vy = emitDirY * speed;

    // Size with variance
    p.size = params.sparkSize * (1 + (Math.random() - 0.5) * params.sparkSizeVariance * 2);

    p.temperature = params.initialTemperature;
    p.age = 0;
    p.alive = true;
  }

  // ============================================================
  // Particle physics update
  // ============================================================

  private updateParticles(params: CharcoalParams, dt: number): void {
    // Gravity in UV space: positive gravity value pushes sparks downward.
    // In our UV system y=0 is bottom, y=1 is top, so downward = negative vy.
    const gravityUV = -params.gravity / 950;

    // coolingRate is per-millisecond in the interface
    const coolingPerSecond = params.coolingRate * 1000;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]!;
      if (!p.alive) continue;

      // Gravity
      p.vy += gravityUV * dt;

      // Drag (exponential decay approximation)
      const dragFactor = 1 - params.dragCoefficient * dt;
      const clampedDrag = Math.max(dragFactor, 0);
      p.vx *= clampedDrag;
      p.vy *= clampedDrag;

      // Position integration
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Cooling
      p.temperature -= coolingPerSecond * dt;

      // Aging
      p.age += dt;

      // Secondary spark emission
      if (params.secondarySparkChance > 0 && Math.random() < params.secondarySparkChance * dt) {
        const secondary = this.findDeadParticle();
        if (secondary) {
          secondary.x = p.x;
          secondary.y = p.y;
          // Reduced speed, random direction
          const angle = Math.random() * Math.PI * 2;
          const secondarySpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy) * 0.4;
          secondary.vx = Math.cos(angle) * secondarySpeed;
          secondary.vy = Math.sin(angle) * secondarySpeed;
          secondary.temperature = p.temperature * 0.6;
          secondary.size = p.size * 0.6;
          secondary.age = 0;
          secondary.alive = true;
        }
      }

      // Kill conditions
      if (
        p.temperature <= 0 ||
        p.age > params.sparkLifetime ||
        p.x < -0.1 || p.x > 1.1 ||
        p.y < -0.1 || p.y > 1.1
      ) {
        p.alive = false;
      }
    }
  }

  // ============================================================
  // VBO packing
  // ============================================================

  /**
   * Pack all alive particles into the upload buffer.
   * Returns the number of alive particles written.
   */
  private packUploadBuffer(): number {
    let writeIdx = 0;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]!;
      if (!p.alive) continue;

      const base = writeIdx * FLOATS_PER_PARTICLE;
      this.uploadBuffer[base] = p.x;
      this.uploadBuffer[base + 1] = p.y;
      this.uploadBuffer[base + 2] = p.temperature;
      this.uploadBuffer[base + 3] = p.size;
      writeIdx++;
    }

    return writeIdx;
  }

  // ============================================================
  // Pool management
  // ============================================================

  private findDeadParticle(): Particle | null {
    for (let i = 0; i < this.particles.length; i++) {
      if (!this.particles[i]!.alive) return this.particles[i]!;
    }
    return null;
  }

  // ============================================================
  // Cleanup
  // ============================================================

  dispose(): void {
    const gl = this.gl;
    if (!gl) return;

    if (this.program) {
      gl.deleteProgram(this.program);
      this.program = null;
    }
    if (this.vbo) {
      gl.deleteBuffer(this.vbo);
      this.vbo = null;
    }
    if (this.vao) {
      gl.deleteVertexArray(this.vao);
      this.vao = null;
    }

    this.gl = null;
    this.canvas = null;
    this.particles = [];
  }
}
