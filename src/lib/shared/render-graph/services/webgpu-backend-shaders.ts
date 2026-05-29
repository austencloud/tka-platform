export const FULLSCREEN_VERT_WGSL = /* wgsl */ `
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

export const DECAY_FRAG_WGSL = /* wgsl */ `
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

export const COMPOSITE_FRAG_WGSL = /* wgsl */ `
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var srcSampler: sampler;
@group(0) @binding(2) var<uniform> tint: vec4f;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return textureSample(src, srcSampler, uv) * tint;
}
`;

export const TRAIL_MESH_VERT_WGSL = /* wgsl */ `
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

export const TRAIL_MESH_FRAG_WGSL = /* wgsl */ `
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

export const GAUSSIAN_BLUR_FRAG_WGSL = /* wgsl */ `
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

export const TRAIL_COMPOSITE_FRAG_WGSL = /* wgsl */ `
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
