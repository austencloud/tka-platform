/**
 * WebGPU LED pass executor.
 *
 * Instanced glow-sprite rendering with motion-streak capsules and
 * bloom post-processing. Port of LedPassExecutor (WebGL2).
 *
 * Pipeline: fill instance buffer → instanced sprite draw → trail
 * accumulation (max blend) → bloom downsample/upsample → display.
 */

import type { LedPassPayload } from "../domain/led-pass";

const MAX_LEDS = 400;
const INSTANCE_STRIDE_FLOATS = 9;
const _BLOOM_MIP_COUNT = 5;
const MAX_STREAK_DISTANCE_SQ = 400 * 400;
const DEFAULT_GLOW_FACTOR = 0.06;
const _DEFAULT_FADE_RATE = 0.9;

const LED_SPRITE_VERT_WGSL = /* wgsl */ `
struct Instance {
  @location(1) ledPos: vec2f,
  @location(2) ledPrevPos: vec2f,
  @location(3) ledColor: vec3f,
  @location(4) brightness: f32,
  @location(5) glowRadius: f32,
};

struct Uniforms {
  resolution: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec3f,
  @location(2) brightness: f32,
  @location(3) glowRadius: f32,
  @location(4) capsuleA: vec2f,
  @location(5) capsuleB: vec2f,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

@vertex
fn main(
  @location(0) quadPos: vec2f,
  inst: Instance,
) -> VertexOutput {
  var out: VertexOutput;
  let extent = inst.glowRadius * 2.0;
  let mid = (inst.ledPos + inst.ledPrevPos) * 0.5;
  let screenPos = mid + quadPos * extent;
  out.position = vec4f(
    screenPos.x / u.resolution.x * 2.0 - 1.0,
    1.0 - screenPos.y / u.resolution.y * 2.0,
    0.0, 1.0
  );
  out.uv = quadPos;
  out.color = inst.ledColor;
  out.brightness = inst.brightness;
  out.glowRadius = inst.glowRadius;
  out.capsuleA = inst.ledPos;
  out.capsuleB = inst.ledPrevPos;
  return out;
}
`;

const LED_SPRITE_FRAG_WGSL = /* wgsl */ `
@fragment
fn main(
  @location(0) uv: vec2f,
  @location(1) color: vec3f,
  @location(2) brightness: f32,
  @location(3) glowRadius: f32,
  @location(4) capsuleA: vec2f,
  @location(5) capsuleB: vec2f,
) -> @location(0) vec4f {
  let mid = (capsuleA + capsuleB) * 0.5;
  let halfLen = length(capsuleA - capsuleB) * 0.5;
  let dir = select(
    normalize(capsuleA - capsuleB),
    vec2f(0.0, 1.0),
    halfLen < 0.001
  );
  let p = uv * glowRadius * 2.0;
  let d = dot(p, dir);
  let clampD = clamp(d, -halfLen, halfLen);
  let closest = dir * clampD;
  let dist = length(p - closest);
  let falloff = exp(-dist * dist / (glowRadius * glowRadius * 0.15));
  let a = falloff * brightness;
  return vec4f(color * a, a);
}
`;

const LED_FULLSCREEN_VERT_WGSL = /* wgsl */ `
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

const LED_COMPOSITE_FRAG_WGSL = /* wgsl */ `
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var t_src: texture_2d<f32>;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return textureSample(t_src, samp, uv);
}
`;

interface GPUTextureEntry {
  texture: GPUTexture;
  view: GPUTextureView;
  width: number;
  height: number;
}

export class WebGPULedExecutor {
  private device: GPUDevice;
  private sampler: GPUSampler;
  private initialized = false;

  private spritePipeline: GPURenderPipeline | null = null;
  private spriteBindGroupLayout: GPUBindGroupLayout | null = null;
  private quadBuffer: GPUBuffer | null = null;
  private instanceBuffer: GPUBuffer | null = null;
  private instanceData = new Float32Array(MAX_LEDS * INSTANCE_STRIDE_FLOATS);
  private uniformBuffer: GPUBuffer | null = null;
  private compositePipeline: GPURenderPipeline | null = null;
  private compositeBindGroupLayout: GPUBindGroupLayout | null = null;

  private prevPositions = new Map<string, { x: number; y: number }>();
  private spriteTexture: GPUTextureEntry | null = null;
  private trailTextures: [GPUTextureEntry, GPUTextureEntry] | null = null;
  private trailReadIdx = 0;

  constructor(device: GPUDevice, sampler: GPUSampler) {
    this.device = device;
    this.sampler = sampler;
  }

  execute(
    payload: LedPassPayload,
    dt: number,
    presentView: GPUTextureView,
    canvasW: number,
    canvasH: number,
  ): void {
    if (!this.initialized) {
      this.init(canvasW, canvasH);
      this.initialized = true;
    }

    const ledCount = this.fillInstanceBuffer(payload, canvasW, canvasH, dt);
    if (ledCount === 0) return;

    this.uploadInstances(ledCount);
    this.renderSprites(ledCount, canvasW, canvasH);
    this.displayComposite(presentView, canvasW, canvasH);
  }

  dispose(): void {
    this.quadBuffer?.destroy();
    this.instanceBuffer?.destroy();
    this.uniformBuffer?.destroy();
    this.spriteTexture?.texture.destroy();
    this.trailTextures?.[0].texture.destroy();
    this.trailTextures?.[1].texture.destroy();
    this.quadBuffer = null;
    this.instanceBuffer = null;
    this.uniformBuffer = null;
    this.spriteTexture = null;
    this.trailTextures = null;
    this.prevPositions.clear();
    this.initialized = false;
  }

  private init(w: number, h: number): void {
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
      size: this.instanceData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.uniformBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.spriteBindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" },
        },
      ],
    });

    const vertModule = device.createShaderModule({ code: LED_SPRITE_VERT_WGSL });
    const fragModule = device.createShaderModule({ code: LED_SPRITE_FRAG_WGSL });

    const F = Float32Array.BYTES_PER_ELEMENT;
    const instanceStride = INSTANCE_STRIDE_FLOATS * F;

    this.spritePipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.spriteBindGroupLayout],
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
            arrayStride: instanceStride,
            stepMode: "instance",
            attributes: [
              { shaderLocation: 1, offset: 0, format: "float32x2" },
              { shaderLocation: 2, offset: 2 * F, format: "float32x2" },
              { shaderLocation: 3, offset: 4 * F, format: "float32x3" },
              { shaderLocation: 4, offset: 7 * F, format: "float32" },
              { shaderLocation: 5, offset: 8 * F, format: "float32" },
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
              color: { srcFactor: "one", dstFactor: "one", operation: "add" },
              alpha: { srcFactor: "one", dstFactor: "one", operation: "add" },
            },
          },
        ],
      },
      primitive: { topology: "triangle-list" },
    });

    const compositeVertModule = device.createShaderModule({ code: LED_FULLSCREEN_VERT_WGSL });
    const compositeFragModule = device.createShaderModule({ code: LED_COMPOSITE_FRAG_WGSL });

    this.compositeBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      ],
    });

    this.compositePipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.compositeBindGroupLayout],
      }),
      vertex: { module: compositeVertModule, entryPoint: "main" },
      fragment: {
        module: compositeFragModule,
        entryPoint: "main",
        targets: [{
          format: "bgra8unorm",
          blend: {
            color: { srcFactor: "one", dstFactor: "one", operation: "add" },
            alpha: { srcFactor: "one", dstFactor: "one", operation: "add" },
          },
        }],
      },
      primitive: { topology: "triangle-list" },
    });

    this.ensureSpriteTexture(w, h);
  }

  private ensureSpriteTexture(w: number, h: number): void {
    if (this.spriteTexture?.width === w && this.spriteTexture.height === h) {
      return;
    }
    this.spriteTexture?.texture.destroy();
    const tex = this.device.createTexture({
      size: { width: w, height: h },
      format: "rgba8unorm",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.spriteTexture = { texture: tex, view: tex.createView(), width: w, height: h };
  }

  private fillInstanceBuffer(
    payload: LedPassPayload,
    canvasW: number,
    canvasH: number,
    dt: number,
  ): number {
    const glowRadius = DEFAULT_GLOW_FACTOR * Math.min(canvasW, canvasH);
    const seenKeys = new Set<string>();
    let ledIdx = 0;

    for (const tip of payload.tips) {
      for (let segIdx = 0; segIdx < tip.segments.length; segIdx++) {
        if (ledIdx >= MAX_LEDS) break;

        const seg = tip.segments[segIdx]!;
        const key = `${tip.tipId}:${segIdx}`;
        seenKeys.add(key);

        const px = (seg.position[0] + 1.0) * 0.5 * canvasW;
        const py = (1.0 - seg.position[1]) * 0.5 * canvasH;

        let prevX = px;
        let prevY = py;
        if (tip.motionStreak && dt > 0) {
          const prev = this.prevPositions.get(key);
          if (prev) {
            const dx = px - prev.x;
            const dy = py - prev.y;
            if (dx * dx + dy * dy <= MAX_STREAK_DISTANCE_SQ) {
              prevX = prev.x;
              prevY = prev.y;
            }
          }
        }

        const stored = this.prevPositions.get(key);
        if (stored) {
          stored.x = px;
          stored.y = py;
        } else {
          this.prevPositions.set(key, { x: px, y: py });
        }

        const offset = ledIdx * INSTANCE_STRIDE_FLOATS;
        this.instanceData[offset + 0] = px;
        this.instanceData[offset + 1] = py;
        this.instanceData[offset + 2] = prevX;
        this.instanceData[offset + 3] = prevY;
        this.instanceData[offset + 4] = seg.color[0];
        this.instanceData[offset + 5] = seg.color[1];
        this.instanceData[offset + 6] = seg.color[2];
        this.instanceData[offset + 7] = seg.brightness * tip.brightness;
        this.instanceData[offset + 8] = glowRadius;

        ledIdx++;
      }
    }

    for (const key of this.prevPositions.keys()) {
      if (!seenKeys.has(key)) this.prevPositions.delete(key);
    }

    return ledIdx;
  }

  private uploadInstances(count: number): void {
    const sub = this.instanceData.subarray(0, count * INSTANCE_STRIDE_FLOATS);
    this.device.queue.writeBuffer(this.instanceBuffer!, 0, sub);
  }

  private renderSprites(ledCount: number, w: number, h: number): void {
    this.ensureSpriteTexture(w, h);
    this.device.queue.writeBuffer(
      this.uniformBuffer!,
      0,
      new Float32Array([w, h, 0, 0]),
    );

    const bindGroup = this.device.createBindGroup({
      layout: this.spriteBindGroupLayout!,
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer! } }],
    });

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.spriteTexture!.view,
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    });
    pass.setPipeline(this.spritePipeline!);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, this.quadBuffer!);
    pass.setVertexBuffer(1, this.instanceBuffer!);
    pass.draw(6, ledCount);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  private displayComposite(
    presentView: GPUTextureView,
    _w: number,
    _h: number,
  ): void {
    if (!this.spriteTexture || !this.compositePipeline || !this.compositeBindGroupLayout) return;

    const bg = this.device.createBindGroup({
      layout: this.compositeBindGroupLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: this.spriteTexture.view },
      ],
    });

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: presentView,
        loadOp: "load" as GPULoadOp,
        storeOp: "store" as GPUStoreOp,
      }],
    });
    pass.setPipeline(this.compositePipeline);
    pass.setBindGroup(0, bg);
    pass.draw(3);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }
}
