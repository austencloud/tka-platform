/**
 * GLSL shader snippets for bioluminescent crystal rendering.
 *
 * Two modes:
 * - Procedural: per-instance color attribute drives diffuse + emissive
 * - GLB: model's baked textures drive diffuse; glow is additive on top
 */

// ── Procedural mode (per-instance color) ──────────────────────────────────────

export const CRYSTAL_VERTEX_PARS = /* glsl */ `
  attribute vec3  aInstanceColor;
  attribute float aGlowIntensity;
  attribute float aGlowPhase;

  varying vec3  vInstanceColor;
  varying float vGlowIntensity;
  varying float vGlowPhase;
  varying float vFresnel;
`;

export const CRYSTAL_VERTEX_MAIN = /* glsl */ `
  vInstanceColor  = aInstanceColor;
  vGlowIntensity  = aGlowIntensity;
  vGlowPhase      = aGlowPhase;

  vec3 worldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vec3 viewDir     = normalize(cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz);
  vFresnel         = 1.0 - abs(dot(worldNormal, viewDir));
`;

export const CRYSTAL_FRAGMENT_PARS = /* glsl */ `
  uniform float uCrystalTime;

  varying vec3  vInstanceColor;
  varying float vGlowIntensity;
  varying float vGlowPhase;
  varying float vFresnel;
`;

export const CRYSTAL_FRAGMENT_EMISSIVE = /* glsl */ `
  float pulse = 0.55 + 0.45 * sin(uCrystalTime * 1.8 + vGlowPhase);
  float glow  = vGlowIntensity * pulse;

  vec3 edgeShift = mix(vec3(1.0), vec3(0.6, 0.8, 1.4), vFresnel * vFresnel);

  diffuseColor.rgb *= vInstanceColor * edgeShift;
  totalEmissiveRadiance += vInstanceColor * glow * (0.6 + 0.4 * vFresnel);
`;

// ── GLB mode (preserve baked textures, additive glow only) ────────────────────

export const GLB_CRYSTAL_VERTEX_PARS = /* glsl */ `
  attribute float aGlowIntensity;
  attribute float aGlowPhase;

  varying float vGlowIntensity;
  varying float vGlowPhase;
  varying float vFresnel;
`;

export const GLB_CRYSTAL_VERTEX_MAIN = /* glsl */ `
  vGlowIntensity  = aGlowIntensity;
  vGlowPhase      = aGlowPhase;

  vec3 wN = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vec3 vD = normalize(cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz);
  vFresnel = 1.0 - abs(dot(wN, vD));
`;

export const GLB_CRYSTAL_FRAGMENT_PARS = /* glsl */ `
  uniform float uCrystalTime;

  varying float vGlowIntensity;
  varying float vGlowPhase;
  varying float vFresnel;
`;

export const GLB_CRYSTAL_FRAGMENT_EMISSIVE = /* glsl */ `
  float glbPulse = 0.55 + 0.45 * sin(uCrystalTime * 1.8 + vGlowPhase);
  float glbGlow  = vGlowIntensity * glbPulse;

  // Glow in the crystal's own baked color — each model glows its natural hue
  totalEmissiveRadiance += diffuseColor.rgb * glbGlow * (0.5 + 0.5 * vFresnel);
`;
