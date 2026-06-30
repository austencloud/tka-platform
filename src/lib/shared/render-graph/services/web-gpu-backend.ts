import type { RenderBackend, BackendStats } from "../domain/backend";
import type { FrameGraph } from "../domain/frame-graph";
import type {
  RenderPassDescriptor,
  RenderPassKind,
} from "../domain/render-pass";
import type { TrailPassPayload } from "../domain/trail-pass";
import type { FirePassPayload } from "../domain/fire-pass";
import type { LedPassPayload } from "../domain/led-pass";
import type { ParticlePassPayload } from "../domain/particle-pass";
import type {
  GhostPassPayload,
  BloomPassPayload,
  ZapPassPayload,
  PulsePassPayload,
  InkPassPayload,
  FrostPassPayload,
  SilkPassPayload,
} from "../domain/effect-passes";
import { TRAIL_VERTEX_STRIDE } from "../math/trail-mesh";
import { WebGPUFireExecutor } from "./web-gpu-fire-executor";
import { WebGPULedExecutor } from "./web-gpu-led-executor";
import { WebGPUOverlayEffectsExecutor } from "./web-gpu-overlay-effects-executor";
import { WebGPUParticleExecutor } from "./web-gpu-particle-executor";
import {
  WebGPUTrailExecutor,
  type GPUTextureEntry,
  type PingPongPair,
  type CompiledPipeline,
} from "./webgpu-trail-executor";
import {
  FULLSCREEN_VERT_WGSL,
  DECAY_FRAG_WGSL,
  COMPOSITE_FRAG_WGSL,
  TRAIL_MESH_VERT_WGSL,
  TRAIL_MESH_FRAG_WGSL,
  GAUSSIAN_BLUR_FRAG_WGSL,
} from "./webgpu-backend-shaders";

const DT_CLAMP_SECONDS = 0.1;
const BLOOM_DOWNSAMPLE = 2;

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
  private unsupportedKindsWarned = new Set<RenderPassKind>();

  private meshBuffer: GPUBuffer | null = null;
  private meshBufferSize = 0;

  private trailExecutor: WebGPUTrailExecutor | null = null;
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

    this.trailExecutor = new WebGPUTrailExecutor(
      device,
      this.linearSampler,
      this.pipelines,
      this.textures,
      this.pingPongs,
      () => this.meshBuffer,
      (byteLength) => this.ensureMeshBuffer(byteLength),
      (key, w, h) => this.ensureTexture(key, w, h),
      (key, w, h) => this.ensurePingPong(key, w, h),
      () => this.context!,
    );
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

    this.trailExecutor!.garbageCollect(this.frameCount);
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

  clearScreen(): void {
    if (!this.device || !this.context) return;
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.end();
    this.device.queue.submit([encoder.finish()]);
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
    this.trailExecutor = null;
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
        this.trailExecutor!.execute(
          pass.payload as TrailPassPayload,
          dt,
          this.canvas!.width,
          this.canvas!.height,
          this.frameCount,
        );
        return;
      case "fire":
        this.executeFirePass(pass.payload as FirePassPayload, dt);
        return;
      case "led":
        this.executeLedPass(pass.payload as LedPassPayload, dt);
        return;
      case "goo":
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
      case "ghost":
        this.executeGhostPass(pass.payload as GhostPassPayload, dt);
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

  // ─── Effect Executors ───────────────────────────────────────────

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

  private executeGhostPass(payload: GhostPassPayload, _dt: number): void {
    const presentView = this.context!.getCurrentTexture().createView();
    this.getOverlay().executeGhost(payload, presentView);
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

    this.compileFullscreenPipeline(
      "display",
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
      this.presentFormat,
    );

    this.compileTrailMeshPipeline();
  }

  private compileFullscreenPipeline(
    name: string,
    vertWGSL: string,
    fragWGSL: string,
    layoutEntries: GPUBindGroupLayoutEntry[],
    format: GPUTextureFormat = "rgba8unorm",
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
            format,
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
    if (existing?.width === width && existing.height === height) {
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
      existing?.read.width === width &&
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

  private warnUnsupportedOnce(kind: RenderPassKind): void {
    if (this.unsupportedKindsWarned.has(kind)) return;
    this.unsupportedKindsWarned.add(kind);
    console.warn(`[WebGPUBackend] unsupported pass kind: ${kind}`);
  }
}
