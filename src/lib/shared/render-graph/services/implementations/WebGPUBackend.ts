/**
 * WebGPU render backend — Phase 4.
 *
 * Implements the same RenderBackend interface as WebGL2Backend but targets
 * WebGPU. Structure mirrors WebGL2Backend for maintainability:
 *
 *   initialize → acquire device, compile pipelines, allocate textures
 *   executeFrame → sort passes by z-order, dispatch each
 *   resize → recreate display-sized textures
 *   dispose → destroy all GPU resources
 *
 * Shader source is WGSL (inlined). Each GLSL program in ShaderLibrary has
 * a corresponding WGSL pipeline here.
 */

import type { RenderBackend, BackendStats } from "../../domain/Backend";
import type { FrameGraph } from "../../domain/FrameGraph";
import type {
  RenderPassDescriptor,
  RenderPassKind,
} from "../../domain/RenderPass";
import type { TrailPassPayload, TrailTipState } from "../../domain/TrailPass";
import type { FirePassPayload } from "../../domain/FirePass";
import type { LedPassPayload } from "../../domain/LedPass";
import type { ParticlePassPayload } from "../../domain/ParticlePass";
import type {
  EchoPassPayload,
  BloomPassPayload,
  ZapPassPayload,
  PulsePassPayload,
  InkPassPayload,
  FrostPassPayload,
  SilkPassPayload,
} from "../../domain/EffectPasses";
import {
  adaptiveSubdivisions,
  buildTaperedMesh,
  createSmoothCurve,
  TRAIL_VERTEX_STRIDE,
  type Point2D,
  type MeshBuildOptions,
} from "../../math/trail-mesh";
import { WebGPUFireExecutor } from "./WebGPUFireExecutor";
import { WebGPULedExecutor } from "./WebGPULedExecutor";
import { WebGPUOverlayEffectsExecutor } from "./WebGPUOverlayEffectsExecutor";
import { WebGPUParticleExecutor } from "./WebGPUParticleExecutor";

const TRAIL_KEY_PREFIX = "trail-tip-";
const DT_CLAMP_SECONDS = 0.1;
const MAX_UNUSED_FRAMES_BEFORE_GC = 30;
const AA_WIDTH = 0.05;
const ALPHA_SUBTRACT = 1.0 / 255.0;
const GLOW_MIX = 1.0;
const BLOOM_DOWNSAMPLE = 2;
const SIGMA_PER_PASS = 2.0;
const MAX_BLUR_ITERATIONS = 8;

// ─── WGSL Shaders ───────────────────────────────────────────────────

const FULLSCREEN_VERT_WGSL = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn main(@builtin(vertex_index) vid: u32) -> VertexOutput {
  var out: VertexOutput;
  let x = select(-1.0, 3.0, vid == 1u);
  let y = select(-1.0, 3.0, vid == 2u);
  out.uv = vec2f((x + 1.0) * 0.5, (y + 1.0) * 0.5);
  out.position = vec4f(x, y, 0.0, 1.0);
  return out;
}
`;

const DECAY_FRAG_WGSL = /* wgsl */ `
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var srcSampler: sampler;
@group(0) @binding(2) var<uniform> params: DecayParams;

struct DecayParams {
  alphaFactor: f32,
  alphaSubtract: f32,
};

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let c = textureSample(src, srcSampler, uv) * params.alphaFactor;
  return max(c - vec4f(params.alphaSubtract), vec4f(0.0));
}
`;

const COMPOSITE_FRAG_WGSL = /* wgsl */ `
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var srcSampler: sampler;
@group(0) @binding(2) var<uniform> tint: vec4f;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return textureSample(src, srcSampler, uv) * tint;
}
`;

const TRAIL_MESH_VERT_WGSL = /* wgsl */ `
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

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.edge_t = input.edge_t;
  out.alpha = input.alpha;
  let zClip = input.z * 2.0 - 1.0;
  out.position = vec4f(input.position, zClip, 1.0);
  return out;
}
`;

const TRAIL_MESH_FRAG_WGSL = /* wgsl */ `
@group(0) @binding(0) var<uniform> params: TrailMeshParams;

struct TrailMeshParams {
  color: vec4f,
  aaWidth: f32,
};

struct FragInput {
  @location(0) edge_t: f32,
  @location(1) alpha: f32,
};

@fragment
fn main(input: FragInput) -> @location(0) vec4f {
  let edge = smoothstep(1.0, 1.0 - params.aaWidth, abs(input.edge_t));
  let a = input.alpha * edge;
  return params.color * a;
}
`;

const GAUSSIAN_BLUR_FRAG_WGSL = /* wgsl */ `
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var srcSampler: sampler;
@group(0) @binding(2) var<uniform> params: BlurParams;

struct BlurParams {
  direction: vec2f,
  texelSize: vec2f,
};

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let offsets = array<f32, 4>(1.3846153846, 3.2307692308, 5.0769230769, 6.9230769231);
  let weights = array<f32, 4>(0.2270270270, 0.3162162162, 0.0702702703, 0.0031311312);

  var result = textureSample(src, srcSampler, uv) * 0.2270270270;
  let step = params.direction * params.texelSize;
  for (var i = 0u; i < 4u; i = i + 1u) {
    let offset = step * offsets[i];
    result += textureSample(src, srcSampler, uv + offset) * weights[i];
    result += textureSample(src, srcSampler, uv - offset) * weights[i];
  }
  return result;
}
`;

const TRAIL_COMPOSITE_FRAG_WGSL = /* wgsl */ `
@group(0) @binding(0) var accumTex: texture_2d<f32>;
@group(0) @binding(1) var blurTex: texture_2d<f32>;
@group(0) @binding(2) var texSampler: sampler;
@group(0) @binding(3) var<uniform> params: TrailCompositeParams;

struct TrailCompositeParams {
  glowMix: f32,
};

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let accum = textureSample(accumTex, texSampler, uv);
  let blur = textureSample(blurTex, texSampler, uv);
  return accum + blur * params.glowMix;
}
`;

// ─── Types ──────────────────────────────────────────────────────────

interface GPUTextureEntry {
  texture: GPUTexture;
  view: GPUTextureView;
  width: number;
  height: number;
}

interface PingPongPair {
  read: GPUTextureEntry;
  write: GPUTextureEntry;
}

interface TipLiveness {
  lastSeenFrame: number;
}

interface CompiledPipeline {
  pipeline: GPURenderPipeline;
  bindGroupLayout: GPUBindGroupLayout;
}

// ─── Backend ────────────────────────────────────────────────────────

export class WebGPUBackend implements RenderBackend {
  readonly kind = "webgpu" as const;

  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private presentFormat: GPUTextureFormat = "bgra8unorm";
  private linearSampler: GPUSampler | null = null;

  private pipelines = new Map<string, CompiledPipeline>();
  private textures = new Map<string, GPUTextureEntry>();
  private pingPongs = new Map<string, PingPongPair>();
  private tipLiveness = new Map<string, TipLiveness>();
  private unsupportedKindsWarned = new Set<RenderPassKind>();

  private meshBuffer: GPUBuffer | null = null;
  private meshBufferSize = 0;

  private fireExecutor: WebGPUFireExecutor | null = null;
  private ledExecutor: WebGPULedExecutor | null = null;
  private overlayExecutor: WebGPUOverlayEffectsExecutor | null = null;
  private particleExecutor: WebGPUParticleExecutor | null = null;

  private previousTime = -1;
  private frameCount = 0;
  private lastFrameMs = 0;
  private longestPassMs = 0;

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    if (this.device) return;

    if (!navigator.gpu) {
      throw new Error("WebGPUBackend: WebGPU not available");
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance",
    });
    if (!adapter) {
      throw new Error("WebGPUBackend: no adapter available");
    }

    const device = await adapter.requestDevice({
      requiredFeatures: [],
      requiredLimits: {},
    });

    const ctx = canvas.getContext("webgpu");
    if (!ctx) {
      throw new Error("WebGPUBackend: failed to get webgpu context");
    }

    this.presentFormat = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({
      device,
      format: this.presentFormat,
      alphaMode: "premultiplied",
    });

    this.device = device;
    this.context = ctx;
    this.canvas = canvas;

    this.linearSampler = device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });

    this.compilePipelines();
    this.allocateScratchTextures(canvas.width, canvas.height);
  }

  executeFrame(graph: FrameGraph, time: number): void {
    if (!this.device || !this.context) {
      throw new Error("WebGPUBackend: executeFrame before initialize");
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
    if (!this.device || !this.canvas || !this.context) return;
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    this.canvas.width = w;
    this.canvas.height = h;
    this.context.configure({
      device: this.device,
      format: this.presentFormat,
      alphaMode: "premultiplied",
    });
    this.allocateScratchTextures(w, h);
  }

  dispose(): void {
    if (!this.device) return;
    this.textures.forEach((t) => t.texture.destroy());
    this.textures.clear();
    this.pingPongs.forEach((pp) => {
      pp.read.texture.destroy();
      pp.write.texture.destroy();
    });
    this.pingPongs.clear();
    this.meshBuffer?.destroy();
    this.meshBuffer = null;
    this.fireExecutor?.dispose();
    this.fireExecutor = null;
    this.ledExecutor?.dispose();
    this.ledExecutor = null;
    this.overlayExecutor?.dispose();
    this.overlayExecutor = null;
    this.particleExecutor?.dispose();
    this.particleExecutor = null;
    this.device.destroy();
    this.device = null;
    this.context = null;
  }

  getStats(): BackendStats {
    return {
      lastFrameMs: this.lastFrameMs,
      longestPassMs: this.longestPassMs,
      fboCount: this.textures.size + this.pingPongs.size * 2,
    };
  }

  // ─── Private ────────────────────────────────────────────────────

  private computeDt(time: number): number {
    if (this.previousTime < 0) {
      this.previousTime = time;
      return 0;
    }
    const dt = Math.min((time - this.previousTime) / 1000, DT_CLAMP_SECONDS);
    this.previousTime = time;
    return dt;
  }

  private dispatch(pass: RenderPassDescriptor, dt: number): void {
    switch (pass.kind) {
      case "trail":
        this.executeTrailPass(pass.payload as TrailPassPayload, dt);
        return;
      case "fire":
        this.executeFirePass(pass.payload as FirePassPayload, dt);
        return;
      case "led":
        this.executeLedPass(pass.payload as LedPassPayload, dt);
        return;
      case "water":
      case "bubbles":
      case "petals":
      case "smoke":
      case "charcoal":
      case "sparkles":
        this.executeParticlePass(
          pass.kind,
          pass.payload as ParticlePassPayload,
          dt,
        );
        return;
      case "echo":
        this.executeEchoPass(pass.payload as EchoPassPayload, dt);
        return;
      case "bloom":
        this.executeBloomPass(pass.payload as BloomPassPayload, dt);
        return;
      case "zap":
        this.executeZapPass(pass.payload as ZapPassPayload, dt);
        return;
      case "pulse":
        this.executePulsePass(pass.payload as PulsePassPayload, dt);
        return;
      case "ink":
        this.executeInkPass(pass.payload as InkPassPayload, dt);
        return;
      case "frost":
        this.executeFrostPass(pass.payload as FrostPassPayload, dt);
        return;
      case "silk":
        this.executeSilkPass(pass.payload as SilkPassPayload, dt);
        return;
      case "composite":
        return;
      default:
        this.warnUnsupportedOnce(pass.kind);
        return;
    }
  }

  // ─── Trail Pass ─────────────────────────────────────────────────

  private executeTrailPass(payload: TrailPassPayload, dt: number): void {
    const canvas = this.canvas!;
    const w = canvas.width;
    const h = canvas.height;

    for (const tip of payload.tips) {
      if (tip.path.length < 2) continue;

      const tipKey = TRAIL_KEY_PREFIX + tip.tipId;
      this.tipLiveness.set(tipKey, { lastSeenFrame: this.frameCount });

      const pp = this.ensurePingPong(tipKey, w, h);

      // 1. Decay: read → write with multiplicative fade
      this.runDecayPass(pp, tip.decayPerSecond, dt);

      // 2. Stamp: draw trail mesh into scratch texture
      this.runTrailStampPass(tip, w, h);

      // 3. Blur (if glow > 0)
      if (tip.glow > 0) {
        this.runBlurPass(tip.glow, w, h);
      }

      // 4. Composite stamp + blur onto accumulator
      this.runTrailCompositePass(pp, tip.glow > 0);

      // 5. Display: composite accumulator to screen
      this.runDisplayPass(pp, tip.blendMode);
    }
  }

  private runDecayPass(pp: PingPongPair, decayPerSecond: number, dt: number): void {
    const device = this.device!;
    const factor = Math.exp(-decayPerSecond * dt);
    const pipeline = this.pipelines.get("decay");
    if (!pipeline) return;

    const uniformBuf = device.createBuffer({
      size: 8,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      uniformBuf,
      0,
      new Float32Array([factor, ALPHA_SUBTRACT]),
    );

    const bindGroup = device.createBindGroup({
      layout: pipeline.bindGroupLayout,
      entries: [
        { binding: 0, resource: pp.read.view },
        { binding: 1, resource: this.linearSampler! },
        { binding: 2, resource: { buffer: uniformBuf } },
      ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: pp.write.view,
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    });
    pass.setPipeline(pipeline.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);
    uniformBuf.destroy();

    // Swap ping-pong
    const tmp = pp.read;
    pp.read = pp.write;
    pp.write = tmp;
  }

  private runTrailStampPass(
    tip: TrailTipState,
    w: number,
    h: number,
  ): void {
    const device = this.device!;
    const pipeline = this.pipelines.get("trail-mesh");
    if (!pipeline) return;

    const stamp = this.ensureTexture("stamp", w, h);

    const controlPoints: Point2D[] = tip.path.map(([x, y]) => ({ x, y }));
    const subdivs = adaptiveSubdivisions(controlPoints.length);

    const smoothPath = createSmoothCurve(controlPoints, {
      subdivisionsPerSegment: subdivs,
    });
    if (smoothPath.length < 2) return;

    const meshOpts: MeshBuildOptions = {
      thickness: tip.thickness,
      taperTailRatio: tip.taperTailRatio,
      maxAlpha: tip.color[3],
      fadeExponent: tip.fadeExponent,
    };
    const mesh = buildTaperedMesh(smoothPath, meshOpts);
    if (mesh.vertexCount === 0) return;

    this.ensureMeshBuffer(mesh.vertices.byteLength);
    device.queue.writeBuffer(
      this.meshBuffer!,
      0,
      mesh.vertices.buffer,
      mesh.vertices.byteOffset,
      mesh.vertices.byteLength,
    );

    const [r, g, b, a] = tip.color;
    const uniformBuf = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      uniformBuf,
      0,
      new Float32Array([r, g, b, a, AA_WIDTH, 0, 0, 0]),
    );

    const bindGroup = device.createBindGroup({
      layout: pipeline.bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: uniformBuf } }],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: stamp.view,
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    });
    pass.setPipeline(pipeline.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, this.meshBuffer!);
    pass.draw(mesh.vertexCount);
    pass.end();
    device.queue.submit([encoder.finish()]);
    uniformBuf.destroy();
  }

  private runBlurPass(radius: number, w: number, h: number): void {
    const device = this.device!;
    const pipeline = this.pipelines.get("gaussian-blur");
    if (!pipeline) return;

    const halfW = Math.max(1, Math.floor(w / BLOOM_DOWNSAMPLE));
    const halfH = Math.max(1, Math.floor(h / BLOOM_DOWNSAMPLE));
    const blurTemp = this.ensureTexture("blur-temp", halfW, halfH);
    const blurResult = this.ensureTexture("blur-result", halfW, halfH);
    const stamp = this.textures.get("stamp");
    if (!stamp) return;

    const effectiveSigma = radius * 0.5;
    const passes = Math.min(
      Math.ceil(effectiveSigma / SIGMA_PER_PASS),
      MAX_BLUR_ITERATIONS,
    );

    let readTex = stamp;
    let writeTex = blurTemp;

    for (let i = 0; i < passes * 2; i++) {
      const horizontal = i % 2 === 0;
      const tw = horizontal ? 1.0 / readTex.width : 0;
      const th = horizontal ? 0 : 1.0 / readTex.height;

      const uniformBuf = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(
        uniformBuf,
        0,
        new Float32Array([
          horizontal ? 1 : 0,
          horizontal ? 0 : 1,
          tw || 1.0 / readTex.width,
          th || 1.0 / readTex.height,
        ]),
      );

      const bindGroup = device.createBindGroup({
        layout: pipeline.bindGroupLayout,
        entries: [
          { binding: 0, resource: readTex.view },
          { binding: 1, resource: this.linearSampler! },
          { binding: 2, resource: { buffer: uniformBuf } },
        ],
      });

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: writeTex.view,
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
          },
        ],
      });
      pass.setPipeline(pipeline.pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
      uniformBuf.destroy();

      // Alternate read/write between temp and result
      const swap = readTex;
      readTex = writeTex;
      writeTex = i === 0 ? blurResult : swap;
    }
  }

  private runTrailCompositePass(
    pp: PingPongPair,
    hasBlur: boolean,
  ): void {
    // Composite stamp (+ optional blur) onto the accumulator
    // For now, use a simple additive blit of the stamp onto pp.write
    const device = this.device!;
    const pipeline = this.pipelines.get("composite");
    if (!pipeline) return;

    const stamp = this.textures.get("stamp");
    if (!stamp) return;

    const uniformBuf = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uniformBuf, 0, new Float32Array([1, 1, 1, 1]));

    const bindGroup = device.createBindGroup({
      layout: pipeline.bindGroupLayout,
      entries: [
        { binding: 0, resource: stamp.view },
        { binding: 1, resource: this.linearSampler! },
        { binding: 2, resource: { buffer: uniformBuf } },
      ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: pp.read.view,
          loadOp: "load",
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(pipeline.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);
    uniformBuf.destroy();
  }

  private runDisplayPass(
    pp: PingPongPair,
    _blendMode: string,
  ): void {
    const device = this.device!;
    const ctx = this.context!;
    const pipeline = this.pipelines.get("composite");
    if (!pipeline) return;

    const uniformBuf = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uniformBuf, 0, new Float32Array([1, 1, 1, 1]));

    const bindGroup = device.createBindGroup({
      layout: pipeline.bindGroupLayout,
      entries: [
        { binding: 0, resource: pp.read.view },
        { binding: 1, resource: this.linearSampler! },
        { binding: 2, resource: { buffer: uniformBuf } },
      ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: ctx.getCurrentTexture().createView(),
          loadOp: "load",
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(pipeline.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);
    uniformBuf.destroy();
  }

  // ─── Effect Stubs (implemented in follow-up commits) ────────────

  private executeFirePass(payload: FirePassPayload, dt: number): void {
    if (!this.fireExecutor) {
      this.fireExecutor = new WebGPUFireExecutor(this.device!, this.linearSampler!);
    }
    const canvas = this.canvas!;
    const presentView = this.context!.getCurrentTexture().createView();
    this.fireExecutor.execute(payload, dt, presentView, canvas.width, canvas.height);
  }

  private executeLedPass(payload: LedPassPayload, dt: number): void {
    if (!this.ledExecutor) {
      this.ledExecutor = new WebGPULedExecutor(this.device!, this.linearSampler!);
    }
    const canvas = this.canvas!;
    const presentView = this.context!.getCurrentTexture().createView();
    this.ledExecutor.execute(payload, dt, presentView, canvas.width, canvas.height);
  }

  private executeParticlePass(
    kind: RenderPassKind,
    payload: ParticlePassPayload,
    dt: number,
  ): void {
    if (!this.particleExecutor) {
      this.particleExecutor = new WebGPUParticleExecutor(this.device!);
    }
    const canvas = this.canvas!;
    const presentView = this.context!.getCurrentTexture().createView();
    this.particleExecutor.execute(kind, payload, dt, presentView, canvas.width, canvas.height);
  }

  private getOverlay(): WebGPUOverlayEffectsExecutor {
    if (!this.overlayExecutor) {
      this.overlayExecutor = new WebGPUOverlayEffectsExecutor(this.device!, this.linearSampler!);
    }
    return this.overlayExecutor;
  }

  private executeEchoPass(payload: EchoPassPayload, _dt: number): void {
    const presentView = this.context!.getCurrentTexture().createView();
    this.getOverlay().executeEcho(payload, presentView);
  }

  private executeBloomPass(payload: BloomPassPayload, _dt: number): void {
    const presentView = this.context!.getCurrentTexture().createView();
    this.getOverlay().executeBloom(payload, presentView);
  }

  private executeZapPass(payload: ZapPassPayload, _dt: number): void {
    const presentView = this.context!.getCurrentTexture().createView();
    this.getOverlay().executeZap(payload, presentView);
  }

  private executePulsePass(payload: PulsePassPayload, _dt: number): void {
    const presentView = this.context!.getCurrentTexture().createView();
    this.getOverlay().executePulse(payload, presentView);
  }

  private executeInkPass(payload: InkPassPayload, dt: number): void {
    const canvas = this.canvas!;
    const presentView = this.context!.getCurrentTexture().createView();
    this.getOverlay().executeInk(payload, dt, presentView, canvas.width, canvas.height);
  }

  private executeFrostPass(payload: FrostPassPayload, dt: number): void {
    const canvas = this.canvas!;
    const presentView = this.context!.getCurrentTexture().createView();
    this.getOverlay().executeFrost(payload, dt, presentView, canvas.width, canvas.height);
  }

  private executeSilkPass(payload: SilkPassPayload, dt: number): void {
    const canvas = this.canvas!;
    const presentView = this.context!.getCurrentTexture().createView();
    this.getOverlay().executeSilk(payload, dt, presentView, canvas.width, canvas.height);
  }

  // ─── Pipeline Compilation ───────────────────────────────────────

  private compilePipelines(): void {
    const device = this.device!;

    this.compileFullscreenPipeline(
      "decay",
      FULLSCREEN_VERT_WGSL,
      DECAY_FRAG_WGSL,
      [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    );

    this.compileFullscreenPipeline(
      "composite",
      FULLSCREEN_VERT_WGSL,
      COMPOSITE_FRAG_WGSL,
      [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    );

    this.compileFullscreenPipeline(
      "gaussian-blur",
      FULLSCREEN_VERT_WGSL,
      GAUSSIAN_BLUR_FRAG_WGSL,
      [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    );

    this.compileTrailMeshPipeline();
  }

  private compileFullscreenPipeline(
    name: string,
    vertWGSL: string,
    fragWGSL: string,
    layoutEntries: GPUBindGroupLayoutEntry[],
  ): void {
    const device = this.device!;

    const vertModule = device.createShaderModule({ code: vertWGSL });
    const fragModule = device.createShaderModule({ code: fragWGSL });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: layoutEntries,
    });
    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    const pipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module: vertModule, entryPoint: "main" },
      fragment: {
        module: fragModule,
        entryPoint: "main",
        targets: [
          {
            format: "rgba8unorm",
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

    this.pipelines.set(name, { pipeline, bindGroupLayout });
  }

  private compileTrailMeshPipeline(): void {
    const device = this.device!;

    const vertModule = device.createShaderModule({
      code: TRAIL_MESH_VERT_WGSL,
    });
    const fragModule = device.createShaderModule({
      code: TRAIL_MESH_FRAG_WGSL,
    });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });
    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    const stride = TRAIL_VERTEX_STRIDE * Float32Array.BYTES_PER_ELEMENT;
    const pipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: vertModule,
        entryPoint: "main",
        buffers: [
          {
            arrayStride: stride,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" },
              {
                shaderLocation: 1,
                offset: 2 * Float32Array.BYTES_PER_ELEMENT,
                format: "float32",
              },
              {
                shaderLocation: 2,
                offset: 3 * Float32Array.BYTES_PER_ELEMENT,
                format: "float32",
              },
              {
                shaderLocation: 3,
                offset: 4 * Float32Array.BYTES_PER_ELEMENT,
                format: "float32",
              },
            ],
          },
        ],
      },
      fragment: {
        module: fragModule,
        entryPoint: "main",
        targets: [
          {
            format: "rgba8unorm",
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

    this.pipelines.set("trail-mesh", { pipeline, bindGroupLayout });
  }

  // ─── Texture Management ─────────────────────────────────────────

  private allocateScratchTextures(w: number, h: number): void {
    const halfW = Math.max(1, Math.floor(w / BLOOM_DOWNSAMPLE));
    const halfH = Math.max(1, Math.floor(h / BLOOM_DOWNSAMPLE));
    this.ensureTexture("stamp", w, h);
    this.ensureTexture("blur-temp", halfW, halfH);
    this.ensureTexture("blur-result", halfW, halfH);
  }

  private ensureTexture(
    key: string,
    width: number,
    height: number,
  ): GPUTextureEntry {
    const existing = this.textures.get(key);
    if (existing && existing.width === width && existing.height === height) {
      return existing;
    }
    existing?.texture.destroy();

    const device = this.device!;
    const texture = device.createTexture({
      size: { width, height },
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_SRC,
    });
    const view = texture.createView();
    const entry: GPUTextureEntry = { texture, view, width, height };
    this.textures.set(key, entry);
    return entry;
  }

  private ensurePingPong(
    key: string,
    width: number,
    height: number,
  ): PingPongPair {
    const existing = this.pingPongs.get(key);
    if (
      existing &&
      existing.read.width === width &&
      existing.read.height === height
    ) {
      return existing;
    }
    existing?.read.texture.destroy();
    existing?.write.texture.destroy();

    const make = (): GPUTextureEntry => {
      const device = this.device!;
      const texture = device.createTexture({
        size: { width, height },
        format: "rgba8unorm",
        usage:
          GPUTextureUsage.RENDER_ATTACHMENT |
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_SRC,
      });
      return { texture, view: texture.createView(), width, height };
    };

    const pair: PingPongPair = { read: make(), write: make() };
    this.pingPongs.set(key, pair);
    return pair;
  }

  private ensureMeshBuffer(byteLength: number): void {
    if (this.meshBuffer && this.meshBufferSize >= byteLength) return;
    this.meshBuffer?.destroy();
    const size = Math.max(byteLength, 4096);
    this.meshBuffer = this.device!.createBuffer({
      size,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.meshBufferSize = size;
  }

  // ─── Utilities ──────────────────────────────────────────────────

  private garbageCollectTips(): void {
    const cutoff = this.frameCount - MAX_UNUSED_FRAMES_BEFORE_GC;
    for (const [key, liveness] of this.tipLiveness) {
      if (liveness.lastSeenFrame < cutoff) {
        const pp = this.pingPongs.get(key);
        if (pp) {
          pp.read.texture.destroy();
          pp.write.texture.destroy();
          this.pingPongs.delete(key);
        }
        this.tipLiveness.delete(key);
      }
    }
  }

  private warnUnsupportedOnce(kind: RenderPassKind): void {
    if (this.unsupportedKindsWarned.has(kind)) return;
    this.unsupportedKindsWarned.add(kind);
    console.warn(`[WebGPUBackend] unsupported pass kind: ${kind}`);
  }
}
