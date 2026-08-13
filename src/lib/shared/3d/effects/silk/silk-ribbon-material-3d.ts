import { DoubleSide, NormalBlending, ShaderMaterial } from "three";

const vertexShader = /* glsl */ `
  attribute vec3 bodyColor;
  attribute vec3 edgeColor;
  attribute vec3 ribbonTangent;
  attribute float alpha;
  attribute float ribbonEdge;
  attribute float progress;
  attribute float emissive;
  attribute float sheen;
  attribute float roughness;
  attribute float translucency;
  attribute float weaveFrequency;

  varying vec3 vBodyColor;
  varying vec3 vEdgeColor;
  varying vec3 vViewNormal;
  varying vec3 vViewTangent;
  varying vec3 vViewDirection;
  varying float vAlpha;
  varying float vRibbonEdge;
  varying float vProgress;
  varying float vEmissive;
  varying float vSheen;
  varying float vRoughness;
  varying float vTranslucency;
  varying float vWeaveFrequency;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vBodyColor = bodyColor;
    vEdgeColor = edgeColor;
    vViewNormal = normalize(normalMatrix * normal);
    vViewTangent = normalize(normalMatrix * ribbonTangent);
    vViewDirection = normalize(-viewPosition.xyz);
    vAlpha = alpha;
    vRibbonEdge = ribbonEdge;
    vProgress = progress;
    vEmissive = emissive;
    vSheen = sheen;
    vRoughness = roughness;
    vTranslucency = translucency;
    vWeaveFrequency = weaveFrequency;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vBodyColor;
  varying vec3 vEdgeColor;
  varying vec3 vViewNormal;
  varying vec3 vViewTangent;
  varying vec3 vViewDirection;
  varying float vAlpha;
  varying float vRibbonEdge;
  varying float vProgress;
  varying float vEmissive;
  varying float vSheen;
  varying float vRoughness;
  varying float vTranslucency;
  varying float vWeaveFrequency;

  const float PI = 3.141592653589793;

  void main() {
    vec3 normal = normalize(vViewNormal);
    vec3 tangent = normalize(vViewTangent);
    vec3 viewDirection = normalize(vViewDirection);
    vec3 keyDirection = normalize(vec3(-0.42, 0.58, 0.70));
    vec3 halfDirection = normalize(keyDirection + viewDirection);

    float across = abs(vRibbonEdge);
    float selvedge = smoothstep(0.72, 0.99, across);
    float facing = abs(dot(normal, viewDirection));
    float keyLight = 0.72 + 0.72 * abs(dot(normal, keyDirection));
    float grazing = pow(1.0 - facing, mix(1.25, 2.7, vRoughness));

    // Cloth highlights stretch across the yarn instead of forming a plastic
    // point highlight. The tangent term gives every fold a readable direction.
    float tangentHalf = clamp(abs(dot(tangent, halfDirection)), 0.0, 1.0);
    float anisotropic = pow(
      max(0.0, 1.0 - tangentHalf * tangentHalf),
      mix(7.0, 24.0, 1.0 - vRoughness)
    );

    float warp = 0.5 + 0.5 * sin(vProgress * vWeaveFrequency * PI * 2.0);
    float weft = 0.5 + 0.5 * sin(vRibbonEdge * 18.0 * PI + vProgress * 7.0);
    float weaveBreakup = mix(0.86, 1.12, warp * weft);
    vec3 fabricColor = mix(vBodyColor, vEdgeColor, selvedge * 0.82);

    float sheenLobe = vSheen * (anisotropic * 0.74 + grazing * 0.38);
    float transmission = vTranslucency * pow(1.0 - facing, 1.5);
    vec3 finalColor = fabricColor * keyLight * weaveBreakup;
    finalColor += vEdgeColor * sheenLobe * 0.82;
    finalColor += mix(vBodyColor, vEdgeColor, 0.5) * transmission * 0.45;
    finalColor *= 1.0 + vEmissive * 0.72;

    // The edge remains legible without rendering the entire surface a second
    // time. This keeps two rigs from accumulating into one white sheet.
    float coverage = 0.68 + facing * 0.18 + selvedge * 0.1;
    coverage += sheenLobe * 0.08 + transmission * 0.07;
    float finalAlpha = vAlpha * min(0.92, coverage) * (1.0 - vTranslucency * 0.25);
    if (finalAlpha < 0.004) discard;
    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export function createSilkRibbonMaterial3D(): ShaderMaterial {
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    blending: NormalBlending,
  });
  material.forceSinglePass = true;
  return material;
}
