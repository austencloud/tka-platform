/**
 * WebGPU overlay effects executor.
 *
 * Port of OverlayEffectsExecutor (WebGL2). Three strategies:
 *   A. Fullscreen SDF overlay (bloom halo, pulse ring, frost crystal)
 *   B. Trail-mesh geometry (echo phantom, zap lightning)
 *   C. Accumulator ribbon (ink, silk) — mesh into ping-pong with decay
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
const MESH_BUFFER_VERTS = 8192;

// ── WGSL Shaders ───────────────────────────────────────────────────

const FULLSCREEN_VERT_WGSL = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn main(@builtin(vertex_index) vi: u32) -> VertexOutput {
  var out: VertexOutput;
  let x = f32((vi << 1u) & 2u);
  let y = f32(vi & 2u);
  out.position = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  out.uv = vec2f(x, y);
  return out;
}
`;

const TRAIL_MESH_VERT_WGSL = /* wgsl */ `
struct MeshUniforms {
  color: vec3f,
  aaWidth: f32,
};

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) z: f32,
  @location(2) edge_t: f32,
  @location(3) alpha: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) edge_t: f32,
  @location(1) alpha: f32,
};

@group(0) @binding(0) var<uniform> u: MeshUniforms;

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = vec4f(input.position, input.z, 1.0);
  out.edge_t = input.edge_t;
  out.alpha = input.alpha;
  return out;
}
`;

const TRAIL_MESH_FRAG_WGSL = /* wgsl */ `
struct MeshUniforms {
  color: vec3f,
  aaWidth: f32,
};

@group(0) @binding(0) var<uniform> u: MeshUniforms;

@fragment
fn main(
  @location(0) edge_t: f32,
  @location(1) alpha: f32,
) -> @location(0) vec4f {
  let edgeFade = smoothstep(0.0, u.aaWidth, edge_t)
               * smoothstep(0.0, u.aaWidth, 1.0 - edge_t);
  let a = alpha * edgeFade;
  return vec4f(u.color * a, a);
}
`;

// ── Halo (bloom) ───────────────────────────────────────────────────

const HALO_FRAG_WGSL = /* wgsl */ `
struct HaloSource {
  position: vec2f,
  radius: f32,
  pulseFactor: f32,
  color: vec4f,
};

struct HaloUniforms {
  intensity: f32,
  falloffMode: f32,
  sourceCount: f32,
  _pad: f32,
  sources: array<HaloSource, 16>,
};

@group(0) @binding(0) var<uniform> u: HaloUniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let ndc = uv * 2.0 - 1.0;
  var color = vec4f(0.0);
  let count = u32(u.sourceCount);

  for (var i = 0u; i < count; i++) {
    let src = u.sources[i];
    let d = distance(ndc, src.position);
    let r = src.radius * (1.0 + src.pulseFactor * 0.3);

    var falloff: f32;
    if (u.falloffMode < 0.5) {
      falloff = exp(-d * d / (r * r));
    } else if (u.falloffMode < 1.5) {
      falloff = max(0.0, 1.0 - d / r);
    } else {
      falloff = smoothstep(r, 0.0, d);
    }

    color += src.color * falloff * u.intensity;
  }
  return color;
}
`;

// ── Pulse (ring SDF) ───────────────────────────────────────────────

const RING_FRAG_WGSL = /* wgsl */ `
struct RingInfo {
  center: vec2f,
  radius: f32,
  age: f32,
  color: vec4f,
};

struct RingUniforms {
  intensity: f32,
  thickness: f32,
  style: f32,
  ringCount: f32,
  rings: array<RingInfo, 16>,
};

@group(0) @binding(0) var<uniform> u: RingUniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let ndc = uv * 2.0 - 1.0;
  var color = vec4f(0.0);
  let count = u32(u.ringCount);

  for (var i = 0u; i < count; i++) {
    let ring = u.rings[i];
    let d = distance(ndc, ring.center);
    let ringDist = abs(d - ring.radius);

    var alpha: f32;
    if (u.style < 0.5) {
      alpha = smoothstep(u.thickness, 0.0, ringDist);
    } else {
      alpha = smoothstep(ring.radius + u.thickness, ring.radius, d);
    }

    let ageFade = max(0.0, 1.0 - ring.age);
    color += ring.color * alpha * ageFade * u.intensity;
  }
  return color;
}
`;

// ── Frost (crystal SDF) ────────────────────────────────────────────

const FROST_FRAG_WGSL = /* wgsl */ `
struct FrostSeed {
  position: vec2f,
  radius: f32,
  crystallinity: f32,
  color: vec4f,
};

struct FrostUniforms {
  intensity: f32,
  seedCount: f32,
  _pad0: f32,
  _pad1: f32,
  seeds: array<FrostSeed, 16>,
};

@group(0) @binding(0) var<uniform> u: FrostUniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let ndc = uv * 2.0 - 1.0;
  var color = vec4f(0.0);
  let count = u32(u.seedCount);

  for (var i = 0u; i < count; i++) {
    let seed = u.seeds[i];
    let d = distance(ndc, seed.position);
    let angle = atan2(ndc.y - seed.position.y, ndc.x - seed.position.x);
    let crystal = abs(sin(angle * 3.0)) * 0.5 + 0.5;
    let effectiveR = seed.radius * (0.5 + crystal * 0.5 * seed.crystallinity);
    let falloff = smoothstep(effectiveR, 0.0, d);
    color += seed.color * falloff * u.intensity;
  }
  return color;
}
`;

// ── Decay + Composite ──────────────────────────────────────────────

const DECAY_FRAG_WGSL = /* wgsl */ `
struct DecayUniforms {
  alphaFactor: f32,
  alphaSubtract: f32,
  _pad0: f32,
  _pad1: f32,
};

@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var t_src: texture_2d<f32>;
@group(0) @binding(2) var<uniform> u: DecayUniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let prev = textureSample(t_src, samp, uv);
  let decayed = prev * u.alphaFactor;
  return max(vec4f(0.0), decayed - vec4f(u.alphaSubtract));
}
`;

const ACCUM_COMPOSITE_FRAG_WGSL = /* wgsl */ `
struct CompUniforms {
  tint: vec4f,
};

@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var t_src: texture_2d<f32>;
@group(0) @binding(2) var<uniform> u: CompUniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return textureSample(t_src, samp, uv) * u.tint;
}
`;

// ── Types ──────────────────────────────────────────────────────────

interface AccumPair {
  textures: [AccumTex, AccumTex];
  readIdx: number;
  width: number;
  height: number;
}

interface AccumTex {
  texture: GPUTexture;
  view: GPUTextureView;
}

// ── Executor ───────────────────────────────────────────────────────

export class WebGPUOverlayEffectsExecutor {
  private device: GPUDevice;
  private sampler: GPUSampler;
  private initialized = false;

  private fullscreenVert!: GPUShaderModule;

  // Pipelines
  private haloPipeline!: GPURenderPipeline;
  private haloLayout!: GPUBindGroupLayout;
  private ringPipeline!: GPURenderPipeline;
  private ringLayout!: GPUBindGroupLayout;
  private frostPipeline!: GPURenderPipeline;
  private frostLayout!: GPUBindGroupLayout;
  private meshPipeline!: GPURenderPipeline;
  private meshPipelineAdditive!: GPURenderPipeline;
  private meshLayout!: GPUBindGroupLayout;
  private decayPipeline!: GPURenderPipeline;
  private decayLayout!: GPUBindGroupLayout;
  private compositePipeline!: GPURenderPipeline;
  private compositeLayout!: GPUBindGroupLayout;

  // For accumulator-target mesh rendering (ink/silk)
  private meshPipelineAccum!: GPURenderPipeline;

  // Buffers
  private meshVertexBuf!: GPUBuffer;
  private meshUniformBuf!: GPUBuffer;
  private haloUniformBuf!: GPUBuffer;
  private ringUniformBuf!: GPUBuffer;
  private frostUniformBuf!: GPUBuffer;
  private decayUniformBuf!: GPUBuffer;
  private compositeUniformBuf!: GPUBuffer;

  // Accumulators
  private inkAccum: AccumPair | null = null;
  private silkAccum: AccumPair | null = null;
  private frostAccum: AccumPair | null = null;

  constructor(device: GPUDevice, sampler: GPUSampler) {
    this.device = device;
    this.sampler = sampler;
  }

  // ── Bloom (Gaussian halos) ──────────────────────────────────────

  executeBloom(
    payload: BloomPassPayload,
    presentView: GPUTextureView,
  ): void {
    if (payload.sources.length === 0) return;
    this.ensureInit();

    const count = Math.min(payload.sources.length, MAX_SOURCES);
    const data = new Float32Array(4 + count * 8);
    data[0] = payload.intensity;
    const falloff = payload.falloff === "smooth" ? 0 : payload.falloff === "sharp" ? 1 : 2;
    data[1] = falloff;
    data[2] = count;

    for (let i = 0; i < count; i++) {
      const s = payload.sources[i]!;
      const base = 4 + i * 8;
      data[base + 0] = s.position[0];
      data[base + 1] = s.position[1];
      data[base + 2] = s.radius;
      data[base + 3] = s.pulseFactor;
      data[base + 4] = s.color[0];
      data[base + 5] = s.color[1];
      data[base + 6] = s.color[2];
      data[base + 7] = s.color[3];
    }

    this.device.queue.writeBuffer(this.haloUniformBuf, 0, data);

    const bg = this.device.createBindGroup({
      layout: this.haloLayout,
      entries: [{ binding: 0, resource: { buffer: this.haloUniformBuf } }],
    });

    this.drawFullscreen(this.haloPipeline, bg, presentView, "load");
  }

  // ── Pulse (expanding ring SDFs) ─────────────────────────────────

  executePulse(
    payload: PulsePassPayload,
    presentView: GPUTextureView,
  ): void {
    if (payload.rings.length === 0) return;
    this.ensureInit();

    const count = Math.min(payload.rings.length, MAX_SOURCES);
    const data = new Float32Array(4 + count * 8);
    data[0] = payload.intensity;
    data[1] = payload.thickness;
    data[2] = payload.style === "stroke" ? 0 : 1;
    data[3] = count;

    for (let i = 0; i < count; i++) {
      const r = payload.rings[i]!;
      const base = 4 + i * 8;
      data[base + 0] = r.center[0];
      data[base + 1] = r.center[1];
      data[base + 2] = r.radius;
      data[base + 3] = r.age;
      data[base + 4] = r.color[0];
      data[base + 5] = r.color[1];
      data[base + 6] = r.color[2];
      data[base + 7] = r.color[3];
    }

    this.device.queue.writeBuffer(this.ringUniformBuf, 0, data);

    const bg = this.device.createBindGroup({
      layout: this.ringLayout,
      entries: [{ binding: 0, resource: { buffer: this.ringUniformBuf } }],
    });

    this.drawFullscreen(this.ringPipeline, bg, presentView, "load");
  }

  // ── Ghost (phantom trail lines) ──────────────────────────────────

  executeGhost(
    payload: GhostPassPayload,
    presentView: GPUTextureView,
  ): void {
    if (payload.phantoms.length === 0) return;
    this.ensureInit();

    for (const phantom of payload.phantoms) {
      if (phantom.age >= payload.maxAge) continue;
      const ageFade = 1 - phantom.age / payload.maxAge;
      const drawStaff = payload.shape === "staff" || payload.shape === "both";
      const drawTips = payload.shape === "tips" || payload.shape === "both";

      if (drawStaff) {
        this.drawLineSegment(
          this.meshPipeline, presentView, phantom.bluePos, phantom.redPos,
          payload.thickness, payload.color, payload.color[3] * ageFade,
        );
      }

      if (drawTips) {
        const dotW = payload.thickness * (drawStaff ? 2 : 1);
        this.drawDot(this.meshPipeline, presentView, phantom.bluePos, dotW, payload.color, payload.color[3] * ageFade);
        this.drawDot(this.meshPipeline, presentView, phantom.redPos, dotW, payload.color, payload.color[3] * ageFade);
      }
    }
  }

  // ── Zap (procedural lightning) ──────────────────────────────────

  executeZap(
    payload: ZapPassPayload,
    presentView: GPUTextureView,
  ): void {
    if (payload.arcs.length === 0) return;
    this.ensureInit();

    for (const arc of payload.arcs) {
      const path = this.buildJaggedPath(arc.from, arc.to, 12, arc.seed);
      const smooth = createSmoothCurve(path, { subdivisionsPerSegment: 3 });
      const mesh = buildTaperedMesh(smooth, {
        thickness: arc.thickness,
        maxAlpha: arc.color[3] * payload.intensity,
        taperTailRatio: 0.8,
      });
      if (mesh.vertexCount >= 2) {
        this.drawMeshToTarget(this.meshPipelineAdditive, mesh.vertices, mesh.vertexCount, arc.color, presentView);
      }

      if (arc.branching > 0) {
        this.drawBranches(this.meshPipelineAdditive, presentView, path, arc, payload.intensity);
      }
    }
  }

  // ── Ink (ribbon with accumulator persistence) ───────────────────

  executeInk(
    payload: InkPassPayload,
    dt: number,
    presentView: GPUTextureView,
    canvasW: number,
    canvasH: number,
  ): void {
    if (payload.strokes.length === 0) return;
    this.ensureInit();
    this.ensureAccum("ink", canvasW, canvasH);
    const accum = this.inkAccum!;

    this.decayAccumulator(accum, payload.decayPerSecond, dt);

    const writeView = accum.textures[1 - accum.readIdx]!.view;

    for (const stroke of payload.strokes) {
      if (stroke.path.length < 2) continue;
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
      if (mesh.vertexCount >= 2) {
        this.drawMeshToTarget(this.meshPipelineAccum, mesh.vertices, mesh.vertexCount, stroke.color, writeView);
      }
    }

    accum.readIdx = 1 - accum.readIdx;
    this.compositeAccumToScreen(accum, presentView);
  }

  // ── Silk (flutter ribbon with accumulator) ──────────────────────

  executeSilk(
    payload: SilkPassPayload,
    dt: number,
    presentView: GPUTextureView,
    canvasW: number,
    canvasH: number,
  ): void {
    if (payload.ribbons.length === 0) return;
    this.ensureInit();
    this.ensureAccum("silk", canvasW, canvasH);
    const accum = this.silkAccum!;

    this.decayAccumulator(accum, payload.decayPerSecond, dt);

    const writeView = accum.textures[1 - accum.readIdx]!.view;

    for (const ribbon of payload.ribbons) {
      if (ribbon.path.length < 2) continue;
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
      if (mesh.vertexCount >= 2) {
        this.drawMeshToTarget(this.meshPipelineAccum, mesh.vertices, mesh.vertexCount, ribbon.color, writeView);
      }
    }

    accum.readIdx = 1 - accum.readIdx;
    this.compositeAccumToScreen(accum, presentView);
  }

  // ── Frost (crystal growth with accumulator) ─────────────────────

  executeFrost(
    payload: FrostPassPayload,
    dt: number,
    presentView: GPUTextureView,
    canvasW: number,
    canvasH: number,
  ): void {
    if (payload.seeds.length === 0) return;
    this.ensureInit();
    this.ensureAccum("frost", canvasW, canvasH);
    const accum = this.frostAccum!;

    this.decayAccumulator(accum, payload.decayPerSecond, dt);

    const count = Math.min(payload.seeds.length, MAX_SOURCES);
    const data = new Float32Array(4 + count * 8);
    data[0] = payload.intensity * payload.spreadRate;
    data[1] = count;

    for (let i = 0; i < count; i++) {
      const s = payload.seeds[i]!;
      const base = 4 + i * 8;
      data[base + 0] = s.position[0];
      data[base + 1] = s.position[1];
      data[base + 2] = s.radius;
      data[base + 3] = s.crystallinity;
      data[base + 4] = s.color[0];
      data[base + 5] = s.color[1];
      data[base + 6] = s.color[2];
      data[base + 7] = s.color[3];
    }

    this.device.queue.writeBuffer(this.frostUniformBuf, 0, data);

    const writeView = accum.textures[1 - accum.readIdx]!.view;
    const bg = this.device.createBindGroup({
      layout: this.frostLayout,
      entries: [{ binding: 0, resource: { buffer: this.frostUniformBuf } }],
    });

    this.drawFullscreen(this.frostPipeline, bg, writeView, "load");

    accum.readIdx = 1 - accum.readIdx;
    this.compositeAccumToScreen(accum, presentView);
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  dispose(): void {
    if (!this.initialized) return;
    this.meshVertexBuf.destroy();
    this.meshUniformBuf.destroy();
    this.haloUniformBuf.destroy();
    this.ringUniformBuf.destroy();
    this.frostUniformBuf.destroy();
    this.decayUniformBuf.destroy();
    this.compositeUniformBuf.destroy();
    this.destroyAccum(this.inkAccum);
    this.destroyAccum(this.silkAccum);
    this.destroyAccum(this.frostAccum);
    this.inkAccum = null;
    this.silkAccum = null;
    this.frostAccum = null;
    this.initialized = false;
  }

  // ── Initialization ──────────────────────────────────────────────

  private ensureInit(): void {
    if (this.initialized) return;
    this.initialized = true;
    const device = this.device;
    const F = Float32Array.BYTES_PER_ELEMENT;

    this.fullscreenVert = device.createShaderModule({ code: FULLSCREEN_VERT_WGSL });

    this.meshVertexBuf = device.createBuffer({
      size: MESH_BUFFER_VERTS * TRAIL_VERTEX_STRIDE * F,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.meshUniformBuf = device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.haloUniformBuf = device.createBuffer({
      size: (4 + MAX_SOURCES * 8) * F,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.ringUniformBuf = device.createBuffer({
      size: (4 + MAX_SOURCES * 8) * F,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.frostUniformBuf = device.createBuffer({
      size: (4 + MAX_SOURCES * 8) * F,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.decayUniformBuf = device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.compositeUniformBuf = device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.compilePipelines();
  }

  private compilePipelines(): void {
    const device = this.device;
    const F = Float32Array.BYTES_PER_ELEMENT;
    const presentFmt: GPUTextureFormat = "bgra8unorm";
    const accumFmt: GPUTextureFormat = "rgba8unorm";

    const premulBlend: GPUBlendState = {
      color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
    };
    const additiveBlend: GPUBlendState = {
      color: { srcFactor: "one", dstFactor: "one", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "one", operation: "add" },
    };

    // ── Halo ──
    this.haloLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ],
    });
    this.haloPipeline = this.makeFullscreenPipeline(
      HALO_FRAG_WGSL, this.haloLayout, presentFmt, additiveBlend,
    );

    // ── Ring ──
    this.ringLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ],
    });
    this.ringPipeline = this.makeFullscreenPipeline(
      RING_FRAG_WGSL, this.ringLayout, presentFmt, additiveBlend,
    );

    // ── Frost ──
    this.frostLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ],
    });
    this.frostPipeline = this.makeFullscreenPipeline(
      FROST_FRAG_WGSL, this.frostLayout, accumFmt, premulBlend,
    );

    // ── Trail mesh (premultiplied alpha, to present) ──
    const meshVert = device.createShaderModule({ code: TRAIL_MESH_VERT_WGSL });
    const meshFrag = device.createShaderModule({ code: TRAIL_MESH_FRAG_WGSL });

    this.meshLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ],
    });

    const meshVertexBuffers: GPUVertexBufferLayout[] = [{
      arrayStride: TRAIL_VERTEX_STRIDE * F,
      stepMode: "vertex",
      attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x2" },
        { shaderLocation: 1, offset: 2 * F, format: "float32" },
        { shaderLocation: 2, offset: 3 * F, format: "float32" },
        { shaderLocation: 3, offset: 4 * F, format: "float32" },
      ],
    }];

    const meshPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this.meshLayout],
    });

    this.meshPipeline = device.createRenderPipeline({
      layout: meshPipelineLayout,
      vertex: { module: meshVert, entryPoint: "main", buffers: meshVertexBuffers },
      fragment: {
        module: meshFrag, entryPoint: "main",
        targets: [{ format: presentFmt, blend: premulBlend }],
      },
      primitive: { topology: "triangle-strip", stripIndexFormat: "uint32" },
    });

    this.meshPipelineAdditive = device.createRenderPipeline({
      layout: meshPipelineLayout,
      vertex: { module: meshVert, entryPoint: "main", buffers: meshVertexBuffers },
      fragment: {
        module: meshFrag, entryPoint: "main",
        targets: [{ format: presentFmt, blend: additiveBlend }],
      },
      primitive: { topology: "triangle-strip", stripIndexFormat: "uint32" },
    });

    this.meshPipelineAccum = device.createRenderPipeline({
      layout: meshPipelineLayout,
      vertex: { module: meshVert, entryPoint: "main", buffers: meshVertexBuffers },
      fragment: {
        module: meshFrag, entryPoint: "main",
        targets: [{ format: accumFmt, blend: premulBlend }],
      },
      primitive: { topology: "triangle-strip", stripIndexFormat: "uint32" },
    });

    // ── Decay ──
    this.decayLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ],
    });
    this.decayPipeline = this.makeFullscreenPipeline(
      DECAY_FRAG_WGSL, this.decayLayout, accumFmt,
    );

    // ── Composite ──
    this.compositeLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ],
    });
    this.compositePipeline = this.makeFullscreenPipeline(
      ACCUM_COMPOSITE_FRAG_WGSL, this.compositeLayout, presentFmt, premulBlend,
    );
  }

  private makeFullscreenPipeline(
    fragCode: string,
    bindGroupLayout: GPUBindGroupLayout,
    targetFormat: GPUTextureFormat,
    blend?: GPUBlendState,
  ): GPURenderPipeline {
    const fragModule = this.device.createShaderModule({ code: fragCode });
    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module: this.fullscreenVert, entryPoint: "main" },
      fragment: {
        module: fragModule, entryPoint: "main",
        targets: [{ format: targetFormat, blend }],
      },
      primitive: { topology: "triangle-list" },
    });
  }

  // ── Accumulator management ──────────────────────────────────────

  private ensureAccum(name: "ink" | "silk" | "frost", w: number, h: number): void {
    const field = `${name}Accum` as const;
    const existing = this[field];
    if (existing?.width === w && existing.height === h) return;
    if (existing) this.destroyAccum(existing);

    const makeAccumTex = (): AccumTex => {
      const texture = this.device.createTexture({
        size: { width: w, height: h },
        format: "rgba8unorm",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      return { texture, view: texture.createView() };
    };

    (this as Record<string, unknown>)[field] = {
      textures: [makeAccumTex(), makeAccumTex()],
      readIdx: 0,
      width: w,
      height: h,
    } satisfies AccumPair;
  }

  private destroyAccum(accum: AccumPair | null): void {
    if (!accum) return;
    accum.textures[0].texture.destroy();
    accum.textures[1].texture.destroy();
  }

  private decayAccumulator(accum: AccumPair, decayPerSecond: number, dt: number): void {
    const factor = decayPerSecond > 0 ? Math.exp(-decayPerSecond * dt) : 1.0;
    const data = new Float32Array(4);
    data[0] = factor;
    data[1] = ALPHA_SUBTRACT;
    this.device.queue.writeBuffer(this.decayUniformBuf, 0, data);

    const readView = accum.textures[accum.readIdx]!.view;
    const writeView = accum.textures[1 - accum.readIdx]!.view;

    const bg = this.device.createBindGroup({
      layout: this.decayLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: readView },
        { binding: 2, resource: { buffer: this.decayUniformBuf } },
      ],
    });

    this.drawFullscreen(this.decayPipeline, bg, writeView, "clear");
  }

  private compositeAccumToScreen(accum: AccumPair, presentView: GPUTextureView): void {
    const data = new Float32Array(4);
    data[0] = 1; data[1] = 1; data[2] = 1; data[3] = 1;
    this.device.queue.writeBuffer(this.compositeUniformBuf, 0, data);

    const readView = accum.textures[accum.readIdx]!.view;
    const bg = this.device.createBindGroup({
      layout: this.compositeLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: readView },
        { binding: 2, resource: { buffer: this.compositeUniformBuf } },
      ],
    });

    this.drawFullscreen(this.compositePipeline, bg, presentView, "load");
  }

  // ── Drawing helpers ─────────────────────────────────────────────

  private drawFullscreen(
    pipeline: GPURenderPipeline,
    bindGroup: GPUBindGroup,
    targetView: GPUTextureView,
    loadOp: "load" | "clear",
  ): void {
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: targetView,
        loadOp,
        storeOp: "store" as GPUStoreOp,
        ...(loadOp === "clear" ? { clearValue: { r: 0, g: 0, b: 0, a: 0 } } : {}),
      }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  private drawMeshToTarget(
    pipeline: GPURenderPipeline,
    vertices: Float32Array,
    vertexCount: number,
    color: readonly number[],
    targetView: GPUTextureView,
  ): void {
    if (vertices.byteLength > this.meshVertexBuf.size) return;

    this.device.queue.writeBuffer(
      this.meshVertexBuf, 0,
      vertices.buffer, vertices.byteOffset, vertices.byteLength,
    );

    const data = new Float32Array(4);
    data[0] = color[0]!; data[1] = color[1]!; data[2] = color[2]!;
    data[3] = AA_WIDTH;
    this.device.queue.writeBuffer(this.meshUniformBuf, 0, data);

    const bg = this.device.createBindGroup({
      layout: this.meshLayout,
      entries: [{ binding: 0, resource: { buffer: this.meshUniformBuf } }],
    });

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: targetView,
        loadOp: "load" as GPULoadOp,
        storeOp: "store" as GPUStoreOp,
      }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bg);
    pass.setVertexBuffer(0, this.meshVertexBuf);
    pass.draw(vertexCount);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  private drawLineSegment(
    pipeline: GPURenderPipeline,
    targetView: GPUTextureView,
    from: [number, number],
    to: [number, number],
    thickness: number,
    color: readonly number[],
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
    if (mesh.vertexCount >= 2) {
      this.drawMeshToTarget(pipeline, mesh.vertices, mesh.vertexCount, color, targetView);
    }
  }

  private drawDot(
    pipeline: GPURenderPipeline,
    targetView: GPUTextureView,
    pos: [number, number],
    thickness: number,
    color: readonly number[],
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
    if (mesh.vertexCount >= 2) {
      this.drawMeshToTarget(pipeline, mesh.vertices, mesh.vertexCount, color, targetView);
    }
  }

  // ── Geometry helpers ────────────────────────────────────────────

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
    pipeline: GPURenderPipeline,
    targetView: GPUTextureView,
    mainPath: Point2D[],
    arc: {
      from: [number, number]; to: [number, number];
      thickness: number; color: [number, number, number, number];
      branching: number; seed: number;
    },
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
        this.drawMeshToTarget(pipeline, mesh.vertices, mesh.vertexCount, arc.color, targetView);
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
