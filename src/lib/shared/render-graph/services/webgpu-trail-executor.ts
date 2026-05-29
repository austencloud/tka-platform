import type { TrailPassPayload, TrailTipState } from "../domain/trail-pass";
import {
  adaptiveSubdivisions,
  buildTaperedMesh,
  createSmoothCurve,
  type Point2D,
  type MeshBuildOptions,
} from "../math/trail-mesh";

const TRAIL_KEY_PREFIX = "trail-tip-";
const AA_WIDTH = 0.05;
const BLOOM_DOWNSAMPLE = 2;
const SIGMA_PER_PASS = 2.0;
const MAX_BLUR_ITERATIONS = 8;
const ALPHA_SUBTRACT = 1.0 / 255.0;
const MAX_UNUSED_FRAMES_BEFORE_GC = 30;

export interface GPUTextureEntry {
  texture: GPUTexture;
  view: GPUTextureView;
  width: number;
  height: number;
}

export interface PingPongPair {
  read: GPUTextureEntry;
  write: GPUTextureEntry;
}

interface TipLiveness {
  lastSeenFrame: number;
}

export interface CompiledPipeline {
  pipeline: GPURenderPipeline;
  bindGroupLayout: GPUBindGroupLayout;
}

export class WebGPUTrailExecutor {
  private tipLiveness = new Map<string, TipLiveness>();

  constructor(
    private device: GPUDevice,
    private linearSampler: GPUSampler,
    private pipelines: Map<string, CompiledPipeline>,
    private textures: Map<string, GPUTextureEntry>,
    private pingPongs: Map<string, PingPongPair>,
    private getMeshBuffer: () => GPUBuffer | null,
    private ensureMeshBuffer: (byteLength: number) => void,
    private ensureTexture: (key: string, width: number, height: number) => GPUTextureEntry,
    private ensurePingPong: (key: string, width: number, height: number) => PingPongPair,
    private getContext: () => GPUCanvasContext,
  ) {}

  execute(payload: TrailPassPayload, dt: number, canvasWidth: number, canvasHeight: number, frameCount: number): void {
    for (const tip of payload.tips) {
      if (tip.path.length < 2) continue;

      const tipKey = TRAIL_KEY_PREFIX + tip.tipId;
      this.tipLiveness.set(tipKey, { lastSeenFrame: frameCount });

      const pp = this.ensurePingPong(tipKey, canvasWidth, canvasHeight);

      this.runDecayPass(pp, tip.decayPerSecond, dt);
      this.runTrailStampPass(tip, canvasWidth, canvasHeight);

      if (tip.glow > 0) {
        this.runBlurPass(tip.glow, canvasWidth, canvasHeight);
      }

      this.runTrailCompositePass(pp, tip.glow > 0);
      this.runDisplayPass(pp, tip.blendMode);
    }
  }

  garbageCollect(frameCount: number): void {
    const cutoff = frameCount - MAX_UNUSED_FRAMES_BEFORE_GC;
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

  private runDecayPass(pp: PingPongPair, decayPerSecond: number, dt: number): void {
    const device = this.device;
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
        { binding: 1, resource: this.linearSampler },
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

    const tmp = pp.read;
    pp.read = pp.write;
    pp.write = tmp;
  }

  private runTrailStampPass(tip: TrailTipState, w: number, h: number): void {
    const device = this.device;
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
      this.getMeshBuffer()!,
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
    pass.setVertexBuffer(0, this.getMeshBuffer()!);
    pass.draw(mesh.vertexCount);
    pass.end();
    device.queue.submit([encoder.finish()]);
    uniformBuf.destroy();
  }

  private runBlurPass(radius: number, w: number, h: number): void {
    const device = this.device;
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
          { binding: 1, resource: this.linearSampler },
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

      const swap = readTex;
      readTex = writeTex;
      writeTex = i === 0 ? blurResult : swap;
    }
  }

  private runTrailCompositePass(pp: PingPongPair, _hasBlur: boolean): void {
    const device = this.device;
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
        { binding: 1, resource: this.linearSampler },
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

  private runDisplayPass(pp: PingPongPair, _blendMode: string): void {
    const device = this.device;
    const ctx = this.getContext();
    const pipeline = this.pipelines.get("display");
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
        { binding: 1, resource: this.linearSampler },
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
}
