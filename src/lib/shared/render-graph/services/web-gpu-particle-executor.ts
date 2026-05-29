/**
 * WebGPU particle executor.
 *
 * Handles: water, bubbles, petals, smoke, charcoal, sparkles.
 * CPU-side particle pool is identical to the WebGL2 version. Only
 * the GPU draw calls change (point sprites → instanced quads since
 * WebGPU doesn't support gl_PointSize).
 *
 * Pipeline: spawn → integrate → retire → upload → instanced draw.
 */

import type {
  ParticlePassPayload,
  ParticleTipState,
} from "../domain/particle-pass";

const MAX_PARTICLES = 2048;
const VERTEX_STRIDE_FLOATS = 10;

const SHAPE_MAP: Record<string, number> = {
  circle: 0, quad: 1, streak: 2, petal: 3, crystal: 4, spark: 5,
};

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
          r: tip.color[0], g: tip.color[1], b: tip.color[2],
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

const PARTICLE_VERT_WGSL = /* wgsl */ `
struct Uniforms {
  resolution: vec2f,
};

struct VertexInput {
  @location(0) quadPos: vec2f,
  @location(1) position: vec2f,
  @location(2) color: vec4f,
  @location(3) size: f32,
  @location(4) rotation: f32,
  @location(5) shape: f32,
  @location(6) age: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) shape: f32,
  @location(3) age: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let cosR = cos(input.rotation);
  let sinR = sin(input.rotation);
  let rotated = vec2f(
    input.quadPos.x * cosR - input.quadPos.y * sinR,
    input.quadPos.x * sinR + input.quadPos.y * cosR,
  );
  let worldPos = input.position + rotated * input.size;
  out.position = vec4f(
    worldPos.x / u.resolution.x * 2.0 - 1.0,
    1.0 - worldPos.y / u.resolution.y * 2.0,
    0.0, 1.0
  );
  out.uv = input.quadPos;
  out.color = input.color;
  out.shape = input.shape;
  out.age = input.age;
  return out;
}
`;

const PARTICLE_FRAG_WGSL = /* wgsl */ `
@fragment
fn main(
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) shape: f32,
  @location(3) age: f32,
) -> @location(0) vec4f {
  let d = length(uv);
  var alpha = 0.0;
  let shapeInt = u32(shape + 0.5);
  switch (shapeInt) {
    case 0u: { // circle
      alpha = smoothstep(1.0, 0.8, d);
    }
    case 1u: { // quad
      let box = max(abs(uv.x), abs(uv.y));
      alpha = smoothstep(1.0, 0.85, box);
    }
    case 2u: { // streak
      let streakD = abs(uv.y) + abs(uv.x) * 0.3;
      alpha = smoothstep(1.0, 0.7, streakD);
    }
    case 3u: { // petal
      let petalD = d + sin(atan2(uv.y, uv.x) * 3.0) * 0.3;
      alpha = smoothstep(1.2, 0.8, petalD);
    }
    case 4u: { // crystal
      let crystalD = abs(uv.x) + abs(uv.y);
      alpha = smoothstep(1.0, 0.7, crystalD);
    }
    default: { // spark
      let sparkD = d * (1.0 + abs(sin(atan2(uv.y, uv.x) * 4.0)) * 0.5);
      alpha = smoothstep(1.2, 0.5, sparkD);
    }
  }
  return color * alpha;
}
`;

export class WebGPUParticleExecutor {
  private device: GPUDevice;
  private initialized = false;

  private pipeline: GPURenderPipeline | null = null;
  private bindGroupLayout: GPUBindGroupLayout | null = null;
  private quadBuffer: GPUBuffer | null = null;
  private instanceBuffer: GPUBuffer | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private vertexData = new Float32Array(MAX_PARTICLES * VERTEX_STRIDE_FLOATS);

  private pools = new Map<string, ParticlePool>();

  constructor(device: GPUDevice) {
    this.device = device;
  }

  execute(
    kind: string,
    payload: ParticlePassPayload,
    dt: number,
    presentView: GPUTextureView,
    canvasW: number,
    canvasH: number,
  ): void {
    if (!this.initialized) {
      this.init();
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

    const device = this.device;
    const sub = this.vertexData.subarray(0, count * VERTEX_STRIDE_FLOATS);
    device.queue.writeBuffer(this.instanceBuffer!, 0, sub);
    device.queue.writeBuffer(
      this.uniformBuffer!,
      0,
      new Float32Array([canvasW, canvasH]),
    );

    const blendMode = payload.tips.length > 0 ? payload.tips[0]!.blendMode : "alpha"; // eslint-disable-line @typescript-eslint/no-unused-vars
    // Blend mode is baked into pipeline at creation; for runtime switching
    // we'd need multiple pipelines. Using premultiplied alpha for now.

    const bindGroup = device.createBindGroup({
      layout: this.bindGroupLayout!,
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer! } }],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: presentView,
          loadOp: "load",
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(this.pipeline!);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, this.quadBuffer!);
    pass.setVertexBuffer(1, this.instanceBuffer!);
    pass.draw(6, count);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  dispose(): void {
    this.quadBuffer?.destroy();
    this.instanceBuffer?.destroy();
    this.uniformBuffer?.destroy();
    this.quadBuffer = null;
    this.instanceBuffer = null;
    this.uniformBuffer = null;
    this.pools.clear();
    this.initialized = false;
  }

  private init(): void {
    const device = this.device;

    const quadVerts = new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]);
    this.quadBuffer = device.createBuffer({
      size: quadVerts.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.quadBuffer, 0, quadVerts);

    this.instanceBuffer = device.createBuffer({
      size: this.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.uniformBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" },
        },
      ],
    });

    const vertModule = device.createShaderModule({ code: PARTICLE_VERT_WGSL });
    const fragModule = device.createShaderModule({ code: PARTICLE_FRAG_WGSL });

    const F = Float32Array.BYTES_PER_ELEMENT;
    this.pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout],
      }),
      vertex: {
        module: vertModule,
        entryPoint: "main",
        buffers: [
          {
            arrayStride: 2 * F,
            stepMode: "vertex",
            attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
          },
          {
            arrayStride: VERTEX_STRIDE_FLOATS * F,
            stepMode: "instance",
            attributes: [
              { shaderLocation: 1, offset: 0 * F, format: "float32x2" },
              { shaderLocation: 2, offset: 2 * F, format: "float32x4" },
              { shaderLocation: 3, offset: 6 * F, format: "float32" },
              { shaderLocation: 4, offset: 7 * F, format: "float32" },
              { shaderLocation: 5, offset: 8 * F, format: "float32" },
              { shaderLocation: 6, offset: 9 * F, format: "float32" },
            ],
          },
        ],
      },
      fragment: {
        module: fragModule,
        entryPoint: "main",
        targets: [
          {
            format: "bgra8unorm",
            blend: {
              color: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: { topology: "triangle-list" },
    });
  }
}
