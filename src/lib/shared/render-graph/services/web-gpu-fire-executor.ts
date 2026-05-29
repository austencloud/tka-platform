/**
 * WebGPU fire pass executor.
 *
 * Port of FirePassExecutor (WebGL2). Navier-Stokes fluid sim with
 * 13-step per-frame pipeline. Uses render passes with fullscreen
 * triangle + fragment shaders (same pattern as WebGL2 but WGSL).
 *
 * Pipeline per frame:
 *   1. Splat fuel + velocity + temperature at each source
 *   2. Advect velocity through itself
 *   3. Curl + vorticity confinement
 *   4. Curl noise turbulence
 *   5. Buoyancy
 *   6. Combustion + cooling
 *   7. Divergence → Jacobi pressure solve → gradient subtraction
 *   8. Advect temperature + fuel
 *   9. Display: temperature → blackbody color + wick cores
 *  10. Bloom downsample/upsample
 *  11. Composite to screen
 */

import type {
  FirePassPayload,
  FireSourcePoint,
  FireColorStop,
} from "../domain/fire-pass";

const SIM_SIZE = 256;
const JACOBI_ITERATIONS = 12;
const VELOCITY_DISSIPATION = 0.985;
const TEMPERATURE_DISSIPATION = 0.96;
const FUEL_DISSIPATION = 0.92;
const BURN_RATE = 3.0;
const BURN_TEMP = 0.1;
const FUEL_EFFICIENCY = 3.5;
const COOLING_RATE = 2.5;
const AMBIENT_TEMP = 0.0;
const BUOYANCY_DEFAULT = 1.2;
const VORTICITY_STRENGTH = 15.0;
const TERMINAL_VELOCITY = 6.0;
const GRAVITY = -0.3;
const DISPLAY_INTENSITY = 2.2;
const BLOOM_MIP_COUNT = 4;
const BLOOM_STRENGTH = 0.08;
const SPLAT_RADIUS = 0.012;
const MAX_TIPS = 16;

const DEFAULT_COLD: [number, number, number] = [0.8, 0.2, 0.05];
const DEFAULT_MID: [number, number, number] = [1.0, 0.6, 0.1];
const DEFAULT_HOT: [number, number, number] = [1.0, 0.85, 0.4];
const DEFAULT_CORE: [number, number, number] = [1.0, 0.95, 0.85];

// ── Uniform buffer size (256-byte aligned for offset binding) ──────

const DISPLAY_UNIFORM_FLOATS = 160;
const DISPLAY_UNIFORM_BYTES = DISPLAY_UNIFORM_FLOATS * 4;

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

const SIM_UNIFORM_DECL = /* wgsl */ `
struct SimUniforms {
  texelSize: vec2f,
  dt: f32,
  dissipation: f32,
  point: vec2f,
  radius: f32,
  strength: f32,
  splatValue: vec4f,
  time: f32,
  ambientTemp: f32,
  buoyancy_val: f32,
  gravity_val: f32,
  terminalVelocity: f32,
  burnRate: f32,
  burnTemp: f32,
  fuelEfficiency: f32,
  coolingRate: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var samp: sampler;
`;

const SPLAT_FRAG_WGSL = /* wgsl */ `
${SIM_UNIFORM_DECL}
@group(0) @binding(1) var t_target: texture_2d<f32>;
@group(0) @binding(2) var<uniform> u: SimUniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let prev = textureSample(t_target, samp, uv);
  let d = distance(uv, u.point);
  let falloff = exp(-d * d / (u.radius * u.radius));
  return prev + u.splatValue * falloff;
}
`;

const ADVECT_FRAG_WGSL = /* wgsl */ `
${SIM_UNIFORM_DECL}
@group(0) @binding(1) var t_velocity: texture_2d<f32>;
@group(0) @binding(2) var t_source: texture_2d<f32>;
@group(0) @binding(3) var<uniform> u: SimUniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let vel = textureSample(t_velocity, samp, uv).xy;
  let backPos = uv - vel * u.dt * u.texelSize;
  return textureSample(t_source, samp, backPos) * u.dissipation;
}
`;

const CURL_FRAG_WGSL = /* wgsl */ `
${SIM_UNIFORM_DECL}
@group(0) @binding(1) var t_velocity: texture_2d<f32>;
@group(0) @binding(2) var<uniform> u: SimUniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let ts = u.texelSize;
  let L = textureSample(t_velocity, samp, uv - vec2f(ts.x, 0.0)).y;
  let R = textureSample(t_velocity, samp, uv + vec2f(ts.x, 0.0)).y;
  let B = textureSample(t_velocity, samp, uv - vec2f(0.0, ts.y)).x;
  let T = textureSample(t_velocity, samp, uv + vec2f(0.0, ts.y)).x;
  return vec4f((R - L - T + B) * 0.5, 0.0, 0.0, 1.0);
}
`;

const VORTICITY_FRAG_WGSL = /* wgsl */ `
${SIM_UNIFORM_DECL}
@group(0) @binding(1) var t_velocity: texture_2d<f32>;
@group(0) @binding(2) var t_curl: texture_2d<f32>;
@group(0) @binding(3) var<uniform> u: SimUniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let vel = textureSample(t_velocity, samp, uv).xy;
  let ts = u.texelSize;
  let L = textureSample(t_curl, samp, uv - vec2f(ts.x, 0.0)).x;
  let R = textureSample(t_curl, samp, uv + vec2f(ts.x, 0.0)).x;
  let B = textureSample(t_curl, samp, uv - vec2f(0.0, ts.y)).x;
  let T = textureSample(t_curl, samp, uv + vec2f(0.0, ts.y)).x;
  let C = textureSample(t_curl, samp, uv).x;

  let grad = vec2f(abs(R) - abs(L), abs(T) - abs(B));
  let gradLen = max(length(grad), 1e-5);
  let N = grad / gradLen;
  let force = vec2f(N.y, -N.x) * C * u.strength * u.dt;
  let wobble = sin(u.time * 2.5) * 0.3;
  return vec4f(vel + force * (1.0 + wobble), 0.0, 1.0);
}
`;

const CURL_NOISE_FRAG_WGSL = /* wgsl */ `
${SIM_UNIFORM_DECL}
@group(0) @binding(1) var t_velocity: texture_2d<f32>;
@group(0) @binding(2) var t_temperature: texture_2d<f32>;
@group(0) @binding(3) var<uniform> u: SimUniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let vel = textureSample(t_velocity, samp, uv).xy;
  let temp = textureSample(t_temperature, samp, uv).x;

  let freq = 8.0;
  let p = uv * freq + vec2f(u.time * 0.5, u.time * 0.3);
  let eps = u.texelSize.x * freq;

  let n1 = sin(p.x + cos(p.y * 1.3)) * cos(p.y + sin(p.x * 0.7));
  let n2 = sin((p.x + eps) + cos(p.y * 1.3)) * cos(p.y + sin((p.x + eps) * 0.7));
  let n3 = sin(p.x + cos((p.y + eps) * 1.3)) * cos((p.y + eps) + sin(p.x * 0.7));

  let dndx = (n2 - n1) / eps;
  let dndy = (n3 - n1) / eps;
  let curlForce = vec2f(-dndy, dndx) * u.strength * u.dt;
  let tempFactor = smoothstep(0.0, 0.3, temp);

  return vec4f(vel + curlForce * tempFactor, 0.0, 1.0);
}
`;

const BUOYANCY_FRAG_WGSL = /* wgsl */ `
${SIM_UNIFORM_DECL}
@group(0) @binding(1) var t_velocity: texture_2d<f32>;
@group(0) @binding(2) var t_temperature: texture_2d<f32>;
@group(0) @binding(3) var<uniform> u: SimUniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let vel = textureSample(t_velocity, samp, uv).xy;
  let temp = textureSample(t_temperature, samp, uv).x;

  let force = (temp - u.ambientTemp) * u.buoyancy_val;
  var nv = vel + vec2f(0.0, force) * u.dt;
  nv += vec2f(0.0, u.gravity_val) * u.dt;

  let speed = length(nv);
  if (speed > u.terminalVelocity) {
    nv = nv / speed * u.terminalVelocity;
  }
  return vec4f(nv, 0.0, 1.0);
}
`;

const COMBUSTION_FRAG_WGSL = /* wgsl */ `
${SIM_UNIFORM_DECL}
@group(0) @binding(1) var t_temperature: texture_2d<f32>;
@group(0) @binding(2) var t_fuel: texture_2d<f32>;
@group(0) @binding(3) var<uniform> u: SimUniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let temp = textureSample(t_temperature, samp, uv).x;
  let fuel = textureSample(t_fuel, samp, uv).x;

  let burnAmount = min(fuel, u.burnRate * u.dt);
  let heated = temp + burnAmount * u.fuelEfficiency;
  let cooled = heated - (heated - u.ambientTemp) * u.coolingRate * u.dt;
  return vec4f(max(cooled, u.ambientTemp), 0.0, 0.0, 1.0);
}
`;

const DIVERGENCE_FRAG_WGSL = /* wgsl */ `
${SIM_UNIFORM_DECL}
@group(0) @binding(1) var t_velocity: texture_2d<f32>;
@group(0) @binding(2) var<uniform> u: SimUniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let ts = u.texelSize;
  let L = textureSample(t_velocity, samp, uv - vec2f(ts.x, 0.0)).x;
  let R = textureSample(t_velocity, samp, uv + vec2f(ts.x, 0.0)).x;
  let B = textureSample(t_velocity, samp, uv - vec2f(0.0, ts.y)).y;
  let T = textureSample(t_velocity, samp, uv + vec2f(0.0, ts.y)).y;
  return vec4f((R - L + T - B) * 0.5, 0.0, 0.0, 1.0);
}
`;

const JACOBI_FRAG_WGSL = /* wgsl */ `
${SIM_UNIFORM_DECL}
@group(0) @binding(1) var t_pressure: texture_2d<f32>;
@group(0) @binding(2) var t_divergence: texture_2d<f32>;
@group(0) @binding(3) var<uniform> u: SimUniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let ts = u.texelSize;
  let L = textureSample(t_pressure, samp, uv - vec2f(ts.x, 0.0)).x;
  let R = textureSample(t_pressure, samp, uv + vec2f(ts.x, 0.0)).x;
  let B = textureSample(t_pressure, samp, uv - vec2f(0.0, ts.y)).x;
  let T = textureSample(t_pressure, samp, uv + vec2f(0.0, ts.y)).x;
  let div = textureSample(t_divergence, samp, uv).x;
  return vec4f((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}
`;

const GRADIENT_SUB_FRAG_WGSL = /* wgsl */ `
${SIM_UNIFORM_DECL}
@group(0) @binding(1) var t_velocity: texture_2d<f32>;
@group(0) @binding(2) var t_pressure: texture_2d<f32>;
@group(0) @binding(3) var<uniform> u: SimUniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let vel = textureSample(t_velocity, samp, uv).xy;
  let ts = u.texelSize;
  let L = textureSample(t_pressure, samp, uv - vec2f(ts.x, 0.0)).x;
  let R = textureSample(t_pressure, samp, uv + vec2f(ts.x, 0.0)).x;
  let B = textureSample(t_pressure, samp, uv - vec2f(0.0, ts.y)).x;
  let T = textureSample(t_pressure, samp, uv + vec2f(0.0, ts.y)).x;
  return vec4f(vel - vec2f(R - L, T - B) * 0.5, 0.0, 1.0);
}
`;

const DISPLAY_UNIFORM_DECL = /* wgsl */ `
struct TipInfo {
  position: vec2f,
  speed: f32,
  flameScale: f32,
  color: vec4f,
};

struct DisplayUniforms {
  displayIntensity: f32,
  colorBlend: f32,
  time: f32,
  tipCountF: f32,
  colorCold: vec4f,
  colorMid: vec4f,
  colorHot: vec4f,
  colorCore: vec4f,
  aspectCorrect: vec4f,
  tips: array<TipInfo, 16>,
};
`;

const DISPLAY_FRAG_WGSL = /* wgsl */ `
${DISPLAY_UNIFORM_DECL}

@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var t_temperature: texture_2d<f32>;
@group(0) @binding(2) var t_fuel: texture_2d<f32>;
@group(0) @binding(3) var t_colorField: texture_2d<f32>;
@group(0) @binding(4) var<uniform> u: DisplayUniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let temp = textureSample(t_temperature, samp, uv).x;
  let fuel = textureSample(t_fuel, samp, uv).x;

  var col: vec3f;
  if (temp < 0.25) {
    col = mix(vec3f(0.0), u.colorCold.xyz, temp * 4.0);
  } else if (temp < 0.5) {
    col = mix(u.colorCold.xyz, u.colorMid.xyz, (temp - 0.25) * 4.0);
  } else if (temp < 0.75) {
    col = mix(u.colorMid.xyz, u.colorHot.xyz, (temp - 0.5) * 4.0);
  } else {
    col = mix(u.colorHot.xyz, u.colorCore.xyz, (temp - 0.75) * 4.0);
  }

  let intensity = temp * u.displayIntensity;
  col *= intensity;

  let tipCount = u32(u.tipCountF);
  for (var i = 0u; i < tipCount; i++) {
    let tip = u.tips[i];
    let d = distance(uv * u.aspectCorrect.xy, tip.position.xy * u.aspectCorrect.xy);
    let coreRadius = 0.015 * tip.flameScale;
    let coreBrightness = exp(-d * d / (coreRadius * coreRadius)) * (0.5 + tip.speed * 0.5);
    col += tip.color.xyz * coreBrightness;
  }

  let alpha = min(1.0, intensity * 1.5 + fuel * 0.2);
  return vec4f(col * alpha, alpha);
}
`;

const BLOOM_UNIFORM_DECL = /* wgsl */ `
struct BloomUniforms {
  texelSize: vec2f,
  bloomRadius: f32,
  bloomStrength: f32,
};

@group(0) @binding(0) var samp: sampler;
`;

const BLOOM_DOWN_FRAG_WGSL = /* wgsl */ `
${BLOOM_UNIFORM_DECL}
@group(0) @binding(1) var t_source: texture_2d<f32>;
@group(0) @binding(2) var<uniform> u: BloomUniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let d = u.texelSize;
  var col = textureSample(t_source, samp, uv) * 4.0;
  col += textureSample(t_source, samp, uv + vec2f(-d.x, -d.y));
  col += textureSample(t_source, samp, uv + vec2f( d.x, -d.y));
  col += textureSample(t_source, samp, uv + vec2f(-d.x,  d.y));
  col += textureSample(t_source, samp, uv + vec2f( d.x,  d.y));
  col += textureSample(t_source, samp, uv + vec2f(-d.x,  0.0)) * 2.0;
  col += textureSample(t_source, samp, uv + vec2f( d.x,  0.0)) * 2.0;
  col += textureSample(t_source, samp, uv + vec2f( 0.0, -d.y)) * 2.0;
  col += textureSample(t_source, samp, uv + vec2f( 0.0,  d.y)) * 2.0;
  return col / 16.0;
}
`;

const BLOOM_UP_FRAG_WGSL = /* wgsl */ `
${BLOOM_UNIFORM_DECL}
@group(0) @binding(1) var t_source: texture_2d<f32>;
@group(0) @binding(2) var<uniform> u: BloomUniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let d = u.texelSize * u.bloomRadius;
  var col = textureSample(t_source, samp, uv) * 4.0;
  col += textureSample(t_source, samp, uv + vec2f(-d.x, -d.y));
  col += textureSample(t_source, samp, uv + vec2f( d.x, -d.y));
  col += textureSample(t_source, samp, uv + vec2f(-d.x,  d.y));
  col += textureSample(t_source, samp, uv + vec2f( d.x,  d.y));
  col += textureSample(t_source, samp, uv + vec2f(-d.x,  0.0)) * 2.0;
  col += textureSample(t_source, samp, uv + vec2f( d.x,  0.0)) * 2.0;
  col += textureSample(t_source, samp, uv + vec2f( 0.0, -d.y)) * 2.0;
  col += textureSample(t_source, samp, uv + vec2f( 0.0,  d.y)) * 2.0;
  return col / 16.0;
}
`;

const COMPOSITE_FRAG_WGSL = /* wgsl */ `
${BLOOM_UNIFORM_DECL}
@group(0) @binding(1) var t_scene: texture_2d<f32>;
@group(0) @binding(2) var t_bloom: texture_2d<f32>;
@group(0) @binding(3) var<uniform> u: BloomUniforms;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let scene = textureSample(t_scene, samp, uv);
  let bloom = textureSample(t_bloom, samp, uv);
  return scene + bloom * u.bloomStrength;
}
`;

// ── Types ──────────────────────────────────────────────────────────

interface SimTexture {
  texture: GPUTexture;
  view: GPUTextureView;
  width: number;
  height: number;
}

interface PingPong {
  textures: [SimTexture, SimTexture];
  readIdx: number;
}

function createSimTexture(device: GPUDevice, w: number, h: number): SimTexture {
  const texture = device.createTexture({
    size: { width: w, height: h },
    format: "rgba16float",
    usage:
      GPUTextureUsage.RENDER_ATTACHMENT |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST,
  });
  return { texture, view: texture.createView(), width: w, height: h };
}

function createPingPong(device: GPUDevice, w: number, h: number): PingPong {
  return {
    textures: [createSimTexture(device, w, h), createSimTexture(device, w, h)],
    readIdx: 0,
  };
}

function ppRead(pp: PingPong): SimTexture {
  return pp.textures[pp.readIdx]!;
}

function ppWrite(pp: PingPong): SimTexture {
  return pp.textures[1 - pp.readIdx]! as SimTexture;
}

function ppSwap(pp: PingPong): void {
  pp.readIdx = 1 - pp.readIdx;
}

// ── Pipeline descriptor helpers ────────────────────────────────────

type PipelineTag =
  | "splat"
  | "advect"
  | "curl"
  | "vorticity"
  | "curlNoise"
  | "buoyancy"
  | "combustion"
  | "divergence"
  | "jacobi"
  | "gradientSub"
  | "display"
  | "bloomDown"
  | "bloomUp"
  | "composite";

interface PipelineEntry {
  pipeline: GPURenderPipeline;
  bindGroupLayout: GPUBindGroupLayout;
}

// ── Executor ───────────────────────────────────────────────────────

export class WebGPUFireExecutor {
  private device: GPUDevice;
  private sampler: GPUSampler;
  private initialized = false;
  private elapsedTime = 0;

  private vel!: PingPong;
  private temp!: PingPong;
  private fuel!: PingPong;
  private press!: PingPong;
  private color!: PingPong;

  private curlTex!: SimTexture;
  private divTex!: SimTexture;
  private displayTex!: SimTexture;
  private bloomMips: SimTexture[] = [];

  private pipelines = new Map<PipelineTag, PipelineEntry>();
  private vertModule!: GPUShaderModule;

  private simUniformBuf!: GPUBuffer;
  private displayUniformBuf!: GPUBuffer;
  private bloomUniformBuf!: GPUBuffer;

  constructor(device: GPUDevice, sampler: GPUSampler) {
    this.device = device;
    this.sampler = sampler;
  }

  execute(
    payload: FirePassPayload,
    dt: number,
    presentView: GPUTextureView,
    _canvasW: number,
    _canvasH: number,
  ): void {
    if (!this.initialized) {
      this.init();
      this.initialized = true;
    }

    this.elapsedTime += dt;
    const texelSize: [number, number] = [1 / SIM_SIZE, 1 / SIM_SIZE];
    const iterations = payload.jacobiIterations ?? JACOBI_ITERATIONS;

    // 1. Splat sources
    for (const src of payload.sources) {
      this.splat(src, payload.intensity, texelSize);
    }

    // 2. Advect velocity through itself
    this.advect(this.vel, ppRead(this.vel).view, texelSize, VELOCITY_DISSIPATION, dt);

    // 3. Curl + vorticity
    this.computeCurl(texelSize);
    this.applyVorticity(texelSize, payload.turbulence, dt);

    // 4. Curl noise
    if (payload.turbulence > 0.01) {
      this.applyCurlNoise(texelSize, payload.turbulence, dt);
    }

    // 5. Buoyancy
    this.applyBuoyancy(payload.buoyancy ?? BUOYANCY_DEFAULT, dt, texelSize);

    // 6. Combustion
    this.combustion(payload.intensity, dt, texelSize);

    // 7. Divergence
    this.computeDivergence(texelSize);

    // 8. Jacobi pressure solve
    this.clearTexture(ppWrite(this.press));
    ppSwap(this.press);
    for (let i = 0; i < iterations; i++) {
      this.jacobiIteration(texelSize);
    }

    // 9. Gradient subtraction
    this.gradientSubtract(texelSize);

    // 10. Advect temperature + fuel
    this.advect(this.temp, ppRead(this.temp).view, texelSize, TEMPERATURE_DISSIPATION, dt);
    this.advect(this.fuel, ppRead(this.fuel).view, texelSize, FUEL_DISSIPATION, dt);

    // 11. Display render
    this.renderDisplay(payload);

    // 12. Bloom
    this.bloom();

    // 13. Composite to screen
    this.compositeToScreen(presentView);
  }

  dispose(): void {
    const destroyPP = (pp: PingPong) => {
      pp.textures[0].texture.destroy();
      pp.textures[1].texture.destroy();
    };
    if (this.initialized) {
      destroyPP(this.vel);
      destroyPP(this.temp);
      destroyPP(this.fuel);
      destroyPP(this.press);
      destroyPP(this.color);
      this.curlTex.texture.destroy();
      this.divTex.texture.destroy();
      this.displayTex.texture.destroy();
      for (const m of this.bloomMips) m.texture.destroy();
      this.simUniformBuf.destroy();
      this.displayUniformBuf.destroy();
      this.bloomUniformBuf.destroy();
    }
    this.bloomMips = [];
    this.pipelines.clear();
    this.initialized = false;
  }

  // ── Initialization ──────────────────────────────────────────────

  private init(): void {
    const device = this.device;

    this.vel = createPingPong(device, SIM_SIZE, SIM_SIZE);
    this.temp = createPingPong(device, SIM_SIZE, SIM_SIZE);
    this.fuel = createPingPong(device, SIM_SIZE, SIM_SIZE);
    this.press = createPingPong(device, SIM_SIZE, SIM_SIZE);
    this.color = createPingPong(device, SIM_SIZE, SIM_SIZE);

    this.curlTex = createSimTexture(device, SIM_SIZE, SIM_SIZE);
    this.divTex = createSimTexture(device, SIM_SIZE, SIM_SIZE);
    this.displayTex = createSimTexture(device, SIM_SIZE, SIM_SIZE);

    let w = Math.max(1, SIM_SIZE >> 1);
    let h = Math.max(1, SIM_SIZE >> 1);
    for (let i = 0; i < BLOOM_MIP_COUNT; i++) {
      this.bloomMips.push(createSimTexture(device, w, h));
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
    }

    this.simUniformBuf = device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.displayUniformBuf = device.createBuffer({
      size: DISPLAY_UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.bloomUniformBuf = device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.vertModule = device.createShaderModule({ code: FULLSCREEN_VERT_WGSL });
    this.compilePipelines();
  }

  private compilePipelines(): void {
    const sim1TLayout = this.makeBindGroupLayout([
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
    ]);
    const sim2TLayout = this.makeBindGroupLayout([
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
    ]);
    const display3TLayout = this.makeBindGroupLayout([
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
    ]);
    const bloom1TLayout = this.makeBindGroupLayout([
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
    ]);
    const composite2TLayout = this.makeBindGroupLayout([
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
    ]);

    const premulBlend: GPUBlendState = {
      color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
    };
    const additiveBlend: GPUBlendState = {
      color: { srcFactor: "one", dstFactor: "one", operation: "add" },
      alpha: { srcFactor: "one", dstFactor: "one", operation: "add" },
    };

    const simFmt: GPUTextureFormat = "rgba16float";
    const presentFmt: GPUTextureFormat = "bgra8unorm";

    this.registerPipeline("splat", sim1TLayout, SPLAT_FRAG_WGSL, simFmt);
    this.registerPipeline("advect", sim2TLayout, ADVECT_FRAG_WGSL, simFmt);
    this.registerPipeline("curl", sim1TLayout, CURL_FRAG_WGSL, simFmt);
    this.registerPipeline("vorticity", sim2TLayout, VORTICITY_FRAG_WGSL, simFmt);
    this.registerPipeline("curlNoise", sim2TLayout, CURL_NOISE_FRAG_WGSL, simFmt);
    this.registerPipeline("buoyancy", sim2TLayout, BUOYANCY_FRAG_WGSL, simFmt);
    this.registerPipeline("combustion", sim2TLayout, COMBUSTION_FRAG_WGSL, simFmt);
    this.registerPipeline("divergence", sim1TLayout, DIVERGENCE_FRAG_WGSL, simFmt);
    this.registerPipeline("jacobi", sim2TLayout, JACOBI_FRAG_WGSL, simFmt);
    this.registerPipeline("gradientSub", sim2TLayout, GRADIENT_SUB_FRAG_WGSL, simFmt);
    this.registerPipeline("display", display3TLayout, DISPLAY_FRAG_WGSL, simFmt, premulBlend);
    this.registerPipeline("bloomDown", bloom1TLayout, BLOOM_DOWN_FRAG_WGSL, simFmt);
    this.registerPipeline("bloomUp", bloom1TLayout, BLOOM_UP_FRAG_WGSL, simFmt, additiveBlend);
    this.registerPipeline("composite", composite2TLayout, COMPOSITE_FRAG_WGSL, presentFmt, premulBlend);
  }

  private registerPipeline(
    tag: PipelineTag,
    bindGroupLayout: GPUBindGroupLayout,
    fragCode: string,
    targetFormat: GPUTextureFormat,
    blend?: GPUBlendState,
  ): void {
    const fragModule = this.device.createShaderModule({ code: fragCode });
    const pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module: this.vertModule, entryPoint: "main" },
      fragment: {
        module: fragModule,
        entryPoint: "main",
        targets: [{ format: targetFormat, blend }],
      },
      primitive: { topology: "triangle-list" },
    });
    this.pipelines.set(tag, { pipeline, bindGroupLayout });
  }

  private makeBindGroupLayout(
    entries: GPUBindGroupLayoutEntry[],
  ): GPUBindGroupLayout {
    return this.device.createBindGroupLayout({ entries });
  }

  // ── Sim step: splat ─────────────────────────────────────────────

  private splat(src: FireSourcePoint, intensity: number, _texelSize: [number, number]): void {
    const u = (src.position[0] + 1) / 2;
    const v = (src.position[1] + 1) / 2;
    const radius = src.radius > 0 ? src.radius : SPLAT_RADIUS;

    this.splatField(this.fuel, u, v, src.density * intensity, 0, 0, radius);
    this.splatField(this.vel, u, v, src.velocity[0], src.velocity[1], 0, radius);
    this.splatField(this.temp, u, v, src.temperature * intensity, 0, 0, radius);
  }

  private splatField(
    target: PingPong,
    x: number, y: number,
    r: number, g: number, b: number,
    radius: number,
  ): void {
    this.writeSimUniforms(0, 0, 0, 0, x, y, radius, 0, r, g, b, 0);
    const entry = this.pipelines.get("splat")!;
    const bindGroup = this.device.createBindGroup({
      layout: entry.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: ppRead(target).view },
        { binding: 2, resource: { buffer: this.simUniformBuf } },
      ],
    });
    this.runPass(entry.pipeline, bindGroup, ppWrite(target).view, SIM_SIZE, SIM_SIZE);
    ppSwap(target);
  }

  // ── Sim step: advect ────────────────────────────────────────────

  private advect(
    target: PingPong,
    sourceView: GPUTextureView,
    texelSize: [number, number],
    dissipation: number,
    dt: number,
  ): void {
    this.writeSimUniforms(texelSize[0], texelSize[1], dt, dissipation);
    const entry = this.pipelines.get("advect")!;
    const bindGroup = this.device.createBindGroup({
      layout: entry.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: ppRead(this.vel).view },
        { binding: 2, resource: sourceView },
        { binding: 3, resource: { buffer: this.simUniformBuf } },
      ],
    });
    this.runPass(entry.pipeline, bindGroup, ppWrite(target).view, SIM_SIZE, SIM_SIZE);
    ppSwap(target);
  }

  // ── Sim step: curl ──────────────────────────────────────────────

  private computeCurl(texelSize: [number, number]): void {
    this.writeSimUniforms(texelSize[0], texelSize[1]);
    const entry = this.pipelines.get("curl")!;
    const bindGroup = this.device.createBindGroup({
      layout: entry.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: ppRead(this.vel).view },
        { binding: 2, resource: { buffer: this.simUniformBuf } },
      ],
    });
    this.runPass(entry.pipeline, bindGroup, this.curlTex.view, SIM_SIZE, SIM_SIZE);
  }

  // ── Sim step: vorticity ─────────────────────────────────────────

  private applyVorticity(texelSize: [number, number], turbulence: number, dt: number): void {
    this.writeSimUniforms(
      texelSize[0], texelSize[1], dt, 0,
      0, 0, 0, VORTICITY_STRENGTH,
      0, 0, 0, 0,
      this.elapsedTime,
    );
    const entry = this.pipelines.get("vorticity")!;
    const bindGroup = this.device.createBindGroup({
      layout: entry.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: ppRead(this.vel).view },
        { binding: 2, resource: this.curlTex.view },
        { binding: 3, resource: { buffer: this.simUniformBuf } },
      ],
    });
    this.runPass(entry.pipeline, bindGroup, ppWrite(this.vel).view, SIM_SIZE, SIM_SIZE);
    ppSwap(this.vel);
  }

  // ── Sim step: curl noise ────────────────────────────────────────

  private applyCurlNoise(texelSize: [number, number], turbulence: number, dt: number): void {
    const strength = VORTICITY_STRENGTH * turbulence * 8.0;
    this.writeSimUniforms(
      texelSize[0], texelSize[1], dt, 0,
      0, 0, 0, strength,
      0, 0, 0, 0,
      this.elapsedTime,
    );
    const entry = this.pipelines.get("curlNoise")!;
    const bindGroup = this.device.createBindGroup({
      layout: entry.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: ppRead(this.vel).view },
        { binding: 2, resource: ppRead(this.temp).view },
        { binding: 3, resource: { buffer: this.simUniformBuf } },
      ],
    });
    this.runPass(entry.pipeline, bindGroup, ppWrite(this.vel).view, SIM_SIZE, SIM_SIZE);
    ppSwap(this.vel);
  }

  // ── Sim step: buoyancy ──────────────────────────────────────────

  private applyBuoyancy(buoyancy: number, dt: number, texelSize: [number, number]): void {
    const termVel = GRAVITY < 0 ? 14.0 : TERMINAL_VELOCITY;
    this.writeSimUniforms(
      texelSize[0], texelSize[1], dt, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, AMBIENT_TEMP, buoyancy, GRAVITY, termVel,
    );
    const entry = this.pipelines.get("buoyancy")!;
    const bindGroup = this.device.createBindGroup({
      layout: entry.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: ppRead(this.vel).view },
        { binding: 2, resource: ppRead(this.temp).view },
        { binding: 3, resource: { buffer: this.simUniformBuf } },
      ],
    });
    this.runPass(entry.pipeline, bindGroup, ppWrite(this.vel).view, SIM_SIZE, SIM_SIZE);
    ppSwap(this.vel);
  }

  // ── Sim step: combustion ────────────────────────────────────────

  private combustion(intensity: number, dt: number, texelSize: [number, number]): void {
    const data = new Float32Array(24);
    data[0] = texelSize[0]; data[1] = texelSize[1];
    data[2] = dt;
    // burnRate at offset [17], burnTemp [18], fuelEfficiency [19], coolingRate [20]
    // ambientTemp at offset [13]
    data[13] = AMBIENT_TEMP;
    data[17] = BURN_RATE * intensity;
    data[18] = BURN_TEMP;
    data[19] = FUEL_EFFICIENCY;
    data[20] = COOLING_RATE;
    this.device.queue.writeBuffer(this.simUniformBuf, 0, data);

    const entry = this.pipelines.get("combustion")!;
    const bindGroup = this.device.createBindGroup({
      layout: entry.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: ppRead(this.temp).view },
        { binding: 2, resource: ppRead(this.fuel).view },
        { binding: 3, resource: { buffer: this.simUniformBuf } },
      ],
    });
    this.runPass(entry.pipeline, bindGroup, ppWrite(this.temp).view, SIM_SIZE, SIM_SIZE);
    ppSwap(this.temp);
  }

  // ── Sim step: divergence ────────────────────────────────────────

  private computeDivergence(texelSize: [number, number]): void {
    this.writeSimUniforms(texelSize[0], texelSize[1]);
    const entry = this.pipelines.get("divergence")!;
    const bindGroup = this.device.createBindGroup({
      layout: entry.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: ppRead(this.vel).view },
        { binding: 2, resource: { buffer: this.simUniformBuf } },
      ],
    });
    this.runPass(entry.pipeline, bindGroup, this.divTex.view, SIM_SIZE, SIM_SIZE);
  }

  // ── Sim step: jacobi ───────────────────────────────────────────

  private jacobiIteration(texelSize: [number, number]): void {
    this.writeSimUniforms(texelSize[0], texelSize[1]);
    const entry = this.pipelines.get("jacobi")!;
    const bindGroup = this.device.createBindGroup({
      layout: entry.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: ppRead(this.press).view },
        { binding: 2, resource: this.divTex.view },
        { binding: 3, resource: { buffer: this.simUniformBuf } },
      ],
    });
    this.runPass(entry.pipeline, bindGroup, ppWrite(this.press).view, SIM_SIZE, SIM_SIZE);
    ppSwap(this.press);
  }

  // ── Sim step: gradient subtraction ──────────────────────────────

  private gradientSubtract(texelSize: [number, number]): void {
    this.writeSimUniforms(texelSize[0], texelSize[1]);
    const entry = this.pipelines.get("gradientSub")!;
    const bindGroup = this.device.createBindGroup({
      layout: entry.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: ppRead(this.vel).view },
        { binding: 2, resource: ppRead(this.press).view },
        { binding: 3, resource: { buffer: this.simUniformBuf } },
      ],
    });
    this.runPass(entry.pipeline, bindGroup, ppWrite(this.vel).view, SIM_SIZE, SIM_SIZE);
    ppSwap(this.vel);
  }

  // ── Display: temperature → blackbody color ──────────────────────

  private renderDisplay(payload: FirePassPayload): void {
    const data = new Float32Array(DISPLAY_UNIFORM_FLOATS);

    data[0] = DISPLAY_INTENSITY * payload.intensity;
    data[1] = 0; // colorBlend
    data[2] = this.elapsedTime;
    data[3] = Math.min(payload.sources.length, MAX_TIPS);

    const cold = this.findColorStop(payload.colorCurve, 0, DEFAULT_COLD);
    const mid = this.findColorStop(payload.colorCurve, 1, DEFAULT_MID);
    const hot = this.findColorStop(payload.colorCurve, 2, DEFAULT_HOT);
    const core = this.findColorStop(payload.colorCurve, 3, DEFAULT_CORE);

    // vec4f aligned: colorCold at offset 4, colorMid at 8, colorHot at 12, colorCore at 16
    data[4] = cold[0]; data[5] = cold[1]; data[6] = cold[2]; data[7] = 0;
    data[8] = mid[0]; data[9] = mid[1]; data[10] = mid[2]; data[11] = 0;
    data[12] = hot[0]; data[13] = hot[1]; data[14] = hot[2]; data[15] = 0;
    data[16] = core[0]; data[17] = core[1]; data[18] = core[2]; data[19] = 0;

    // aspectCorrect vec4f at offset 20
    data[20] = 1.0; data[21] = 1.0; data[22] = 0; data[23] = 0;

    // tips array starts at offset 24, each TipInfo = 8 floats (vec2f + f32 + f32 + vec4f)
    const tipCount = Math.min(payload.sources.length, MAX_TIPS);
    for (let i = 0; i < tipCount; i++) {
      const src = payload.sources[i]!;
      const base = 24 + i * 8;
      data[base + 0] = (src.position[0] + 1) / 2;
      data[base + 1] = (src.position[1] + 1) / 2;
      data[base + 2] = Math.sqrt(src.velocity[0] ** 2 + src.velocity[1] ** 2);
      data[base + 3] = Math.max(0.5, src.radius / SPLAT_RADIUS);
      data[base + 4] = hot[0]; data[base + 5] = hot[1]; data[base + 6] = hot[2];
      data[base + 7] = 0;
    }

    this.device.queue.writeBuffer(this.displayUniformBuf, 0, data);

    const entry = this.pipelines.get("display")!;
    const bindGroup = this.device.createBindGroup({
      layout: entry.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: ppRead(this.temp).view },
        { binding: 2, resource: ppRead(this.fuel).view },
        { binding: 3, resource: ppRead(this.color).view },
        { binding: 4, resource: { buffer: this.displayUniformBuf } },
      ],
    });

    this.runPass(
      entry.pipeline, bindGroup, this.displayTex.view,
      SIM_SIZE, SIM_SIZE, { r: 0, g: 0, b: 0, a: 0 },
    );
  }

  // ── Bloom ───────────────────────────────────────────────────────

  private bloom(): void {
    if (this.bloomMips.length === 0) return;

    const downEntry = this.pipelines.get("bloomDown")!;
    const upEntry = this.pipelines.get("bloomUp")!;

    // Downsample: display → mip[0], then mip[i-1] → mip[i]
    {
      const data = new Float32Array(4);
      data[0] = 1.0 / SIM_SIZE; data[1] = 1.0 / SIM_SIZE;
      this.device.queue.writeBuffer(this.bloomUniformBuf, 0, data);

      const bg = this.device.createBindGroup({
        layout: downEntry.bindGroupLayout,
        entries: [
          { binding: 0, resource: this.sampler },
          { binding: 1, resource: this.displayTex.view },
          { binding: 2, resource: { buffer: this.bloomUniformBuf } },
        ],
      });
      const m = this.bloomMips[0]!;
      this.runPass(downEntry.pipeline, bg, m.view, m.width, m.height);
    }

    for (let i = 1; i < this.bloomMips.length; i++) {
      const prev = this.bloomMips[i - 1]!;
      const cur = this.bloomMips[i]!;
      const data = new Float32Array(4);
      data[0] = 1.0 / prev.width; data[1] = 1.0 / prev.height;
      this.device.queue.writeBuffer(this.bloomUniformBuf, 0, data);

      const bg = this.device.createBindGroup({
        layout: downEntry.bindGroupLayout,
        entries: [
          { binding: 0, resource: this.sampler },
          { binding: 1, resource: prev.view },
          { binding: 2, resource: { buffer: this.bloomUniformBuf } },
        ],
      });
      this.runPass(downEntry.pipeline, bg, cur.view, cur.width, cur.height);
    }

    // Upsample: mip[N-1] → mip[N-2] → ... → mip[0] (additive)
    for (let i = this.bloomMips.length - 1; i > 0; i--) {
      const src = this.bloomMips[i]!;
      const dst = this.bloomMips[i - 1]!;
      const data = new Float32Array(4);
      data[0] = 1.0 / src.width; data[1] = 1.0 / src.height;
      data[2] = 1.0; // bloomRadius
      this.device.queue.writeBuffer(this.bloomUniformBuf, 0, data);

      const bg = this.device.createBindGroup({
        layout: upEntry.bindGroupLayout,
        entries: [
          { binding: 0, resource: this.sampler },
          { binding: 1, resource: src.view },
          { binding: 2, resource: { buffer: this.bloomUniformBuf } },
        ],
      });
      this.runPass(upEntry.pipeline, bg, dst.view, dst.width, dst.height, "load");
    }
  }

  // ── Composite to screen ─────────────────────────────────────────

  private compositeToScreen(presentView: GPUTextureView): void {
    const data = new Float32Array(4);
    data[3] = BLOOM_STRENGTH;
    this.device.queue.writeBuffer(this.bloomUniformBuf, 0, data);

    const entry = this.pipelines.get("composite")!;
    const bg = this.device.createBindGroup({
      layout: entry.bindGroupLayout,
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: this.displayTex.view },
        { binding: 2, resource: this.bloomMips.length > 0 ? this.bloomMips[0]!.view : this.displayTex.view },
        { binding: 3, resource: { buffer: this.bloomUniformBuf } },
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
    pass.setPipeline(entry.pipeline);
    pass.setBindGroup(0, bg);
    pass.draw(3);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private writeSimUniforms(
    texelX = 0, texelY = 0, dt = 0, dissipation = 0,
    pointX = 0, pointY = 0, radius = 0, strength = 0,
    splatR = 0, splatG = 0, splatB = 0, splatA = 0,
    time = 0, ambientTemp = 0, buoyancy = 0, gravity = 0,
    terminalVelocity = 0, burnRate = 0, burnTemp = 0,
    fuelEfficiency = 0, coolingRate = 0,
  ): void {
    const data = new Float32Array(24);
    data[0] = texelX; data[1] = texelY;
    data[2] = dt; data[3] = dissipation;
    data[4] = pointX; data[5] = pointY;
    data[6] = radius; data[7] = strength;
    data[8] = splatR; data[9] = splatG; data[10] = splatB; data[11] = splatA;
    data[12] = time; data[13] = ambientTemp;
    data[14] = buoyancy; data[15] = gravity;
    data[16] = terminalVelocity; data[17] = burnRate;
    data[18] = burnTemp; data[19] = fuelEfficiency;
    data[20] = coolingRate;
    this.device.queue.writeBuffer(this.simUniformBuf, 0, data);
  }

  private runPass(
    pipeline: GPURenderPipeline,
    bindGroup: GPUBindGroup,
    targetView: GPUTextureView,
    width: number,
    height: number,
    loadBehavior: GPULoadOp | GPUColor = "clear",
  ): void {
    const isClear = loadBehavior !== "load";
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: targetView,
        loadOp: (isClear ? "clear" : "load") as GPULoadOp,
        storeOp: "store" as GPUStoreOp,
        ...(isClear && typeof loadBehavior === "object"
          ? { clearValue: loadBehavior }
          : isClear
            ? { clearValue: { r: 0, g: 0, b: 0, a: 0 } }
            : {}),
      }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  private clearTexture(tex: SimTexture): void {
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: tex.view,
        loadOp: "clear",
        storeOp: "store",
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
      }],
    });
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  private findColorStop(
    curve: FireColorStop[] | undefined,
    index: number,
    fallback: [number, number, number],
  ): [number, number, number] {
    if (!curve || index >= curve.length) return fallback;
    return curve[index]!.color;
  }
}
