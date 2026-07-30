import { ShaderMaterial, Color, DoubleSide, AdditiveBlending } from "three";

/**
 * 3D trail ribbon material — the 3D port of the 2D WebGL2 accumulator look.
 *
 * The 2D trail's "glow" is a widened additive splat (GLOW_RATIO), not a true
 * bloom. This shader reproduces that: a solid bright core down the centre of
 * the ribbon plus a Gaussian halo toward the widened edges, emitted in HDR so
 * the scene bloom pass (HIGH/MEDIUM tier) catches it. On LOW tier the halo
 * alone still reads as glow because the blend is additive.
 *
 * Vertex attributes (set by TrailRenderer3D):
 *   - position      ribbon vertex (world)
 *   - alpha         head→tail opacity (1 at head, →0 at tail)
 *   - instanceColor per-vertex colour (rainbow mode), else black → uBaseColor
 *   - edge          -1 at one ribbon edge, +1 at the other, 0 down the centre
 */

const vertexShader = /* glsl */ `
  attribute float alpha;
  attribute vec3 instanceColor;
  attribute float edge;

  varying float vAlpha;
  varying vec3 vColor;
  varying float vEdge;

  void main() {
    vAlpha = alpha;
    vColor = instanceColor;
    vEdge = edge;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  uniform float uVisibility;
  uniform vec3 uBaseColor;
  uniform float uEmissiveStrength; // HDR core multiplier (>1 so bloom catches it)
  uniform float uCoreFrac;         // inner fraction that stays solid
  uniform float uHaloSoftness;     // Gaussian sharpness for the edge halo

  varying float vAlpha;
  varying vec3 vColor;
  varying float vEdge;

  void main() {
    // Instance colour when provided (rainbow mode), otherwise base colour.
    vec3 color = length(vColor) > 0.01 ? vColor : uBaseColor;

    // Cross-ribbon profile: solid core for |edge| < uCoreFrac, then a Gaussian
    // halo out to the widened edge. This is the GLOW_RATIO splat in 3D.
    float a = abs(vEdge);
    float t = max(0.0, (a - uCoreFrac) / max(1e-3, 1.0 - uCoreFrac));
    float halo = exp(-t * t * uHaloSoftness);
    float profile = a < uCoreFrac ? 1.0 : halo;

    // HDR emissive core; head→tail fade via vAlpha; halo via profile.
    vec3 finalColor = color * uEmissiveStrength;
    float finalAlpha = vAlpha * uOpacity * uVisibility * profile;
    if (finalAlpha < 0.001) discard;

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export interface TrailMaterialOptions {
  color: string;
  opacity: number;
  /** HDR core multiplier. >1 pushes peak luminance past the bloom threshold. */
  emissiveStrength?: number;
  /** Inner fraction of the ribbon width that stays at full intensity. */
  coreFrac?: number;
  /** Gaussian falloff sharpness for the halo outside the core. */
  haloSoftness?: number;
  rainbow?: boolean;
}

export function createTrailMaterial(
  options: TrailMaterialOptions
): ShaderMaterial {
  const baseColor = new Color(
    options.color === "rainbow" ? "#ffffff" : options.color
  );

  return new ShaderMaterial({
    uniforms: {
      uBaseColor: { value: baseColor },
      uOpacity: { value: options.opacity },
      uVisibility: { value: 1.0 },
      uEmissiveStrength: { value: options.emissiveStrength ?? 2.5 },
      uCoreFrac: { value: options.coreFrac ?? 0.35 },
      uHaloSoftness: { value: options.haloSoftness ?? 3.5 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });
}
