import { ShaderMaterial, Color, DoubleSide } from "three";

// Shaders for the ruins dais, extracted from the recovered RuinsPlatform so the
// Blender-authored dais GLB can wear them at runtime. The bioluminescent crack
// network (top material) is the hero — an animated voronoi glow that can't be
// baked into glTF, hence the runtime material swap.

const noiseGlsl = /* glsl */ `
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  vec2 hash2(vec2 p) {
    return fract(sin(vec2(
      dot(p, vec2(127.1, 311.7)),
      dot(p, vec2(269.5, 183.3))
    )) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = p * 2.0 + vec2(100.0);
      a *= 0.5;
    }
    return v;
  }
  vec2 voronoi2(vec2 p) {
    vec2 ci = floor(p); vec2 cf = fract(p);
    float f1 = 8.0, f2 = 8.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash2(ci + g);
      o = 0.5 + 0.4 * sin(6.2831 * o + 2.0);
      vec2 r = g + o - cf;
      float dd = dot(r, r);
      if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) { f2 = dd; }
    }
    return vec2(sqrt(f1), sqrt(f2));
  }
`;

const bodyVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const bodyFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uStoneColor;
  uniform float uMossIntensity;
  varying vec2 vUv;
  varying vec3 vPos;

  ${noiseGlsl}

  void main() {
    vec2 p = vec2(vUv.x * 8.0, vPos.y * 6.0);
    float stoneN = fbm(p * 1.5 + 5.0);
    vec3 lightStone = uStoneColor + vec3(0.06, 0.07, 0.08);
    vec3 stoneColor = mix(uStoneColor, lightStone, stoneN);

    float mossGrad = smoothstep(-0.2, 0.3, vPos.y / 0.5);
    float mossNoise = fbm(p * 1.0 + vec2(uTime * 0.003, 0.0));
    float mossMask = mossGrad * smoothstep(0.35, 0.6, mossNoise);
    vec3 mossColor = vec3(0.08, 0.16, 0.10);
    stoneColor = mix(stoneColor, mossColor, mossMask * 0.5 * uMossIntensity);

    vec2 v = voronoi2(p * 2.0);
    float crackEdge = v.y - v.x;
    float crackLine = 1.0 - smoothstep(0.0, 0.05, crackEdge);
    stoneColor = mix(stoneColor, uStoneColor * 0.6, crackLine * 0.3);

    gl_FragColor = vec4(stoneColor, 1.0);
  }
`;

const topVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const topFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uStoneColor;
  uniform vec3 uBioGlowColor;
  uniform float uGlowIntensity;
  uniform float uMossIntensity;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  ${noiseGlsl}

  void main() {
    vec2 c = vUv - 0.5;
    float dist = length(c) * 2.0;

    float stoneN = fbm(c * 8.0 + 3.0);
    vec3 lightStone = uStoneColor + vec3(0.06, 0.07, 0.08);
    vec3 stone = mix(uStoneColor, lightStone, stoneN);

    float edgeDist = max(abs(c.x), abs(c.y));
    float edgeMoss = smoothstep(0.25, 0.45, edgeDist);
    float mossNoise = fbm(c * 5.0 + vec2(uTime * 0.003, 0.0));
    float mossMask = edgeMoss * smoothstep(0.38, 0.58, mossNoise);
    vec3 mossColor = vec3(0.07, 0.14, 0.09);
    stone = mix(stone, mossColor, mossMask * 0.45 * uMossIntensity);

    vec2 v = voronoi2(c * 5.0);
    float crackEdge = v.y - v.x;
    float crackLine = 1.0 - smoothstep(0.0, 0.05, crackEdge);
    float crackGlow = 1.0 - smoothstep(0.0, 0.2, crackEdge);

    float breathe = 0.45 + 0.25 * sin(uTime * 0.25 + fbm(c * 2.0) * 5.0);
    breathe += 0.1 * sin(uTime * 0.4 + dist * 3.0);

    float glowPatch = smoothstep(0.35, 0.6, fbm(c * 1.8 + 19.0));
    float bioIntensity = breathe * glowPatch * uGlowIntensity;

    stone += uBioGlowColor * crackLine * 0.9 * bioIntensity;
    stone += uBioGlowColor * crackGlow * 0.1 * bioIntensity;

    float darkCrack = crackLine * (1.0 - glowPatch);
    stone = mix(stone, uStoneColor * 0.65, darkCrack * 0.3);

    gl_FragColor = vec4(stone, 1.0);
  }
`;

export interface RuinsShaderConfig {
  stoneColor: string;
  runeGlowColor: string;
  glowIntensity: number;
  mossIntensity: number;
}

export function createBodyMaterial(config: RuinsShaderConfig): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uStoneColor: { value: new Color(config.stoneColor) },
      uMossIntensity: { value: config.mossIntensity },
    },
    vertexShader: bodyVertexShader,
    fragmentShader: bodyFragmentShader,
  });
}

export function createTopMaterial(config: RuinsShaderConfig): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uStoneColor: { value: new Color(config.stoneColor) },
      uBioGlowColor: { value: new Color(config.runeGlowColor) },
      uGlowIntensity: { value: config.glowIntensity },
      uMossIntensity: { value: config.mossIntensity },
    },
    vertexShader: topVertexShader,
    fragmentShader: topFragmentShader,
    side: DoubleSide,
  });
}
