/**
 * Unified GPU particle executor for the render-graph WebGL2 backend.
 *
 * Handles: water, bubbles, petals, smoke, charcoal, sparkles.
 * Each kind gets its own CPU-side particle pool; the GPU resources
 * (shader, VBO, VAO) are shared across all kinds.
 *
 * Pipeline per kind per frame:
 *   1. Spawn new particles at emitter positions
 *   2. Euler-integrate forces (gravity, drag, sway)
 *   3. Retire dead particles (age > lifetime)
 *   4. Upload live particles to VBO
 *   5. Render as point sprites with shape-based SDF fragment shader
 */

import type {
  ParticlePassPayload,
  ParticleTipState,
  ParticleBlendMode,
} from "../domain/particle-pass";
import type { ShaderLibrary } from "./shader-library";

// ── Constants ───────────────────────────────────────────────────────────

const MAX_PARTICLES = 2048;
const VERTEX_STRIDE_FLOATS = 10;
const VERTEX_STRIDE_BYTES = VERTEX_STRIDE_FLOATS * 4;

// Shape encoding (matches fragment shader)
const SHAPE_MAP: Record<string, number> = {
  circle: 0, quad: 1, streak: 2, petal: 3, crystal: 4, spark: 5,
};

// ── Particle state ──────────────────────────────────────────────────────

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  age: number; lifetime: number;
  r: number; g: number; b: number; a: number;
  size: number; sizeJitter: number;
  rotation: number; spinSpeed: number;
  shape: number;
  gravity: number; drag: number;
  swayAmplitude: number; swayPhase: number;
}

class ParticlePool {
  readonly particles: Particle[] = [];
  private readonly spawnAccum = new Map<string, number>();
  private maxParticles: number;

  constructor(maxParticles: number) {
    this.maxParticles = maxParticles;
  }

  update(payload: ParticlePassPayload, dt: number): void {
    if (dt <= 0 || dt > 0.1) return;

    this.maxParticles = payload.maxParticles ?? MAX_PARTICLES;

    for (const tip of payload.tips) {
      this.spawnFromTip(tip, dt);
    }

    this.integrate(dt);
    this.retire();
  }

  fillBuffer(data: Float32Array): number {
    let count = 0;
    for (const p of this.particles) {
      if (count >= this.maxParticles) break;
      const ageNorm = Math.min(1, p.age / p.lifetime);
      const ageFade = 1 - ageNorm;
      const jitteredSize = p.size * (1 + (p.sizeJitter - 0.5) * 0.5);

      const off = count * VERTEX_STRIDE_FLOATS;
      data[off + 0] = p.x;
      data[off + 1] = p.y;
      data[off + 2] = p.r;
      data[off + 3] = p.g;
      data[off + 4] = p.b;
      data[off + 5] = p.a * ageFade;
      data[off + 6] = jitteredSize;
      data[off + 7] = p.rotation;
      data[off + 8] = p.shape;
      data[off + 9] = ageNorm;
      count++;
    }
    return count;
  }

  clear(): void {
    this.particles.length = 0;
    this.spawnAccum.clear();
  }

  private spawnFromTip(tip: ParticleTipState, dt: number): void {
    const forces = tip.forces;
    const shapeCode = SHAPE_MAP[tip.shape] ?? 0;

    for (let ei = 0; ei < tip.emitters.length; ei++) {
      const em = tip.emitters[ei]!;
      const key = `${tip.tipId}:${ei}`;

      const accum = (this.spawnAccum.get(key) ?? 0) + em.rate * dt;
      const toSpawn = Math.floor(accum);
      this.spawnAccum.set(key, accum - toSpawn);

      for (let i = 0; i < toSpawn; i++) {
        if (this.particles.length >= this.maxParticles) break;

        const angle = em.angleRange[0] + Math.random() * (em.angleRange[1] - em.angleRange[0]);
        const speed = em.speed[0] + Math.random() * (em.speed[1] - em.speed[0]);
        const ox = (Math.random() - 0.5) * 2 * em.spread;
        const oy = (Math.random() - 0.5) * 2 * em.spread;

        this.particles.push({
          x: em.position[0] + ox,
          y: em.position[1] + oy,
          vx: Math.sin(angle) * speed,
          vy: -Math.cos(angle) * speed,
          age: 0,
          lifetime: tip.lifetime * (0.7 + Math.random() * 0.6),
          r: tip.color[0],
          g: tip.color[1],
          b: tip.color[2],
          a: tip.color[3] * tip.opacity,
          size: tip.size,
          sizeJitter: Math.random() * tip.sizeJitter,
          rotation: Math.random() * Math.PI * 2,
          spinSpeed: (Math.random() - 0.5) * 3,
          shape: shapeCode,
          gravity: forces.gravity,
          drag: forces.drag,
          swayAmplitude: forces.swayAmplitude,
          swayPhase: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  private integrate(dt: number): void {
    for (const p of this.particles) {
      p.vx *= 1 - p.drag * dt;
      p.vy += p.gravity * dt;
      p.vy *= 1 - p.drag * dt;

      if (p.swayAmplitude > 0) {
        p.vx += Math.sin(p.age * 4 + p.swayPhase) * p.swayAmplitude * dt;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.age += dt;
      p.rotation += p.spinSpeed * dt;
    }
  }

  private retire(): void {
    let write = 0;
    for (let read = 0; read < this.particles.length; read++) {
      const p = this.particles[read]!;
      if (p.age < p.lifetime) {
        this.particles[write] = p;
        write++;
      }
    }
    this.particles.length = write;
  }
}

// ── Executor ────────────────────────────────────────────────────────────

export class ParticlePassExecutor {
  private gl: WebGL2RenderingContext;
  private shaders: ShaderLibrary;
  private initialized = false;

  private particleVAO: WebGLVertexArrayObject | null = null;
  private particleVBO: WebGLBuffer | null = null;
  private vertexData = new Float32Array(MAX_PARTICLES * VERTEX_STRIDE_FLOATS);

  private pools = new Map<string, ParticlePool>();

  constructor(gl: WebGL2RenderingContext, shaders: ShaderLibrary) {
    this.gl = gl;
    this.shaders = shaders;
  }

  execute(kind: string, payload: ParticlePassPayload, dt: number): void {
    const gl = this.gl;
    if (!this.initialized) {
      this.initGeometry();
      this.initialized = true;
    }

    let pool = this.pools.get(kind);
    if (!pool) {
      pool = new ParticlePool(payload.maxParticles ?? MAX_PARTICLES);
      this.pools.set(kind, pool);
    }

    pool.update(payload, dt);
    const count = pool.fillBuffer(this.vertexData);
    if (count === 0) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertexData.subarray(0, count * VERTEX_STRIDE_FLOATS));

    const canvasW = (gl.canvas as HTMLCanvasElement).width;
    const canvasH = (gl.canvas as HTMLCanvasElement).height;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvasW, canvasH);

    const blendMode = this.pickBlendMode(payload);
    gl.enable(gl.BLEND);
    this.setBlendMode(gl, blendMode);

    const prog = this.shaders.get("particle-sprite");
    gl.useProgram(prog.program);
    gl.uniform2f(prog.uniforms["u_resolution"]!, canvasW, canvasH);

    gl.bindVertexArray(this.particleVAO);
    gl.drawArrays(gl.POINTS, 0, count);
    gl.bindVertexArray(null);

    gl.disable(gl.BLEND);
  }

  dispose(): void {
    const gl = this.gl;
    if (this.particleVAO) gl.deleteVertexArray(this.particleVAO);
    if (this.particleVBO) gl.deleteBuffer(this.particleVBO);
    this.particleVAO = null;
    this.particleVBO = null;
    this.pools.clear();
    this.initialized = false;
  }

  private initGeometry(): void {
    const gl = this.gl;

    this.particleVBO = gl.createBuffer();
    if (!this.particleVBO) throw new Error("ParticlePassExecutor: VBO alloc failed");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleVBO);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertexData.byteLength, gl.DYNAMIC_DRAW);

    const prog = this.shaders.get("particle-sprite");
    this.particleVAO = gl.createVertexArray();
    if (!this.particleVAO) throw new Error("ParticlePassExecutor: VAO alloc failed");
    gl.bindVertexArray(this.particleVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleVBO);

    const F = Float32Array.BYTES_PER_ELEMENT;
    const bind = (name: string, components: number, offset: number) => {
      const loc = prog.attribs[name];
      if (loc === undefined || loc < 0) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, components, gl.FLOAT, false, VERTEX_STRIDE_BYTES, offset * F);
    };

    bind("a_position", 2, 0);
    bind("a_color", 4, 2);
    bind("a_size", 1, 6);
    bind("a_rotation", 1, 7);
    bind("a_shape", 1, 8);
    bind("a_age", 1, 9);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  private pickBlendMode(payload: ParticlePassPayload): ParticleBlendMode {
    if (payload.tips.length > 0) return payload.tips[0]!.blendMode;
    return "alpha";
  }

  private setBlendMode(gl: WebGL2RenderingContext, mode: ParticleBlendMode): void {
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
}
